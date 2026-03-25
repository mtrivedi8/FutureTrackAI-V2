import { BookOpen, Lightbulb, Users, Laptop, Sun, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const gradeLabels = {
  7: "7th Grade", 8: "8th Grade", 9: "9th Grade",
  10: "10th Grade", 11: "11th Grade", 12: "12th Grade"
};

const sections = [
  {
    key: "core_classes",
    label: "Core Classes",
    icon: BookOpen,
    color: "bg-primary/10 text-primary",
    tagColor: "bg-primary/10 text-primary",
  },
  {
    key: "electives",
    label: "Electives",
    icon: Lightbulb,
    color: "bg-yellow-500/10 text-yellow-600",
    tagColor: "bg-yellow-500/10 text-yellow-700",
  },
  {
    key: "clubs",
    label: "Clubs",
    icon: Users,
    color: "bg-secondary/10 text-secondary",
    tagColor: "bg-secondary/10 text-secondary",
  },
  {
    key: "extracurriculars",
    label: "Extracurriculars",
    icon: Trophy,
    color: "bg-accent/10 text-accent",
    tagColor: "bg-accent/10 text-accent",
  },
  {
    key: "online_courses",
    label: "Online Courses",
    icon: Laptop,
    color: "bg-blue-500/10 text-blue-500",
    tagColor: "bg-blue-500/10 text-blue-600",
  },
  {
    key: "summer_activities",
    label: "Summer Activities",
    icon: Sun,
    color: "bg-orange-500/10 text-orange-500",
    tagColor: "bg-orange-500/10 text-orange-600",
  },
];

export default function GradePlanCard({ grade, gradeData }) {
  if (!gradeData) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">{gradeLabels[grade]}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{gradeData.focus}</p>
          </div>
          {gradeData.key_milestone && (
            <div className="bg-white/60 dark:bg-card/60 rounded-xl p-3 max-w-xs">
              <p className="text-xs font-medium text-primary mb-1">🏆 Key Milestone</p>
              <p className="text-sm text-foreground">{gradeData.key_milestone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ key, label, icon: Icon, color, tagColor }) => {
          const items = gradeData[key] || [];
          if (!items.length) return null;

          return (
            <div key={key} className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-semibold text-sm text-foreground">{label}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                  <span
                    key={i}
                    className={cn("px-2.5 py-1 rounded-lg text-xs font-medium", tagColor)}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}