import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, CalendarClock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/api/apiClient";

const statusColors = {
  "New": "bg-muted text-muted-foreground",
  "Applied": "bg-primary/10 text-primary",
  "Interviewing": "bg-secondary/10 text-secondary",
  "Accepted": "bg-green-500/10 text-green-600",
  "Rejected": "bg-destructive/10 text-destructive",
  "Skipped": "bg-muted text-muted-foreground",
};

const STATUS_OPTIONS = ["Applied", "Interviewing", "Accepted", "Rejected"];

export default function InternshipCard({ internship, onStatusChange }) {
  const [localStatus, setLocalStatus] = useState(internship.status);

  const updateStatus = async (s) => {
    setLocalStatus(s);
    await apiClient.entities.Internship.update(internship.id, { status: s });
    toast.success(`Marked as ${s}`);
    onStatusChange?.();
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-3 sm:p-5 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      <div className="flex items-start gap-2 sm:gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-foreground">{internship.title}</h3>
          {internship.organization && (
            <p className="text-sm font-medium text-primary/80">{internship.organization}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1 mb-2">{internship.description}</p>
          {internship.why_recommended && (
            <p className="text-xs text-muted-foreground italic mb-3">"{internship.why_recommended}"</p>
          )}

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Badge variant="secondary" className={cn("text-[10px]", statusColors[localStatus])}>
              {localStatus || "New"}
            </Badge>
            {internship.duration && <Badge variant="outline" className="text-[10px]">{internship.duration}</Badge>}
            {internship.location && (
              <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="w-2.5 h-2.5" />{internship.location}</Badge>
            )}
            {internship.deadline && (
              <Badge variant="outline" className="text-[10px] gap-1"><CalendarClock className="w-2.5 h-2.5" />{internship.deadline}</Badge>
            )}
            {internship.grade_levels?.length > 0 && (
              <Badge variant="outline" className="text-[10px]">Grades {internship.grade_levels.join(', ')}</Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {internship.application_url && (
              <a
                href={internship.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded-lg border font-medium bg-primary text-primary-foreground border-primary flex items-center gap-1"
              >
                Apply <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors select-none",
                  localStatus === s
                    ? s === "Accepted" ? "bg-green-500/20 text-green-700 border-green-300"
                      : s === "Rejected" ? "bg-destructive/20 text-destructive border-destructive/40"
                      : "bg-primary/20 text-primary border-primary/40"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
