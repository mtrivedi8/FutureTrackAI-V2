import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { recommendationIcons } from "@/utils/customEmojis";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const typeConfig = {
  "Career Path": { icon: recommendationIcons['Career Path'], color: "bg-primary/10 text-primary" },
  "Skill": { icon: recommendationIcons['Skill'], color: "bg-secondary/10 text-secondary" },
  "Course": { icon: recommendationIcons['Course'], color: "bg-blue-500/10 text-blue-500" },
  "Activity": { icon: recommendationIcons['Activity'], color: "bg-yellow-500/10 text-yellow-500" },
  "Project": { icon: recommendationIcons['Project'], color: "bg-accent/10 text-accent" }
};

const statusColors = {
  "New": "bg-muted text-muted-foreground",
  "Exploring": "bg-primary/10 text-primary",
  "In Progress": "bg-secondary/10 text-secondary",
  "Completed": "bg-green-500/10 text-green-600",
  "Skipped": "bg-muted text-muted-foreground"
};

export default function RecommendationCard({ recommendation, onClick, onStatusChange }) {
  const [localStatus, setLocalStatus] = useState(recommendation.status);
  const config = typeConfig[recommendation.type] || typeConfig["Skill"];
  const Icon = config.icon;
  const isCustomIcon = typeof Icon === 'function' && Icon.length === 1;

  return (
    <button
      onClick={() => onClick?.(recommendation)}
      className="w-full text-left rounded-2xl bg-card border border-border p-3 sm:p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group"
    >
      <div className="flex items-start gap-2 sm:gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", config.color)}>
          {isCustomIcon ? <Icon size={20} /> : <Icon className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-heading font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {recommendation.title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {recommendation.description}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-[10px]", statusColors[localStatus])}>
              {localStatus || "New"}
            </Badge>
            {recommendation.difficulty_level && (
              <Badge variant="outline" className="text-[10px]">
                {recommendation.difficulty_level}
              </Badge>
            )}
          </div>
          {onStatusChange && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
              {["Exploring", "In Progress", "Completed"].map(s => {
                const isActive = recommendation.status === s;
                return (
                  <button
                    key={s}
                    onClick={async () => {
                      setLocalStatus(s);
                      await base44.entities.Recommendation.update(recommendation.id, { status: s });
                      toast.success(`Marked as ${s}`);
                      onStatusChange?.();
                    }}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors select-none",
                      localStatus === s
                        ? s === "Completed" ? "bg-green-500/20 text-green-700 border-green-300" : s === "In Progress" ? "bg-secondary/20 text-secondary border-secondary/40" : "bg-primary/20 text-primary border-primary/40"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </button>
  );































}