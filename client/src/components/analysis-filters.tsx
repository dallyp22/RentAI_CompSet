import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface AnalysisFiltersProps {
  activeFilters: Record<string, boolean>;
  onFilterChange: (filter: string, enabled: boolean) => void;
  onResetFilters: () => void;
}

const filterOptions = [
  { key: "bedroomCount", label: "Bedroom Count" },
  { key: "squareFootage", label: "Square Footage" },
  { key: "amenitiesScore", label: "Amenities Score" },
  { key: "distance", label: "Distance" },
  { key: "buildingAge", label: "Age of Building" },
  { key: "parkingRatio", label: "Parking Ratio" }
];

export default function AnalysisFilters({ 
  activeFilters, 
  onFilterChange, 
  onResetFilters 
}: AnalysisFiltersProps) {
  return (
    <div className="lg:w-80 space-y-4" data-testid="analysis-filters">
      <h3 className="text-xl font-semibold" data-testid="filters-title">Analysis Variables</h3>
      
      <div className="space-y-3">
        {filterOptions.map((option) => (
          <div 
            key={option.key}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
            data-testid={`filter-${option.key}`}
          >
            <span className="font-medium" data-testid={`filter-label-${option.key}`}>
              {option.label}
            </span>
            <Switch
              checked={activeFilters[option.key] || false}
              onCheckedChange={(checked) => onFilterChange(option.key, checked)}
              data-testid={`switch-${option.key}`}
            />
          </div>
        ))}
      </div>
      
      <Button 
        variant="secondary" 
        className="w-full"
        onClick={onResetFilters}
        data-testid="button-reset-filters"
      >
        Reset All Filters
      </Button>
    </div>
  );
}
