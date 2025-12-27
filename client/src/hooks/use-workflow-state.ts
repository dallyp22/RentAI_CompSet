import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface WorkflowState {
  stage?: string;
  completedStages?: string[];
  selectedCompetitorIds?: string[];
  filterCriteria?: any;
  optimizationParams?: any;
  scrapingCompleted?: boolean;
  timestamp?: string;
  propertyData?: any;
  lastVisitedStage?: string;
}

export function useWorkflowState(propertyId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<WorkflowState | null>(null);

  const loadState = async (): Promise<WorkflowState | null> => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', `/api/workflow/${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Also load from localStorage for immediate availability
        const localState = localStorage.getItem(`workflow-${propertyId}`);
        if (localState) {
          try {
            const parsed = JSON.parse(localState);
            // Merge server state with local state, preferring server for critical data
            const mergedState = {
              ...parsed,
              ...data,
              // Keep local cache for non-critical data if server doesn't have it
              filterCriteria: data.filterCriteria || parsed.filterCriteria,
              optimizationParams: data.optimizationParams || parsed.optimizationParams
            };
            setState(mergedState);
            return mergedState;
          } catch (e) {
            setState(data);
            return data;
          }
        }
        
        setState(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error loading workflow state:", error);
      // Try loading from localStorage as fallback
      const localState = localStorage.getItem(`workflow-${propertyId}`);
      if (localState) {
        try {
          const parsed = JSON.parse(localState);
          setState(parsed);
          return parsed;
        } catch (e) {
          return null;
        }
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const saveState = async (updates: Partial<WorkflowState>): Promise<void> => {
    try {
      const updatedState = {
        ...state,
        ...updates,
        timestamp: new Date().toISOString(),
        lastVisitedStage: updates.stage || state?.stage
      };
      
      // Update completed stages
      if (updates.stage && !updatedState.completedStages?.includes(updates.stage)) {
        updatedState.completedStages = [
          ...(updatedState.completedStages || []),
          updates.stage
        ];
      }
      
      // Save to localStorage immediately for instant navigation
      localStorage.setItem(`workflow-${propertyId}`, JSON.stringify(updatedState));
      
      // Also save to server
      await apiRequest('PUT', `/api/workflow/${propertyId}`, updatedState);
      setState(updatedState);
    } catch (error) {
      console.error("Error saving workflow state:", error);
      // Still update local state even if server save fails
      const updatedState = {
        ...state,
        ...updates,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`workflow-${propertyId}`, JSON.stringify(updatedState));
      setState(updatedState);
    }
  };

  const clearState = async (): Promise<void> => {
    localStorage.removeItem(`workflow-${propertyId}`);
    setState(null);
  };

  // Load state on mount
  useEffect(() => {
    if (propertyId) {
      loadState();
    }
  }, [propertyId]);

  return { 
    state, 
    isLoading, 
    loadState, 
    saveState,
    clearState
  };
}