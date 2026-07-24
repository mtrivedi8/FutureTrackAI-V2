import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import ProgressForm from "../components/progress/ProgressForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Calendar, Lock } from "lucide-react";
import { motion } from "framer-motion";
import moment from "moment";

const moodEmojis = {
  Excited: "🔥", Motivated: "💪", Curious: "🤔",
  Neutral: "😊", Struggling: "😤", Uncertain: "🤷",
};

const typeColors = {
  Achievement: "bg-green-500/10 text-green-600",
  Milestone: "bg-primary/10 text-primary",
  Reflection: "bg-blue-500/10 text-blue-500",
  "Interest Change": "bg-accent/10 text-accent",
  Feedback: "bg-yellow-500/10 text-yellow-600",
};

export default function Progress() {
  const navigate = useNavigate();
  const [updates, setUpdates] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentGated, setPaymentGated] = useState(false);

  const loadData = async () => {
    const user = await apiClient.auth.me();
    const [ups, recs, memberships, allSettings] = await Promise.all([
      apiClient.entities.ProgressUpdate.filter({ user_email: user.email }, "-created_date", 100),
      apiClient.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100),
      apiClient.entities.Membership.filter({ user_email: user.email, status: 'active' }),
      apiClient.entities.AppSettings.filter({}),
    ]);
    const paymentEnabled = allSettings.find(s => s.key === 'payment_enabled')?.value === 'true';
    if (paymentEnabled && memberships.length === 0) {
      setPaymentGated(true);
      setLoading(false);
      return;
    }
    setUpdates(ups);
    setRecommendations(recs);
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

  if (paymentGated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold mb-2">Your Journey is a Premium Feature</h2>
          <p className="text-muted-foreground max-w-sm">Track your progress, log milestones, and see how far you've come. Subscribe to unlock your full journey log.</p>
        </div>
        <Button onClick={() => navigate('/membership')} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg">
          <Lock className="w-4 h-4" /> Unlock with Subscription
        </Button>
      </div>
    );
  }

  // Group by month
  const grouped = {};
  updates.forEach(u => {
    const key = moment(u.created_date).format("MMMM YYYY");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(u);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-secondary" />
            Your Journey
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{updates.length} updates logged</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Log Progress
        </Button>
      </motion.div>

      {updates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Start tracking your journey by logging your first update!</p>
          <Button onClick={() => setShowForm(true)} variant="secondary" className="gap-2">
            <Plus className="w-4 h-4" /> Log Your First Update
          </Button>
        </div>
      ) : (
        Object.entries(grouped).map(([month, monthUpdates]) => (
          <motion.div
            key={month}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">{month}</h3>
            </div>
            <div className="space-y-3">
              {monthUpdates.map(update => {
                const relatedRec = recommendations.find(r => r.id === update.recommendation_id);
                return (
                  <div key={update.id} className="rounded-2xl bg-card border border-border p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{moodEmojis[update.mood] || "📝"}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-heading font-semibold text-foreground">{update.title}</h3>
                          <Badge variant="secondary" className={typeColors[update.update_type]}>
                            {update.update_type}
                          </Badge>
                        </div>
                        {update.description && (
                          <p className="text-sm text-muted-foreground">{update.description}</p>
                        )}
                        {relatedRec && (
                          <p className="text-xs text-primary mt-1">Related to: {relatedRec.title}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {moment(update.created_date).fromNow()}
                      </span>
                    </div>

                    {(update.skills_gained?.length > 0 || update.new_interests?.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                        {update.skills_gained?.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] rounded-md font-medium">
                            🛠 {s}
                          </span>
                        ))}
                        {update.new_interests?.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-md font-medium">
                            ✨ {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))
      )}

      {showForm && (
        <ProgressForm
          recommendations={recommendations}
          onClose={() => setShowForm(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}