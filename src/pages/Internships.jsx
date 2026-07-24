import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { apiClient } from "@/api/apiClient";
import InternshipCard from "@/components/internships/InternshipCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Briefcase, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const FILTERS = ["All", "New", "Applied", "Interviewing", "Accepted", "Rejected", "Skipped"];

export default function Internships() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [internships, setInternships] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);

  const loadData = useCallback(async () => {
    const user = await apiClient.auth.me();
    const [profiles, plans, existing] = await Promise.all([
      apiClient.entities.TeenProfile.filter({ user_email: user.email }),
      apiClient.entities.CareerPlan.filter({ user_email: user.email }),
      apiClient.entities.Internship.filter({ user_email: user.email }, "-created_date", 100),
    ]);
    if (!profiles.length) {
      navigate("/onboarding");
      return;
    }
    setProfile(profiles[0]);
    const plan = plans[0];
    if (plan?.career_tracks?.length > 0) {
      setTracks(plan.career_tracks.filter((t) => t?.name));
      setTrackIndex(plan.selected_track_index || 0);
    }
    setInternships(existing);
    setLoading(false);
  }, [navigate]);

  usePullToRefresh(loadData);
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const generate = async () => {
    setGenerating(true);
    toast.info("Searching for internships that fit your track and interests…");
    apiClient.functions.invoke('generateInternships', { trackIndex })
      .catch((err) => console.error('generateInternships invoke error:', err));

    const prevCount = internships.length;
    let stableRounds = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const user = await apiClient.auth.me();
        const fresh = await apiClient.entities.Internship.filter({ user_email: user.email }, "-created_date", 100);
        if (fresh.length > prevCount) {
          setInternships(fresh);
        } else {
          stableRounds++;
        }
        if (stableRounds >= 3 || fresh.length - prevCount >= 5) {
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

  const filtered = filter === "All" ? internships : internships.filter((i) => i.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 sm:space-y-0 sm:flex sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Internships
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Matched to your track, grade, and interests</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tracks.length > 1 && (
            <Select value={String(trackIndex)} onValueChange={(v) => setTrackIndex(parseInt(v))}>
              <SelectTrigger className="h-10 w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tracks.map((t, i) => (
                  <SelectItem key={i} value={String(i)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={generate}
            disabled={generating}
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Searching..." : "Find Internships"}
          </Button>
        </div>
      </motion.div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted/50 w-full sm:w-auto overflow-x-auto flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f} className="text-xs">{f}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:gap-3">
          {filtered.map((internship, i) => (
            <motion.div key={internship.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <InternshipCard internship={internship} onStatusChange={loadData} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {filter !== "All" ? `No ${filter.toLowerCase()} internships yet` : "Click \"Find Internships\" to get suggestions tailored to your roadmap"}
          </p>
        </div>
      )}

      {generating && (
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <span>Still searching for real internships that match your profile…</span>
        </div>
      )}
    </div>
  );
}
