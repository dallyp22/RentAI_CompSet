import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Square, Calendar, Award } from "lucide-react";
import type { CompetitiveEdges } from "@shared/schema";

interface CompetitiveAdvantagesGridProps {
  competitiveEdges: CompetitiveEdges;
}

export default function CompetitiveAdvantagesGrid({ 
  competitiveEdges 
}: CompetitiveAdvantagesGridProps) {
  const getStatusColor = (status: "advantage" | "neutral" | "disadvantage") => {
    switch (status) {
      case "advantage": return "bg-green-100 text-green-700 border-green-300";
      case "neutral": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "disadvantage": return "bg-red-100 text-red-700 border-red-300";
    }
  };

  const getStatusBadge = (status: "advantage" | "neutral" | "disadvantage") => {
    switch (status) {
      case "advantage": return "Advantage";
      case "neutral": return "Neutral";
      case "disadvantage": return "Disadvantage";
    }
  };

  const edges = [
    {
      key: "pricing",
      title: "Pricing",
      icon: <DollarSign className="h-5 w-5" />,
      data: competitiveEdges.pricing
    },
    {
      key: "size",
      title: "Unit Size",
      icon: <Square className="h-5 w-5" />,
      data: competitiveEdges.size
    },
    {
      key: "availability",
      title: "Availability",
      icon: <Calendar className="h-5 w-5" />,
      data: competitiveEdges.availability
    },
    {
      key: "amenities",
      title: "Amenities",
      icon: <Award className="h-5 w-5" />,
      data: competitiveEdges.amenities
    }
  ];

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
      data-testid="competitive-advantages-grid"
    >
      {edges.map((edge) => (
        <Card 
          key={edge.key}
          className={`border-2 ${getStatusColor(edge.data.status)} transition-all hover:shadow-lg`}
          data-testid={`edge-card-${edge.key}`}
        >
          <CardContent className="p-4 space-y-3">
            {/* Header with icon and title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {edge.icon}
                <span className="font-semibold text-sm">{edge.title}</span>
              </div>
              <Badge 
                variant="outline" 
                className="text-xs"
                data-testid={`status-badge-${edge.key}`}
              >
                {getStatusBadge(edge.data.status)}
              </Badge>
            </div>

            {/* Edge value display */}
            <div className="text-center py-2">
              <div 
                className="text-2xl font-bold"
                data-testid={`edge-value-${edge.key}`}
              >
                {edge.key === "pricing" && edge.data.edge !== 0 && (
                  edge.data.edge > 0 ? `+${edge.data.edge}%` : `${edge.data.edge}%`
                )}
                {edge.key === "size" && edge.data.edge !== 0 && (
                  edge.data.edge > 0 ? `+${edge.data.edge} sq ft` : `${edge.data.edge} sq ft`
                )}
                {edge.key === "availability" && (
                  edge.data.edge !== 0 ? `${Math.abs(edge.data.edge)} units` : "Equal"
                )}
                {edge.key === "amenities" && (
                  `${edge.data.edge}/100`
                )}
              </div>
            </div>

            {/* Description label */}
            <div className="text-center">
              <span 
                className="text-xs font-medium"
                data-testid={`edge-label-${edge.key}`}
              >
                {edge.data.label}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}