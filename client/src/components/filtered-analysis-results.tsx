import MarketPositionGauge from "@/components/analysis/market-position-gauge";
import CompetitiveAdvantagesGrid from "@/components/analysis/competitive-advantages-grid";
import DynamicInsightsPanel from "@/components/analysis/dynamic-insights-panel";
import InteractiveComparisonChart from "@/components/analysis/interactive-comparison-chart";
import type { FilteredAnalysis } from "@shared/schema";

interface FilteredAnalysisResultsProps {
  analysis: FilteredAnalysis;
  isLoading?: boolean;
}

export default function FilteredAnalysisResults({ 
  analysis, 
  isLoading = false 
}: FilteredAnalysisResultsProps) {
  // Handle loading state or missing analysis data
  if (isLoading || !analysis) {
    return (
      <div className="flex-1 space-y-6" data-testid="analysis-loading">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MarketPositionGauge 
            percentileRank={50} 
            marketPosition="Loading..." 
            pricingPowerScore={50} 
          />
          <DynamicInsightsPanel 
            aiInsights={[]} 
            isLoading={true} 
          />
        </div>
        <CompetitiveAdvantagesGrid 
          competitiveEdges={{
            pricing: { edge: 0, label: "Loading...", status: "neutral" },
            size: { edge: 0, label: "Loading...", status: "neutral" },
            availability: { edge: 0, label: "Loading...", status: "neutral" },
            amenities: { edge: 0, label: "Loading...", status: "neutral" }
          }} 
        />
        <InteractiveComparisonChart 
          subjectUnits={[]} 
          competitorUnits={[]} 
          isLoading={true} 
        />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6" data-testid="filtered-analysis-results">
      {/* Top Row: Market Position and AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketPositionGauge 
          percentileRank={analysis.percentileRank}
          marketPosition={analysis.marketPosition}
          pricingPowerScore={analysis.pricingPowerScore}
        />
        <DynamicInsightsPanel 
          aiInsights={analysis.aiInsights || []}
          isLoading={isLoading}
        />
      </div>

      {/* Competitive Advantages Grid */}
      {analysis.competitiveEdges && (
        <CompetitiveAdvantagesGrid 
          competitiveEdges={analysis.competitiveEdges}
        />
      )}

      {/* Interactive Comparison Chart */}
      {analysis.subjectUnits && analysis.competitorUnits && (
        <InteractiveComparisonChart 
          subjectUnits={analysis.subjectUnits}
          competitorUnits={analysis.competitorUnits}
          isLoading={isLoading}
        />
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-muted rounded-lg" data-testid="unit-count">
          <div className="text-2xl font-bold text-primary" data-testid="unit-count-value">
            {analysis.unitCount}
          </div>
          <div className="text-sm text-muted-foreground">Your Units</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg" data-testid="avg-rent">
          <div className="text-2xl font-bold text-primary" data-testid="avg-rent-value">
            ${analysis.avgRent.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Avg Rent</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg" data-testid="location-score">
          <div className="text-2xl font-bold text-primary" data-testid="location-score-value">
            {analysis.locationScore}/100
          </div>
          <div className="text-sm text-muted-foreground">Location Score</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg" data-testid="price-per-sqft">
          <div className="text-2xl font-bold text-primary" data-testid="price-per-sqft-value">
            ${analysis.pricePerSqFt}
          </div>
          <div className="text-sm text-muted-foreground">Price/Sq Ft</div>
        </div>
      </div>
    </div>
  );
}