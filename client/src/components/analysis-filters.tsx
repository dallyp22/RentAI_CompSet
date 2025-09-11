import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { FilterCriteria } from "@shared/schema";

interface AnalysisFiltersProps {
  filters: FilterCriteria;
  onFiltersChange: (filters: FilterCriteria) => void;
}

const bedroomTypes = ["Studio", "1BR", "2BR", "3BR"] as const;
const availabilityOptions = [
  { value: "now", label: "Available Now" },
  { value: "30days", label: "Within 30 Days" },
  { value: "60days", label: "Within 60 Days" }
] as const;

export default function AnalysisFilters({ 
  filters, 
  onFiltersChange
}: AnalysisFiltersProps) {
  const handleBedroomChange = (bedroom: string, checked: boolean) => {
    const newBedroomTypes = checked 
      ? [...filters.bedroomTypes, bedroom as any]
      : filters.bedroomTypes.filter(type => type !== bedroom);
    
    onFiltersChange({
      ...filters,
      bedroomTypes: newBedroomTypes
    });
  };

  const handlePriceRangeChange = (values: number[]) => {
    onFiltersChange({
      ...filters,
      priceRange: { min: values[0], max: values[1] }
    });
  };

  const handleSquareFootageChange = (values: number[]) => {
    onFiltersChange({
      ...filters,
      squareFootageRange: { min: values[0], max: values[1] }
    });
  };

  const handleAvailabilityChange = (value: string) => {
    onFiltersChange({
      ...filters,
      availability: value as any
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      bedroomTypes: [],
      priceRange: { min: 800, max: 3000 },
      availability: "now",
      squareFootageRange: { min: 400, max: 2000 }
    });
  };

  return (
    <div className="lg:w-80 space-y-4" data-testid="analysis-filters">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg" data-testid="filters-title">
            Filter Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bedroom Type Filters */}
          <div className="space-y-3" data-testid="bedroom-filters">
            <Label className="text-sm font-semibold">Unit Types</Label>
            <div className="grid grid-cols-2 gap-2">
              {bedroomTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2" data-testid={`bedroom-filter-${type.toLowerCase()}`}>
                  <Checkbox
                    id={`bedroom-${type}`}
                    checked={filters.bedroomTypes.includes(type)}
                    onCheckedChange={(checked) => handleBedroomChange(type, checked as boolean)}
                    data-testid={`checkbox-${type.toLowerCase()}`}
                  />
                  <Label 
                    htmlFor={`bedroom-${type}`} 
                    className="text-sm cursor-pointer"
                    data-testid={`label-${type.toLowerCase()}`}
                  >
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Price Range Slider */}
          <div className="space-y-3" data-testid="price-range-filter">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Price Range</Label>
              <span className="text-sm text-muted-foreground" data-testid="price-range-display">
                ${filters.priceRange.min.toLocaleString()} - ${filters.priceRange.max.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[filters.priceRange.min, filters.priceRange.max]}
              onValueChange={handlePriceRangeChange}
              max={3000}
              min={800}
              step={50}
              className="w-full"
              data-testid="slider-price-range"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$800</span>
              <span>$3,000</span>
            </div>
          </div>

          <Separator />

          {/* Availability Filter */}
          <div className="space-y-3" data-testid="availability-filter">
            <Label className="text-sm font-semibold">Availability</Label>
            <RadioGroup 
              value={filters.availability} 
              onValueChange={handleAvailabilityChange}
              data-testid="radiogroup-availability"
            >
              {availabilityOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2" data-testid={`availability-option-${option.value}`}>
                  <RadioGroupItem 
                    value={option.value} 
                    id={option.value}
                    data-testid={`radio-${option.value}`}
                  />
                  <Label 
                    htmlFor={option.value} 
                    className="text-sm cursor-pointer"
                    data-testid={`label-${option.value}`}
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Square Footage Range Slider */}
          <div className="space-y-3" data-testid="sqft-range-filter">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Square Footage</Label>
              <span className="text-sm text-muted-foreground" data-testid="sqft-range-display">
                {filters.squareFootageRange.min} - {filters.squareFootageRange.max} sq ft
              </span>
            </div>
            <Slider
              value={[filters.squareFootageRange.min, filters.squareFootageRange.max]}
              onValueChange={handleSquareFootageChange}
              max={2000}
              min={400}
              step={25}
              className="w-full"
              data-testid="slider-sqft-range"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>400 sq ft</span>
              <span>2,000 sq ft</span>
            </div>
          </div>

          <Separator />

          <Button 
            variant="outline" 
            className="w-full"
            onClick={resetFilters}
            data-testid="button-reset-filters"
          >
            Reset All Filters
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
