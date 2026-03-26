import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { recommendationIcons } from "@/utils/customEmojis";

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

export default function RecommendationCard({ recommendation, onClick }) {
  const config = typeConfig[recommendation.type] || typeConfig["Skill"];
  const Icon = config.icon;
  const isCustomIcon = typeof Icon === 'function' && Icon.length === 1;

  return (
    <button
      onClick={() => onClick?.(recommendation)}
      className="w-full text-left rounded-2xl bg-card border border-border p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 group"
    >
      <div className="flex items-start gap-4">
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
            <Badge variant="secondary" className={cn("text-[10px]", statusColors[recommendation.status])}>
              {recommendation.status || "New"}
            </Badge>
            {recommendation.difficulty_level && (
              <Badge variant="outline" className="text-[10px]">
                {recommendation.difficulty_level}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );































}