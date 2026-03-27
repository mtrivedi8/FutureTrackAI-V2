import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import RecommendationDetail from "../components/recommendations/RecommendationDetail";
import GenerateButton from "../components/dashboard/GenerateButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compass, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

const FILTERS = ["All", "New", "Exploring", "In Progress", "Completed", "Skipped"];

export default function Recommendations() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const pollRef = useRef(null);

  const handleNewRec = (freshRecs) => {
    setRecommendations(freshRecs);
  };

  const loadData = async (autoGenerate = false) => {
    const user = await base44.auth.me();
    const [profiles, memberships, allSettings] = await Promise.all([
      base44.entities.TeenProfile.filter({ user_email: user.email }),
      base44.entities.Membership.filter({ user_email: user.email, status: 'active' }),
      base44.entities.AppSettings.filter({}),
    ]);
    setHasMembership(memberships.length > 0);
    const paymentSetting = allSettings.find(s => s.key === 'payment_enabled');
    const isPaymentEnabled = paymentSetting ? paymentSetting.value === 'true' : true;
    setPaymentEnabled(isPaymentEnabled);
    const p = profiles[0] || null;
    if (p) setProfile(p);
    const recs = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100);

    // Auto-generate on first visit if no recommendations exist
    if (autoGenerate && p && recs.length === 0) {
      setLoading(false);
      setIsSearching(true);
      base44.functions.invoke('generateRecommendations', {
        profile: p,
        existingTitles: [],
      }).catch(err => console.error('generateRecommendations invoke error:', err));
      // Poll for new recs and show them as they arrive
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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Compass className="w-6 h-6 text-primary" />
            Explore Paths
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{recommendations.length} recommendations tailored for you</p>
        </div>
        {!paymentEnabled || hasMembership || recommendations.length === 0 ? (
          <GenerateButton
            profile={profile}
            existingRecs={recommendations}
            onGenerated={() => { setIsSearching(false); loadData(); }}
            onNewRec={(fresh) => { handleNewRec(fresh); setIsSearching(true); }}
          />
        ) : (
          <Button
            onClick={() => navigate('/membership')}
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
          >
            <Lock className="w-4 h-4" /> Unlock More Suggestions
          </Button>
        )}
      </motion.div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted/50 w-full sm:w-auto overflow-x-auto flex">
          {FILTERS.map(f => (
            <TabsTrigger key={f} value={f} className="text-xs">{f}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <RecommendationCard recommendation={rec} onClick={setSelected} />
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