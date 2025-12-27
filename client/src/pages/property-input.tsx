import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PropertyForm from "@/components/property-form";
import AIAnalysis from "@/components/ai-analysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Database } from "lucide-react";
import type { InsertProperty, Property, PropertyAnalysis, ScrapingJob } from "@shared/schema";

interface PropertyWithAnalysis {
  property: Property;
  analysis: PropertyAnalysis;
}

interface ScrapingResult {
  scrapingJob: ScrapingJob;
  message: string;
  targetUrl: string;
}

export default function PropertyInput() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [result, setResult] = useState<PropertyWithAnalysis | null>(null);
  const [scrapingResult, setScrapingResult] = useState<ScrapingResult | null>(null);
  const [existingProperty, setExistingProperty] = useState<Property | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  
  // Query to get the latest property (if it exists)
  const latestPropertyQuery = useQuery({
    queryKey: ['/api/properties/latest'],
    queryFn: async () => {
      const res = await fetch('/api/properties/latest');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch property');
      return res.json();
    },
    retry: false
  });
  
  useEffect(() => {
    if (latestPropertyQuery.data) {
      setExistingProperty(latestPropertyQuery.data);
    }
  }, [latestPropertyQuery.data]);

  const createPropertyMutation = useMutation({
    mutationFn: async (data: InsertProperty): Promise<PropertyWithAnalysis> => {
      setLoadingStatus("Creating property...");
      const res = await apiRequest("POST", "/api/properties", data);
      setLoadingStatus("Property created! Finding your listing...");
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setLoadingStatus("Discovering competitors...");
      // Automatically start scraping after property creation
      startScrapingMutation.mutate(data.property.id);
    },
    onError: (error: any) => {
      console.error("Error creating property:", error);
      const errorMessage = error?.message || "Unknown error occurred";
      const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("network");
      const isValidationError = errorMessage.includes("validation") || errorMessage.includes("invalid");
      
      toast({
        title: "Analysis Failed",
        description: isNetworkError 
          ? "Network error. Please check your connection and try again."
          : isValidationError
          ? "Invalid property data. Please check all fields and try again."
          : "Failed to analyze your property. Please verify all information and try again.",
        variant: "destructive",
      });
    }
  });

  const startScrapingMutation = useMutation({
    mutationFn: async (propertyId: string): Promise<ScrapingResult> => {
      setLoadingStatus("Scraping competitor properties...");
      const res = await apiRequest("POST", `/api/properties/${propertyId}/scrape`, {});
      setLoadingStatus("Competitors discovered!");
      return res.json();
    },
    onSuccess: (data) => {
      setScrapingResult(data);
      setLoadingStatus("");
      toast({
        title: "Discovery Complete",
        description: data.message,
      });
    },
    onError: (error: any) => {
      console.error("Error starting scraping:", error);
      const errorMessage = error?.message || "Failed to start competitive data scraping.";
      const isTemporary = errorMessage.includes("temporarily unavailable");
      const isApiKey = errorMessage.includes("API key") || errorMessage.includes("authentication");
      const isNetwork = errorMessage.includes("fetch") || errorMessage.includes("timeout");
      
      toast({
        title: isApiKey 
          ? "Configuration Error"
          : isTemporary 
          ? "Temporary Service Issue" 
          : isNetwork
          ? "Network Error"
          : "Scraping Failed",
        description: isApiKey
          ? "Firecrawl API key is not configured. Please check your environment variables."
          : isTemporary 
          ? "The scraping service is temporarily blocked. This usually resolves in a few minutes. Try:\n• Waiting 2-3 minutes\n• Using a different zip code\n• Contacting support if it persists"
          : isNetwork
          ? "Connection timed out. Please check your internet connection and try again."
          : `${errorMessage}\n\nTry:\n• Checking the address format\n• Using a different location\n• Retrying in a few moments`,
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
      {loadingStatus && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">{loadingStatus}</p>
                <p className="text-sm text-blue-700">This usually takes 5-10 seconds...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <PropertyForm 
        onSubmit={handleSubmit}
        isLoading={createPropertyMutation.isPending}
        initialValues={existingProperty ? {
          propertyName: existingProperty.propertyName,
          address: existingProperty.address
        } : undefined}
      />
      
      {result && (
        <AIAnalysis
          analysis={result.analysis}
          onContinue={handleContinue}
        />
      )}

      {/* Scraping Status Card */}
      {(startScrapingMutation.isPending || scrapingResult) && (
        <Card className="border-blue-200 bg-blue-50" data-testid="scraping-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Database className="h-5 w-5" />
              Competitive Data Scraping
            </CardTitle>
          </CardHeader>
          <CardContent>
            {startScrapingMutation.isPending && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Starting competitive data collection...</p>
                  <p className="text-sm text-blue-700">Analyzing your property address and preparing scraping job</p>
                </div>
              </div>
            )}
            
            {scrapingResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Scraping job initiated successfully!</p>
                    <p className="text-sm text-green-700">{scrapingResult.message}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Scraping Details:</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-blue-700">Target URL:</span>
                      <span className="ml-2 font-mono text-blue-900">{scrapingResult.targetUrl}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Job ID:</span>
                      <span className="ml-2 font-mono text-blue-900">{scrapingResult.scrapingJob.id}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Status:</span>
                      <span className="ml-2 text-blue-900 capitalize">{scrapingResult.scrapingJob.status}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-900">Background Processing</p>
                        <p className="text-yellow-800">
                          The scraping job is now running in the background. You can continue with the analysis 
                          while competitive data is being collected. Real scraped data will be available for 
                          comparison shortly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {startScrapingMutation.isError && (
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Scraping failed</p>
                  <p className="text-sm text-red-700">
                    Unable to start competitive data collection. You can still proceed with manual analysis.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
