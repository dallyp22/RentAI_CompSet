import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PropertyForm from "@/components/property-form";
import AIAnalysis from "@/components/ai-analysis";
import type { InsertProperty, Property, PropertyAnalysis } from "@shared/schema";

interface PropertyWithAnalysis {
  property: Property;
  analysis: PropertyAnalysis;
}

export default function PropertyInput() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [result, setResult] = useState<PropertyWithAnalysis | null>(null);

  const createPropertyMutation = useMutation({
    mutationFn: async (data: InsertProperty): Promise<PropertyWithAnalysis> => {
      const res = await apiRequest("POST", "/api/properties", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Analysis Complete",
        description: "Your property has been analyzed successfully.",
      });
    },
    onError: (error) => {
      console.error("Error creating property:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze your property. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: InsertProperty) => {
    createPropertyMutation.mutate(data);
  };

  const handleContinue = () => {
    if (result?.property.id) {
      setLocation(`/summarize/${result.property.id}`);
    }
  };

  return (
    <div className="space-y-6" data-testid="property-input-page">
      <PropertyForm 
        onSubmit={handleSubmit}
        isLoading={createPropertyMutation.isPending}
      />
      
      {result && (
        <AIAnalysis
          analysis={result.analysis}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
