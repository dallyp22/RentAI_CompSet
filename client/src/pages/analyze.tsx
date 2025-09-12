import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AnalysisFilters from "@/components/analysis-filters";
import FilteredAnalysisResults from "@/components/filtered-analysis-results";
import { useWorkflowState } from "@/hooks/use-workflow-state";
import type { FilterCriteria, FilteredAnalysis } from "@shared/schema";

export default function Analyze({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<FilterCriteria>({
    bedroomTypes: [],
    priceRange: { min: 800, max: 3000 },
    availability: "now",
    squareFootageRange: { min: 400, max: 2000 }
  });
  const [analysisData, setAnalysisData] = useState<FilteredAnalysis | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { state: workflowState, saveState: saveWorkflowState, loadState: loadWorkflowState } = useWorkflowState(params.id);

  // Mutation for filtered analysis
  const analysisMutation = useMutation({
    mutationFn: async (filterCriteria: FilterCriteria): Promise<FilteredAnalysis> => {
      const response = await apiRequest('POST', '/api/filtered-analysis', filterCriteria);
      return response.json();
    },
    onSuccess: (data: FilteredAnalysis) => {
      setAnalysisData(data);
    },
    onError: (error) => {
      console.error('Analysis error:', error);
    }
  });

  // Load workflow state on mount and restore filters
  useEffect(() => {
    const initializeState = async () => {
      const loadedState = await loadWorkflowState();
      if (loadedState && loadedState.filterCriteria) {
        setFilters(loadedState.filterCriteria);
      }
      setIsInitialized(true);
    };
    initializeState();
  }, [params.id]);

  // Trigger analysis when filters change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      analysisMutation.mutate(filters);
      // Save workflow state with current filters
      saveWorkflowState({
        stage: 'analyze',
        filterCriteria: filters
      });
    }
  }, [filters, isInitialized]);

  const handleFiltersChange = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
  };

  const handleContinueToOptimize = async () => {
    // Save workflow state before navigating
    await saveWorkflowState({
      stage: 'optimize',
      filterCriteria: filters
    });
    setLocation(`/optimize/${params.id}`);
  };

  return (
    <div className="space-y-6" data-testid="analyze-page">
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Panel */}
          <AnalysisFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />

          {/* Analysis Results Area */}
          {analysisMutation.error ? (
            <div className="flex-1 flex items-center justify-center py-12" data-testid="error-state">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <div className="text-lg font-medium">Analysis Failed</div>
                <div className="text-muted-foreground mb-4">
                  Unable to load analysis data. Please try again.
                </div>
                <Button 
                  onClick={() => analysisMutation.mutate(filters)} 
                  data-testid="button-retry"
                >
                  Retry Analysis
                </Button>
              </div>
            </div>
          ) : (
            <FilteredAnalysisResults 
              analysis={analysisData!}
              isLoading={analysisMutation.isPending}
            />
          )}
        </div>
        
        {/* Continue to Optimization Button */}
        {analysisData && !analysisMutation.isPending && (
          <div className="flex justify-end pt-6 border-t mt-6">
            <Button 
              onClick={handleContinueToOptimize} 
              data-testid="button-proceed-optimization"
              size="lg"
            >
              Proceed to Optimization
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}