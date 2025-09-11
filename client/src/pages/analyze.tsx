import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart, Sparkle } from "lucide-react";
import AnalysisFilters from "@/components/analysis-filters";
import type { Property, PropertyAnalysis } from "@shared/schema";

interface PropertyWithAnalysis {
  property: Property;
  analysis: PropertyAnalysis;
}

export default function Analyze({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    bedroomCount: true,
    squareFootage: true,
    distance: true,
    parkingRatio: true
  });

  const propertyQuery = useQuery<PropertyWithAnalysis>({
    queryKey: ['/api/properties', params.id],
  });

  const handleFilterChange = (filter: string, enabled: boolean) => {
    setActiveFilters(prev => ({ ...prev, [filter]: enabled }));
  };

  const handleResetFilters = () => {
    setActiveFilters({});
  };

  const handleContinueToOptimize = () => {
    setLocation(`/optimize/${params.id}`);
  };

  if (propertyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-state">
        <div className="text-muted-foreground">Loading analysis data...</div>
      </div>
    );
  }

  if (propertyQuery.error) {
    return (
      <div className="text-center py-8" data-testid="error-state">
        <div className="text-red-600 mb-4">Failed to load analysis data</div>
        <Button onClick={() => window.location.reload()} data-testid="button-retry">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="analyze-page">
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <AnalysisFilters
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          <div className="flex-1 space-y-6" data-testid="analysis-results">
            <h3 className="text-xl font-semibold" data-testid="results-title">
              Comparative Analysis Results
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="analysis-charts">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-3" data-testid="chart-title-1">
                  Price vs. Bedroom Count
                </h4>
                <div className="h-64 bg-background rounded flex items-center justify-center text-muted-foreground">
                  <div className="text-center" data-testid="chart-placeholder-1">
                    <Sparkle className="text-4xl mb-2 mx-auto" />
                    <div>Interactive Chart</div>
                    <div className="text-sm">Price correlation by bedroom count</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-3" data-testid="chart-title-2">
                  Amenities Impact
                </h4>
                <div className="h-64 bg-background rounded flex items-center justify-center text-muted-foreground">
                  <div className="text-center" data-testid="chart-placeholder-2">
                    <BarChart className="text-4xl mb-2 mx-auto" />
                    <div>Interactive Chart</div>
                    <div className="text-sm">Amenities vs. pricing premiums</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted p-6 rounded-lg" data-testid="insights-panel">
              <h4 className="font-semibold mb-4">Key Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-background rounded border-l-4 border-primary" data-testid="insight-pricing">
                  <div className="font-medium text-primary">Pricing Opportunity</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Your 2BR units are priced 5% below market average, suggesting room for optimization.
                  </div>
                </div>
                <div className="p-3 bg-background rounded border-l-4 border-green-500" data-testid="insight-advantage">
                  <div className="font-medium text-green-600">Competitive Advantage</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Your amenity package outperforms 78% of comparable properties in the area.
                  </div>
                </div>
                <div className="p-3 bg-background rounded border-l-4 border-amber-500" data-testid="insight-position">
                  <div className="font-medium text-amber-600">Market Position</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Properties within 0.5 miles command 8% higher rents due to location premium.
                  </div>
                </div>
                <div className="p-3 bg-background rounded border-l-4 border-blue-500" data-testid="insight-occupancy">
                  <div className="font-medium text-blue-600">Occupancy Correlation</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Lower vacancy rates correlate with properties offering modern fitness amenities.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleContinueToOptimize} data-testid="button-proceed-optimization">
                Proceed to Optimization
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
