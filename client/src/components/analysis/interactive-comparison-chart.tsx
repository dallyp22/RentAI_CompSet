import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Chart as ChartJS, 
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Scatter, Bar } from 'react-chartjs-2';
import type { UnitComparison } from "@shared/schema";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface InteractiveComparisonChartProps {
  subjectUnits: UnitComparison[];
  competitorUnits: UnitComparison[];
  isLoading?: boolean;
}

export default function InteractiveComparisonChart({ 
  subjectUnits, 
  competitorUnits,
  isLoading = false 
}: InteractiveComparisonChartProps) {
  // State for chart type and metric type
  const [chartType, setChartType] = useState<"scatter" | "bar">("scatter");
  const [metricType, setMetricType] = useState<"unitPrice" | "pricePerSqFt">("unitPrice");

  // Calculate price per sq ft for a unit
  const getPricePerSqFt = (unit: UnitComparison) => {
    return unit.squareFootage && unit.squareFootage > 0 
      ? unit.rent / unit.squareFootage 
      : null;
  };

  // Truncate property name for bar chart labels
  const truncatePropertyName = (name: string, maxLength: number = 15) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  // Prepare data for scatter chart
  const subjectScatterData = useMemo(() => {
    return subjectUnits
      .filter(unit => metricType === "unitPrice" || getPricePerSqFt(unit) !== null)
      .map(unit => ({
        x: unit.squareFootage || 0,
        y: metricType === "unitPrice" ? unit.rent : getPricePerSqFt(unit),
        unitInfo: unit
      }));
  }, [subjectUnits, metricType]);

  const competitorScatterData = useMemo(() => {
    return competitorUnits
      .filter(unit => metricType === "unitPrice" || getPricePerSqFt(unit) !== null)
      .map(unit => ({
        x: unit.squareFootage || 0,
        y: metricType === "unitPrice" ? unit.rent : getPricePerSqFt(unit),
        unitInfo: unit
      }));
  }, [competitorUnits, metricType]);

  // Prepare data for bar chart
  const barData = useMemo(() => {
    const filteredSubjectUnits = metricType === "pricePerSqFt" 
      ? subjectUnits.filter(unit => getPricePerSqFt(unit) !== null)
      : subjectUnits;
    const filteredCompetitorUnits = metricType === "pricePerSqFt"
      ? competitorUnits.filter(unit => getPricePerSqFt(unit) !== null)
      : competitorUnits;
    
    const allUnits = [...filteredSubjectUnits, ...filteredCompetitorUnits];
    const barLabels = allUnits.map((unit, index) => {
      const prefix = filteredSubjectUnits.includes(unit) ? 'S' : 'C';
      return `${prefix}${index + 1}: ${truncatePropertyName(unit.propertyName)}`;
    });

    return {
      labels: barLabels,
      datasets: [
        {
          label: 'Your Units',
          data: allUnits.map(unit => 
            filteredSubjectUnits.includes(unit) 
              ? (metricType === "unitPrice" ? unit.rent : getPricePerSqFt(unit))
              : null
          ),
          backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
        {
          label: 'Competitor Units',
          data: allUnits.map(unit => 
            filteredCompetitorUnits.includes(unit) 
              ? (metricType === "unitPrice" ? unit.rent : getPricePerSqFt(unit))
              : null
          ),
          backgroundColor: 'rgba(239, 68, 68, 0.4)', // Red
          borderColor: 'rgba(239, 68, 68, 0.8)',
          borderWidth: 1,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        }
      ],
    };
  }, [subjectUnits, competitorUnits, metricType]);

  const scatterData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'Your Units',
          data: subjectScatterData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointStyle: 'circle',
          pointRadius: (context: any) => {
            const unit = context.raw?.unitInfo;
            return unit ? 4 + (unit.bedrooms * 2) : 6;
          },
        },
        {
          label: 'Competitor Units',
          data: competitorScatterData,
          backgroundColor: 'rgba(239, 68, 68, 0.4)', // Red
          borderColor: 'rgba(239, 68, 68, 0.8)',
          borderWidth: 1,
          pointStyle: 'circle',
          pointRadius: (context: any) => {
            const unit = context.raw?.unitInfo;
            return unit ? 4 + (unit.bedrooms * 2) : 6;
          },
        }
      ],
    };
  }, [subjectScatterData, competitorScatterData]);

  const scatterOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const unitInfo = context.raw.unitInfo;
            const pricePerSqFt = getPricePerSqFt(unitInfo);
            return [
              `Property: ${unitInfo.propertyName}`,
              `Type: ${unitInfo.unitType}`,
              `Rent: $${unitInfo.rent.toLocaleString()}`,
              `Size: ${unitInfo.squareFootage || 'N/A'} sq ft`,
              `Price/SqFt: ${pricePerSqFt !== null ? `$${pricePerSqFt.toFixed(2)}` : 'N/A'}`,
              `Bedrooms: ${unitInfo.bedrooms}`,
              `Bathrooms: ${unitInfo.bathrooms || 'N/A'}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Square Footage',
        },
        min: 0,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      },
      y: {
        title: {
          display: true,
          text: metricType === "unitPrice" ? 'Monthly Rent ($)' : 'Price per Sq Ft ($/sq ft)',
        },
        min: 0,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value: any) {
            return metricType === "unitPrice" 
              ? '$' + value.toLocaleString()
              : '$' + value.toFixed(2);
          }
        }
      }
    }
  }), [metricType]);

  const barOptions = useMemo(() => {
    const filteredSubjectUnits = metricType === "pricePerSqFt" 
      ? subjectUnits.filter(unit => getPricePerSqFt(unit) !== null)
      : subjectUnits;
    const filteredCompetitorUnits = metricType === "pricePerSqFt"
      ? competitorUnits.filter(unit => getPricePerSqFt(unit) !== null)
      : competitorUnits;
    const allUnits = [...filteredSubjectUnits, ...filteredCompetitorUnits];
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const index = context.dataIndex;
              const unit = allUnits[index];
              const pricePerSqFt = getPricePerSqFt(unit);
              return [
                `Property: ${unit.propertyName}`,
                `Type: ${unit.unitType}`,
                `Rent: $${unit.rent.toLocaleString()}`,
                `Size: ${unit.squareFootage || 'N/A'} sq ft`,
                `Price/SqFt: ${pricePerSqFt !== null ? `$${pricePerSqFt.toFixed(2)}` : 'N/A'}`,
                `Bedrooms: ${unit.bedrooms}`,
                `Bathrooms: ${unit.bathrooms || 'N/A'}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Units',
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 20,
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          title: {
            display: true,
            text: metricType === "unitPrice" ? 'Monthly Rent ($)' : 'Price per Sq Ft ($/sq ft)',
          },
          min: 0,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            callback: function(value: any) {
              return metricType === "unitPrice" 
                ? '$' + value.toLocaleString()
                : '$' + value.toFixed(2);
            }
          }
        }
      }
    };
  }, [subjectUnits, competitorUnits, metricType]);

  // Calculate summary statistics
  const totalUnits = subjectUnits.length + competitorUnits.length;
  
  const avgSubjectRent = subjectUnits.length > 0 
    ? subjectUnits.reduce((sum, u) => sum + u.rent, 0) / subjectUnits.length 
    : 0;
  const avgCompetitorRent = competitorUnits.length > 0
    ? competitorUnits.reduce((sum, u) => sum + u.rent, 0) / competitorUnits.length
    : 0;
    
  const subjectUnitsWithSqFt = subjectUnits.filter(u => getPricePerSqFt(u) !== null);
  const competitorUnitsWithSqFt = competitorUnits.filter(u => getPricePerSqFt(u) !== null);
  
  const avgSubjectPricePerSqFt = subjectUnitsWithSqFt.length > 0
    ? subjectUnitsWithSqFt.reduce((sum, u) => sum + (getPricePerSqFt(u) || 0), 0) / subjectUnitsWithSqFt.length
    : 0;
  const avgCompetitorPricePerSqFt = competitorUnitsWithSqFt.length > 0
    ? competitorUnitsWithSqFt.reduce((sum, u) => sum + (getPricePerSqFt(u) || 0), 0) / competitorUnitsWithSqFt.length
    : 0;

  const displaySubjectMetric = metricType === "unitPrice" ? avgSubjectRent : avgSubjectPricePerSqFt;
  const displayCompetitorMetric = metricType === "unitPrice" ? avgCompetitorRent : avgCompetitorPricePerSqFt;
  const displayDifference = displaySubjectMetric - displayCompetitorMetric;

  return (
    <Card data-testid="interactive-comparison-chart">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle>Unit-Level Market Comparison</CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary" data-testid="subject-units-count">
                {subjectUnits.length} Your Units
              </Badge>
              <Badge variant="outline" data-testid="competitor-units-count">
                {competitorUnits.length} Competitor Units
              </Badge>
            </div>
          </div>
          
          {/* Chart Controls */}
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Chart Type:</span>
              <ToggleGroup 
                type="single" 
                value={chartType} 
                onValueChange={(value) => value && setChartType(value as "scatter" | "bar")}
                data-testid="toggle-chart-type"
              >
                <ToggleGroupItem value="scatter" aria-label="Scatter chart" data-testid="toggle-scatter">
                  Scatter
                </ToggleGroupItem>
                <ToggleGroupItem value="bar" aria-label="Bar chart" data-testid="toggle-bar">
                  Bar
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Metric:</span>
              <ToggleGroup 
                type="single" 
                value={metricType} 
                onValueChange={(value) => value && setMetricType(value as "unitPrice" | "pricePerSqFt")}
                data-testid="toggle-metric-type"
              >
                <ToggleGroupItem value="unitPrice" aria-label="Unit price" data-testid="toggle-unit-price">
                  Unit Price
                </ToggleGroupItem>
                <ToggleGroupItem value="pricePerSqFt" aria-label="Price per sq ft" data-testid="toggle-price-per-sqft">
                  Price per Sq Ft
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4" data-testid="chart-loading">
            <Skeleton className="h-[400px] w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        ) : totalUnits > 0 ? (
          <>
            {/* Chart Container */}
            <div className="h-[400px] mb-6" data-testid={chartType === "scatter" ? "scatter-chart" : "bar-chart"}>
              {chartType === "scatter" ? (
                <Scatter data={scatterData} options={scatterOptions} />
              ) : (
                <Bar data={barData} options={barOptions} />
              )}
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg" data-testid="avg-subject-metric">
                <div className="text-2xl font-bold text-blue-600">
                  {metricType === "unitPrice" 
                    ? `$${Math.round(displaySubjectMetric).toLocaleString()}`
                    : `$${displaySubjectMetric.toFixed(2)}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {metricType === "unitPrice" ? "Your Avg Rent" : "Your Avg $/SqFt"}
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg" data-testid="avg-competitor-metric">
                <div className="text-2xl font-bold text-red-600">
                  {metricType === "unitPrice" 
                    ? `$${Math.round(displayCompetitorMetric).toLocaleString()}`
                    : `$${displayCompetitorMetric.toFixed(2)}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {metricType === "unitPrice" ? "Competitor Avg Rent" : "Competitor Avg $/SqFt"}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg" data-testid="metric-difference">
                <div className={`text-2xl font-bold ${
                  displayDifference > 0 ? 'text-green-600' : 
                  displayDifference < 0 ? 'text-orange-600' : 
                  'text-gray-600'
                }`}>
                  {displayDifference > 0 ? '+' : ''}
                  {metricType === "unitPrice" 
                    ? `$${Math.round(displayDifference).toLocaleString()}`
                    : `$${displayDifference.toFixed(2)}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  Difference
                </div>
              </div>
            </div>

            {/* Chart Legend Info */}
            <div className="mt-4 text-xs text-muted-foreground text-center">
              {chartType === "scatter" 
                ? "Bubble size represents bedroom count. Hover over points for detailed unit information."
                : "S = Subject (Your) Units, C = Competitor Units. Hover over bars for detailed unit information."}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground" data-testid="no-data">
            No units match the current filter criteria. Try adjusting your filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}