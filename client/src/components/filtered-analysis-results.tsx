import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, MapPin, Award, Lightbulb, DollarSign } from "lucide-react";
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
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6" data-testid="filtered-analysis-results">
      {/* Market Position Overview */}
      <Card data-testid="market-position-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Position Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg" data-testid="market-position">
              <div className="text-2xl font-bold text-primary" data-testid="market-position-value">
                {analysis.marketPosition}
              </div>
              <div className="text-sm text-muted-foreground">Market Position</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg" data-testid="unit-count">
              <div className="text-2xl font-bold text-primary" data-testid="unit-count-value">
                {analysis.unitCount}
              </div>
              <div className="text-sm text-muted-foreground">Filtered Units</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg" data-testid="avg-rent">
              <div className="text-2xl font-bold text-primary" data-testid="avg-rent-value">
                ${analysis.avgRent.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Average Rent</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Power Visualization */}
      <Card data-testid="pricing-power-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Power Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3" data-testid="pricing-power-score">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Pricing Power Score</span>
                <span className="text-sm font-bold" data-testid="pricing-power-value">
                  {analysis.pricingPowerScore}/100
                </span>
              </div>
              <Progress 
                value={analysis.pricingPowerScore} 
                className="h-3" 
                data-testid="pricing-power-progress"
              />
              <div className="text-xs text-muted-foreground">
                Based on market percentile and competitive positioning
              </div>
            </div>
            
            <div className="space-y-3" data-testid="market-percentile">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Market Percentile</span>
                <span className="text-sm font-bold" data-testid="percentile-value">
                  {analysis.percentileRank}th
                </span>
              </div>
              <Progress 
                value={analysis.percentileRank} 
                className="h-3" 
                data-testid="percentile-progress"
              />
              <div className="text-xs text-muted-foreground">
                Higher percentile indicates premium positioning
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg" data-testid="location-score">
              <div className="text-lg font-bold text-primary" data-testid="location-score-value">
                {analysis.locationScore}/100
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" />
                Location Score
              </div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg" data-testid="amenity-score">
              <div className="text-lg font-bold text-primary" data-testid="amenity-score-value">
                {analysis.amenityScore}/100
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Award className="h-3 w-3" />
                Amenity Score
              </div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg" data-testid="price-per-sqft">
              <div className="text-lg font-bold text-primary" data-testid="price-per-sqft-value">
                ${analysis.pricePerSqFt}
              </div>
              <div className="text-xs text-muted-foreground">Price/Sq Ft</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competitive Advantages */}
      <Card data-testid="competitive-advantages-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Competitive Advantages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.competitiveAdvantages.length > 0 ? (
            <div className="flex flex-wrap gap-2" data-testid="advantages-list">
              {analysis.competitiveAdvantages.map((advantage, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="px-3 py-1"
                  data-testid={`advantage-${index}`}
                >
                  {advantage}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm" data-testid="no-advantages">
              No specific competitive advantages identified with current filter criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card data-testid="recommendations-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recommended Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.recommendations.length > 0 ? (
            <div className="space-y-3" data-testid="recommendations-list">
              {analysis.recommendations.map((recommendation, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  data-testid={`recommendation-${index}`}
                >
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="text-sm">{recommendation}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm" data-testid="no-recommendations">
              No specific recommendations available for current filter criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}