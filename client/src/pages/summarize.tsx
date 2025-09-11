import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import CompetitorSelection from "@/components/competitor-selection";
import VacancyChart from "@/components/vacancy-chart";
import type { Property, PropertyAnalysis, CompetitorProperty } from "@shared/schema";

interface PropertyWithAnalysis {
  property: Property;
  analysis: PropertyAnalysis;
}

export default function Summarize({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [selectedCompetitors, setSelectedCompetitors] = useState<CompetitorProperty[]>([]);
  const [showChart, setShowChart] = useState(false);

  const propertyQuery = useQuery<PropertyWithAnalysis>({
    queryKey: ['/api/properties', params.id],
  });

  const competitorsQuery = useQuery<CompetitorProperty[]>({
    queryKey: ['/api/competitors'],
  });

  const handleCompetitorSelection = (selectedIds: string[]) => {
    if (competitorsQuery.data) {
      const selected = competitorsQuery.data.filter(comp => selectedIds.includes(comp.id));
      setSelectedCompetitors(selected);
      setShowChart(true);
    }
  };

  const handleContinueToAnalyze = () => {
    setLocation(`/analyze/${params.id}`);
  };

  if (propertyQuery.isLoading || competitorsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-state">
        <div className="text-muted-foreground">Loading property data...</div>
      </div>
    );
  }

  if (propertyQuery.error || competitorsQuery.error) {
    return (
      <div className="text-center py-8" data-testid="error-state">
        <div className="text-red-600 mb-4">Failed to load property data</div>
        <Button onClick={() => window.location.reload()} data-testid="button-retry">
          Retry
        </Button>
      </div>
    );
  }

  const competitors = competitorsQuery.data || [];

  return (
    <div className="space-y-6" data-testid="summarize-page">
      {!showChart ? (
        <CompetitorSelection 
          competitors={competitors}
          onContinue={handleCompetitorSelection}
        />
      ) : (
        <>
          <VacancyChart
            subjectVacancyRate={8.5} // This should be calculated from actual property data
            competitors={selectedCompetitors}
          />
          
          <div className="flex justify-end" data-testid="continue-section">
            <Button onClick={handleContinueToAnalyze} data-testid="button-proceed-analysis">
              Proceed to Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
