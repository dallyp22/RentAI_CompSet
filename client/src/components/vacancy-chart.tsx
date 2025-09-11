import type { CompetitorProperty } from "@shared/schema";

interface VacancyChartProps {
  subjectVacancyRate: number;
  competitors: CompetitorProperty[];
}

export default function VacancyChart({ subjectVacancyRate, competitors }: VacancyChartProps) {
  const allProperties = [
    { name: "Your Property", vacancyRate: subjectVacancyRate, color: "bg-primary" },
    ...competitors.map(comp => ({ 
      name: comp.name, 
      vacancyRate: parseFloat(comp.vacancyRate), 
      color: getColorForIndex(competitors.indexOf(comp))
    }))
  ];

  const maxRate = Math.max(...allProperties.map(p => p.vacancyRate));

  return (
    <div className="bg-card rounded-lg border border-border p-6" data-testid="vacancy-chart">
      <h3 className="text-xl font-semibold mb-6" data-testid="chart-title">
        Vacancy Comparison Summary
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-muted p-4 rounded-lg text-center" data-testid="subject-vacancy">
          <div className="text-2xl font-bold text-primary">
            {subjectVacancyRate.toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Your Property Vacancy</div>
        </div>
        <div className="bg-muted p-4 rounded-lg text-center" data-testid="market-average">
          <div className="text-2xl font-bold text-green-600">
            {calculateMarketAverage(competitors).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Market Average</div>
        </div>
        <div className="bg-muted p-4 rounded-lg text-center" data-testid="competitor-average">
          <div className="text-2xl font-bold text-amber-600">
            {calculateCompetitorAverage(competitors).toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground">Competitor Average</div>
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg" data-testid="chart-container">
        <h4 className="font-semibold mb-4">Vacancy Rate Comparison</h4>
        <div className="space-y-4">
          {allProperties.map((property, index) => (
            <div key={index} className="flex items-center" data-testid={`chart-bar-${index}`}>
              <div className="w-32 text-sm font-medium" data-testid={`property-name-${index}`}>
                {property.name}
              </div>
              <div className="flex-1 bg-background rounded-full h-6 relative">
                <div 
                  className={`chart-bar ${property.color} h-6 rounded-full`}
                  style={{ width: `${(property.vacancyRate / maxRate) * 100}%` }}
                  data-testid={`progress-bar-${index}`}
                />
                <span 
                  className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium"
                  data-testid={`vacancy-rate-${index}`}
                >
                  {property.vacancyRate.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getColorForIndex(index: number): string {
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500"];
  return colors[index % colors.length];
}

function calculateMarketAverage(competitors: CompetitorProperty[]): number {
  if (competitors.length === 0) return 0;
  const total = competitors.reduce((sum, comp) => sum + parseFloat(comp.vacancyRate), 0);
  return total / competitors.length;
}

function calculateCompetitorAverage(competitors: CompetitorProperty[]): number {
  return calculateMarketAverage(competitors);
}
