import { Button } from "@/components/ui/button";
import { Download, ArrowRight, Clock } from "lucide-react";
import type { PropertyAnalysis } from "@shared/schema";

interface AIAnalysisProps {
  analysis: PropertyAnalysis;
  onContinue: () => void;
}

export default function AIAnalysis({ analysis, onContinue }: AIAnalysisProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6" data-testid="ai-analysis">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold" data-testid="analysis-title">
          OpenAI Property Analysis
        </h3>
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="mr-1 h-4 w-4" />
          Generated just now
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg" data-testid="market-position">
            <h4 className="font-semibold text-primary mb-2">Market Position</h4>
            <p className="text-sm text-muted-foreground">
              {analysis.marketPosition}
            </p>
          </div>
          
          <div className="p-4 bg-muted rounded-lg" data-testid="competitive-advantages">
            <h4 className="font-semibold text-primary mb-2">Competitive Advantages</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.competitiveAdvantages.map((advantage, index) => (
                <li key={index}>• {advantage}</li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg" data-testid="pricing-insights">
            <h4 className="font-semibold text-primary mb-2">Pricing Insights</h4>
            <p className="text-sm text-muted-foreground">
              {analysis.pricingInsights}
            </p>
          </div>
          
          <div className="p-4 bg-muted rounded-lg" data-testid="recommendations">
            <h4 className="font-semibold text-primary mb-2">Recommendations</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.recommendations.map((recommendation, index) => (
                <li key={index}>• {recommendation}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="status-notice">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
          <span className="text-sm font-medium text-blue-800">
            Competitive analysis data is ready for review.
          </span>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" data-testid="button-download-analysis">
          <Download className="mr-2 h-4 w-4" />
          Download Analysis
        </Button>
        <Button onClick={onContinue} data-testid="button-continue-competitors">
          Continue to Competitor Selection
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
