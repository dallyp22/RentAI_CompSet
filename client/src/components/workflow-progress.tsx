import { useLocation } from "wouter";
import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkflowState } from "@/hooks/use-workflow-state";

interface WorkflowProgressProps {
  propertyId?: string;
  scrapingStats?: {
    propertiesFound?: number;
    unitsScraped?: number;
    matchConfidence?: number;
  };
}

export default function WorkflowProgress({ propertyId, scrapingStats }: WorkflowProgressProps) {
  const [location] = useLocation();
  const { state } = useWorkflowState(propertyId || '');
  
  const steps = [
    { 
      name: "Input", 
      path: "/", 
      label: "Property Details",
      description: "Enter your property information"
    },
    { 
      name: "Summarize", 
      path: "/summarize", 
      label: "Market Summary",
      description: "Review competitors and market data"
    },
    { 
      name: "Analyze", 
      path: "/analyze", 
      label: "Analysis",
      description: "Deep dive into competitive positioning"
    },
    { 
      name: "Optimize", 
      path: "/optimize", 
      label: "Optimization",
      description: "Generate pricing recommendations"
    }
  ];
  
  const currentStepIndex = steps.findIndex(step => 
    location === "/" ? step.path === "/" : location.startsWith(step.path)
  );
  
  const isStepCompleted = (stepName: string) => {
    return state?.completedStages?.includes(stepName.toLowerCase()) || false;
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center space-x-2 py-4">
        {steps.map((step, index) => (
          <div key={step.name} className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-help">
                  {isStepCompleted(step.name) ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : index === currentStepIndex ? (
                    <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className={`text-sm ${
                    index === currentStepIndex 
                      ? "font-semibold text-primary" 
                      : isStepCompleted(step.name)
                      ? "font-medium text-green-700"
                      : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
                {isStepCompleted(step.name) && (
                  <Badge variant="outline" className="mt-1 text-xs">Completed</Badge>
                )}
              </TooltipContent>
            </Tooltip>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 transition-colors ${
                index < currentStepIndex ? "bg-green-600" : "bg-muted-foreground/30"
              }`} />
            )}
          </div>
        ))}
      </div>
      
      {/* Data Quality Indicators */}
      {scrapingStats && (scrapingStats.propertiesFound || scrapingStats.unitsScraped) && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          {scrapingStats.propertiesFound && (
            <Badge variant="secondary" className="text-xs">
              {scrapingStats.propertiesFound} properties found
            </Badge>
          )}
          {scrapingStats.unitsScraped && (
            <Badge variant="secondary" className="text-xs">
              {scrapingStats.unitsScraped} units analyzed
            </Badge>
          )}
          {scrapingStats.matchConfidence !== undefined && (
            <Badge 
              variant={scrapingStats.matchConfidence >= 70 ? "default" : "outline"}
              className={`text-xs ${
                scrapingStats.matchConfidence >= 70 
                  ? "bg-green-600" 
                  : scrapingStats.matchConfidence >= 50 
                  ? "bg-blue-600"
                  : "bg-yellow-600 text-white"
              }`}
            >
              {scrapingStats.matchConfidence.toFixed(0)}% match confidence
            </Badge>
          )}
        </div>
      )}
      
      {/* Warning if low confidence */}
      {scrapingStats?.matchConfidence !== undefined && scrapingStats.matchConfidence < 50 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
            <AlertCircle className="h-3 w-3" />
            <span>Please verify your subject property on the Summarize page</span>
          </div>
        </div>
      )}
    </div>
  );
}
