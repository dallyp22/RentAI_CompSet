import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPropertySchema, insertPropertyAnalysisSchema, insertOptimizationReportSchema } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create property and get initial AI analysis
  app.post("/api/properties", async (req, res) => {
    try {
      const propertyData = insertPropertySchema.parse(req.body);
      
      // Create property
      const property = await storage.createProperty(propertyData);
      
      // Generate AI analysis
      const prompt = `Analyze the following property for real estate market positioning and provide insights in JSON format:
      
      Property Details:
      - Address: ${property.address}
      - Type: ${property.propertyType}
      - Total Units: ${property.totalUnits}
      - Built Year: ${property.builtYear}
      - Square Footage: ${property.squareFootage}
      - Parking Spaces: ${property.parkingSpaces}
      - Amenities: ${property.amenities.join(", ")}
      
      Please provide analysis in this exact JSON format:
      {
        "marketPosition": "string describing market position",
        "competitiveAdvantages": ["advantage1", "advantage2", "advantage3"],
        "pricingInsights": "string with pricing insights",
        "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
      }`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const analysisData = JSON.parse(aiResponse.choices[0].message.content || "{}");
      
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

  // Get property with analysis
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const analysis = await storage.getPropertyAnalysis(property.id);
      res.json({ property, analysis });
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  // Get all competitor properties
  app.get("/api/competitors", async (req, res) => {
    try {
      const competitors = await storage.getAllCompetitorProperties();
      res.json(competitors);
    } catch (error) {
      console.error("Error fetching competitors:", error);
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

      const competitors = await storage.getSelectedCompetitorProperties(ids);
      res.json(competitors);
    } catch (error) {
      console.error("Error fetching selected competitors:", error);
      res.status(500).json({ message: "Failed to fetch selected competitors" });
    }
  });

  // Create sample units for a property (for demo purposes)
  app.post("/api/properties/:id/units", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Create sample units based on property type
      const sampleUnits = [
        { unitNumber: "A101", unitType: "1BR/1BA", currentRent: "1450", status: "vacant" },
        { unitNumber: "A102", unitType: "1BR/1BA", currentRent: "1450", status: "occupied" },
        { unitNumber: "B201", unitType: "2BR/2BA", currentRent: "1850", status: "notice_given" },
        { unitNumber: "B202", unitType: "2BR/2BA", currentRent: "1900", status: "occupied" },
        { unitNumber: "C301", unitType: "3BR/2BA", currentRent: "2200", status: "vacant" }
      ];

      const units = [];
      for (const unitData of sampleUnits) {
        const unit = await storage.createPropertyUnit({
          propertyId,
          unitNumber: unitData.unitNumber,
          unitType: unitData.unitType,
          currentRent: unitData.currentRent,
          status: unitData.status
        });
        units.push(unit);
      }

      res.json(units);
    } catch (error) {
      console.error("Error creating units:", error);
      res.status(500).json({ message: "Failed to create property units" });
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

  // Generate optimization report
  app.post("/api/properties/:id/optimize", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { goal, riskTolerance, timeline } = req.body;

      const property = await storage.getProperty(propertyId);
      const units = await storage.getPropertyUnits(propertyId);
      
      if (!property || units.length === 0) {
        return res.status(404).json({ message: "Property or units not found" });
      }

      // Generate AI-powered optimization recommendations
      const prompt = `Generate pricing optimization recommendations for a property with the following details:

      Property: ${property.address}
      Goal: ${goal}
      Risk Tolerance: ${riskTolerance}
      Timeline: ${timeline}
      
      Current Units:
      ${units.map(unit => `${unit.unitNumber}: ${unit.unitType} - $${unit.currentRent} - ${unit.status}`).join('\n')}
      
      Please provide optimization in this exact JSON format:
      {
        "unitRecommendations": [
          {
            "unitNumber": "string",
            "currentRent": number,
            "recommendedRent": number,
            "change": number,
            "annualImpact": number
          }
        ],
        "totalIncrease": number,
        "affectedUnits": number,
        "avgIncrease": number,
        "riskLevel": "Low|Medium|High"
      }`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const optimizationData = JSON.parse(aiResponse.choices[0].message.content || "{}");
      
      // Update units with recommendations
      const updatedUnits = [];
      for (const recommendation of optimizationData.unitRecommendations) {
        const unit = units.find(u => u.unitNumber === recommendation.unitNumber);
        if (unit) {
          const updatedUnit = await storage.updatePropertyUnit(unit.id, {
            recommendedRent: recommendation.recommendedRent.toString()
          });
          updatedUnits.push(updatedUnit);
        }
      }

      // Create optimization report
      const report = await storage.createOptimizationReport({
        propertyId,
        goal,
        riskTolerance,
        timeline,
        totalIncrease: optimizationData.totalIncrease.toString(),
        affectedUnits: optimizationData.affectedUnits,
        avgIncrease: optimizationData.avgIncrease.toString(),
        riskLevel: optimizationData.riskLevel
      });

      res.json({ report, units: updatedUnits });
    } catch (error) {
      console.error("Error generating optimization:", error);
      res.status(500).json({ message: "Failed to generate optimization report" });
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

  const httpServer = createServer(app);
  return httpServer;
}
