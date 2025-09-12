import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface WorkflowState {
  stage?: string;
  selectedCompetitorIds?: string[];
  filterCriteria?: any;
  optimizationParams?: any;
  timestamp?: string;
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
        setState(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error loading workflow state:", error);
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
        timestamp: new Date().toISOString()
      };
      
      await apiRequest('PUT', `/api/workflow/${propertyId}`, updatedState);
      setState(updatedState);
    } catch (error) {
      console.error("Error saving workflow state:", error);
    }
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
    saveState 
  };
}