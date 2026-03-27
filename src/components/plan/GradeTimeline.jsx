import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Star } from "lucide-react";

const gradeLabels = {
  7: "7th", 8: "8th", 9: "9th", 10: "10th", 11: "11th", 12: "12th"
};

const gradeThemes = {
  7: "Foundation",
  8: "Exploration",
  9: "Discovery",
  10: "Direction",
  11: "Preparation",
  12: "Launch"
};

export default function GradeTimeline({ grades, selectedGrade, currentGrade, onSelect, trackGrades }) {
  return (
    <div className="relative">
      {/* Desktop: horizontal timeline */}
      <div className="hidden sm:flex items-start gap-0 relative">
        {/* Single continuous background line */}
        <div className="absolute left-0 right-0 h-0.5 bg-border" style={{ top: '20px' }} />
        {grades.map((grade, idx) => {
          const isSelected = grade === selectedGrade;
          const isCurrent = grade === currentGrade;
          const isPast = currentGrade && grade < currentGrade;

          return (
            <div key={grade} className="flex-1 flex flex-col items-center relative">
              {/* Completed segment overlay */}
              {isPast && idx < grades.length - 1 && (
                <div className="absolute left-1/2 w-full h-0.5 bg-primary" style={{ top: '20px' }} />
              )}

              {/* Node */}
              <button
                onClick={() => onSelect(grade)}
                className={cn(
                  "relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 text-sm font-bold border-2",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-110"
                    : isPast
                    ? "bg-primary/20 text-primary border-primary"
                    : isCurrent
                    ? "bg-secondary text-secondary-foreground border-secondary animate-pulse"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {isPast && !isSelected ? <CheckCircle2 className="w-4 h-4" /> : grade}
              </button>

              {/* Label */}
              <div className="mt-2 text-center">
                <p className={cn(
                  "text-xs font-semibold",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}>
                  {gradeLabels[grade]}
                </p>
                <p className="text-[10px] text-muted-foreground/70">{gradeThemes[grade]}</p>
                {isCurrent && (
                  <span className="text-[9px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block">
                    You're here
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: grid */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {grades.map((grade) => {
          const isSelected = grade === selectedGrade;
          const isCurrent = grade === currentGrade;
          const isPast = currentGrade && grade < currentGrade;

          return (
            <button
              key={grade}
              onClick={() => onSelect(grade)}
              className={cn(
                "p-3 rounded-xl border text-left transition-all duration-200",
                isSelected
                  ? "bg-primary/10 border-primary"
                  : isPast
                  ? "bg-muted/50 border-border"
                  : "bg-card border-border hover:border-primary/40"
              )}
            >
              <p className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                {gradeLabels[grade]}
              </p>
              <p className="text-[10px] text-muted-foreground">{gradeThemes[grade]}</p>
              {isCurrent && <span className="text-[9px] text-secondary font-medium">← You</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}