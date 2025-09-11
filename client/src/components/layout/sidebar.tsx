import { Link, useLocation } from "wouter";
import { Home, BarChart3, TrendingUp, DollarSign } from "lucide-react";
import WorkflowProgress from "@/components/workflow-progress";

export default function Sidebar() {
  const [location] = useLocation();
  
  const navigation = [
    { name: "Property Input", href: "/", icon: Home },
    { name: "Summarize", href: "/summarize", icon: BarChart3 },
    { name: "Analyze", href: "/analyze", icon: TrendingUp },
    { name: "Optimize", href: "/optimize", icon: DollarSign },
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary" data-testid="app-title">
          PropertyAnalytics Pro
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="app-subtitle">
          Real Estate Analysis Platform
        </p>
      </div>
      
      <nav className="flex-1 p-4" data-testid="main-navigation">
        <div className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || 
              (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </div>
        
        <WorkflowProgress />
      </nav>
    </div>
  );
}
