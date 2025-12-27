import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPropertySchema } from "@shared/schema";
import type { InsertProperty } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, HelpCircle } from "lucide-react";
import { z } from "zod";

interface PropertyFormProps {
  onSubmit: (data: InsertProperty) => void;
  isLoading?: boolean;
  initialValues?: {
    propertyName: string;
    address: string;
  };
}

// Simplified schema for just address and property name
const simplifiedPropertySchema = z.object({
  address: z.string().min(1, "Property address is required"),
  propertyName: z.string().min(1, "Property name is required")
});

type SimplifiedFormData = z.infer<typeof simplifiedPropertySchema>;

export default function PropertyForm({ onSubmit, isLoading, initialValues }: PropertyFormProps) {
  const form = useForm<SimplifiedFormData>({
    resolver: zodResolver(simplifiedPropertySchema),
    defaultValues: {
      address: initialValues?.address || "",
      propertyName: initialValues?.propertyName || ""
    }
  });

  const handleSubmit = (data: SimplifiedFormData) => {
    // Transform simplified data to InsertProperty format
    const fullPropertyData: InsertProperty = {
      address: data.address,
      propertyName: data.propertyName,
      city: null,
      state: null,
      propertyType: null,
      totalUnits: null,
      builtYear: null,
      squareFootage: null,
      parkingSpaces: null,
      amenities: []
    };
    onSubmit(fullPropertyData);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6" data-testid="property-form">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-semibold mb-2" data-testid="form-title">
          Property Analysis Setup
        </h3>
        <p className="text-muted-foreground">
          Enter your property details to begin AI analysis and competitive data scraping
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="propertyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium flex items-center gap-2">
                    Property Name
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Enter the official name of your apartment complex or building. 
                          This helps us accurately match your property in the market data.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. The Duo Apartments, Urban Village" 
                      {...field} 
                      data-testid="input-property-name"
                      className="h-12"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Exact name as it appears on listings
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium flex items-center gap-2">
                    Property Address
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Full street address including street number, city, state, and ZIP code. 
                          This is used to find nearby competitors and market comparisons.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="222 S 15th St, Omaha, NE 68102" 
                      {...field} 
                      data-testid="input-address"
                      className="h-12"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Include street, city, state, and ZIP for best results
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Brain className="text-blue-600 mr-3 mt-1 h-5 w-5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">What happens next:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Instant AI Analysis:</strong> Get immediate market insights for your property</li>
                  <li>• <strong>Auto City Detection:</strong> We'll extract the city from your address</li>
                  <li>• <strong>Background Scraping:</strong> Automatic data collection from apartments.com</li>
                  <li>• <strong>Property Matching:</strong> Auto-detect your property from competitive listings</li>
                  <li>• <strong>Detailed Analysis:</strong> Compare with real market data and optimize pricing</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button 
              type="submit" 
              disabled={isLoading}
              data-testid="button-start-analysis"
              className="h-12 px-8 text-base"
            >
              <Brain className="mr-2 h-5 w-5" />
              {isLoading ? "Starting Analysis..." : "Start AI Analysis & Scraping"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
