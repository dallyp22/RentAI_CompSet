import { useLocation } from "wouter";

export default function WorkflowProgress() {
  const [location] = useLocation();
  
  const steps = [
    { id: 1, name: "Property Analysis", path: "/" },
    { id: 2, name: "Competitor Selection", path: "/summarize" },
    { id: 3, name: "Summary & Analysis", path: "/analyze" },
    { id: 4, name: "Optimization", path: "/optimize" }
  ];

  const getCurrentStep = () => {
    if (location === "/") return 1;
    if (location.includes("/summarize")) return 2;
    if (location.includes("/analyze")) return 3;
    if (location.includes("/optimize")) return 4;
    return 1;
  };

  const currentStep = getCurrentStep();

  return (
    <div className="mt-8 p-4 bg-muted rounded-lg" data-testid="workflow-progress">
      <h3 className="font-semibold mb-4" data-testid="progress-title">Analysis Progress</h3>
      <div className="space-y-3">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          
          return (
            <div key={step.id} className="flex items-center" data-testid={`step-${step.id}`}>
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                  isCompleted 
                    ? "step-completed" 
                    : isActive 
                    ? "step-active" 
                    : "step-inactive"
                }`}
                data-testid={`step-circle-${step.id}`}
              >
                {step.id}
              </div>
              <span 
                className={`text-sm ${
                  isActive || isCompleted 
                    ? "font-medium text-foreground" 
                    : "text-muted-foreground"
                }`}
                data-testid={`step-name-${step.id}`}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
