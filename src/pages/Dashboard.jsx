import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatsOverview from "../components/dashboard/StatsOverview";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import GenerateButton from "../components/dashboard/GenerateButton";
import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.TeenProfile.filter({ user_email: user.email });
    if (!profiles.length) {
      navigate("/onboarding");
      return;
    }
    setProfile(profiles[0]);
    const recs = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 50);
    setRecommendations(recs);
    const updates = await base44.entities.ProgressUpdate.filter({ user_email: user.email }, "-created_date", 50);
    setProgressUpdates(updates);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const recentRecs = recommendations.slice(0, 4);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Hey {profile?.display_name} {profile?.avatar_emoji}
          </h1>
          <p className="text-muted-foreground mt-1">Here's your career exploration journey</p>
        </div>
        <GenerateButton profile={profile} existingRecs={recommendations} onGenerated={loadData} />
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <StatsOverview recommendations={recommendations} progressUpdates={progressUpdates} />
      </motion.div>

      {/* Recent Recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Your Recommendations
          </h2>
          {recommendations.length > 4 && (
            <Link to="/recommendations" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        {recentRecs.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {recentRecs.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} onClick={() => navigate(`/recommendations?id=${rec.id}`)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Click "Get New Suggestions" to receive your first AI recommendations!</p>
          </div>
        )}
      </motion.div>

      {/* Recent Progress */}
      {progressUpdates.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Recent Updates</h2>
            <Link to="/progress" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {progressUpdates.slice(0, 3).map(update => (
              <div key={update.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <span className="text-lg">
                  {update.mood === "Excited" ? "🔥" : update.mood === "Motivated" ? "💪" : update.mood === "Curious" ? "🤔" : update.mood === "Struggling" ? "😤" : "📝"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{update.title}</p>
                  <p className="text-xs text-muted-foreground">{update.update_type}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}