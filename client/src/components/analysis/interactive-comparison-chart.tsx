import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Chart as ChartJS, 
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { UnitComparison } from "@shared/schema";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  // Calculate bubble size based on bedroom count
  const getBubbleSize = (bedrooms: number) => {
    return 4 + (bedrooms * 2); // Base size 4, +2 per bedroom
  };

  // Prepare data for chart
  const subjectData = subjectUnits.map(unit => ({
    x: unit.squareFootage || 0,
    y: unit.rent,
    r: getBubbleSize(unit.bedrooms),
    unitInfo: unit
  }));

  const competitorData = competitorUnits.map(unit => ({
    x: unit.squareFootage || 0,
    y: unit.rent,
    r: getBubbleSize(unit.bedrooms),
    unitInfo: unit
  }));

  const chartData = {
    datasets: [
      {
        label: 'Your Units',
        data: subjectData,
        backgroundColor: 'rgba(59, 130, 246, 0.6)', // Blue
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointStyle: 'circle',
      },
      {
        label: 'Competitor Units',
        data: competitorData,
        backgroundColor: 'rgba(239, 68, 68, 0.4)', // Red
        borderColor: 'rgba(239, 68, 68, 0.8)',
        borderWidth: 1,
        pointStyle: 'circle',
      }
    ],
  };

  const options = {
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
            return [
              `Property: ${unitInfo.propertyName}`,
              `Type: ${unitInfo.unitType}`,
              `Rent: $${unitInfo.rent}`,
              `Size: ${unitInfo.squareFootage || 'N/A'} sq ft`,
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
          text: 'Monthly Rent ($)',
        },
        min: 0,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value: any) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  // Calculate summary statistics
  const totalUnits = subjectUnits.length + competitorUnits.length;
  const avgSubjectRent = subjectUnits.length > 0 
    ? subjectUnits.reduce((sum, u) => sum + u.rent, 0) / subjectUnits.length 
    : 0;
  const avgCompetitorRent = competitorUnits.length > 0
    ? competitorUnits.reduce((sum, u) => sum + u.rent, 0) / competitorUnits.length
    : 0;

  return (
    <Card data-testid="interactive-comparison-chart">
      <CardHeader>
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
            <div className="h-[400px] mb-6" data-testid="scatter-chart">
              <Scatter data={chartData} options={options} />
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg" data-testid="avg-subject-rent">
                <div className="text-2xl font-bold text-blue-600">
                  ${Math.round(avgSubjectRent).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Your Avg Rent
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg" data-testid="avg-competitor-rent">
                <div className="text-2xl font-bold text-red-600">
                  ${Math.round(avgCompetitorRent).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Competitor Avg Rent
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg" data-testid="rent-difference">
                <div className={`text-2xl font-bold ${
                  avgSubjectRent > avgCompetitorRent ? 'text-green-600' : 
                  avgSubjectRent < avgCompetitorRent ? 'text-orange-600' : 
                  'text-gray-600'
                }`}>
                  {avgSubjectRent > avgCompetitorRent ? '+' : ''}
                  ${Math.round(avgSubjectRent - avgCompetitorRent).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Difference
                </div>
              </div>
            </div>

            {/* Chart Legend Info */}
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Bubble size represents bedroom count. Hover over points for detailed unit information.
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