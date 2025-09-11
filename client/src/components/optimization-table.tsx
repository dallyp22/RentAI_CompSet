import { Badge } from "@/components/ui/badge";
import type { PropertyUnit, OptimizationReport } from "@shared/schema";

interface OptimizationTableProps {
  units: PropertyUnit[];
  report: OptimizationReport;
}

export default function OptimizationTable({ units, report }: OptimizationTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "vacant":
        return <Badge variant="destructive" data-testid={`status-vacant`}>Vacant</Badge>;
      case "occupied":
        return <Badge variant="default" className="bg-green-100 text-green-800" data-testid={`status-occupied`}>Occupied</Badge>;
      case "notice_given":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800" data-testid={`status-notice`}>Notice Given</Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-unknown`}>{status}</Badge>;
    }
  };

  const getChangeDisplay = (current: number, recommended: number | null) => {
    if (!recommended) return { amount: 0, display: "$0", variant: "outline" as const };
    
    const change = recommended - current;
    if (change > 0) {
      return { 
        amount: change, 
        display: `+$${change}`, 
        variant: "default" as const,
        className: "bg-green-100 text-green-800"
      };
    } else if (change < 0) {
      return { 
        amount: change, 
        display: `-$${Math.abs(change)}`, 
        variant: "destructive" as const,
        className: "bg-red-100 text-red-800"
      };
    }
    return { 
      amount: 0, 
      display: "$0", 
      variant: "outline" as const,
      className: "bg-gray-100 text-gray-800"
    };
  };

  return (
    <div className="space-y-6" data-testid="optimization-table">
      <div className="bg-muted rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Unit</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Current Rent</th>
                <th className="px-4 py-3 text-left font-semibold">Recommended</th>
                <th className="px-4 py-3 text-left font-semibold">Change</th>
                <th className="px-4 py-3 text-left font-semibold">Impact</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {units.map((unit) => {
                const currentRent = parseFloat(unit.currentRent);
                const recommendedRent = unit.recommendedRent ? parseFloat(unit.recommendedRent) : null;
                const change = getChangeDisplay(currentRent, recommendedRent);
                const annualImpact = change.amount * 12;

                return (
                  <tr 
                    key={unit.id} 
                    className="hover:bg-accent" 
                    data-testid={`unit-row-${unit.unitNumber}`}
                  >
                    <td className="px-4 py-3 font-medium" data-testid={`unit-number-${unit.unitNumber}`}>
                      {unit.unitNumber}
                    </td>
                    <td className="px-4 py-3" data-testid={`unit-type-${unit.unitNumber}`}>
                      {unit.unitType}
                    </td>
                    <td className="px-4 py-3" data-testid={`current-rent-${unit.unitNumber}`}>
                      ${currentRent}
                    </td>
                    <td className="px-4 py-3 font-semibold" data-testid={`recommended-rent-${unit.unitNumber}`}>
                      {recommendedRent ? (
                        <span className={change.amount > 0 ? "text-green-600" : change.amount < 0 ? "text-red-600" : "text-blue-600"}>
                          ${recommendedRent}
                        </span>
                      ) : (
                        <span className="text-blue-600">${currentRent}</span>
                      )}
                    </td>
                    <td className="px-4 py-3" data-testid={`change-${unit.unitNumber}`}>
                      <Badge 
                        variant={change.variant} 
                        className={change.className}
                      >
                        {change.display}
                      </Badge>
                    </td>
                    <td className="px-4 py-3" data-testid={`impact-${unit.unitNumber}`}>
                      <span className={
                        annualImpact > 0 ? "text-green-600" : 
                        annualImpact < 0 ? "text-red-600" : 
                        "text-gray-600"
                      }>
                        {annualImpact > 0 ? "+" : ""}${Math.abs(annualImpact)}/year
                      </span>
                    </td>
                    <td className="px-4 py-3" data-testid={`status-${unit.unitNumber}`}>
                      {getStatusBadge(unit.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="optimization-summary">
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600" data-testid="total-increase">
            +${report.totalIncrease}
          </div>
          <div className="text-sm text-green-700">Annual Revenue Increase</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600" data-testid="affected-units">
            {report.affectedUnits}
          </div>
          <div className="text-sm text-blue-700">Units Affected</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-amber-600" data-testid="avg-increase">
            {report.avgIncrease}%
          </div>
          <div className="text-sm text-amber-700">Average Increase</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-600" data-testid="risk-level">
            {report.riskLevel}
          </div>
          <div className="text-sm text-purple-700">Risk Level</div>
        </div>
      </div>
    </div>
  );
}
