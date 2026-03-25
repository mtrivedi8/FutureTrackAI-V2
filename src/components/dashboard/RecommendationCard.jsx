import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Briefcase, BookOpen, Lightbulb, Rocket, Wrench } from "lucide-react";

const typeConfig = {
  "Career Path": { icon: Briefcase, color: "bg-primary/10 text-primary" },
  "Skill": { icon: Wrench, color: "bg-secondary/10 text-secondary" },
  "Course": { icon: BookOpen, color: "bg-blue-500/10 text-blue-500" },
  "Activity": { icon: Lightbulb, color: "bg-yellow-500/10 text-yellow-500" },
  "Project": { icon: Rocket, color: "bg-accent/10 text-accent" }
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

  return null;































}