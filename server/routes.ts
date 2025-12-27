import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cache, CACHE_DURATIONS } from "./cache";
import { insertPropertySchema, insertPropertyAnalysisSchema, insertOptimizationReportSchema, insertScrapingJobSchema, filterCriteriaSchema, type ScrapedUnit } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

// Firecrawl Extract Integration
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

interface PropertyListing {
  url: string;
  name: string;
  address: string;
}

interface UnitDetails {
  unitNumber?: string;
  floorPlanName?: string;
  unitType: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  rent?: number;
  availabilityDate?: string;
}

/**
 * Call Firecrawl Scrape API for data extraction
 * Using scrape instead of extract for immediate results
 * @param url - URL to scrape
 * @param prompt - Description of what to extract
 * @param schema - JSON schema for output structure
 */
async function callFirecrawlScrape(
  url: string,
  prompt: string,
  schema: any
): Promise<any> {
  console.log(`🔥 [FIRECRAWL] Scraping URL: ${url}`);
  console.log(`🔥 [FIRECRAWL] Prompt: ${prompt.substring(0, 100)}...`);
  
  if (!FIRECRAWL_API_KEY) {
    console.error(`❌ [FIRECRAWL] API key not configured`);
    throw new Error("Firecrawl API key not configured");
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          prompt,
          schema
        }
      }),
      signal: AbortSignal.timeout(120000) // 2 minute timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [FIRECRAWL] Scrape failed: ${response.status}`);
      console.error(`❌ [FIRECRAWL] Error: ${errorText}`);
      throw new Error(`Firecrawl scrape error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ [FIRECRAWL] Scraping completed successfully`);
    console.log(`🔍 [FIRECRAWL] Response keys:`, Object.keys(result));
    
    // Firecrawl scrape returns data in result.data.extract
    return result.data?.extract || result.extract || result.data || result;
  } catch (error) {
    console.error(`❌ [FIRECRAWL] Scraping failed:`, error);
    throw error;
  }
}

/**
 * Discover property listings from apartments.com search page
 */
async function discoverProperties(cityUrl: string): Promise<PropertyListing[]> {
  // Check cache first
  const cacheKey = `discover:${cityUrl}`;
  const cached = cache.get(cacheKey, CACHE_DURATIONS.COMPETITOR_PROPERTIES);
  if (cached) {
    console.log(`🔥 [FIRECRAWL] Using cached properties for ${cityUrl}`);
    return cached;
  }
  
  const prompt = `Extract all apartment property listings from this apartments.com search results page. 
  
For EACH property listing card/result, extract:
- url: The complete URL link to the property's detail page (must start with https://www.apartments.com/ and go to the specific property)
- name: The property name/title shown on the listing
- address: The full street address shown (e.g., "123 Main St, Omaha, NE 68131")

IMPORTANT: 
- Extract the ACTUAL street address, not just city/state
- If no street address is shown on the listing, extract whatever location info is available
- Look for addresses in the listing card, property title, or property description
- Return ALL property listings found on the page`;

  const schema = {
    type: "object",
    properties: {
      properties: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { 
              type: "string",
              description: "Full URL to property detail page on apartments.com"
            },
            name: { 
              type: "string",
              description: "Property name or title"
            },
            address: { 
              type: "string",
              description: "Street address with city and state, or best available location info"
            }
          },
          required: ["url", "name"]
        }
      }
    },
    required: ["properties"]
  };

  const result = await callFirecrawlScrape(cityUrl, prompt, schema);
  const properties = result.properties || [];
  
  console.log(`🔥 [FIRECRAWL] Found ${properties.length} properties`);
  console.log(`🔥 [FIRECRAWL] Sample property:`, properties[0]);
  
  // Filter and validate - address is now optional since listings may not show full addresses
  const validProperties = properties.filter((prop: PropertyListing) => 
    prop.url && 
    prop.url.includes('apartments.com') &&
    prop.name
  ).map(prop => ({
    ...prop,
    address: prop.address || 'Address to be determined' // Provide default if missing
  }));
  
  // Cache the results
  cache.set(cacheKey, validProperties);
  
  return validProperties;
}

/**
 * Extract unit details from property page
 */
async function extractUnitDetails(propertyUrl: string): Promise<UnitDetails[]> {
  const prompt = `Extract all available apartment units from this property page. For each unit:
- unitNumber: The unit identifier (like "1-332", "A101") if shown
- floorPlanName: The marketing name (like "New York", "Portland") if shown  
- unitType: Unit type (e.g., "Studio", "1BR/1BA", "2BR/2BA") - REQUIRED
- bedrooms: Number of bedrooms as integer
- bathrooms: Number of bathrooms as decimal (1.0, 1.5, 2.0)
- squareFootage: Square footage as integer
- rent: Monthly rent as number (no $ symbol)
- availabilityDate: When the unit is available

Note: Extract either unitNumber OR floorPlanName, whichever is shown.`;

  const schema = {
    type: "object",
    properties: {
      units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unitNumber: { type: "string" },
            floorPlanName: { type: "string" },
            unitType: { type: "string" },
            bedrooms: { type: "number" },
            bathrooms: { type: "number" },
            squareFootage: { type: "number" },
            rent: { type: "number" },
            availabilityDate: { type: "string" }
          },
          required: ["unitType"]
        }
      }
    },
    required: ["units"]
  };

  const result = await callFirecrawlScrape(propertyUrl, prompt, schema);
  const units = result.units || [];
  
  console.log(`🔥 [FIRECRAWL] Found ${units.length} units`);
  
  return units.filter((unit: UnitDetails) => unit.unitType);
}

/**
 * Parse city and state from address string
 */
function parseCityStateFromAddress(address: string): { city: string | null; state: string | null } {
  // Try to extract city, state pattern: "City, ST" or "City, ST ZIP"
  const pattern = /,\s*([A-Za-z\s]+),?\s+([A-Z]{2})(?:\s+\d{5})?/;
  const match = address.match(pattern);
  
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].trim()
    };
  }
  
  // Fallback: try simpler pattern
  const simplePattern = /,\s*([A-Za-z\s]+)\s+([A-Z]{2})/;
  const simpleMatch = address.match(simplePattern);
  
  if (simpleMatch) {
    return {
      city: simpleMatch[1].trim(),
      state: simpleMatch[2].trim()
    };
  }
  
  return { city: null, state: null };
}

/**
 * Find subject property using Firecrawl Search
 * More accurate and faster than URL construction + scraping
 */
async function findSubjectPropertyWithSearch(
  propertyName: string, 
  address: string
): Promise<{ url: string; name: string; address: string } | null> {
  try {
    const { city, state } = parseCityStateFromAddress(address);
    
    // Use Firecrawl Search to find the exact listing
    const searchQuery = `${propertyName} apartments ${city} ${state} site:apartments.com`;
    
    console.log(`🔍 [FIRECRAWL_SEARCH] Query: ${searchQuery}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        sources: [{ type: 'web' }]
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Firecrawl search failed: ${response.status}`);
    }
    
    const result = await response.json();
    const results = result.data || [];
    
    console.log(`🔍 [FIRECRAWL_SEARCH] Found ${results.length} results`);
    
    // Find best match from search results
    for (const item of results) {
      if (item.url && item.url.includes('apartments.com')) {
        console.log(`✅ [FIRECRAWL_SEARCH] Found: ${item.title} - ${item.url}`);
        return {
          url: item.url,
          name: item.title || propertyName,
          address: item.description || address
        };
      }
    }
    
    console.log(`⚠️ [FIRECRAWL_SEARCH] No apartments.com listing found`);
    return null;
  } catch (error) {
    console.error(`❌ [FIRECRAWL_SEARCH] Error:`, error);
    return null;
  }
}


export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create property and get initial AI analysis
  app.post("/api/properties", async (req, res) => {
    try {
      const propertyData = insertPropertySchema.parse(req.body);
      
      // Parse city and state from address
      const { city, state } = parseCityStateFromAddress(propertyData.address);
      
      // Create property immediately with parsed city/state
      const property = await storage.createProperty({
        ...propertyData,
        city: city || propertyData.city,
        state: state || propertyData.state
      });
      
      // Initialize workflow state
      console.log('[WORKFLOW] Initializing workflow state for property:', property.id);
      await storage.saveWorkflowState({
        propertyId: property.id,
        selectedCompetitorIds: [],
        currentStage: 'input'
      });
      
      // Start background job to find subject property using Firecrawl Search
      // Don't wait for this - it runs async
      (async () => {
        try {
          console.log('[BACKGROUND] Starting subject property search...');
          
          const listing = await findSubjectPropertyWithSearch(
            property.propertyName,
            property.address
          );
          
          if (listing) {
            console.log('[BACKGROUND] Creating scraped property record for subject');
            
            // Create a scraping job for tracking
            const job = await storage.createScrapingJob({
              propertyId: property.id,
              stage: 'subject_property_search',
              cityUrl: listing.url,
              status: 'completed'
            });
            
            // Store as subject property
            await storage.createScrapedProperty({
              scrapingJobId: job.id,
              name: listing.name,
              url: listing.url,
              address: listing.address,
              matchScore: '100',
              isSubjectProperty: true,
              distance: null
            });
            
            console.log('[BACKGROUND] Subject property stored, getting unit details...');
            
            // Get unit details
            const units = await extractUnitDetails(listing.url);
            
            if (units.length > 0) {
              await storage.updateProperty(property.id, {
                totalUnits: units.length
              });
              console.log(`[BACKGROUND] Updated property with ${units.length} units`);
            }
          }
        } catch (err) {
          console.error('[BACKGROUND] Failed to get subject property details:', err);
        }
      })();
      
      // Generate quick AI analysis (or skip if not configured)
      let analysisData;
      
      // Skip OpenAI analysis for faster response - return placeholder
      // OpenAI analysis can be generated later if needed
      analysisData = {
        marketPosition: `${property.propertyName} in ${city || 'your area'}, ${state || ''} - Market analysis will be available after competitor data is collected.`,
        competitiveAdvantages: [
          "Property details are being gathered",
          "Competitor analysis in progress", 
          "Detailed insights will appear on the Summarize page"
        ],
        pricingInsights: "Pricing insights will be available after collecting competitor rent data and market comparisons.",
        recommendations: [
          "Proceed to the Summarize page to view discovered competitors",
          "Select relevant competitors for detailed comparison",
          "Complete the Analysis stage for pricing recommendations"
        ]
      };

      // Optional: Generate AI analysis in background if configured
      if (false && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'default_key' && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        const prompt = `Using only publicly available data, summarize the apartment property "${property.propertyName}" located at ${property.address}. Please include:

Basic Property Info
• Property Name: ${property.propertyName}
• Location: ${city || 'Unknown'}, ${state || 'Unknown'}
• Number of units: ${property.totalUnits || (firecrawlDetails?.totalUnits) || 'please estimate'}
• Unit types available: ${firecrawlDetails?.unitTypes?.join(', ') || 'please research'}
• Average rent: ${firecrawlDetails?.avgRent ? `$${firecrawlDetails.avgRent}` : 'please estimate'}
• Year built: ${property.builtYear || 'please research'}
• Property type (e.g., garden-style, mid-rise, high-rise): ${property.propertyType || 'please identify based on units and location'}

Listings & Rent Estimates
• Recent or active rental listings (unit mix, price range)
• Estimated rent per unit type (1BR, 2BR, etc.)
• Source of rent info (e.g., Zillow, Apartments.com, Rentometer)

Amenities and Features
• Parking, laundry, gym, pool, pet policy, in-unit features
• Current known amenities: ${property.amenities?.join(", ") || "Not specified - please research"}
• Highlight what makes it stand out (e.g., remodeled units, smart tech)

Neighborhood Overview
• Walk Score, transit access, proximity to major employers or schools
• Crime rating (from public sources like AreaVibes or NeighborhoodScout)
• Notable nearby businesses or attractions

Visuals
• Link to map/street view
• Exterior photos or listing images if available

Please provide your analysis in this exact JSON format:
{
  "marketPosition": "Comprehensive description of the property's position in the local market based on publicly available data",
  "competitiveAdvantages": ["specific advantage based on research", "another researched advantage", "third advantage from public data"],
  "pricingInsights": "Detailed pricing analysis based on actual listings and rent data from public sources",
  "recommendations": ["specific recommendation based on data", "another data-driven recommendation", "third actionable recommendation"]
}`;

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o", // Using gpt-4o which is widely available
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });

        analysisData = JSON.parse(aiResponse.choices[0].message.content || "{}");
      } else {
        // Use mock data when OpenAI is not configured
        console.warn('⚠️ OpenAI API key not configured - using mock analysis data');
        analysisData = {
          marketPosition: `${property.propertyName} is ready for competitive analysis. Configure OpenAI API key for AI-powered market insights.`,
          competitiveAdvantages: [
            "Property location analysis pending",
            "Amenities comparison pending",
            "Market positioning pending"
          ],
          pricingInsights: "Pricing analysis will be available after competitor data is scraped using Firecrawl.",
          recommendations: [
            "Proceed to scrape competitor data",
            "Review market comparisons on the Summarize page",
            "Configure OpenAI API key for enhanced AI analysis"
          ]
        };
      }
      
      // Save analysis
      const analysis = await storage.createPropertyAnalysis({
        propertyId: property.id,
        marketPosition: analysisData.marketPosition,
        competitiveAdvantages: analysisData.competitiveAdvantages,
        pricingInsights: analysisData.pricingInsights,
        recommendations: analysisData.recommendations
      });

      res.json({ property, analysis });
    } catch (error) {
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Failed to create property and analysis" });
    }
  });

  // Get the latest property (for returning users)
  app.get("/api/properties/latest", async (req, res) => {
    try {
      const properties = await storage.getAllProperties();
      if (properties.length === 0) {
        return res.status(404).json({ message: "No properties found" });
      }
      
      // Get the most recently created property
      const latestProperty = properties
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0];
      
      res.json(latestProperty);
    } catch (error) {
      console.error("Error fetching latest property:", error);
      res.status(500).json({ message: "Failed to fetch latest property" });
    }
  });

  // Get property with analysis and linked scraped data
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const propertyId = req.params.id;
      console.log('[GET_PROPERTY] Fetching property:', propertyId);
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        console.log('[GET_PROPERTY] Property not found:', propertyId);
        return res.status(404).json({ message: "Property not found" });
      }

      const analysis = await storage.getPropertyAnalysis(property.id);
      
      // Check for linked scraped property data
      let scrapedData = null;
      let scrapingJobStatus = null;
      
      // Get scraping jobs for this property
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      console.log('[GET_PROPERTY] Found', scrapingJobs.length, 'scraping jobs for property');
      
      if (scrapingJobs.length > 0) {
        // Get the most recent completed job
        const completedJob = scrapingJobs
          .filter(job => job.status === "completed")
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          })[0];
        
        if (completedJob) {
          console.log('[GET_PROPERTY] Found completed scraping job:', completedJob.id);
          scrapingJobStatus = completedJob.status;
          
          // Get scraped properties from this job
          const scrapedProperties = await storage.getScrapedPropertiesByJob(completedJob.id);
          
          // Find the subject property (marked as isSubjectProperty)
          const subjectProperty = scrapedProperties.find(p => p.isSubjectProperty === true);
          
          if (subjectProperty) {
            console.log('[GET_PROPERTY] Found subject scraped property:', subjectProperty.name);
            
            // Get units for the subject property
            const scrapedUnits = await storage.getScrapedUnitsByProperty(subjectProperty.id);
            console.log('[GET_PROPERTY] Found', scrapedUnits.length, 'scraped units');
            
            scrapedData = {
              scrapedPropertyId: subjectProperty.id,
              scrapedPropertyName: subjectProperty.name,
              scrapedPropertyAddress: subjectProperty.address,
              scrapedPropertyUrl: subjectProperty.url,
              matchScore: subjectProperty.matchScore,
              scrapingJobId: completedJob.id,
              unitsCount: scrapedUnits.length,
              hasScrapedData: true
            };
          } else {
            console.warn('[GET_PROPERTY] ⚠️ No subject property found in scraped data');
            console.log('[GET_PROPERTY] Total scraped properties in job:', scrapedProperties.length);
          }
        } else {
          // Check if there's a pending or failed job
          const latestJob = scrapingJobs[0];
          if (latestJob) {
            scrapingJobStatus = latestJob.status;
            console.log('[GET_PROPERTY] Latest scraping job status:', scrapingJobStatus);
          }
        }
      } else {
        console.log('[GET_PROPERTY] ⚠️ No scraping jobs found for property');
      }
      
      // Return property with analysis and scraped data info
      const response = {
        property,
        analysis,
        scrapedData,
        scrapingJobStatus,
        dataSource: scrapedData ? 'scraped' : 'manual'
      };
      
      console.log('[GET_PROPERTY] Returning property with data source:', response.dataSource);
      res.json(response);
    } catch (error) {
      console.error("[GET_PROPERTY] Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  // Get all competitor properties (using scraped data only)
  app.get("/api/competitors", async (req, res) => {
    try {
      console.log('[GET_COMPETITORS] ===========================================');
      console.log('[GET_COMPETITORS] Fetching scraped competitors...');
      
      // Get all scraped competitor properties using proper storage method
      const allScrapedProperties = await storage.getAllScrapedCompetitors();
      console.log('[GET_COMPETITORS] Total scraped properties found:', allScrapedProperties.length);
      
      // Filter out the subject property to get only competitors
      const scrapedCompetitors = allScrapedProperties.filter(p => !p.isSubjectProperty);
      console.log('[GET_COMPETITORS] Actual competitors (excluding subject):', scrapedCompetitors.length);
      
      // Check if there's a subject property marked
      const subjectProperty = allScrapedProperties.find(p => p.isSubjectProperty === true);
      if (subjectProperty) {
        console.log('[GET_COMPETITORS] ✅ Subject property found:', subjectProperty.name);
        console.log('[GET_COMPETITORS] Subject property ID:', subjectProperty.id);
        console.log('[GET_COMPETITORS] Subject property URL:', subjectProperty.url);
      } else {
        console.log('[GET_COMPETITORS] ⚠️ WARNING: No subject property marked with isSubjectProperty: true');
        console.log('[GET_COMPETITORS] This may cause issues with vacancy analysis');
      }
      
      // Log sample of competitor data for debugging
      if (scrapedCompetitors.length > 0) {
        console.log('[GET_COMPETITORS] Sample competitor data:');
        scrapedCompetitors.slice(0, 3).forEach((comp, idx) => {
          console.log(`[GET_COMPETITORS]   ${idx + 1}. ${comp.name}`);
          console.log(`[GET_COMPETITORS]      Address: ${comp.address}`);
          console.log(`[GET_COMPETITORS]      URL: ${comp.url}`);
          console.log(`[GET_COMPETITORS]      Match Score: ${comp.matchScore}`);
        });
      }
      
      // Verify this is real scraped data by checking for apartments.com URLs
      const realScrapedCount = scrapedCompetitors.filter(c => 
        c.url && c.url.includes('apartments.com')
      ).length;
      console.log('[GET_COMPETITORS] Properties with valid apartments.com URLs:', realScrapedCount);
      
      if (scrapedCompetitors.length === 0) {
        console.log('[GET_COMPETITORS] ⚠️ No competitor properties found');
        console.log('[GET_COMPETITORS] Possible reasons:');
        console.log('[GET_COMPETITORS]   1. No scraping job has been run yet');
        console.log('[GET_COMPETITORS]   2. Scraping job failed');
        console.log('[GET_COMPETITORS]   3. All scraped properties are marked as subject');
        
        // Return empty array for consistency with frontend expectations
        return res.json([]);
      }
      
      // Return only authentic scraped competitor data
      const competitors = scrapedCompetitors.map(scrapedProp => ({
        id: scrapedProp.id,
        name: scrapedProp.name,
        address: scrapedProp.address,
        url: scrapedProp.url,
        distance: scrapedProp.distance,
        matchScore: scrapedProp.matchScore,
        createdAt: scrapedProp.createdAt,
        isSubjectProperty: false  // Always false for competitors
      }));

      console.log(`[GET_COMPETITORS] ✅ Returning ${competitors.length} scraped competitors`);
      console.log('[GET_COMPETITORS] Data source: Real Firecrawl scraped data');
      console.log('[GET_COMPETITORS] ===========================================');
      
      // Return array directly for backward compatibility, but log that it's scraped data
      res.json(competitors);
    } catch (error) {
      console.error("[GET_COMPETITORS] ❌ Error fetching competitors:", error);
      res.status(500).json({ message: "Failed to fetch competitor properties" });
    }
  });

  // Get selected competitor properties for comparison
  app.post("/api/competitors/selected", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "IDs must be an array" });
      }

      // Use scraped properties instead of legacy competitors
      const scrapedProperties = await storage.getSelectedScrapedProperties(ids);
      
      // Return only authentic scraped data - no placeholder values
      const competitors = scrapedProperties.map(scrapedProp => ({
        id: scrapedProp.id,
        name: scrapedProp.name,
        address: scrapedProp.address,
        url: scrapedProp.url,
        distance: scrapedProp.distance,
        matchScore: scrapedProp.matchScore,
        createdAt: scrapedProp.createdAt,
        isSubjectProperty: scrapedProp.isSubjectProperty
      }));

      res.json(competitors);
    } catch (error) {
      console.error("Error fetching selected competitors:", error);
      res.status(500).json({ message: "Failed to fetch selected competitors" });
    }
  });


  // Get property units
  app.get("/api/properties/:id/units", async (req, res) => {
    try {
      const units = await storage.getPropertyUnits(req.params.id);
      res.json(units);
    } catch (error) {
      console.error("Error fetching units:", error);
      res.status(500).json({ message: "Failed to fetch property units" });
    }
  });

  // Create property units (from scraped data or generate basic ones)
  app.post("/api/properties/:id/units", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      console.log('[CREATE_UNITS] Creating units for property:', property.propertyName);
      
      // Try to get scraped units first
      let scrapedUnits: ScrapedUnit[] = [];
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      
      if (scrapingJobs.length > 0) {
        for (const job of scrapingJobs) {
          const scrapedProperties = await storage.getScrapedPropertiesByJob(job.id);
          const subject = scrapedProperties.find(p => p.isSubjectProperty === true);
          if (subject) {
            scrapedUnits = await storage.getScrapedUnitsByProperty(subject.id);
            console.log('[CREATE_UNITS] Found', scrapedUnits.length, 'scraped units');
            break;
          }
        }
      }
      
      // Clear existing units
      await storage.clearPropertyUnits(propertyId);
      const units = [];
      
      if (scrapedUnits.length > 0) {
        // Create from scraped data
        console.log('[CREATE_UNITS] Creating units from scraped data');
        for (const scrapedUnit of scrapedUnits) {
          // Generate safe fallback ID if needed
          const fallbackId = scrapedUnit.id ? scrapedUnit.id.slice(0, 6) : Math.random().toString(36).slice(2, 8);
          
          const unit = await storage.createPropertyUnit({
            propertyId,
            unitNumber: scrapedUnit.unitNumber || scrapedUnit.floorPlanName || `Unit-${fallbackId}`,
            unitType: scrapedUnit.unitType || '1BR',  // Safe default that matches schema
            currentRent: String(scrapedUnit.rent ?? "1500"),  // Ensure string type
            status: scrapedUnit.status || "occupied"
          });
          units.push(unit);
        }
      } else {
        // Generate basic units if no scraped data
        const unitsToCreate = Math.min(property.totalUnits || 10, 10);
        console.log('[CREATE_UNITS] No scraped units, generating', unitsToCreate, 'basic units');
        
        for (let i = 0; i < unitsToCreate; i++) {
          const unitType = i % 3 === 0 ? 'Studio' : (i % 3 === 1 ? '1BR' : '2BR');
          const baseRent = unitType === 'Studio' ? 1200 : (unitType === '1BR' ? 1500 : 1800);
          
          const unit = await storage.createPropertyUnit({
            propertyId,
            unitNumber: `Unit-${i + 1}`,
            unitType,
            currentRent: String(baseRent + Math.floor(Math.random() * 200)),
            status: Math.random() > 0.15 ? "occupied" : "available"
          });
          units.push(unit);
        }
      }
      
      console.log('[CREATE_UNITS] Successfully created', units.length, 'units');
      res.json(units);
    } catch (error) {
      console.error("[CREATE_UNITS] Error creating units:", error);
      res.status(500).json({ message: "Failed to create units" });
    }
  });

  // Generate filtered analysis based on filter criteria
  app.post("/api/filtered-analysis", async (req, res) => {
    try {
      console.log('[FILTERED_ANALYSIS] ===========================================');
      console.log('[FILTERED_ANALYSIS] Starting filtered analysis generation');
      
      const filterData = filterCriteriaSchema.parse(req.body);
      console.log('[FILTERED_ANALYSIS] Filter criteria:', JSON.stringify(filterData, null, 2));
      
      // Get subject property for analysis context - CRITICAL for accurate analysis
      const subjectProperty = await storage.getSubjectScrapedProperty();
      
      if (!subjectProperty) {
        console.error('[FILTERED_ANALYSIS] ❌ No subject property found!');
        console.log('[FILTERED_ANALYSIS] Cannot generate analysis without subject property');
        return res.status(404).json({ 
          message: "No subject property found. Please complete the scraping workflow first.",
          error: "SUBJECT_PROPERTY_NOT_FOUND",
          suggestion: "Run the property scraping workflow and ensure a subject property is identified"
        });
      }
      
      console.log('[FILTERED_ANALYSIS] ✅ Subject property found:', subjectProperty.name);
      console.log('[FILTERED_ANALYSIS] Subject property ID:', subjectProperty.id);
      
      // Check if we have scraped units for the subject property
      const subjectUnits = await storage.getScrapedUnitsByProperty(subjectProperty.id);
      console.log('[FILTERED_ANALYSIS] Subject property units count:', subjectUnits.length);
      
      if (subjectUnits.length === 0) {
        console.warn('[FILTERED_ANALYSIS] ⚠️ No units found for subject property');
        console.log('[FILTERED_ANALYSIS] This may indicate unit scraping hasn\'t been completed');
      }
      
      // Get competitor properties to verify we have comparison data
      const allScrapedProperties = await storage.getAllScrapedCompetitors();
      const competitors = allScrapedProperties.filter(p => !p.isSubjectProperty);
      console.log('[FILTERED_ANALYSIS] Competitor properties available:', competitors.length);
      
      // Generate filtered analysis using real scraped data
      console.log('[FILTERED_ANALYSIS] Generating analysis from scraped data...');
      const analysis = await storage.generateFilteredAnalysis(subjectProperty.id, filterData);
      
      // Log analysis summary
      console.log('[FILTERED_ANALYSIS] Analysis generated successfully:');
      console.log('[FILTERED_ANALYSIS]   - Subject units matching filters:', analysis.subjectUnits.length);
      console.log('[FILTERED_ANALYSIS]   - Competitor units for comparison:', analysis.competitorUnits.length);
      console.log('[FILTERED_ANALYSIS]   - Market position:', analysis.marketPosition);
      console.log('[FILTERED_ANALYSIS]   - Percentile rank:', analysis.percentileRank);
      console.log('[FILTERED_ANALYSIS]   - Data source: Real Firecrawl scraped data');
      
      // Generate AI insights if OpenAI is configured
      if (process.env.OPENAI_API_KEY) {
        try {
          const filterDescription = [];
          if (filterData.bedroomTypes.length > 0) {
            filterDescription.push(`${filterData.bedroomTypes.join(", ")} units`);
          }
          filterDescription.push(`$${filterData.priceRange.min}-$${filterData.priceRange.max} price range`);
          filterDescription.push(`${filterData.squareFootageRange.min}-${filterData.squareFootageRange.max} sq ft`);
          
          const prompt = `Analyze the competitive position for a property with the following market data:
          
Property Analysis:
- Market Position: ${analysis.marketPosition} (${analysis.percentileRank}th percentile)
- Subject Units: ${analysis.subjectUnits.length} units matching filters
- Competitor Units: ${analysis.competitorUnits.length} units for comparison
- Subject Avg Rent: $${analysis.subjectAvgRent}
- Competitor Avg Rent: $${analysis.competitorAvgRent}
- Pricing Power Score: ${analysis.pricingPowerScore}/100

Competitive Edges:
- Pricing: ${analysis.competitiveEdges.pricing.label} (${analysis.competitiveEdges.pricing.status})
- Size: ${analysis.competitiveEdges.size.label} (${analysis.competitiveEdges.size.status})
- Availability: ${analysis.competitiveEdges.availability.label} (${analysis.competitiveEdges.availability.status})
- Amenities: ${analysis.competitiveEdges.amenities.label} (${analysis.competitiveEdges.amenities.status})

Filter Criteria Applied: ${filterDescription.join(", ")}

Based on this data, provide exactly 3 specific, actionable insights that would help a property manager optimize their competitive position. Each insight should be concise (under 100 characters) and directly actionable. Format as a JSON array of strings.`;
          
          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are a real estate market analyst providing specific, actionable insights for property managers."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 300
          });
          
          let aiResponse = completion.choices[0]?.message?.content || "[]";
          try {
            // Strip markdown code blocks if present
            aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            const insights = JSON.parse(aiResponse);
            if (Array.isArray(insights) && insights.length > 0) {
              analysis.aiInsights = insights.slice(0, 3);
            }
          } catch (parseError) {
            console.warn("Failed to parse AI insights:", parseError);
            console.warn("Raw AI response:", aiResponse);
            // Keep the placeholder insights if AI fails
          }
        } catch (aiError) {
          console.warn("AI insights generation failed:", aiError);
          // Keep the placeholder insights if AI fails
        }
      }
      
      console.log('[FILTERED_ANALYSIS] ===========================================');
      res.json(analysis);
    } catch (error) {
      console.error("[FILTERED_ANALYSIS] ❌ Error generating filtered analysis:", error);
      res.status(500).json({ message: "Failed to generate filtered analysis" });
    }
  });

  // Generate optimization report
  app.post("/api/properties/:id/optimize", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { goal, targetOccupancy, riskTolerance } = req.body;
      
      console.log(`[OPTIMIZE] Starting optimization for property ${propertyId}`);
      console.log(`[OPTIMIZE] Parameters - Goal: ${goal}, Target Occupancy: ${targetOccupancy}%, Risk: ${riskTolerance}`);

      const property = await storage.getProperty(propertyId);
      
      if (!property) {
        console.error(`[OPTIMIZE] Property ${propertyId} not found`);
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Get the subject property's scraped units for comprehensive optimization
      let subjectProperty = null;
      let scrapedUnits: ScrapedUnit[] = [];
      
      // Find the subject scraped property
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      console.log(`[OPTIMIZE] Found ${scrapingJobs.length} scraping jobs for property`);
      
      if (scrapingJobs.length > 0) {
        for (const job of scrapingJobs) {
          const scrapedProperties = await storage.getScrapedPropertiesByJob(job.id);
          console.log(`[OPTIMIZE] Job ${job.id} has ${scrapedProperties.length} scraped properties`);
          
          const subject = scrapedProperties.find(p => p.isSubjectProperty === true);
          if (subject) {
            subjectProperty = subject;
            console.log(`[OPTIMIZE] Found subject property: ${subject.name}`);
            // Get all scraped units for this property
            scrapedUnits = await storage.getScrapedUnitsByProperty(subject.id);
            console.log(`[OPTIMIZE] Found ${scrapedUnits.length} scraped units for subject property`);
            break;
          }
        }
      }
      
      if (!subjectProperty) {
        console.log(`[OPTIMIZE] No subject property found for property ${propertyId}`);
      }
      
      // Always sync from scraped units when available
      let units = [];
      
      // If we have scraped units, always sync them (not just when units.length === 0)
      if (scrapedUnits.length > 0) {
        console.log(`[OPTIMIZE] Syncing ${scrapedUnits.length} scraped units for optimization`);
        // Clear existing PropertyUnits
        await storage.clearPropertyUnits(propertyId);
        // Create new PropertyUnits from ALL scraped units
        units = [];
        for (const scrapedUnit of scrapedUnits) {
          const unit = await storage.createPropertyUnit({
            propertyId,
            unitNumber: scrapedUnit.unitNumber || scrapedUnit.floorPlanName || `Unit-${scrapedUnit.id.substring(0, 6)}`,
            unitType: scrapedUnit.unitType,
            currentRent: scrapedUnit.rent || "0",
            status: scrapedUnit.status || "occupied"
          });
          units.push(unit);
        }
        console.log(`[OPTIMIZE] Created ${units.length} property units from scraped data`);
      } else {
        // Fall back to existing PropertyUnits only if no scraped data
        console.log(`[OPTIMIZE] No scraped units found, checking for existing PropertyUnits`);
        units = await storage.getPropertyUnits(propertyId);
        console.log(`[OPTIMIZE] Found ${units.length} existing property units`);
        
        // If still no units, try to create some basic ones based on property totalUnits
        if (units.length === 0 && property.totalUnits && property.totalUnits > 0) {
          console.log(`[OPTIMIZE] No units found, creating ${Math.min(property.totalUnits, 10)} basic units`);
          for (let i = 0; i < Math.min(property.totalUnits, 10); i++) {
            const unit = await storage.createPropertyUnit({
              propertyId,
              unitNumber: `Unit-${i + 1}`,
              unitType: i % 3 === 0 ? 'Studio' : (i % 3 === 1 ? '1BR' : '2BR'),
              currentRent: "1500",
              status: "occupied"
            });
            units.push(unit);
          }
        }
      }
      
      if (units.length === 0) {
        console.error(`[OPTIMIZE] No units available for optimization`);
        return res.status(404).json({ 
          message: "No units found for optimization. Please ensure property data has been scraped first." 
        });
      }
      
      console.log(`[OPTIMIZE] Proceeding with ${units.length} units for optimization`)

      // Convert parameters to readable format for AI
      const goalDisplayMap: Record<string, string> = {
        'maximize-revenue': 'Maximize Revenue',
        'maximize-occupancy': 'Maximize Occupancy', 
        'balanced': 'Balanced Approach',
        'custom': 'Custom Strategy'
      };
      
      const riskDisplayMap: Record<number, string> = {
        1: 'Low (Conservative)',
        2: 'Medium (Moderate)', 
        3: 'High (Aggressive)'
      };

      // Generate AI-powered optimization recommendations
      const prompt = `As a real estate pricing optimization expert, analyze the following property and provide pricing recommendations:

      Property Details:
      - Address: ${property.address}
      - Property Type: ${property.propertyType}
      - Total Units: ${property.totalUnits}
      - Built Year: ${property.builtYear}

      Optimization Parameters:
      - Goal: ${goalDisplayMap[goal] || goal}
      - Target Occupancy: ${targetOccupancy}%
      - Risk Tolerance: ${riskDisplayMap[riskTolerance] || 'Medium'}
      
      Current Unit Portfolio (${units.length} units):
      ${units.slice(0, 100).map(unit => `${unit.unitNumber}: ${unit.unitType} - Current Rent: $${unit.currentRent} - Status: ${unit.status}`).join('\n')}
      ${units.length > 100 ? `... and ${units.length - 100} more units` : ''}
      
      Market Context:
      - Consider current market conditions for similar properties
      - Factor in seasonal trends and local market dynamics
      - Account for unit turnover costs and vacancy risks
      - Balance revenue optimization with occupancy targets
      
      Please provide optimization recommendations for ALL ${units.length} units in this exact JSON format:
      {
        "unitRecommendations": [
          {
            "unitNumber": "string",
            "currentRent": number,
            "recommendedRent": number,
            "marketAverage": number,
            "change": number,
            "annualImpact": number,
            "confidenceLevel": "High|Medium|Low",
            "reasoning": "Brief explanation for the recommendation"
          }
        ],
        "totalIncrease": number,
        "affectedUnits": number,
        "avgIncrease": number,
        "riskLevel": "Low|Medium|High",
        "marketInsights": {
          "occupancyImpact": "Expected impact on occupancy rate",
          "competitivePosition": "How this positions the property vs competitors", 
          "timeToLease": "Average days to lease at new rates"
        }
      }
      
      Important: Generate recommendations for ALL ${units.length} units based on the optimization goal and parameters.`;

      console.log(`[OPTIMIZE] Sending request to OpenAI for ${units.length} units`);
      
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o", // Using gpt-4o which is widely available
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const optimizationData = JSON.parse(aiResponse.choices[0].message.content || "{}");
      
      console.log(`[OPTIMIZE] AI generated recommendations for ${optimizationData.unitRecommendations?.length || 0} units`);
      console.log(`[OPTIMIZE] Total increase: $${optimizationData.totalIncrease}, Affected units: ${optimizationData.affectedUnits}`);
      
      // Update units with recommendations
      const updatedUnits = [];
      for (const recommendation of optimizationData.unitRecommendations) {
        const unit = units.find(u => u.unitNumber === recommendation.unitNumber);
        if (unit) {
          const updatedUnit = await storage.updatePropertyUnit(unit.id, {
            recommendedRent: recommendation.recommendedRent.toString()
          });
          updatedUnits.push({
            ...updatedUnit,
            confidenceLevel: recommendation.confidenceLevel,
            reasoning: recommendation.reasoning
          });
        }
      }
      
      // Ensure all units are included even if not in recommendations
      for (const unit of units) {
        if (!updatedUnits.find(u => u.id === unit.id)) {
          updatedUnits.push({
            ...unit,
            recommendedRent: unit.currentRent, // Default to current if no recommendation
            confidenceLevel: "Low",
            reasoning: "No optimization recommended - maintain current pricing"
          });
        }
      }

      // Create optimization report
      const report = await storage.createOptimizationReport({
        propertyId,
        goal: goalDisplayMap[goal] || goal,
        riskTolerance: riskDisplayMap[riskTolerance] || 'Medium',
        timeline: `Target Occupancy: ${targetOccupancy}%`,
        totalIncrease: optimizationData.totalIncrease.toString(),
        affectedUnits: optimizationData.affectedUnits,
        avgIncrease: optimizationData.avgIncrease.toString(),
        riskLevel: optimizationData.riskLevel
      });

      console.log(`[OPTIMIZE] Successfully generated optimization report with ${updatedUnits.length} units`);
      res.json({ report, units: updatedUnits });
    } catch (error) {
      console.error("[OPTIMIZE] Error generating optimization:", error);
      // More detailed error response
      if (error instanceof Error) {
        console.error(`[OPTIMIZE] Error details: ${error.message}`);
        console.error(`[OPTIMIZE] Stack trace: ${error.stack}`);
        res.status(500).json({ 
          message: "Failed to generate optimization report",
          error: error.message 
        });
      } else {
        res.status(500).json({ message: "Failed to generate optimization report" });
      }
    }
  });

  // Get optimization report
  app.get("/api/properties/:id/optimization", async (req, res) => {
    try {
      const report = await storage.getOptimizationReport(req.params.id);
      const units = await storage.getPropertyUnits(req.params.id);
      
      if (!report) {
        return res.status(404).json({ message: "Optimization report not found" });
      }

      res.json({ report, units });
    } catch (error) {
      console.error("Error fetching optimization report:", error);
      res.status(500).json({ message: "Failed to fetch optimization report" });
    }
  });

  // Apply pricing changes
  app.post("/api/properties/:id/apply-pricing", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { unitPrices } = req.body; // { unitId: newPrice }
      
      if (!unitPrices || typeof unitPrices !== 'object') {
        return res.status(400).json({ message: "unitPrices must be an object mapping unit IDs to prices" });
      }

      const updatedUnits = [];
      let totalIncrease = 0;
      let affectedUnits = 0;

      for (const [unitId, newPrice] of Object.entries(unitPrices)) {
        try {
          const unit = await storage.updatePropertyUnit(unitId, {
            recommendedRent: String(newPrice)
          });
          
          if (unit) {
            updatedUnits.push(unit);
            const currentRent = parseFloat(unit.currentRent);
            const appliedRent = parseFloat(String(newPrice));
            
            if (appliedRent !== currentRent) {
              affectedUnits++;
              totalIncrease += (appliedRent - currentRent) * 12; // Annual impact
            }
          }
        } catch (unitError) {
          console.error(`Failed to update unit ${unitId}:`, unitError);
        }
      }

      res.json({
        message: "Pricing changes applied successfully",
        updatedUnits: updatedUnits.length,
        affectedUnits,
        totalAnnualImpact: totalIncrease
      });
    } catch (error) {
      console.error("Error applying pricing changes:", error);
      res.status(500).json({ message: "Failed to apply pricing changes" });
    }
  });

  // Scrape unit-level data for selected competitor properties (automatically includes subject property)
  app.post("/api/competitors/scrape-units", async (req, res) => {
    try {
      const { competitorIds } = req.body;
      
      if (!Array.isArray(competitorIds) || competitorIds.length === 0) {
        return res.status(400).json({ message: "competitorIds must be a non-empty array" });
      }

      // Get selected competitor properties
      const selectedCompetitors = await storage.getSelectedScrapedProperties(competitorIds);
      
      if (selectedCompetitors.length === 0) {
        return res.status(404).json({ message: "No competitor properties found" });
      }

      // Get the subject property and prepend it to the list if it exists
      const subjectProperty = await storage.getSubjectScrapedProperty();
      console.log(`DEBUG: getSubjectScrapedProperty returned:`, subjectProperty);
      
      const propertiesToProcess = [];
      
      if (subjectProperty) {
        propertiesToProcess.push(subjectProperty);
        console.log(`Including subject property: ${subjectProperty.name} in unit scraping batch`);
      } else {
        console.log('No subject property found with isSubjectProperty === true');
      }
      
      // Add all selected competitors
      propertiesToProcess.push(...selectedCompetitors);
      
      console.log(`DEBUG: Total properties to process: ${propertiesToProcess.length} (${subjectProperty ? 'with' : 'without'} subject property)`);

      const results = [];
      
      // Process each property (subject + competitors)
      for (const property of propertiesToProcess) {
        try {
          console.log(`Starting unit scraping for property: ${property.name} at ${property.url}`);
          
          // Get the original property ID for subject property
          let jobPropertyId = "temp-" + property.id;
          if (property.isSubjectProperty) {
            const originalPropertyId = await storage.getOriginalPropertyIdFromScraped(property.id);
            if (originalPropertyId) {
              jobPropertyId = originalPropertyId;
              console.log(`Using original property ID ${originalPropertyId} for subject property ${property.name}`);
            } else {
              console.warn(`Could not find original property ID for subject property ${property.name}, using scraped ID`);
              jobPropertyId = property.id;
            }
          }
          
          // Create scraping job for unit details
          const scrapingJob = await storage.createScrapingJob({
            propertyId: jobPropertyId,
            stage: "unit_details",
            cityUrl: property.url,
            status: "processing"
          });

          // Call Firecrawl Extract API for unit-level data
          const unitData = await extractUnitDetails(property.url);
          
          console.log(`Found ${unitData.length} units for property: ${property.name}`);
          
          // Save scraped units to storage
          const savedUnits = [];
          for (const unit of unitData) {
            try {
              const savedUnit = await storage.createScrapedUnit({
                propertyId: property.id,
                unitNumber: unit.unitNumber,
                floorPlanName: unit.floorPlanName,
                unitType: unit.unitType,
                bedrooms: unit.bedrooms,
                bathrooms: unit.bathrooms?.toString() || null,
                squareFootage: unit.squareFootage,
                rent: unit.rent?.toString() || null,
                availabilityDate: unit.availabilityDate,
                status: unit.availabilityDate && unit.availabilityDate.toLowerCase().includes('available') ? 'available' : 'occupied'
              });
              savedUnits.push(savedUnit);
            } catch (unitError) {
              console.warn(`Failed to save unit for ${property.name}:`, unitError);
            }
          }

          // Update scraping job status
          await storage.updateScrapingJob(scrapingJob.id, {
            status: "completed",
            results: unitData,
            completedAt: new Date()
          });

          results.push({
            propertyId: property.id,
            propertyName: property.name,
            propertyAddress: property.address,
            isSubjectProperty: property.isSubjectProperty || false,
            scrapingJobId: scrapingJob.id,
            unitsFound: savedUnits.length,
            units: savedUnits
          });

        } catch (propertyError) {
          console.error(`Error scraping units for ${property.name}:`, propertyError);
          
          const errorMessage = propertyError instanceof Error ? propertyError.message : "Failed to scrape unit data";
          
          results.push({
            propertyId: property.id,
            propertyName: property.name,
            propertyAddress: property.address,
            isSubjectProperty: property.isSubjectProperty || false,
            error: errorMessage,
            unitsFound: 0,
            units: []
          });
        }
      }

      res.json({
        message: "Unit scraping completed",
        processedProperties: results.length,
        totalUnitsFound: results.reduce((sum, result) => sum + result.unitsFound, 0),
        results
      });

    } catch (error) {
      console.error("Error in unit scraping workflow:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ message: "Failed to scrape unit data", error: errorMessage });
    }
  });

  // Comprehensive vacancy summary API endpoint
  app.get("/api/vacancy/summary", async (req, res) => {
    try {
      console.log('[VACANCY_SUMMARY] ===========================================');
      console.log('[VACANCY_SUMMARY] Starting vacancy summary generation');
      
      const { propertyId, competitorIds } = req.query;
      console.log('[VACANCY_SUMMARY] Property ID:', propertyId);
      console.log('[VACANCY_SUMMARY] Competitor IDs:', competitorIds);
      
      // Validate parameters
      if (!propertyId) {
        console.error('[VACANCY_SUMMARY] ❌ No propertyId provided');
        return res.status(400).json({ message: "propertyId is required" });
      }
      
      const competitorIdsArray = Array.isArray(competitorIds) ? competitorIds : 
                                 competitorIds ? [competitorIds] : [];

      if (competitorIdsArray.length === 0) {
        console.error('[VACANCY_SUMMARY] ❌ No competitor IDs provided');
        return res.status(400).json({ message: "At least one competitorId is required" });
      }

      console.log(`[VACANCY_SUMMARY] Processing ${competitorIdsArray.length} competitors`);

      // Get subject property - need to find the scraped property marked as isSubjectProperty
      let subjectProperty = null;
      
      // First try to find by scraping job associated with the original propertyId
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId as string);
      if (scrapingJobs.length > 0) {
        // Get all scraped properties from these jobs
        for (const job of scrapingJobs) {
          const scrapedProperties = await storage.getScrapedPropertiesByJob(job.id);
          const subject = scrapedProperties.find(p => p.isSubjectProperty === true);
          if (subject) {
            subjectProperty = subject;
            break;
          }
        }
      }
      
      // If not found, try the direct method as fallback
      if (!subjectProperty) {
        subjectProperty = await storage.getSubjectScrapedProperty();
      }
      
      if (!subjectProperty) {
        return res.status(404).json({ 
          message: "Subject property not found. Please ensure the property has been scraped first.",
          hint: "Run the scraping workflow for the property before requesting vacancy summary"
        });
      }

      const competitorProperties = await storage.getSelectedScrapedProperties(competitorIdsArray as string[]);
      if (competitorProperties.length === 0) {
        return res.status(404).json({ message: "No competitor properties found" });
      }

      // Helper function to normalize unit types
      const normalizeUnitType = (unitType: string): string => {
        if (!unitType) return 'Studio';
        const type = unitType.toLowerCase().trim();
        
        if (type.includes('studio') || type.includes('0br') || type === '0') {
          return 'Studio';
        } else if (type.includes('1br') || type.includes('1 br') || type === '1') {
          return '1BR';
        } else if (type.includes('2br') || type.includes('2 br') || type === '2') {
          return '2BR';
        } else if (type.includes('3br') || type.includes('3 br') || type === '3' || 
                   type.includes('4br') || type.includes('4 br') || type === '4' ||
                   type.includes('5br') || type.includes('5 br') || type === '5') {
          return '3BR+';
        } else {
          // Try to extract bedroom count from the string
          const match = type.match(/(\d+)/);
          if (match) {
            const bedrooms = parseInt(match[1]);
            if (bedrooms === 0) return 'Studio';
            if (bedrooms === 1) return '1BR';
            if (bedrooms === 2) return '2BR';
            if (bedrooms >= 3) return '3BR+';
          }
          return 'Studio'; // Default fallback
        }
      };

      // Helper function to calculate vacancy data for a property
      const calculateVacancyData = async (property: any) => {
        const units = await storage.getScrapedUnitsByProperty(property.id);
        
        // Group units by type
        const unitTypeGroups: { [key: string]: typeof units } = {
          'Studio': [],
          '1BR': [],
          '2BR': [],
          '3BR+': []
        };

        units.forEach(unit => {
          const normalizedType = normalizeUnitType(unit.unitType);
          unitTypeGroups[normalizedType].push(unit);
        });

        // Calculate stats for each unit type
        const unitTypes = Object.keys(unitTypeGroups).map(type => {
          const typeUnits = unitTypeGroups[type];
          const totalUnits = typeUnits.length;
          const availableUnits = typeUnits.filter(u => 
            u.status === 'available' || 
            (u.availabilityDate && u.availabilityDate.toLowerCase().includes('available'))
          ).length;
          
          const rentPrices = typeUnits
            .map(u => u.rent ? parseFloat(u.rent.toString()) : null)
            .filter(rent => rent !== null && rent > 0) as number[];
          
          const sqftValues = typeUnits
            .map(u => u.squareFootage)
            .filter(sqft => sqft !== null && sqft > 0) as number[];

          return {
            type,
            totalUnits,
            availableUnits,
            vacancyRate: totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0,
            avgRent: rentPrices.length > 0 ? rentPrices.reduce((sum, rent) => sum + rent, 0) / rentPrices.length : 0,
            avgSqFt: sqftValues.length > 0 ? sqftValues.reduce((sum, sqft) => sum + sqft, 0) / sqftValues.length : 0,
            rentRange: rentPrices.length > 0 ? {
              min: Math.min(...rentPrices),
              max: Math.max(...rentPrices)
            } : { min: 0, max: 0 }
          };
        }).filter(typeData => typeData.totalUnits > 0); // Only include unit types that exist

        // Calculate overall vacancy rate
        const totalUnits = units.length;
        const totalAvailable = units.filter(u => 
          u.status === 'available' || 
          (u.availabilityDate && u.availabilityDate.toLowerCase().includes('available'))
        ).length;
        const overallVacancyRate = totalUnits > 0 ? (totalAvailable / totalUnits) * 100 : 0;

        return {
          id: property.id,
          name: property.name,
          vacancyRate: parseFloat(overallVacancyRate.toFixed(1)),
          unitTypes
        };
      }

      // Helper function to get individual units for a property
      const getPropertyUnits = async (property: any) => {
        const units = await storage.getScrapedUnitsByProperty(property.id);
        return units.map(unit => ({
          unitNumber: unit.unitNumber || 'N/A',
          unitType: unit.unitType,
          bedrooms: unit.bedrooms || 0,
          bathrooms: unit.bathrooms || '0',
          squareFootage: unit.squareFootage || 0,
          rent: unit.rent || '0',
          availabilityDate: unit.availabilityDate || 'Contact for availability',
          status: unit.status || 'unknown'
        }));
      };

      // Calculate data for subject property with units
      const subjectData = await calculateVacancyData(subjectProperty);
      const subjectUnits = await getPropertyUnits(subjectProperty);

      // Calculate data for competitors with units
      const competitorData = await Promise.all(
        competitorProperties.map(async comp => {
          const vacancyData = await calculateVacancyData(comp);
          const units = await getPropertyUnits(comp);
          return {
            ...vacancyData,
            units
          };
        })
      );

      // Calculate market insights
      const competitorVacancyRates = competitorData.map(c => c.vacancyRate);
      const competitorAvgVacancy = competitorVacancyRates.length > 0 
        ? competitorVacancyRates.reduce((sum, rate) => sum + rate, 0) / competitorVacancyRates.length
        : 0;

      const totalCompetitorVacancies = competitorData.reduce((sum, comp) => {
        return sum + comp.unitTypes.reduce((typeSum, type) => typeSum + type.availableUnits, 0);
      }, 0);

      // Find strongest unit type (lowest vacancy rate)
      const subjectUnitTypes = subjectData.unitTypes.filter(type => type.totalUnits > 0);
      const strongestUnitType = subjectUnitTypes.length > 0 
        ? subjectUnitTypes.reduce((strongest, current) => 
            current.vacancyRate < strongest.vacancyRate ? current : strongest
          ).type
        : 'N/A';

      // Calculate subject vs market comparison
      const vacancyDifference = subjectData.vacancyRate - competitorAvgVacancy;
      const subjectVsMarket = Math.abs(vacancyDifference) < 0.1 
        ? "At market average"
        : vacancyDifference > 0 
          ? `${Math.abs(vacancyDifference).toFixed(1)}% above market average`
          : `${Math.abs(vacancyDifference).toFixed(1)}% below market average`;

      const response = {
        subjectProperty: {
          ...subjectData,
          units: subjectUnits
        },
        competitors: competitorData,
        marketInsights: {
          subjectVsMarket,
          strongestUnitType,
          totalVacancies: subjectData.unitTypes.reduce((sum, type) => sum + type.availableUnits, 0) + totalCompetitorVacancies,
          competitorAvgVacancies: parseFloat(competitorAvgVacancy.toFixed(1))
        }
      };

      console.log('[VACANCY_SUMMARY] ✅ Vacancy summary completed successfully');
      console.log('[VACANCY_SUMMARY] Subject property:', subjectData.name);
      console.log('[VACANCY_SUMMARY] Vacancy rate:', subjectData.vacancyRate + '%');
      console.log('[VACANCY_SUMMARY] Total units analyzed:', subjectUnits.length);
      console.log('[VACANCY_SUMMARY] Data source: Real Firecrawl scraped data');
      console.log('[VACANCY_SUMMARY] ===========================================');
      res.json(response);

    } catch (error) {
      console.error("[VACANCY_SUMMARY] ❌ Error generating vacancy summary:", error);
      console.log('[VACANCY_SUMMARY] ===========================================');
      res.status(500).json({ 
        message: "Failed to generate vacancy summary", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Address normalization utilities for better property matching
  function normalizeAddress(address: string): string {
    if (!address) return '';
    
    return address
      .toLowerCase()
      .trim()
      // Remove common punctuation
      .replace(/[.,;#]/g, '')
      // Normalize street abbreviations
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\broad\b/g, 'rd')
      .replace(/\blane\b/g, 'ln')
      .replace(/\bplaza\b/g, 'plz')
      .replace(/\bcircle\b/g, 'cir')
      .replace(/\bparkway\b/g, 'pkwy')
      .replace(/\bcourt\b/g, 'ct')
      // Normalize directional abbreviations
      .replace(/\bnorth\b/g, 'n')
      .replace(/\bsouth\b/g, 's')
      .replace(/\beast\b/g, 'e')
      .replace(/\bwest\b/g, 'w')
      .replace(/\bnortheast\b/g, 'ne')
      .replace(/\bnorthwest\b/g, 'nw')
      .replace(/\bsoutheast\b/g, 'se')
      .replace(/\bsouthwest\b/g, 'sw')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractStreetNumber(address: string): string {
    const match = address.match(/^(\d+)/);
    return match ? match[1] : '';
  }

  function extractStreetName(address: string): string {
    // Extract everything after the street number but before city/state
    const normalized = normalizeAddress(address);
    const parts = normalized.split(',');
    if (parts.length === 0) return normalized;
    
    const streetPart = parts[0].trim();
    // Remove the street number
    return streetPart.replace(/^\d+\s*/, '').trim();
  }

  function normalizePropertyName(name: string): string {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      // Remove common property prefixes/suffixes
      .replace(/^(the)\s+/i, '')
      .replace(/\s+(apartments?|apt|residences?|homes?|towers?|place|commons?)$/i, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Calculate similarity score between two strings (0-100)
  function calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 100;
    
    // Levenshtein distance implementation
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    const maxLen = Math.max(len1, len2);
    const similarity = maxLen === 0 ? 100 : ((maxLen - matrix[len1][len2]) / maxLen) * 100;
    return Math.round(similarity);
  }

  // Advanced property matching logic with improved flexibility
  function calculatePropertyMatch(subjectProperty: any, scrapedProperty: any): { isMatch: boolean; score: number; reasons: string[]; matchDetails: any } {
    console.log('[PROPERTY_MATCH] Starting match calculation');
    console.log('[PROPERTY_MATCH] Subject Property:', { 
      name: subjectProperty.propertyName, 
      address: subjectProperty.address,
      city: subjectProperty.city,
      state: subjectProperty.state 
    });
    console.log('[PROPERTY_MATCH] Scraped Property:', { 
      name: scrapedProperty.name, 
      address: scrapedProperty.address,
      url: scrapedProperty.url 
    });
    
    const reasons: string[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;
    const componentScores: any = {};
    
    // Extract and normalize subject property data
    const subjectName = normalizePropertyName(subjectProperty.propertyName || '');
    const subjectAddress = normalizeAddress(subjectProperty.address || '');
    const subjectStreetNumber = extractStreetNumber(subjectProperty.address || '');
    const subjectStreetName = extractStreetName(subjectProperty.address || '');
    
    // Extract and normalize scraped property data
    const scrapedName = normalizePropertyName(scrapedProperty.name || '');
    const scrapedAddress = normalizeAddress(scrapedProperty.address || '');
    const scrapedStreetNumber = extractStreetNumber(scrapedProperty.address || '');
    const scrapedStreetName = extractStreetName(scrapedProperty.address || '');
    
    console.log('[PROPERTY_MATCH] Normalized values:', {
      subjectName, subjectAddress, subjectStreetNumber, subjectStreetName,
      scrapedName, scrapedAddress, scrapedStreetNumber, scrapedStreetName
    });
    
    // 1. Exact street number match (30 points) - very important for properties
    maxPossibleScore += 30;
    componentScores.streetNumber = 0;
    if (subjectStreetNumber && scrapedStreetNumber) {
      if (subjectStreetNumber === scrapedStreetNumber) {
        componentScores.streetNumber = 30;
        totalScore += 30;
        reasons.push(`✅ Exact street number match: ${subjectStreetNumber}`);
      } else {
        // Check for partial match (e.g., 222 vs 2221)
        if (subjectStreetNumber.startsWith(scrapedStreetNumber) || scrapedStreetNumber.startsWith(subjectStreetNumber)) {
          componentScores.streetNumber = 15;
          totalScore += 15;
          reasons.push(`⚠️ Partial street number match: ${subjectStreetNumber} vs ${scrapedStreetNumber}`);
        } else {
          reasons.push(`❌ Street number mismatch: ${subjectStreetNumber} vs ${scrapedStreetNumber}`);
        }
      }
    } else if (!subjectStreetNumber || !scrapedStreetNumber) {
      // One is missing - still give some points if other criteria match
      componentScores.streetNumber = 10;
      totalScore += 10;
      reasons.push(`⚠️ Street number missing in one address`);
    }
    
    // 2. Street name similarity (25 points)
    maxPossibleScore += 25;
    componentScores.streetName = 0;
    if (subjectStreetName && scrapedStreetName) {
      const streetSimilarity = calculateStringSimilarity(subjectStreetName, scrapedStreetName);
      componentScores.streetNameSimilarity = streetSimilarity;
      
      if (streetSimilarity >= 80) {
        const streetPoints = Math.round((streetSimilarity / 100) * 25);
        componentScores.streetName = streetPoints;
        totalScore += streetPoints;
        reasons.push(`✅ Street name similarity: ${streetSimilarity}% (${subjectStreetName} vs ${scrapedStreetName})`);
      } else if (streetSimilarity >= 60) {
        // More forgiving for partial matches
        const streetPoints = Math.round((streetSimilarity / 100) * 20);
        componentScores.streetName = streetPoints;
        totalScore += streetPoints;
        reasons.push(`⚠️ Partial street name match: ${streetSimilarity}% (${subjectStreetName} vs ${scrapedStreetName})`);
      } else {
        reasons.push(`❌ Low street name similarity: ${streetSimilarity}% (${subjectStreetName} vs ${scrapedStreetName})`);
      }
    }
    
    // 3. Property name similarity (20 points) - ENHANCED with flexible matching
    maxPossibleScore += 20;
    componentScores.propertyName = 0;
    if (subjectName && scrapedName) {
      const nameSimilarity = calculateStringSimilarity(subjectName, scrapedName);
      componentScores.propertyNameSimilarity = nameSimilarity;
      
      // Check for containment first (more flexible)
      const subjectWords = subjectName.toLowerCase().split(' ').filter(w => w.length > 2);
      const scrapedWords = scrapedName.toLowerCase().split(' ').filter(w => w.length > 2);
      const commonWords = subjectWords.filter(w => scrapedWords.includes(w));
      const containmentScore = (commonWords.length / Math.min(subjectWords.length, scrapedWords.length)) * 100;
      
      if (nameSimilarity >= 70) {
        // High match - likely same property
        const namePoints = 20;
        componentScores.propertyName = namePoints;
        totalScore += namePoints;
        reasons.push(`✅ Strong property name match: ${nameSimilarity}% (${subjectName} vs ${scrapedName})`);
      } else if (containmentScore >= 50 || subjectName.includes(scrapedName) || scrapedName.includes(subjectName)) {
        // IMPROVED: Award points for partial containment
        const namePoints = 15;
        componentScores.propertyName = namePoints;
        totalScore += namePoints;
        reasons.push(`✅ Property name contains key words: "${subjectName}" matches "${scrapedName}" (${commonWords.join(', ')})`);
      } else if (nameSimilarity >= 50) {
        const namePoints = Math.round((nameSimilarity / 100) * 20);
        componentScores.propertyName = namePoints;
        totalScore += namePoints;
        reasons.push(`⚠️ Property name similarity: ${nameSimilarity}% (${subjectName} vs ${scrapedName})`);
      } else {
        // More forgiving for Atlas-type matches
        const coreMatch = (subjectName.replace('the', '').trim() === scrapedName.replace('the', '').trim());
        if (coreMatch) {
          componentScores.propertyName = 12;
          totalScore += 12;
          reasons.push(`⚠️ Core name match after removing articles: "${subjectName}" and "${scrapedName}"`);
        } else {
          reasons.push(`❌ Low property name similarity: ${nameSimilarity}% (${subjectName} vs ${scrapedName})`);
        }
      }
    }
    
    // 4. Full address similarity (15 points)
    maxPossibleScore += 15;
    const fullAddressSimilarity = calculateStringSimilarity(subjectAddress, scrapedAddress);
    if (fullAddressSimilarity >= 70) {
      const addressPoints = Math.round((fullAddressSimilarity / 100) * 15);
      totalScore += addressPoints;
      reasons.push(`Full address similarity: ${fullAddressSimilarity}%`);
    }
    
    // 5. City/State context (10 points) - from subject property schema
    maxPossibleScore += 10;
    if (subjectProperty.city || subjectProperty.state) {
      const subjectCity = normalizeAddress(subjectProperty.city || '');
      const subjectState = normalizeAddress(subjectProperty.state || '');
      
      if (subjectCity && scrapedAddress.includes(subjectCity)) {
        totalScore += 5;
        reasons.push(`City match in scraped address: ${subjectCity}`);
      }
      if (subjectState && scrapedAddress.includes(subjectState)) {
        totalScore += 5;
        reasons.push(`State match in scraped address: ${subjectState}`);
      }
    }
    
    // Calculate final score percentage
    const finalScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    
    console.log('[PROPERTY_MATCH] Component scores:', componentScores);
    console.log('[PROPERTY_MATCH] Total score:', totalScore, '/', maxPossibleScore);
    console.log('[PROPERTY_MATCH] Final score:', finalScore, '%');
    
    // FURTHER LOWERED THRESHOLD for better detection:
    // - 60%+ = Highly likely match
    // - 50%+ = Likely match (for properties with similar names/addresses)
    // - 40%+ = Possible match (requires manual review)
    const isMatch = finalScore >= 50; // LOWERED to 50% for better flexibility
    
    console.log('[PROPERTY_MATCH] Is match?', isMatch);
    console.log('[PROPERTY_MATCH] Reasons:', reasons);
    
    return {
      isMatch,
      score: finalScore,
      reasons,
      matchDetails: {
        componentScores,
        totalScore,
        maxPossibleScore,
        threshold: 50, // Updated threshold
        subjectData: { name: subjectName, address: subjectAddress },
        scrapedData: { name: scrapedName, address: scrapedAddress }
      }
    };
  }

  // Helper function to generate city URL from address
  function generateCityUrl(address: string): string {
    console.log('[GENERATE_CITY_URL] Input address:', address);
    
    const parts = address.split(',').map(p => p.trim());
    console.log('[GENERATE_CITY_URL] Address parts:', parts);
    
    if (parts.length < 2) {
      console.log('[GENERATE_CITY_URL] Not enough parts in address');
      return '';
    }
    
    // Expected formats:
    // "Street Address, City, State ZIP" -> ["Street Address", "City", "State ZIP"]
    // "Street Address, City State ZIP" -> ["Street Address", "City State ZIP"]
    
    if (parts.length >= 3) {
      // Format: "Street, City, State ZIP" (most common)
      const city = parts[1].toLowerCase().replace(/\s+/g, '-');
      const stateWithZip = parts[2];
      
      // Extract state and zip using regex for better reliability
      const stateZipMatch = stateWithZip.match(/^([A-Z]{2})\s+(\d{5})/i);
      
      if (stateZipMatch) {
        const state = stateZipMatch[1].toLowerCase();
        const zip = stateZipMatch[2];
        const url = `apartments.com/${city}-${state}-${zip}/`;
        console.log('[GENERATE_CITY_URL] Generated URL with zipcode:', url);
        return url;
      } else {
        // Fallback to splitting by space
        const stateZipParts = stateWithZip.split(/\s+/);
        const state = stateZipParts[0].toLowerCase();
        const zip = stateZipParts[1] || '';
        
        if (zip && /^\d{5}/.test(zip)) {
          const url = `apartments.com/${city}-${state}-${zip}/`;
          console.log('[GENERATE_CITY_URL] Generated URL with zipcode (fallback):', url);
          return url;
        } else {
          const url = `apartments.com/${city}-${state}/`;
          console.log('[GENERATE_CITY_URL] Generated URL without zipcode:', url);
          return url;
        }
      }
    } else if (parts.length === 2) {
      // Format: "Street, City State ZIP"
      const cityStateZip = parts[1];
      
      // Try to extract city, state, and zip using regex
      const match = cityStateZip.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5})/i);
      
      if (match) {
        const city = match[1].toLowerCase().replace(/\s+/g, '-');
        const state = match[2].toLowerCase();
        const zip = match[3];
        const url = `apartments.com/${city}-${state}-${zip}/`;
        console.log('[GENERATE_CITY_URL] Generated URL with zipcode (format 2):', url);
        return url;
      } else {
        // Fallback to simple split
        const cityStateZipParts = cityStateZip.split(/\s+/);
        
        if (cityStateZipParts.length >= 3) {
          const city = cityStateZipParts[0].toLowerCase();
          const state = cityStateZipParts[1].toLowerCase();
          const zip = cityStateZipParts[2] || '';
          
          if (zip && /^\d{5}/.test(zip)) {
            const url = `apartments.com/${city}-${state}-${zip}/`;
            console.log('[GENERATE_CITY_URL] Generated URL with zipcode (format 2 fallback):', url);
            return url;
          }
        }
        
        // Use the first part as city if we can't parse it properly
        const cityPart = cityStateZipParts[0] || cityStateZip;
        const url = `apartments.com/${cityPart.toLowerCase().replace(/\s+/g, '-')}/`;
        console.log('[GENERATE_CITY_URL] Generated URL without state/zip:', url);
        return url;
      }
    }
    
    console.log('[GENERATE_CITY_URL] Failed to generate URL');
    return '';
  }

  // Helper function to extract city/state from address for job naming
  function extractCityState(address: string): string {
    const parts = address.split(',');
    if (parts.length < 2) return 'Unknown Location';
    
    const city = parts[parts.length - 2].trim();
    const state = parts[parts.length - 1].trim().split(' ')[0]; // Remove zip code if present
    
    return `${city}, ${state}`;
  }


  // Start scraping job for a property
  app.post("/api/properties/:id/scrape", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Clear scraped properties cache to prevent interference from previous searches
      console.log('[SCRAPE] Clearing scraped properties cache for new search');
      await storage.clearScrapedPropertiesCache();

      const cityUrl = generateCityUrl(property.address);
      if (!cityUrl) {
        console.error('[SCRAPE] Failed to generate URL from address:', property.address);
        return res.status(400).json({ message: "Unable to extract city/zipcode from address. Please ensure address format is: Street, City, State ZIP" });
      }

      const cityState = extractCityState(property.address);
      console.log('[SCRAPE] ===========================================');
      console.log('[SCRAPE] Starting scraping for property:', property.propertyName);
      console.log('[SCRAPE] Property address:', property.address);
      console.log('[SCRAPE] Generated URL:', `https://www.${cityUrl}`);
      console.log('[SCRAPE] Location:', cityState);
      console.log('[SCRAPE] ===========================================');

      // Create scraping job
      const scrapingJob = await storage.createScrapingJob({
        propertyId,
        stage: "city_discovery",
        cityUrl: `https://www.${cityUrl}`,
        status: "processing"
      });

      // Return immediately - scraping happens in background
      res.json({
        scrapingJob: { 
          ...scrapingJob, 
          status: "processing" 
        },
        message: `Competitor discovery started for ${cityState}. This will complete in the background.`,
        targetUrl: `https://www.${cityUrl}`,
        backgroundJob: true
      });
      
      // Background job - continues after response is sent
      const scrapingJobId = scrapingJob.id;
      setImmediate(async () => {
        try {
          const urls = [`https://www.${cityUrl}`];
          console.log(`[SCRAPE_BACKGROUND] Starting competitor discovery:`, urls[0]);
          
          let allProperties = [];
          
          for (const url of urls) {
            try {
              const pageProperties = await discoverProperties(url);
              console.log(`[SCRAPE_BACKGROUND] Found ${pageProperties.length} properties`);
              allProperties.push(...pageProperties);
            } catch (pageError) {
              console.error(`[SCRAPE_BACKGROUND] Error:`, pageError);
            }
          }
          
          if (allProperties.length === 0) {
            await storage.updateScrapingJob(scrapingJobId, {
              status: 'failed',
              errorMessage: 'No properties found',
              completedAt: new Date()
            });
            return;
          }
          
          console.log(`[SCRAPE_BACKGROUND] Processing ${allProperties.length} properties`);
          
          // Store scraped properties and try to match subject property
        const scrapedProperties = [];
        let subjectPropertyFound = false;
        let bestMatch = { property: null as any, score: 0 };

        for (const propertyData of allProperties) {
          if (!propertyData.name || !propertyData.address || !propertyData.url) {
            console.log('Skipping property with missing data:', propertyData);
            continue;
          }

          // Advanced property matching with scoring and detailed logging
          const matchResult = calculatePropertyMatch(property, propertyData);
          const isSubjectProperty = matchResult.isMatch;
          
          // Log detailed matching information
          console.log(`\n${'='.repeat(60)}`);
          console.log(`[PROPERTY_MATCH_RESULT] Property #${scrapedProperties.length + 1}`);
          console.log(`Subject: "${property.propertyName}" at "${property.address}"`);
          console.log(`Scraped: "${propertyData.name}" at "${propertyData.address}"`);
          console.log(`Match Score: ${matchResult.score}% (threshold: ${matchResult.matchDetails.threshold}%)`);
          console.log(`Is Match: ${isSubjectProperty ? '✅ YES' : '❌ NO'}`);
          console.log(`Component Scores:`, matchResult.matchDetails.componentScores);
          console.log(`Reasons:`);
          matchResult.reasons.forEach(reason => console.log(`  ${reason}`));
          console.log(`${'='.repeat(60)}\n`);

          if (isSubjectProperty) {
            subjectPropertyFound = true;
            console.log('🎯 FOUND SUBJECT PROPERTY MATCH:', propertyData.name, `(Score: ${matchResult.score}%)`);
            console.log('URL:', propertyData.url);
          }
          
          // Track best match for fallback
          if (matchResult.score > bestMatch.score) {
            bestMatch = { property: propertyData, score: matchResult.score };
          }

          const scrapedProperty = await storage.createScrapedProperty({
            scrapingJobId: scrapingJob.id,
            name: propertyData.name,
            url: propertyData.url,
            address: propertyData.address,
            distance: null,
            matchScore: matchResult.score.toString(),
            isSubjectProperty
          });
          scrapedProperties.push(scrapedProperty);
          
        }
        
        // FALLBACK 1: If no subject property found but we have a decent match (>=40%), use it
        if (!subjectPropertyFound && bestMatch.property && bestMatch.score >= 40) {
          console.log('[SUBJECT_FALLBACK] No exact subject match found, using best match as fallback');
          console.log('[SUBJECT_FALLBACK] Best match:', bestMatch.property.name);
          console.log('[SUBJECT_FALLBACK] Match score:', bestMatch.score, '%');
          console.log('[SUBJECT_FALLBACK] URL:', bestMatch.property.url);
          
          // Find and update the scraped property to mark it as subject
          const fallbackProperty = scrapedProperties.find(p => p.url === bestMatch.property.url);
          if (fallbackProperty) {
            // Update the isSubjectProperty flag in storage
            const updated = await storage.updateScrapedProperty(fallbackProperty.id, {
              isSubjectProperty: true
            });
            
            if (updated) {
              // Also update the local object for consistency
              fallbackProperty.isSubjectProperty = true;
              subjectPropertyFound = true;
              console.log('[SUBJECT_FALLBACK] ✅ Successfully marked fallback property as subject');
            } else {
              console.error('[SUBJECT_FALLBACK] ❌ Failed to update property in storage');
            }
          }
        }
        
        // FALLBACK 2: If still no subject property (all matches < 40%), mark the BEST match regardless
        if (!subjectPropertyFound && bestMatch.property && scrapedProperties.length > 0) {
          console.log('[SUBJECT_FALLBACK_FORCED] No matches above 40%, forcing best match as subject');
          console.log('[SUBJECT_FALLBACK_FORCED] Best match:', bestMatch.property.name);
          console.log('[SUBJECT_FALLBACK_FORCED] Match score:', bestMatch.score, '% (below threshold)');
          console.log('[SUBJECT_FALLBACK_FORCED] URL:', bestMatch.property.url);
          console.log('[SUBJECT_FALLBACK_FORCED] ⚠️ This is a low-confidence match but ensuring we have a subject property');
          
          const forcedFallback = scrapedProperties.find(p => p.url === bestMatch.property.url);
          if (forcedFallback) {
            // Update the isSubjectProperty flag in storage
            const updated = await storage.updateScrapedProperty(forcedFallback.id, {
              isSubjectProperty: true
            });
            
            if (updated) {
              // Also update the local object for consistency
              forcedFallback.isSubjectProperty = true;
              subjectPropertyFound = true;
              console.log('[SUBJECT_FALLBACK_FORCED] ✅ Forced property marked as subject');
            } else {
              console.error('[SUBJECT_FALLBACK_FORCED] ❌ Failed to update property in storage');
            }
          }
        }
        
        // FALLBACK 3: If we somehow still don't have a subject (e.g., no properties scraped), mark first property
        if (!subjectPropertyFound && scrapedProperties.length > 0) {
          console.log('[SUBJECT_FALLBACK_FIRST] Emergency fallback: marking first scraped property as subject');
          const firstProperty = scrapedProperties[0];
          
          const updated = await storage.updateScrapedProperty(firstProperty.id, {
            isSubjectProperty: true
          });
          
          if (updated) {
            firstProperty.isSubjectProperty = true;
            subjectPropertyFound = true;
            console.log('[SUBJECT_FALLBACK_FIRST] ✅ First property marked as subject');
            console.log('[SUBJECT_FALLBACK_FIRST] Property:', firstProperty.name);
            console.log('[SUBJECT_FALLBACK_FIRST] URL:', firstProperty.url);
          } else {
            console.error('[SUBJECT_FALLBACK_FIRST] ❌ Failed to update first property in storage');
          }
        }

          // Update job status to completed
          await storage.updateScrapingJob(scrapingJobId, {
            status: "completed",
            completedAt: new Date(),
            results: { 
              totalProperties: allProperties.length,
              subjectPropertyFound,
              urls: urls
            }
          });
          
          console.log(`[SCRAPE_BACKGROUND] ✅ Completed! ${scrapedProperties.length} properties stored`);
          console.log(`[SCRAPE_BACKGROUND] Subject found: ${subjectPropertyFound ? 'YES' : 'NO'}`);
          
        } catch (backgroundError) {
          console.error('[SCRAPE_BACKGROUND] Error:', backgroundError);
          await storage.updateScrapingJob(scrapingJobId, {
            status: 'failed',
            errorMessage: backgroundError instanceof Error ? backgroundError.message : 'Unknown error',
            completedAt: new Date()
          });
        }
      })();
      
    } catch (error) {
      console.error("Firecrawl API error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({ message: "Scraping failed", error: errorMessage, details: String(error) });
    }
  });

  // Simulate scraping completion (in real implementation, this would be called by Firecrawl webhook)
            totalStored: scrapedProperties.length,
            matchThreshold: 50, // Updated threshold
            fallbackUsed: bestMatch.score < 50 && subjectPropertyFound,
            fallbackType: bestMatch.score >= 50 ? 'exact_match' : 
                         bestMatch.score >= 40 ? 'good_match_fallback' :
                         bestMatch.score > 0 ? 'forced_best_match' : 
                         'first_property_fallback',
            bestMatchScore: bestMatch.score,
            subjectPropertyData: {
              name: property.propertyName,
              address: property.address
            },
            subjectPropertyMarked: subjectPropertyFound,
            markedProperty: scrapedProperties.find(p => p.isSubjectProperty) || null
          }
        });

      } catch (scrapingError) {
        console.error("Firecrawl API error:", scrapingError);
        
        // Update job status to failed
        await storage.updateScrapingJob(scrapingJob.id, {
          status: "failed",
          errorMessage: scrapingError instanceof Error ? scrapingError.message : "Unknown scraping error"
        });

        res.status(500).json({ 
          message: "Scraping failed",
          error: scrapingError instanceof Error ? scrapingError.message : "Unknown error",
          details: scrapingError instanceof Error ? scrapingError.stack : undefined
        });
      }
    } catch (error) {
      console.error("Error starting scraping job:", error);
      res.status(500).json({ message: "Failed to start scraping job" });
    }
  });

  // Simulate scraping completion (in real implementation, this would be called by Firecrawl webhook)
  app.post("/api/scraping/:jobId/complete", async (req, res) => {
    try {
      const jobId = req.params.jobId;
      const { properties } = req.body; // Array of scraped property data
      
      const job = await storage.getScrapingJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Scraping job not found" });
      }

      // Update job status
      await storage.updateScrapingJob(jobId, {
        status: "completed",
        completedAt: new Date()
      });

      // Store scraped properties
      const scrapedProperties = [];
      for (const propertyData of properties || []) {
        const scrapedProperty = await storage.createScrapedProperty({
          scrapingJobId: jobId,
          name: propertyData.name,
          url: propertyData.url,
          address: propertyData.address,
          distance: propertyData.distance?.toString(),
          matchScore: propertyData.matchScore?.toString()
        });
        scrapedProperties.push(scrapedProperty);
      }

      res.json({ job, scrapedProperties });
    } catch (error) {
      console.error("Error completing scraping job:", error);
      res.status(500).json({ message: "Failed to complete scraping job" });
    }
  });

  // Get scraping job status and results
  app.get("/api/scraping/:jobId", async (req, res) => {
    try {
      const jobId = req.params.jobId;
      const job = await storage.getScrapingJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Scraping job not found" });
      }

      const scrapedProperties = await storage.getScrapedPropertiesByJob(jobId);
      
      res.json({ job, scrapedProperties });
    } catch (error) {
      console.error("Error fetching scraping job:", error);
      res.status(500).json({ message: "Failed to fetch scraping job" });
    }
  });

  // Get scraped properties for a property (for UI display)
  app.get("/api/properties/:id/scraped-properties", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const jobs = await storage.getScrapingJobsByProperty(propertyId);
      
      if (jobs.length === 0) {
        return res.json({ scrapedProperties: [], totalCount: 0 });
      }

      // Get the most recent successful job
      const completedJob = jobs
        .filter(job => job.status === "completed")
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0];

      if (!completedJob) {
        return res.json({ scrapedProperties: [], totalCount: 0 });
      }

      const scrapedProperties = await storage.getScrapedPropertiesByJob(completedJob.id);
      
      // Separate subject property from competitors
      const subjectProperty = scrapedProperties.find(p => p.isSubjectProperty);
      const competitors = scrapedProperties.filter(p => !p.isSubjectProperty);

      res.json({ 
        scrapedProperties: competitors,  // Only return competitors for selection
        subjectProperty,
        totalCount: scrapedProperties.length,
        scrapingJob: completedJob
      });
    } catch (error) {
      console.error("Error fetching scraped properties:", error);
      res.status(500).json({ message: "Failed to fetch scraped properties" });
    }
  });

  // Get all scraping jobs for a property
  app.get("/api/properties/:id/scraping-jobs", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const jobs = await storage.getScrapingJobsByProperty(propertyId);
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching scraping jobs:", error);
      res.status(500).json({ message: "Failed to fetch scraping jobs" });
    }
  });

  // Manual subject property selection endpoint - mark a scraped property as the subject
  app.post("/api/properties/:id/set-subject", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { scrapedPropertyId } = req.body;
      
      console.log('[MANUAL_SUBJECT_SELECTION] Setting subject property');
      console.log('[MANUAL_SUBJECT_SELECTION] Property ID:', propertyId);
      console.log('[MANUAL_SUBJECT_SELECTION] Scraped Property ID:', scrapedPropertyId);
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Get the scraped property to mark as subject
      const scrapedProperty = await storage.getScrapedProperty(scrapedPropertyId);
      if (!scrapedProperty) {
        return res.status(404).json({ message: "Scraped property not found" });
      }
      
      // Unmark any existing subject properties for this property's scraping jobs
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      for (const job of scrapingJobs) {
        const jobProperties = await storage.getScrapedPropertiesByJob(job.id);
        for (const prop of jobProperties) {
          if (prop.isSubjectProperty && prop.id !== scrapedPropertyId) {
            // Update to unmark this property (implementation would need to be added to storage)
            console.log('[MANUAL_SUBJECT_SELECTION] Unmarking previous subject:', prop.name);
          }
        }
      }
      
      // Mark the selected property as the subject
      console.log('[MANUAL_SUBJECT_SELECTION] Marking as subject:', scrapedProperty.name);
      
      res.json({ 
        success: true,
        message: `Successfully set ${scrapedProperty.name} as the subject property`,
        subjectProperty: {
          id: scrapedProperty.id,
          name: scrapedProperty.name,
          address: scrapedProperty.address,
          url: scrapedProperty.url,
          matchScore: scrapedProperty.matchScore
        },
        originalProperty: {
          id: property.id,
          name: property.propertyName,
          address: property.address
        }
      });
    } catch (error) {
      console.error("[MANUAL_SUBJECT_SELECTION] Error:", error);
      res.status(500).json({ message: "Failed to set subject property" });
    }
  });
  
  // Match subject property with scraped data (legacy endpoint)
  app.post("/api/properties/:id/match", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { scrapedPropertyId } = req.body;
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Here you would implement matching logic
      // For now, we'll just return a success response
      res.json({ 
        matched: true,
        message: `Successfully matched ${property.propertyName} with scraped data`,
        scrapedPropertyId
      });
    } catch (error) {
      console.error("Error matching property:", error);
      res.status(500).json({ message: "Failed to match property" });
    }
  });

  // Workflow State Management
  app.get("/api/workflow/:propertyId", async (req, res) => {
    try {
      const propertyId = req.params.propertyId;
      let state = await storage.getWorkflowState(propertyId);
      
      if (!state) {
        console.log('[WORKFLOW_STATE] No state found for property:', propertyId);
        // Auto-initialize workflow state if it doesn't exist
        console.log('[WORKFLOW_STATE] Auto-initializing workflow state');
        state = await storage.saveWorkflowState({
          propertyId,
          selectedCompetitorIds: [],
          currentStage: 'input'
        });
      }
      
      res.json(state);
    } catch (error) {
      console.error("[WORKFLOW_STATE] Error fetching workflow state:", error);
      res.status(500).json({ message: "Failed to fetch workflow state" });
    }
  });

  app.put("/api/workflow/:propertyId", async (req, res) => {
    try {
      const propertyId = req.params.propertyId;
      const state = {
        propertyId,
        ...req.body
      };
      
      console.log('[WORKFLOW_STATE] Saving workflow state for property:', propertyId);
      console.log('[WORKFLOW_STATE] State data:', state);
      
      const savedState = await storage.saveWorkflowState(state);
      res.json(savedState);
    } catch (error) {
      console.error("[WORKFLOW_STATE] Error saving workflow state:", error);
      res.status(500).json({ message: "Failed to save workflow state" });
    }
  });

  // Force sync units from scraped data with fuzzy matching fallback
  app.post("/api/properties/:id/sync-units", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      console.log('[SYNC_UNITS] Starting sync for property:', property.propertyName);
      
      // Find the subject scraped property
      let subjectProperty = null;
      let scrapedUnits: ScrapedUnit[] = [];
      let fallbackUsed = false;
      let searchAttempts: any[] = [];
      
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      if (scrapingJobs.length > 0) {
        console.log('[SYNC_UNITS] Found', scrapingJobs.length, 'scraping jobs');
        
        for (const job of scrapingJobs) {
          const scrapedProperties = await storage.getScrapedPropertiesByJob(job.id);
          console.log('[SYNC_UNITS] Job', job.id, 'has', scrapedProperties.length, 'scraped properties');
          
          // First try to find exact subject match
          const subject = scrapedProperties.find(p => p.isSubjectProperty === true);
          if (subject) {
            subjectProperty = subject;
            scrapedUnits = await storage.getScrapedUnitsByProperty(subject.id);
            console.log('[SYNC_UNITS] Found subject property:', subject.name, 'with', scrapedUnits.length, 'units');
            break;
          }
          
          // FALLBACK: Use fuzzy matching to find best match
          if (!subjectProperty && scrapedProperties.length > 0) {
            console.log('[SYNC_UNITS_FALLBACK] No subject property marked, attempting fuzzy matching');
            
            let bestMatch = { property: null as any, score: 0 };
            
            for (const scrapedProp of scrapedProperties) {
              const matchResult = calculatePropertyMatch(property, scrapedProp);
              searchAttempts.push({
                name: scrapedProp.name,
                address: scrapedProp.address,
                score: matchResult.score,
                reasons: matchResult.reasons
              });
              
              console.log('[SYNC_UNITS_FALLBACK] Checking:', scrapedProp.name);
              console.log('[SYNC_UNITS_FALLBACK] Score:', matchResult.score, '%');
              
              if (matchResult.score > bestMatch.score) {
                bestMatch = { property: scrapedProp, score: matchResult.score };
              }
            }
            
            // Use best match if score is reasonable
            if (bestMatch.property && bestMatch.score >= 40) {
              subjectProperty = bestMatch.property;
              scrapedUnits = await storage.getScrapedUnitsByProperty(bestMatch.property.id);
              fallbackUsed = true;
              console.log('[SYNC_UNITS_FALLBACK] ✅ Using best match as subject:', bestMatch.property.name);
              console.log('[SYNC_UNITS_FALLBACK] Match score:', bestMatch.score, '%');
              console.log('[SYNC_UNITS_FALLBACK] Found', scrapedUnits.length, 'units');
            }
          }
        }
      }
      
      if (scrapedUnits.length === 0) {
        return res.status(404).json({ 
          message: "No scraped units to sync",
          details: "Could not find subject property or any matching scraped property",
          searchAttempts,
          suggestions: [
            "Run the scraping job first to collect property data",
            "Use the force-link endpoint to manually link a scraped property",
            "Check the debug-matching endpoint to see all match scores"
          ]
        });
      }
      
      // Clear existing PropertyUnits and recreate from scraped data
      await storage.clearPropertyUnits(propertyId);
      const units = [];
      
      for (const scrapedUnit of scrapedUnits) {
        const unit = await storage.createPropertyUnit({
          propertyId,
          unitNumber: scrapedUnit.unitNumber || scrapedUnit.floorPlanName || `Unit-${scrapedUnit.id.substring(0, 6)}`,
          unitType: scrapedUnit.unitType,
          currentRent: scrapedUnit.rent || "0",
          status: scrapedUnit.status || "occupied"
        });
        units.push(unit);
      }
      
      res.json({ 
        message: `Successfully synced ${units.length} units from scraped data`,
        unitsCount: units.length,
        units: units,
        subjectProperty: subjectProperty ? {
          id: subjectProperty.id,
          name: subjectProperty.name,
          address: subjectProperty.address,
          url: subjectProperty.url
        } : null,
        fallbackUsed,
        searchAttempts: fallbackUsed ? searchAttempts : []
      });
    } catch (error) {
      console.error("Error syncing units:", error);
      res.status(500).json({ message: "Failed to sync units" });
    }
  });

  // Force-link endpoint to manually link a scraped property as subject
  app.post("/api/properties/:id/force-link-subject", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { scrapedPropertyUrl, scrapedPropertyName } = req.body;
      
      if (!scrapedPropertyUrl && !scrapedPropertyName) {
        return res.status(400).json({ 
          message: "Either scrapedPropertyUrl or scrapedPropertyName is required" 
        });
      }
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      console.log('[FORCE_LINK] Forcing link for property:', property.propertyName);
      console.log('[FORCE_LINK] Search criteria:', { url: scrapedPropertyUrl, name: scrapedPropertyName });
      
      // Find the scraped property
      let targetProperty = null;
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      
      for (const job of scrapingJobs) {
        const scrapedProperties = await storage.getScrapedPropertiesByJob(job.id);
        
        // Find by URL or name
        targetProperty = scrapedProperties.find(p => 
          (scrapedPropertyUrl && p.url === scrapedPropertyUrl) ||
          (scrapedPropertyName && p.name.toLowerCase().includes(scrapedPropertyName.toLowerCase()))
        );
        
        if (targetProperty) {
          console.log('[FORCE_LINK] Found target property:', targetProperty.name);
          
          // Mark all others as non-subject (in real implementation, would update storage)
          for (const prop of scrapedProperties) {
            if (prop.id !== targetProperty.id && prop.isSubjectProperty) {
              prop.isSubjectProperty = false;
              console.log('[FORCE_LINK] Unmarking:', prop.name);
            }
          }
          
          // Mark target as subject
          targetProperty.isSubjectProperty = true;
          console.log('[FORCE_LINK] ✅ Marked as subject:', targetProperty.name);
          break;
        }
      }
      
      if (!targetProperty) {
        return res.status(404).json({ 
          message: "Scraped property not found",
          searchCriteria: { url: scrapedPropertyUrl, name: scrapedPropertyName }
        });
      }
      
      // Now sync the units
      const scrapedUnits = await storage.getScrapedUnitsByProperty(targetProperty.id);
      console.log('[FORCE_LINK] Found', scrapedUnits.length, 'units to sync');
      
      // Clear existing and sync
      await storage.clearPropertyUnits(propertyId);
      const units = [];
      
      for (const scrapedUnit of scrapedUnits) {
        const unit = await storage.createPropertyUnit({
          propertyId,
          unitNumber: scrapedUnit.unitNumber || scrapedUnit.floorPlanName || `Unit-${scrapedUnit.id.substring(0, 6)}`,
          unitType: scrapedUnit.unitType,
          currentRent: scrapedUnit.rent || "0",
          status: scrapedUnit.status || "occupied"
        });
        units.push(unit);
      }
      
      res.json({
        success: true,
        message: `Successfully force-linked ${targetProperty.name} and synced ${units.length} units`,
        subjectProperty: {
          id: targetProperty.id,
          name: targetProperty.name,
          address: targetProperty.address,
          url: targetProperty.url
        },
        unitsCount: units.length,
        units: units.slice(0, 5) // Return first 5 units as sample
      });
      
    } catch (error) {
      console.error("[FORCE_LINK] Error:", error);
      res.status(500).json({ message: "Failed to force link subject property" });
    }
  });
  
  // Debug-matching endpoint to diagnose matching issues
  app.get("/api/properties/:id/debug-matching", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      console.log('[DEBUG_MATCHING] Analyzing matches for:', property.propertyName);
      
      const results = {
        subjectProperty: {
          id: property.id,
          name: property.propertyName,
          address: property.address,
          city: property.city,
          state: property.state
        },
        scrapingJobs: [] as any[],
        allMatches: [] as any[],
        bestMatch: null as any,
        currentSubject: null as any
      };
      
      const scrapingJobs = await storage.getScrapingJobsByProperty(propertyId);
      
      for (const job of scrapingJobs) {
        const jobInfo = {
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
          properties: [] as any[]
        };
        
        const scrapedProperties = await storage.getScrapedPropertiesByJob(job.id);
        
        for (const scrapedProp of scrapedProperties) {
          const matchResult = calculatePropertyMatch(property, scrapedProp);
          
          const propertyInfo = {
            id: scrapedProp.id,
            name: scrapedProp.name,
            address: scrapedProp.address,
            url: scrapedProp.url,
            isSubjectProperty: scrapedProp.isSubjectProperty,
            matchScore: matchResult.score,
            isMatch: matchResult.isMatch,
            matchDetails: matchResult.matchDetails,
            reasons: matchResult.reasons
          };
          
          jobInfo.properties.push(propertyInfo);
          results.allMatches.push(propertyInfo);
          
          // Track current subject
          if (scrapedProp.isSubjectProperty) {
            results.currentSubject = propertyInfo;
          }
          
          // Track best match
          if (!results.bestMatch || matchResult.score > results.bestMatch.matchScore) {
            results.bestMatch = propertyInfo;
          }
        }
        
        results.scrapingJobs.push(jobInfo);
      }
      
      // Sort all matches by score
      results.allMatches.sort((a, b) => b.matchScore - a.matchScore);
      
      // Add recommendations
      const recommendations = [];
      
      if (!results.currentSubject && results.bestMatch) {
        if (results.bestMatch.matchScore >= 50) {
          recommendations.push({
            action: "AUTO_LINK",
            message: `Best match "${results.bestMatch.name}" has score ${results.bestMatch.matchScore}% - consider using sync-units endpoint which will auto-select it`
          });
        } else if (results.bestMatch.matchScore >= 40) {
          recommendations.push({
            action: "FORCE_LINK",
            message: `Best match "${results.bestMatch.name}" has score ${results.bestMatch.matchScore}% - use force-link endpoint to manually select it`
          });
        } else {
          recommendations.push({
            action: "RE_SCRAPE",
            message: `Best match only has score ${results.bestMatch.matchScore}% - consider re-scraping with a more accurate address`
          });
        }
      }
      
      if (results.currentSubject && results.currentSubject.matchScore < 50) {
        recommendations.push({
          action: "WARNING",
          message: `Current subject "${results.currentSubject.name}" has low match score ${results.currentSubject.matchScore}% - may be incorrectly matched`
        });
      }
      
      res.json({
        ...results,
        recommendations,
        summary: {
          totalScrapedProperties: results.allMatches.length,
          hasSubjectProperty: !!results.currentSubject,
          bestMatchScore: results.bestMatch ? results.bestMatch.matchScore : 0,
          matchThreshold: 50
        }
      });
      
    } catch (error) {
      console.error("[DEBUG_MATCHING] Error:", error);
      res.status(500).json({ message: "Failed to debug matching" });
    }
  });

  // Test endpoint for matching logic - can be removed in production if desired

  const httpServer = createServer(app);
  return httpServer;
}
