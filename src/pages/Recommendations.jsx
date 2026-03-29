import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import RecommendationDetail from "../components/recommendations/RecommendationDetail";
import RecommendationMapView from "../components/recommendations/RecommendationMapView";
import GenerateButton from "../components/dashboard/GenerateButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compass, Lock, LayoutGrid, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const FILTERS = ["All", "New", "Exploring", "In Progress", "Completed", "Skipped"];

export default function Recommendations() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [currentGrade, setCurrentGrade] = useState(9);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("list"); // "list" | "map"
  const [loading, setLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const pollRef = useRef(null);

  const handleNewRec = (freshRecs) => setRecommendations(freshRecs);

  const loadData = async (autoGenerate = false) => {
    const user = await base44.auth.me();
    const [profiles, memberships, allSettings, plans] = await Promise.all([
      base44.entities.TeenProfile.filter({ user_email: user.email }),
      base44.entities.Membership.filter({ user_email: user.email, status: 'active' }),
      base44.entities.AppSettings.filter({}),
      base44.entities.CareerPlan.filter({ user_email: user.email }),
    ]);
    if (!profiles.length || !profiles[0].onboarding_completed) {
      navigate('/onboarding');
      return;
    }
    setHasMembership(memberships.length > 0);
    const paymentSetting = allSettings.find(s => s.key === 'payment_enabled');
    setPaymentEnabled(paymentSetting ? paymentSetting.value === 'true' : false);
    const p = profiles[0] || null;
    if (p) {
      setProfile(p);
      if (p.current_grade) setCurrentGrade(p.current_grade);
    }
    if (plans[0]?.career_tracks?.length > 0) setTracks(plans[0].career_tracks.filter(t => t?.name));

    const recs = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100);

    if (autoGenerate && p && recs.length === 0) {
      setLoading(false);
      setIsSearching(true);
      base44.functions.invoke('generateRecommendations', { profile: p, existingTitles: [] })
        .catch(err => console.error('generateRecommendations invoke error:', err));
      let lastCount = 0;
      let stableRounds = 0;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const freshUser = await base44.auth.me();
          const fresh = await base44.entities.Recommendation.filter({ user_email: freshUser.email }, '-created_date', 100);
          if (fresh.length > lastCount) {
            setRecommendations(fresh);
            lastCount = fresh.length;
            stableRounds = 0;
          } else {
            stableRounds++;
          }
          if (stableRounds >= 2 || fresh.length >= 5) {
            clearInterval(pollRef.current);
            setIsSearching(false);
          }
        } catch (e) {
          clearInterval(pollRef.current);
          setIsSearching(false);
        }
      }, 3000);
    } else {
      setRecommendations(recs);
    }

    setLoading(false);

    const urlParams = new URLSearchParams(window.location.search);
    const recId = urlParams.get("id");
    if (recId) {
      const found = recs.find(r => r.id === recId);
      if (found) setSelected(found);
    }
  };

  useEffect(() => { loadData(true); }, []);

  const filtered = filter === "All" ? recommendations : recommendations.filter(r => r.status === filter);

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
        <div className="hidden sm:block">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Compass className="w-6 h-6 text-primary" />
            Explore Paths
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{recommendations.length} recommendations tailored for you</p>
        </div>

        {/* Mobile header */}
        <div className="sm:hidden">
          <h1 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            Explore
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle - compact on mobile */}
          <div className="hidden sm:flex items-center rounded-lg border-2 border-primary/30 bg-primary/5 p-1 gap-0">
            <button
              onClick={() => setView("list")}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                view === "list" ? "bg-primary text-primary-foreground shadow-lg" : "text-foreground hover:bg-primary/20"
              )}
            >
              <LayoutGrid className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView("map")}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                view === "map" ? "bg-primary text-primary-foreground shadow-lg" : "text-foreground hover:bg-primary/20"
              )}
            >
              <GitBranch className="w-4 h-4" /> Map
            </button>
          </div>
          {/* Mobile icon-only toggle */}
          <div className="sm:hidden flex items-center gap-1">
            <button
              onClick={() => setView("list")}
              className={cn("p-2 rounded-lg transition-all",
                view === "list" ? "bg-primary text-primary-foreground shadow-lg" : "border border-border hover:bg-primary/20"
              )}
              title="List View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("map")}
              className={cn("p-2 rounded-lg transition-all",
                view === "map" ? "bg-primary text-primary-foreground shadow-lg" : "border border-border hover:bg-primary/20"
              )}
              title="Map View"
            >
              <GitBranch className="w-4 h-4" />
            </button>
          </div>

          {/* Generate button - stacked on mobile */}
          <div className="w-full sm:w-auto">
            {!paymentEnabled || hasMembership || recommendations.length === 0 ? (
              <GenerateButton
                profile={profile}
                existingRecs={recommendations}
                disabled={isSearching}
                onGenerated={() => { setIsSearching(false); loadData(); }}
                onNewRec={(fresh) => { handleNewRec(fresh); setIsSearching(true); }}
              />
            ) : (
              <Button
                onClick={() => navigate('/membership')}
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 text-xs sm:text-sm"
              >
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Unlock More Suggestions</span>
                <span className="sm:hidden">Unlock</span>
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {view === "map" ? (
        <RecommendationMapView
          tracks={tracks}
          recommendations={recommendations}
          currentGrade={currentGrade}
        />
      ) : (
        <>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-muted/50 w-full sm:w-auto overflow-x-auto flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map(f => (
                <TabsTrigger key={f} value={f} className="text-xs">{f}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:gap-3">
              {filtered.map((rec, i) => (
                <motion.div key={rec.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <RecommendationCard recommendation={rec} onClick={setSelected} onStatusChange={loadData} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">No {filter !== "All" ? filter.toLowerCase() : ""} recommendations yet</p>
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              <span>Still searching for more suggestions for you…</span>
            </div>
          )}
        </>
      )}

      {selected && (
        <RecommendationDetail
          recommendation={selected}
          onClose={() => setSelected(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}