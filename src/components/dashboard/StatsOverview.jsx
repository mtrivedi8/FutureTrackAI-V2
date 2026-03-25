import { Compass, TrendingUp, Target, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Exploring", icon: Compass, color: "from-primary/20 to-primary/5", iconColor: "text-primary" },
  { label: "In Progress", icon: TrendingUp, color: "from-secondary/20 to-secondary/5", iconColor: "text-secondary" },
  { label: "Completed", icon: Target, color: "from-green-500/20 to-green-500/5", iconColor: "text-green-500" },
  { label: "Updates", icon: Flame, color: "from-accent/20 to-accent/5", iconColor: "text-accent" },
];

export default function StatsOverview({ recommendations = [], progressUpdates = [] }) {
  const values = [
    recommendations.filter(r => r.status === "Exploring").length,
    recommendations.filter(r => r.status === "In Progress").length,
    recommendations.filter(r => r.status === "Completed").length,
    progressUpdates.length,
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(({ label, icon: Icon, color, iconColor }, i) => (
        <div
          key={label}
          className={cn("rounded-2xl bg-gradient-to-br p-4", color)}
        >
          <Icon className={cn("w-5 h-5 mb-2", iconColor)} />
          <p className="text-2xl font-heading font-bold text-foreground">{values[i]}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}