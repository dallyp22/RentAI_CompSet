// Test script to verify property matching improvements

const testPropertyMatching = async () => {
  const BASE_URL = 'http://localhost:5000';
  
  console.log('Testing Property Matching Improvements');
  console.log('=====================================\n');
  
  // First, get all properties
  try {
    const propertiesResponse = await fetch(`${BASE_URL}/api/properties`);
    const properties = await propertiesResponse.json();
    
    if (properties.length === 0) {
      console.log('No properties found. Creating a test property...');
      
      // Create The Atlas property for testing
      const createResponse = await fetch(`${BASE_URL}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyName: 'The Atlas',
          address: '1000 Main Street, Omaha, NE 68102',
          city: 'Omaha',
          state: 'NE',
          totalUnits: 100
        })
      });
      
      const { property } = await createResponse.json();
      console.log(`✅ Created property: ${property.propertyName} (ID: ${property.id})`);
      
      // Now test the sync-units endpoint
      console.log('\n📊 Testing sync-units endpoint with fuzzy matching...');
      const syncResponse = await fetch(`${BASE_URL}/api/properties/${property.id}/sync-units`, {
        method: 'POST'
      });
      
      const syncResult = await syncResponse.json();
      console.log('Sync Result:', JSON.stringify(syncResult, null, 2));
      
      // Test the debug-matching endpoint
      console.log('\n🔍 Testing debug-matching endpoint...');
      const debugResponse = await fetch(`${BASE_URL}/api/properties/${property.id}/debug-matching`);
      const debugResult = await debugResponse.json();
      
      console.log('Debug Matching Summary:');
      console.log(`- Total scraped properties: ${debugResult.summary.totalScrapedProperties}`);
      console.log(`- Has subject property: ${debugResult.summary.hasSubjectProperty}`);
      console.log(`- Best match score: ${debugResult.summary.bestMatchScore}%`);
      
      if (debugResult.recommendations && debugResult.recommendations.length > 0) {
        console.log('\n📝 Recommendations:');
        debugResult.recommendations.forEach(rec => {
          console.log(`- [${rec.action}] ${rec.message}`);
        });
      }
      
      if (debugResult.bestMatch) {
        console.log('\n🎯 Best Match Details:');
        console.log(`- Name: ${debugResult.bestMatch.name}`);
        console.log(`- Address: ${debugResult.bestMatch.address}`);
        console.log(`- Score: ${debugResult.bestMatch.matchScore}%`);
        console.log(`- Is Subject: ${debugResult.bestMatch.isSubjectProperty}`);
      }
      
    } else {
      console.log(`Found ${properties.length} existing properties`);
      
      // Test with the first property
      const testProperty = properties[0];
      console.log(`\n📋 Testing with: ${testProperty.propertyName} (ID: ${testProperty.id})`);
      
      // Test debug-matching endpoint
      console.log('\n🔍 Testing debug-matching endpoint...');
      const debugResponse = await fetch(`${BASE_URL}/api/properties/${testProperty.id}/debug-matching`);
      const debugResult = await debugResponse.json();
      
      console.log('Debug Matching Summary:');
      console.log(`- Total scraped properties: ${debugResult.summary.totalScrapedProperties}`);
      console.log(`- Has subject property: ${debugResult.summary.hasSubjectProperty}`);
      console.log(`- Best match score: ${debugResult.summary.bestMatchScore}%`);
      console.log(`- Match threshold: ${debugResult.summary.matchThreshold}%`);
      
      if (debugResult.currentSubject) {
        console.log('\n✅ Current Subject Property:');
        console.log(`- Name: ${debugResult.currentSubject.name}`);
        console.log(`- Score: ${debugResult.currentSubject.matchScore}%`);
        console.log(`- URL: ${debugResult.currentSubject.url}`);
      }
      
      if (debugResult.bestMatch && !debugResult.currentSubject) {
        console.log('\n🎯 Best Match (not marked as subject):');
        console.log(`- Name: ${debugResult.bestMatch.name}`);
        console.log(`- Score: ${debugResult.bestMatch.matchScore}%`);
        console.log(`- URL: ${debugResult.bestMatch.url}`);
      }
      
      // Test sync-units endpoint
      console.log('\n📊 Testing sync-units endpoint...');
      const syncResponse = await fetch(`${BASE_URL}/api/properties/${testProperty.id}/sync-units`, {
        method: 'POST'
      });
      
      const syncResult = await syncResponse.json();
      if (syncResponse.ok) {
        console.log(`✅ Successfully synced ${syncResult.unitsCount} units`);
        if (syncResult.fallbackUsed) {
          console.log('⚠️ Fallback matching was used');
        }
        if (syncResult.subjectProperty) {
          console.log(`📍 Subject Property: ${syncResult.subjectProperty.name}`);
        }
      } else {
        console.log(`❌ Sync failed: ${syncResult.message}`);
        if (syncResult.suggestions) {
          console.log('\n💡 Suggestions:');
          syncResult.suggestions.forEach(s => console.log(`- ${s}`));
        }
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testPropertyMatching();