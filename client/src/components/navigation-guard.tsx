import { useEffect } from "react";
import { useLocation } from "wouter";
import { useWorkflowState } from "@/hooks/use-workflow-state";

interface NavigationGuardProps {
  propertyId: string;
  onBeforeNavigate?: () => Promise<void> | void;
}

export default function NavigationGuard({ propertyId, onBeforeNavigate }: NavigationGuardProps) {
  const [location] = useLocation();
  const { saveState } = useWorkflowState(propertyId);

  useEffect(() => {
    // Save state before page unload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers ignore custom messages, but we still prevent unload
      // if there's unsaved data
      if (onBeforeNavigate) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // Auto-save on location change
    const handleLocationChange = async () => {
      if (onBeforeNavigate) {
        await onBeforeNavigate();
      }
      
      // Determine current stage from location
      let currentStage = 'input';
      if (location.includes('/summarize')) currentStage = 'summarize';
      else if (location.includes('/analyze')) currentStage = 'analyze';
      else if (location.includes('/optimize')) currentStage = 'optimize';
      
      // Auto-save current stage
      await saveState({ 
        stage: currentStage,
        lastVisitedStage: currentStage
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    handleLocationChange();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [location, propertyId, onBeforeNavigate]);

  return null; // This is a utility component, renders nothing
}

