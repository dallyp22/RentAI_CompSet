import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Home, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ScrapedProperty } from "@shared/schema";

interface SubjectPropertySelectorProps {
  propertyId: string;
  allProperties: ScrapedProperty[];
  currentSubjectId?: string;
  onSubjectChanged?: () => void;
}

export default function SubjectPropertySelector({ 
  propertyId, 
  allProperties, 
  currentSubjectId,
  onSubjectChanged 
}: SubjectPropertySelectorProps) {
  const { toast } = useToast();
  
  const setSubjectMutation = useMutation({
    mutationFn: async (scrapedPropertyId: string) => {
      const res = await apiRequest("POST", `/api/properties/${propertyId}/set-subject`, {
        scrapedPropertyId
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competitors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties', propertyId] });
      toast({
        title: "Subject Property Updated",
        description: "Your subject property has been set successfully.",
      });
      onSubjectChanged?.();
    },
    onError: (error) => {
      console.error("Error setting subject property:", error);
      toast({
        title: "Failed to Update",
        description: "Could not set the subject property. Please try again.",
        variant: "destructive",
      });
    }
  });

  const subjectProperty = allProperties.find(p => p.isSubjectProperty);
  const hasLowConfidence = subjectProperty && parseFloat(subjectProperty.matchScore || "0") < 50;

  return (
    <Card className={hasLowConfidence ? "border-yellow-500 bg-yellow-50/50" : "border-blue-500 bg-blue-50/50"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Subject Property Identification
        </CardTitle>
        <CardDescription>
          {hasLowConfidence ? (
            <span className="flex items-center gap-2 text-yellow-700">
              <AlertCircle className="h-4 w-4" />
              Low confidence match detected. Please verify your property below.
            </span>
          ) : (
            "The system has identified your property. You can change it if incorrect."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {allProperties.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No properties found. Please run the scraping process first.
          </div>
        ) : (
          <>
            {allProperties.map((property) => {
              const isCurrentSubject = property.isSubjectProperty;
              const matchScore = parseFloat(property.matchScore || "0");
              
              return (
                <div
                  key={property.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isCurrentSubject
                      ? "border-blue-500 bg-blue-100"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{property.name}</span>
                        {isCurrentSubject && (
                          <Badge variant="default" className="bg-blue-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Your Property
                          </Badge>
                        )}
                        {matchScore > 0 && (
                          <Badge 
                            variant="outline" 
                            className={
                              matchScore >= 70 ? "border-green-600 text-green-700" :
                              matchScore >= 50 ? "border-blue-600 text-blue-700" :
                              matchScore >= 30 ? "border-yellow-600 text-yellow-700" :
                              "border-gray-400 text-gray-600"
                            }
                          >
                            {matchScore.toFixed(0)}% match
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {property.address}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {property.url}
                      </div>
                    </div>
                    
                    {!isCurrentSubject && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSubjectMutation.mutate(property.id)}
                        disabled={setSubjectMutation.isPending}
                        className="shrink-0"
                      >
                        Set as My Property
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
        
        {hasLowConfidence && subjectProperty && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> The current subject property "{subjectProperty.name}" has a low confidence match score of {parseFloat(subjectProperty.matchScore || "0").toFixed(0)}%. 
              Please verify this is correct, or select the right property from the list above.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

