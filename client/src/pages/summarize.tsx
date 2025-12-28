import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, XCircle, Download, TrendingUp, TrendingDown, AlertCircle, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CompetitorSelection from "@/components/competitor-selection";
import SubjectPropertySelector from "@/components/subject-property-selector";
import RentComparisonChart from "@/components/rent-comparison-chart";
import UnitListingsTable from "@/components/unit-listings-table";
import { useWorkflowState } from "@/hooks/use-workflow-state";
import type { Property, PropertyAnalysis, ScrapedProperty } from "@shared/schema";

interface PropertyWithAnalysis {
  property: Property;
  analysis: PropertyAnalysis;
}

interface ScrapingResult {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  isSubjectProperty: boolean;
  scrapingJobId?: string;
  unitsFound: number;
  units: any[];
  error?: string;
}

interface Unit {
  unitNumber: string;
  unitType: string;
  bedrooms: number;
  bathrooms: string;
  squareFootage: number;
  rent: string;
  availabilityDate: string;
  status: string;
}

interface VacancyData {
  subjectProperty: {
    id: string;
    name: string;
    vacancyRate: number;
    unitTypes: UnitTypeData[];
    units?: Unit[];
  };
  competitors: {
    id: string;
    name: string;
    vacancyRate: number;
    unitTypes: UnitTypeData[];
    units?: Unit[];
  }[];
  marketInsights: {
    subjectVsMarket: string;
    strongestUnitType: string;
    totalVacancies: number;
    competitorAvgVacancies: number;
  };
}

interface UnitTypeData {
  type: string;
  totalUnits: number;
  availableUnits: number;
  vacancyRate: number;
  avgRent: number;
  avgSqFt: number;
  rentRange: { min: number; max: number };
}

export default function Summarize({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [selectedCompetitors, setSelectedCompetitors] = useState<ScrapedProperty[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [scrapingStage, setScrapingStage] = useState<'none' | 'scraping' | 'completed' | 'error'>('none');
  const [scrapingResults, setScrapingResults] = useState<ScrapingResult[]>([]);
  const [showVacancyChart, setShowVacancyChart] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState<{
    status: string;
    propertiesFound: number;
    isSearching: boolean;
  }>({ status: 'idle', propertiesFound: 0, isSearching: false });
  const { toast } = useToast();
  const { state: workflowState, saveState: saveWorkflowState, loadState: loadWorkflowState } = useWorkflowState(params.id);

  const propertyQuery = useQuery<PropertyWithAnalysis>({
    queryKey: ['/api/properties', params.id],
  });

  const competitorsQuery = useQuery<ScrapedProperty[]>({
    queryKey: ['/api/competitors'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds to catch new data
  });

  // Load workflow state on mount and restore selections
  useEffect(() => {
    const initializeState = async () => {
      const loadedState = await loadWorkflowState();
      if (loadedState && loadedState.selectedCompetitorIds && competitorsQuery.data) {
        const selected = competitorsQuery.data.filter(comp => 
          loadedState.selectedCompetitorIds?.includes(comp.id)
        );
        if (selected.length > 0) {
          setSelectedCompetitors(selected);
          setShowChart(true);
          // Check if scraping was completed
          if (loadedState.stage === 'summarize-completed') {
            setScrapingStage('completed');
            setShowVacancyChart(true);
          }
        }
      }
    };

    if (competitorsQuery.data) {
      initializeState();
    }
  }, [competitorsQuery.data, params.id]);

  // Vacancy data query - triggered after scraping completes
  const vacancyQuery = useQuery<VacancyData>({
    queryKey: ['/api/vacancy/summary', params.id, selectedCompetitors.map(c => c.id)],
    queryFn: async () => {
      const competitorIds = selectedCompetitors.map(c => c.id);
      const searchParams = new URLSearchParams({
        propertyId: params.id,
        ...competitorIds.reduce((acc, id, index) => {
          acc[`competitorIds[${index}]`] = id;
          return acc;
        }, {} as Record<string, string>)
      });
      const response = await apiRequest('GET', `/api/vacancy/summary?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vacancy data');
      }
      return await response.json();
    },
    enabled: scrapingStage === 'completed' && selectedCompetitors.length > 0,
    retry: 3,
    retryDelay: 2000,
  });

  const scrapingMutation = useMutation({
    mutationFn: async (competitorIds: string[]) => {
      const response = await apiRequest('POST', '/api/competitors/scrape-units', { competitorIds });
      return await response.json();
    },
    onSuccess: (data) => {
      setScrapingResults(data.results || []);
      setScrapingStage('completed');
      // Invalidate and refetch vacancy data
      queryClient.invalidateQueries({ queryKey: ['/api/vacancy/summary'] });
      toast({
        title: "Unit Scraping Completed",
        description: `Successfully scraped ${data.totalUnitsFound} units from ${data.processedProperties} properties.`
      });
    },
    onError: (error: any) => {
      setScrapingStage('error');
      console.error('Scraping error:', error);
      const errorMessage = error?.message || "Unknown error";
      const isTimeout = errorMessage.includes("timeout");
      const isNoData = errorMessage.includes("no units") || errorMessage.includes("0 units");
      
      toast({
        title: "Unit Scraping Failed",
        description: isTimeout
          ? "Request timed out. The property page may be slow to load. Try:\n• Selecting fewer competitors\n• Trying again in a moment\n• Checking your internet connection"
          : isNoData
          ? "No units found on the selected properties. This may mean:\n• Properties have no available units\n• Page structure changed\n• Try different competitors"
          : `${errorMessage}\n\nYou can:\n• Try again with different competitors\n• Continue with available data\n• Contact support if this persists`,
        variant: "destructive"
      });
    }
  });

  const handleCompetitorSelection = async (selectedIds: string[]) => {
    if (competitorsQuery.data) {
      const selected = competitorsQuery.data.filter(comp => selectedIds.includes(comp.id));
      setSelectedCompetitors(selected);
      setShowChart(true);
      
      // Save workflow state with selected competitors
      await saveWorkflowState({
        stage: 'summarize-in-progress',
        selectedCompetitorIds: selectedIds
      });
      
      // Start unit scraping workflow
      setScrapingStage('scraping');
      try {
        await scrapingMutation.mutateAsync(selectedIds);
        // Save completed state after successful scraping
        await saveWorkflowState({
          stage: 'summarize-completed',
          selectedCompetitorIds: selectedIds
        });
      } catch (error) {
        console.error('Failed to start scraping:', error);
      }
    }
  };

  const handleContinueToAnalyze = async () => {
    // Save workflow state before navigating
    await saveWorkflowState({
      stage: 'analyze',
      selectedCompetitorIds: selectedCompetitors.map(c => c.id)
    });
    setLocation(`/analyze/${params.id}`);
  };

  const handleBackToCompetitors = async () => {
    // Update workflow state but don't clear data
    await saveWorkflowState({
      stage: 'summarize',
      selectedCompetitorIds: [] // Still save empty to indicate going back
    });
    setShowChart(false);
    setShowVacancyChart(false);
    setScrapingStage('none');
    setSelectedCompetitors([]);
    setScrapingResults([]);
  };

  const handleExportData = () => {
    if (vacancyQuery.data) {
      const data = vacancyQuery.data;
      const csvContent = generateCSVReport(data);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rent-comparison-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Export Complete",
        description: "Rent comparison data has been downloaded as CSV."
      });
    }
  };

  const generateCSVReport = (data: VacancyData): string => {
    const headers = ['Property', 'Unit Type', 'Total Units', 'Available Units', 'Vacancy Rate %', 'Avg Rent', 'Avg Sq Ft', 'Min Rent', 'Max Rent'];
    const rows = [headers];
    
    // Add subject property data
    data.subjectProperty.unitTypes.forEach(unit => {
      rows.push([
        `${data.subjectProperty.name} (Subject)`,
        unit.type,
        unit.totalUnits.toString(),
        unit.availableUnits.toString(),
        unit.vacancyRate.toFixed(1),
        Math.round(unit.avgRent).toString(),
        Math.round(unit.avgSqFt).toString(),
        Math.round(unit.rentRange.min).toString(),
        Math.round(unit.rentRange.max).toString()
      ]);
    });
    
    // Add competitor data
    data.competitors.forEach(competitor => {
      competitor.unitTypes.forEach(unit => {
        rows.push([
          competitor.name,
          unit.type,
          unit.totalUnits.toString(),
          unit.availableUnits.toString(),
          unit.vacancyRate.toFixed(1),
          Math.round(unit.avgRent).toString(),
          Math.round(unit.avgSqFt).toString(),
          Math.round(unit.rentRange.min).toString(),
          Math.round(unit.rentRange.max).toString()
        ]);
      });
    });
    
    return rows.map(row => row.join(',')).join('\n');
  };

  // Effect to show vacancy chart when data is ready
  useEffect(() => {
    if (scrapingStage === 'completed' && vacancyQuery.data && !vacancyQuery.isLoading) {
      setShowVacancyChart(true);
    }
  }, [scrapingStage, vacancyQuery.data, vacancyQuery.isLoading]);

  if (propertyQuery.isLoading || competitorsQuery.isLoading) {
    return (
      <div className="space-y-6" data-testid="loading-state">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  {propertyQuery.isLoading ? "Loading property details..." : "Discovering competitor properties..."}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {propertyQuery.isLoading 
                    ? "Retrieving your property information" 
                    : "Analyzing nearby apartments and market data"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
      {/* Scraping Status - ALWAYS VISIBLE AT TOP */}
      {discoveryProgress.isSearching && (
        <Card className="border-blue-500 bg-blue-50 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <div className="flex-1">
                <p className="text-xl font-bold text-blue-900">
                  🔍 Discovering Competitor Properties...
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Scraping apartments.com in your area. Please wait ~30-60 seconds.
                </p>
                <div className="mt-3 bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-blue-600 animate-pulse" style={{width: '60%'}}></div>
                </div>
                <p className="text-xs text-blue-600 mt-2 font-semibold">
                  This page will update automatically when competitors are found!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {discoveryProgress.status === 'completed' && competitors.length > 0 && (
        <Card className="border-green-500 bg-green-50 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="flex-1">
                <p className="text-xl font-bold text-green-900">
                  ✅ Discovery Complete! Found {competitors.length} Properties
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Select up to 5 competitors below to compare with your property
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {competitors.length === 0 && !discoveryProgress.isSearching && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
              <div className="flex-1">
                <p className="text-lg font-bold text-yellow-900">
                  ⏳ Waiting for Competitor Data...
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Background scraping is in progress. This page will refresh automatically.
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  If nothing appears after 2 minutes, try refreshing the page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Property Card */}
      {propertyQuery.data && (
        <Card data-testid="subject-property-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default" className="mr-2">Subject Property</Badge>
              {propertyQuery.data.property.propertyName}
            </CardTitle>
            <CardDescription>
              {propertyQuery.data.property.address}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-lg font-semibold">{propertyQuery.data.property.totalUnits || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">City</p>
                <p className="text-lg font-semibold">{propertyQuery.data.property.city || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">State</p>
                <p className="text-lg font-semibold">{propertyQuery.data.property.state || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Property Type</p>
                <p className="text-lg font-semibold">{propertyQuery.data.property.propertyType || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Subject Property Selection - Show before competitor selection */}
      {competitors.length > 0 && (
        <SubjectPropertySelector
          propertyId={params.id}
          allProperties={[...competitors, ...competitors.filter(c => c.isSubjectProperty)]}
          currentSubjectId={competitors.find(c => c.isSubjectProperty)?.id}
          onSubjectChanged={() => {
            competitorsQuery.refetch();
          }}
        />
      )}
      
      {!showChart ? (
        <CompetitorSelection 
          competitors={competitors}
          onContinue={handleCompetitorSelection}
        />
      ) : (
        <>
          <div className="bg-card rounded-lg border border-border p-6" data-testid="competitor-summary">
            <h3 className="text-xl font-semibold mb-6">Selected Competitors</h3>
            <div className="space-y-4">
              {selectedCompetitors.map((competitor) => (
                <div key={competitor.id} className="p-4 bg-muted rounded-lg" data-testid={`selected-competitor-${competitor.id}`}>
                  <div className="font-semibold">{competitor.name}</div>
                  <div className="text-sm text-muted-foreground">{competitor.address}</div>
                  {competitor.distance && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Distance: {competitor.distance} miles
                    </div>
                  )}
                  {competitor.matchScore && (
                    <div className="text-xs text-muted-foreground">
                      Match Score: {competitor.matchScore}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Unit Scraping Progress Section */}
          <div className="bg-card rounded-lg border border-border p-6" data-testid="unit-scraping-section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Unit Data Collection</h3>
              {scrapingStage === 'scraping' && (
                <div className="flex items-center text-blue-600" data-testid="scraping-indicator">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="text-sm">Scraping unit details...</span>
                </div>
              )}
              {scrapingStage === 'completed' && (
                <div className="flex items-center text-green-600" data-testid="scraping-completed">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">Collection completed</span>
                </div>
              )}
              {scrapingStage === 'error' && (
                <div className="flex items-center text-red-600" data-testid="scraping-error">
                  <XCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">Collection failed</span>
                </div>
              )}
            </div>

            {scrapingStage === 'scraping' && (
              <div className="space-y-3" data-testid="scraping-progress">
                <p className="text-sm text-muted-foreground">
                  Collecting detailed unit information from subject property and selected competitors. This may take a few minutes...
                </p>
                <div className="space-y-2">
                  {/* Note: During scraping, we show selected competitors. The backend will automatically include the subject property */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <div className="flex items-center">
                      <Loader2 className="h-3 w-3 mr-2 animate-spin text-blue-500" />
                      <div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Subject Property</span>
                        <div className="text-sm">Collecting unit data...</div>
                      </div>
                    </div>
                  </div>
                  {selectedCompetitors.map((competitor) => (
                    <div key={competitor.id} className="flex items-center p-3 bg-muted rounded-md">
                      <Loader2 className="h-3 w-3 mr-2 animate-spin text-blue-500" />
                      <span className="text-sm">{competitor.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scrapingStage === 'completed' && scrapingResults.length > 0 && (
              <div className="space-y-3" data-testid="scraping-results">
                <p className="text-sm text-muted-foreground">
                  Successfully collected unit data from {scrapingResults.filter(r => !r.error).length} properties
                  {scrapingResults.some(r => r.isSubjectProperty) ? ' (including subject property)' : ''}.
                </p>
                
                {/* Subject Property Display */}
                {scrapingResults.filter(r => r.isSubjectProperty).map((result) => (
                  <div key={result.propertyId} className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid={`subject-property-${result.propertyId}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {result.error ? (
                          <XCircle className="h-4 w-4 mr-2 text-red-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        )}
                        <div>
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Subject Property</span>
                          <div className="text-sm font-semibold">{result.propertyName}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.error ? 'Failed to collect data' : `${result.unitsFound} units found`}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Competitor Properties Display */}
                {scrapingResults.filter(r => !r.isSubjectProperty).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground mt-4">Competitor Properties</h4>
                    {scrapingResults.filter(r => !r.isSubjectProperty).map((result) => (
                      <div key={result.propertyId} className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid={`competitor-result-${result.propertyId}`}>
                        <div className="flex items-center">
                          {result.error ? (
                            <XCircle className="h-4 w-4 mr-2 text-red-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                          )}
                          <span className="text-sm font-medium">{result.propertyName}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.error ? 'Failed to collect data' : `${result.unitsFound} units found`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {scrapingStage === 'error' && (
              <div className="text-center py-4" data-testid="scraping-error-message">
                <p className="text-sm text-muted-foreground mb-3">
                  Failed to collect unit data. Please try again or proceed with available data.
                </p>
                <Button
                  onClick={() => scrapingMutation.mutate(selectedCompetitors.map(c => c.id))}
                  variant="outline"
                  size="sm"
                  data-testid="button-retry-scraping"
                >
                  Retry Collection
                </Button>
              </div>
            )}
          </div>

          {/* Vacancy Analysis Chart */}
          {showVacancyChart && (
            <div className="space-y-6" data-testid="vacancy-analysis-section">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">Rent Analysis & Market Comparison</h3>
                </div>
                {vacancyQuery.data && (
                  <Badge variant="secondary" className="text-xs">
                    {vacancyQuery.data.competitors.length + 1} Properties Analyzed
                  </Badge>
                )}
              </div>

              <RentComparisonChart 
                data={vacancyQuery.data || null}
                isLoading={vacancyQuery.isLoading}
                error={vacancyQuery.error?.message}
              />

              {/* Key Market Insights */}
              {vacancyQuery.data && (
                <Card data-testid="market-insights">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span>Key Market Insights</span>
                    </CardTitle>
                    <CardDescription>
                      Market analysis based on {vacancyQuery.data.competitors.length} competitor properties
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Subject Property vs Market */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center space-x-2 mb-2">
                          {vacancyQuery.data.subjectProperty.vacancyRate < vacancyQuery.data.marketInsights.competitorAvgVacancies ? (
                            <TrendingDown className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Market Position</span>
                        </div>
                        <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {vacancyQuery.data.subjectProperty.vacancyRate.toFixed(1)}% Vacancy
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          {vacancyQuery.data.marketInsights.subjectVsMarket}
                        </div>
                      </div>

                      {/* Strongest Unit Type */}
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">Strongest Unit</span>
                        </div>
                        <div className="text-lg font-bold text-green-900 dark:text-green-100">
                          {vacancyQuery.data.marketInsights.strongestUnitType}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Lowest vacancy rate
                        </div>
                      </div>

                      {/* Market Avg Vacancy */}
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Market Average</span>
                        </div>
                        <div className="text-lg font-bold text-amber-900 dark:text-amber-100">
                          {vacancyQuery.data.marketInsights.competitorAvgVacancies.toFixed(1)}%
                        </div>
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          Competitor avg vacancy
                        </div>
                      </div>

                      {/* Total Market Vacancies */}
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center space-x-2 mb-2">
                          <BarChart3 className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Total Vacancies</span>
                        </div>
                        <div className="text-lg font-bold text-purple-900 dark:text-purple-100">
                          {vacancyQuery.data.marketInsights.totalVacancies}
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          Across all properties
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Detailed insights text */}
                    <div className="prose max-w-none">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Your property <strong>{vacancyQuery.data.subjectProperty.name}</strong> has a vacancy rate of <strong>{vacancyQuery.data.subjectProperty.vacancyRate.toFixed(1)}%</strong>, 
                        which is <strong>{vacancyQuery.data.marketInsights.subjectVsMarket.toLowerCase()}</strong>. 
                        The <strong>{vacancyQuery.data.marketInsights.strongestUnitType}</strong> unit type shows the strongest performance with the lowest vacancy rate. 
                        Consider focusing optimization efforts on underperforming unit types while leveraging the success of your strongest units.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Unit Listings Tables Section */}
              {vacancyQuery.data?.subjectProperty?.units && (
                <div className="space-y-6" data-testid="unit-listings-section">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Detailed Unit Listings</h3>
                    <Badge variant="outline" className="text-xs">
                      {vacancyQuery.data.subjectProperty.units.length + 
                       vacancyQuery.data.competitors.reduce((sum, c) => sum + (c.units?.length || 0), 0)} Total Units
                    </Badge>
                  </div>

                  {/* Subject Property Units Table */}
                  <UnitListingsTable
                    propertyName={vacancyQuery.data.subjectProperty.name}
                    units={vacancyQuery.data.subjectProperty.units || []}
                    isSubjectProperty={true}
                  />

                  {/* Competitor Property Units Tables */}
                  {vacancyQuery.data.competitors.map((competitor) => (
                    <UnitListingsTable
                      key={competitor.id}
                      propertyName={competitor.name}
                      units={competitor.units || []}
                      isSubjectProperty={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6" data-testid="navigation-buttons">
            <Button 
              variant="outline" 
              onClick={handleBackToCompetitors}
              data-testid="button-back-competitors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Competitors
            </Button>
            
            <div className="flex space-x-3">
              {vacancyQuery.data && (
                <Button 
                  variant="outline" 
                  onClick={handleExportData}
                  data-testid="button-export-data"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
              )}
              
              <Button 
                onClick={handleContinueToAnalyze}
                disabled={scrapingStage === 'scraping'}
                data-testid="button-continue-to-analyze"
              >
                {scrapingStage === 'scraping' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Collecting Data...
                  </>
                ) : (
                  <>
                    Proceed to Analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
