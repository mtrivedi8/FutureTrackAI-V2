import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { apiClient } from "@/api/apiClient";
import InternshipCard from "@/components/internships/InternshipCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Briefcase, Sparkles, Loader2, ChevronDown, ChevronRight, Layers, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

function nextSummerYear() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/** Summer + application window for a given grade, relative to the student's current grade. */
function cycleForGrade(currentGrade, targetGrade) {
  const yearsAhead = targetGrade - (currentGrade || 9);
  const summerYear = nextSummerYear() + yearsAhead;
  return {
    summer: `Summer ${summerYear}`,
    applyWindow: `Apply Sep ${summerYear - 1}–Feb ${summerYear}`,
  };
}

function ProfileContextCard({ profile, plan, journeyCount, perTrack, setPerTrack, generating, onGenerate }) {
  const season = `Summer ${nextSummerYear()}`;
  const trackCount = plan?.career_tracks?.filter((t) => t?.name)?.length || 0;
  const roadmapStatus = trackCount > 0 ? `${trackCount} track${trackCount > 1 ? "s" : ""} ready` : "No plan yet";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Your Profile Context
        </h2>
        <Badge variant="outline">Grade {profile?.current_grade || "—"}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Interests", value: `${profile?.interests?.length || 0} areas` },
          { label: "Dream Careers", value: `${profile?.dream_careers?.length || 0} paths` },
          { label: "Roadmap", value: roadmapStatus },
          { label: "Journey", value: `${journeyCount} entries` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/50 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className="text-sm font-medium text-foreground truncate">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(profile?.interests || []).map((i) => (
          <Badge key={i} variant="secondary" className="bg-primary/10 text-primary">{i}</Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(profile?.dream_careers || []).map((c) => (
          <Badge key={c} className="bg-accent/10 text-accent border-accent/20">{c}</Badge>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Internships per track</span>
          <Select value={String(perTrack)} onValueChange={(v) => setPerTrack(parseInt(v))}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 6, 10].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} per track</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onGenerate} disabled={generating} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Searching..." : "Find Internships by Track"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Layers className="w-3 h-3" /> Targeting grade {profile?.current_grade || "—"} · {season} programs (most deadlines fall between Nov and Mar)
      </p>
    </div>
  );
}

function GradeSection({ grade, currentGrade, items, defaultOpen, profile, onStatusChange }) {
  const [open, setOpen] = useState(defaultOpen);
  const { summer, applyWindow } = cycleForGrade(currentGrade, grade);

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/30 transition-colors" disabled={items.length === 0}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary leading-none">{grade}</span>
                <span className="text-[8px] text-primary/70 leading-none mt-0.5">Gr.</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-sm">Grade {grade}</span>
                  <Badge variant="secondary" className="text-[10px] gap-1 bg-muted text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" /> Upcoming
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{summer} · {applyWindow}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {items.length > 0 && <Badge variant="secondary">{items.length} program{items.length !== 1 ? "s" : ""}</Badge>}
              {items.length > 0 && (open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />)}
            </div>
          </button>
        </CollapsibleTrigger>
        {items.length > 0 && (
          <CollapsibleContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 pt-0">
              {items.map((internship) => (
                <InternshipCard key={internship.id} internship={internship} profile={profile} onStatusChange={onStatusChange} />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

function TrackSection({ label, description, items, defaultOpen, profile, onStatusChange }) {
  const [open, setOpen] = useState(defaultOpen);
  const currentGrade = profile?.current_grade || 9;

  const byGrade = useMemo(() => {
    const map = new Map([[9, []], [10, []], [11, []], [12, []]]);
    for (const internship of items) {
      const grades = internship.grade_levels?.length > 0 ? internship.grade_levels : [currentGrade];
      for (const g of grades) {
        if (map.has(g)) map.get(g).push(internship);
      }
    }
    return map;
  }, [items, currentGrade]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-card overflow-hidden">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              <h3 className="font-heading font-semibold text-foreground truncate">{label}</h3>
              {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">{items.length} program{items.length !== 1 ? "s" : ""}</Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 p-4 pt-0">
          {[9, 10, 11, 12]
            // Only show the current grade, the next one up, and anything
            // further out that already has real suggestions - an empty
            // "Grade 12" placeholder means nothing to a 9th grader yet.
            .filter((grade) => grade >= currentGrade && grade <= currentGrade + 1 || (byGrade.get(grade) || []).length > 0)
            .map((grade) => (
              <GradeSection
                key={grade}
                grade={grade}
                currentGrade={currentGrade}
                items={byGrade.get(grade) || []}
                defaultOpen={grade === currentGrade}
                profile={profile}
                onStatusChange={onStatusChange}
              />
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Internships() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [journeyCount, setJourneyCount] = useState(0);
  const [internships, setInternships] = useState([]);
  const [perTrack, setPerTrack] = useState(6);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);

  const loadData = useCallback(async () => {
    const user = await apiClient.auth.me();
    const [profiles, plans, journey, existing] = await Promise.all([
      apiClient.entities.TeenProfile.filter({ user_email: user.email }),
      apiClient.entities.CareerPlan.filter({ user_email: user.email }),
      apiClient.entities.JourneyEntry.filter({ user_email: user.email }),
      apiClient.entities.Internship.filter({ user_email: user.email }, "-created_date", 200),
    ]);
    if (!profiles.length) {
      navigate("/onboarding");
      return;
    }
    setProfile(profiles[0]);
    setPlan(plans[0] || null);
    setJourneyCount(journey.length);
    setInternships(existing);
    setLoading(false);
  }, [navigate]);

  usePullToRefresh(loadData);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const generate = async () => {
    setGenerating(true);
    toast.info("Searching for internships across your tracks…");
    apiClient.functions.invoke('generateInternships', { perTrack })
      .catch((err) => console.error('generateInternships invoke error:', err));

    const prevCount = internships.length;
    let stableRounds = 0;
    let totalRounds = 0;
    // Buckets (General + each career track) are generated one at a time on
    // the backend now, so there can be long quiet gaps between batches of
    // new rows arriving - stay patient rather than giving up early.
    const MAX_STABLE_ROUNDS = 20; // ~60s of no change
    const MAX_TOTAL_ROUNDS = 100; // ~5 min hard cap
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        totalRounds++;
        const user = await apiClient.auth.me();
        const fresh = await apiClient.entities.Internship.filter({ user_email: user.email }, "-created_date", 200);
        if (fresh.length > prevCount) {
          setInternships(fresh);
          stableRounds = 0;
        } else {
          stableRounds++;
        }
        if (stableRounds >= MAX_STABLE_ROUNDS || totalRounds >= MAX_TOTAL_ROUNDS) {
          clearInterval(pollRef.current);
          setGenerating(false);
          if (fresh.length > prevCount) toast.success(`${fresh.length - prevCount} new internships found! 🎉`);
        }
      } catch {
        clearInterval(pollRef.current);
        setGenerating(false);
      }
    }, 3000);
  };

  const groups = useMemo(() => {
    const byTrack = new Map();
    for (const i of internships) {
      const key = i.track_name || "General";
      if (!byTrack.has(key)) byTrack.set(key, []);
      byTrack.get(key).push(i);
    }
    const orderedTrackNames = (plan?.career_tracks || []).filter((t) => t?.name).map((t) => t.name);
    const result = [];
    if (byTrack.has("General")) {
      result.push({ label: "General", description: "General career exploration", items: byTrack.get("General") });
    }
    for (const name of orderedTrackNames) {
      if (byTrack.has(name)) {
        const track = plan.career_tracks.find((t) => t.name === name);
        result.push({ label: name, description: track?.description || "", items: byTrack.get(name) });
      }
    }
    // any leftover track names not in the current plan (e.g. plan regenerated since)
    for (const [key, items] of byTrack.entries()) {
      if (key !== "General" && !orderedTrackNames.includes(key)) {
        result.push({ label: key, description: "", items });
      }
    }
    return result;
  }, [internships, plan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2 mb-1">
          <Briefcase className="w-6 h-6 text-primary" />
          Internships
        </h1>
        <p className="text-muted-foreground text-sm">Matched to your roadmap tracks, grade, and interests</p>
      </motion.div>

      <ProfileContextCard
        profile={profile}
        plan={plan}
        journeyCount={journeyCount}
        perTrack={perTrack}
        setPerTrack={setPerTrack}
        generating={generating}
        onGenerate={generate}
      />

      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <TrackSection
              key={g.label}
              label={g.label}
              description={g.description}
              items={g.items}
              defaultOpen={i === 0}
              profile={profile}
              onStatusChange={loadData}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Click "Find Internships by Track" to get suggestions tailored to your roadmap</p>
        </div>
      )}

      {generating && (
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <span>Still searching for real internships across your tracks…</span>
        </div>
      )}
    </div>
  );
}
