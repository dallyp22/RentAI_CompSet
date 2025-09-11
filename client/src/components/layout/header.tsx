import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="page-title">
            Property Analysis Dashboard
          </h2>
          <p className="text-muted-foreground" data-testid="page-description">
            Analyze, compare, and optimize your property pricing
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="secondary" data-testid="button-export-report">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center" data-testid="user-avatar">
            <span className="text-primary-foreground font-semibold text-sm">JD</span>
          </div>
        </div>
      </div>
    </header>
  );
}
