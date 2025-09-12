import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, Sparkles, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

interface DynamicInsightsPanelProps {
  aiInsights: string[];
  isLoading?: boolean;
}

export default function DynamicInsightsPanel({ 
  aiInsights, 
  isLoading = false 
}: DynamicInsightsPanelProps) {
  const [displayedInsights, setDisplayedInsights] = useState<string[]>([]);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (aiInsights && aiInsights.length > 0 && !isLoading) {
      setAnimating(true);
      setTimeout(() => {
        setDisplayedInsights(aiInsights);
        setAnimating(false);
      }, 300);
    }
  }, [aiInsights, isLoading]);

  const getInsightIcon = (index: number) => {
    const icons = [
      <Lightbulb className="h-4 w-4" />,
      <Sparkles className="h-4 w-4" />,
      <RefreshCw className="h-4 w-4" />
    ];
    return icons[index] || icons[0];
  };

  return (
    <Card data-testid="dynamic-insights-panel">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          AI-Generated Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" data-testid="insights-loading">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : displayedInsights.length > 0 ? (
          <div 
            className={`space-y-3 transition-opacity duration-300 ${
              animating ? 'opacity-50' : 'opacity-100'
            }`}
            data-testid="insights-list"
          >
            {displayedInsights.map((insight, index) => (
              <Alert 
                key={index} 
                className="border-l-4 border-l-primary"
                data-testid={`insight-${index}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                  <AlertDescription className="flex-1">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-primary">
                        {getInsightIcon(index)}
                      </div>
                      <span className="text-sm leading-relaxed">
                        {insight}
                      </span>
                    </div>
                  </AlertDescription>
                </div>
              </Alert>
            ))}
          </div>
        ) : (
          <Alert data-testid="no-insights">
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              No AI insights available. Insights will be generated based on your filter selections and market comparison data.
            </AlertDescription>
          </Alert>
        )}

        {/* Insights metadata */}
        {displayedInsights.length > 0 && !isLoading && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Generated from {aiInsights.length} market factors</span>
              <span>Updates with filter changes</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}