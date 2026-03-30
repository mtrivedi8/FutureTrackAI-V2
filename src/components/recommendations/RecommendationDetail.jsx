import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Star, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusOptions = ["New", "Exploring", "In Progress", "Completed", "Skipped"];

export default function RecommendationDetail({ recommendation, onClose, onUpdated }) {
  const [status, setStatus] = useState(recommendation.status || "New");
  const [rating, setRating] = useState(recommendation.rating || 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.Recommendation.update(recommendation.id, { status: "Skipped" });
    toast.success("Moved to Skipped");
    onUpdated?.();
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Recommendation.update(recommendation.id, { status, rating });
    toast.success("Recommendation updated!");
    onUpdated?.();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile back header */}
        <div className="sm:hidden flex items-center gap-2 px-4 pt-4 pb-0">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-xl transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span className="text-sm font-semibold text-muted-foreground">Back</span>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="secondary" className="mb-2">{recommendation.type}</Badge>
              <h2 className="font-heading text-xl font-bold text-foreground">{recommendation.title}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} disabled={deleting} className="p-2 hover:bg-destructive/10 text-destructive rounded-xl transition-colors" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
              <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">{recommendation.description}</p>

          {recommendation.why_recommended && (
            <div className="rounded-xl bg-primary/5 p-4">
              <p className="text-xs font-medium text-primary mb-1">Why this was recommended</p>
              <p className="text-sm text-foreground">{recommendation.why_recommended}</p>
            </div>
          )}

          <div className="flex gap-4 flex-wrap text-sm">
            {recommendation.difficulty_level && (
              <div>
                <p className="text-muted-foreground text-xs">Difficulty</p>
                <p className="font-medium">{recommendation.difficulty_level}</p>
              </div>
            )}
            {recommendation.estimated_duration && (
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="font-medium">{recommendation.estimated_duration}</p>
              </div>
            )}
          </div>

          {recommendation.resources?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Resources</p>
              <div className="space-y-1">
                {recommendation.resources.map((r, i) => (
                  <a
                    key={i}
                    href={r.startsWith('http') ? r : `https://${r}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span>{r}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-2 border-t border-border">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Your Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRating(n)}>
                    <Star
                      className={cn(
                        "w-6 h-6 transition-colors",
                        n <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}