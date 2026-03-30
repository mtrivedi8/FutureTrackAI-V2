import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NativeSelect from "@/components/NativeSelect";
import { ExternalLink, Star, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusOptions = ["New", "Exploring", "In Progress", "Completed", "Skipped"];

export default function RecommendationDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recId = id || searchParams.get("id");

  const [rec, setRec] = useState(null);
  const [status, setStatus] = useState("New");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recId) { navigate("/recommendations"); return; }
    (async () => {
      const user = await base44.auth.me();
      const recs = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100);
      const found = recs.find(r => r.id === recId);
      if (!found) { navigate("/recommendations"); return; }
      setRec(found);
      setStatus(found.status || "New");
      setRating(found.rating || 0);
      setLoading(false);
    })();
  }, [recId]);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Recommendation.update(rec.id, { status, rating });
    toast.success("Updated!");
    setSaving(false);
    navigate(-1);
  };

  const handleSkip = async () => {
    await base44.entities.Recommendation.update(rec.id, { status: "Skipped" });
    toast.success("Moved to Skipped");
    navigate(-1);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="secondary" className="mb-2">{rec.type}</Badge>
          <h1 className="font-heading text-xl font-bold text-foreground">{rec.title}</h1>
        </div>
        <button onClick={handleSkip} className="p-2 hover:bg-destructive/10 text-destructive rounded-xl transition-colors shrink-0" title="Skip">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">{rec.description}</p>

      {rec.why_recommended && (
        <div className="rounded-xl bg-primary/5 p-4">
          <p className="text-xs font-medium text-primary mb-1">Why this was recommended</p>
          <p className="text-sm text-foreground">{rec.why_recommended}</p>
        </div>
      )}

      <div className="flex gap-4 flex-wrap text-sm">
        {rec.difficulty_level && (
          <div>
            <p className="text-muted-foreground text-xs">Difficulty</p>
            <p className="font-medium">{rec.difficulty_level}</p>
          </div>
        )}
        {rec.estimated_duration && (
          <div>
            <p className="text-muted-foreground text-xs">Duration</p>
            <p className="font-medium">{rec.estimated_duration}</p>
          </div>
        )}
      </div>

      {rec.resources?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Resources</p>
          <div className="space-y-2">
            {rec.resources.map((r, i) => (
              <a key={i} href={r.startsWith('http') ? r : `https://${r}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="break-all">{r}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 pt-2 border-t border-border">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Status</label>
          <NativeSelect value={status} onValueChange={setStatus} options={statusOptions} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Your Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)} className="p-1.5">
                <Star className={cn("w-6 h-6 transition-colors", n <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted")} />
              </button>
            ))}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}