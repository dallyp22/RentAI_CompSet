import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import OptimizationTable from "@/components/optimization-table";
import { exportToExcel, type ExcelExportData } from "@/lib/excel-export";
import type { Property, PropertyUnit, OptimizationReport } from "@shared/schema";

interface OptimizationData {
  report: OptimizationReport;
  units: PropertyUnit[];
}

interface PropertyWithAnalysis {
  property: Property;
  analysis: any;
}

export default function Optimize({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [goal, setGoal] = useState("Maximize Revenue");
  const [riskTolerance, setRiskTolerance] = useState("Moderate");
  const [timeline, setTimeline] = useState("30 Days");

  const propertyQuery = useQuery<PropertyWithAnalysis>({
    queryKey: ['/api/properties', params.id],
  });

  const optimizationQuery = useQuery<OptimizationData>({
    queryKey: ['/api/properties', params.id, 'optimization'],
    enabled: false // We'll trigger this manually
  });

  const createUnitsMutation = useMutation({
    mutationFn: async (): Promise<PropertyUnit[]> => {
      const res = await apiRequest("POST", `/api/properties/${params.id}/units`, {});
      return res.json();
    }
  });

  const optimizeMutation = useMutation({
    mutationFn: async (data: { goal: string; riskTolerance: string; timeline: string }): Promise<OptimizationData> => {
      const res = await apiRequest("POST", `/api/properties/${params.id}/optimize`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/properties', params.id, 'optimization'], data);
      toast({
        title: "Optimization Complete",
        description: "Your pricing recommendations have been generated.",
      });
    },
    onError: () => {
      toast({
        title: "Optimization Failed",
        description: "Failed to generate recommendations. Please try again.",
        variant: "destructive",
      });
    }
  });

  const generateRecommendations = () => {
    // First create units if they don't exist, then optimize
    if (!optimizationQuery.data) {
      createUnitsMutation.mutate(undefined, {
        onSuccess: () => {
          optimizeMutation.mutate({ goal, riskTolerance, timeline });
        }
      });
    } else {
      optimizeMutation.mutate({ goal, riskTolerance, timeline });
    }
  };

  const handleExportToExcel = () => {
    const property = propertyQuery.data?.property;
    const optimization = optimizationQuery.data;
    
    if (!property || !optimization) {
      toast({
        title: "Export Failed",
        description: "No optimization data available to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData: ExcelExportData = {
      propertyInfo: {
        address: property.address,
        type: property.propertyType,
        units: property.totalUnits,
        builtYear: property.builtYear,
      },
      units: optimization.units.map(unit => ({
        unitNumber: unit.unitNumber,
        unitType: unit.unitType,
        currentRent: parseFloat(unit.currentRent),
        recommendedRent: unit.recommendedRent ? parseFloat(unit.recommendedRent) : undefined,
        change: unit.recommendedRent ? parseFloat(unit.recommendedRent) - parseFloat(unit.currentRent) : 0,
        annualImpact: unit.recommendedRent ? (parseFloat(unit.recommendedRent) - parseFloat(unit.currentRent)) * 12 : 0,
        status: unit.status,
      })),
      summary: {
        totalIncrease: parseFloat(optimization.report.totalIncrease),
        affectedUnits: optimization.report.affectedUnits,
        avgIncrease: parseFloat(optimization.report.avgIncrease),
        riskLevel: optimization.report.riskLevel,
      }
    };

    exportToExcel(exportData);
    
    toast({
      title: "Export Successful",
      description: "Optimization report has been downloaded.",
    });
  };

  if (propertyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-state">
        <div className="text-muted-foreground">Loading property data...</div>
      </div>
    );
  }

  if (propertyQuery.error) {
    return (
      <div className="text-center py-8" data-testid="error-state">
        <div className="text-red-600 mb-4">Failed to load property data</div>
        <Button onClick={() => window.location.reload()} data-testid="button-retry">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="optimize-page">
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" data-testid="optimization-title">
            Pricing Optimization
          </h3>
          <Button 
            onClick={handleExportToExcel}
            disabled={!optimizationQuery.data}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Optimization Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6" data-testid="optimization-controls">
          <div className="bg-muted p-4 rounded-lg">
            <label className="block text-sm font-medium mb-2">Optimization Goal</label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger data-testid="select-goal">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Maximize Revenue">Maximize Revenue</SelectItem>
                <SelectItem value="Minimize Vacancy">Minimize Vacancy</SelectItem>
                <SelectItem value="Market Competitive">Market Competitive</SelectItem>
                <SelectItem value="Premium Positioning">Premium Positioning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <label className="block text-sm font-medium mb-2">Risk Tolerance</label>
            <Select value={riskTolerance} onValueChange={setRiskTolerance}>
              <SelectTrigger data-testid="select-risk">
                <SelectValue placeholder="Select risk tolerance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Conservative">Conservative</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="Aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <label className="block text-sm font-medium mb-2">Implementation Timeline</label>
            <Select value={timeline} onValueChange={setTimeline}>
              <SelectTrigger data-testid="select-timeline">
                <SelectValue placeholder="Select timeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="30 Days">30 Days</SelectItem>
                <SelectItem value="60 Days">60 Days</SelectItem>
                <SelectItem value="90 Days">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <Button 
              className="w-full"
              onClick={generateRecommendations}
              disabled={optimizeMutation.isPending || createUnitsMutation.isPending}
              data-testid="button-generate-recommendations"
            >
              {(optimizeMutation.isPending || createUnitsMutation.isPending) 
                ? "Generating..." 
                : "Update Recommendations"}
            </Button>
          </div>
        </div>

        {/* Optimization Table */}
        {optimizationQuery.data ? (
          <OptimizationTable
            units={optimizationQuery.data.units}
            report={optimizationQuery.data.report}
          />
        ) : (
          <div className="text-center py-8" data-testid="no-data-state">
            <div className="text-muted-foreground mb-4">
              No optimization data available. Generate recommendations to get started.
            </div>
            <Button 
              onClick={generateRecommendations}
              disabled={optimizeMutation.isPending || createUnitsMutation.isPending}
              data-testid="button-get-started"
            >
              Generate Recommendations
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        {optimizationQuery.data && (
          <div className="mt-6 flex justify-between">
            <Button variant="outline" data-testid="button-save-draft">
              Save Draft
            </Button>
            <div className="space-x-3">
              <Button variant="secondary" data-testid="button-schedule">
                Schedule Implementation
              </Button>
              <Button data-testid="button-apply-recommendations">
                Apply Recommendations
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
