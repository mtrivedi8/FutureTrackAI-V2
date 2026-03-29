import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, TrendingUp, BookOpen, Award, ArrowRight, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const features = [
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Track courses completed, GPAs, extracurriculars, and achievements across every grade level"
  },
  {
    icon: Award,
    title: "Longitudinal Insights",
    description: "See your complete journey from year to year—grade advancement, growth patterns, and readiness assessment"
  },
  {
    icon: BookOpen,
    title: "Smart Resume Building",
    description: "Auto-generated resume highlighting your best achievements, skills, and experiences from your academic path"
  },
  {
    icon: Rocket,
    title: "College Essays & Applications",
    description: "AI-powered essay drafting and application guidance based on your unique journey and growth story"
  }
];

export default function CollegePath() {
  const navigate = useNavigate();
  const [paymentGated, setPaymentGated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const user = await base44.auth.me();
      const [memberships, allSettings] = await Promise.all([
        base44.entities.Membership.filter({ user_email: user.email, status: 'active' }),
        base44.entities.AppSettings.filter({}),
      ]);
      const paymentEnabled = allSettings.find(s => s.key === 'payment_enabled')?.value === 'true';
      setPaymentGated(paymentEnabled && memberships.length === 0);
      setLoading(false);
    };
    check();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (paymentGated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold mb-2">College Path is a Premium Feature</h2>
          <p className="text-muted-foreground max-w-sm">Track your complete academic journey and build compelling college applications. Subscribe to unlock.</p>
        </div>
        <Button onClick={() => navigate('/membership')} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg">
          <Lock className="w-4 h-4" /> Unlock with Subscription
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-4 py-2 mb-6">
            <span className="text-sm font-semibold text-primary">Coming Soon</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Your Path to College
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track your complete academic journey, showcase your growth, and build compelling college applications—all in one place.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Timeline Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/50 p-8 mb-12"
        >
          <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
            What You'll See
          </h2>
          <div className="space-y-6">
            {[
              {
                grade: "Grade 7",
                items: ["First course completions", "Club memberships", "Starting skills"]
              },
              {
                grade: "Grade 8-10",
                items: ["GPA progression", "Advanced placements", "Leadership roles"]
              },
              {
                grade: "Grade 11-12",
                items: ["Resume generation", "Essay drafting", "Application readiness"]
              },
              {
                grade: "College",
                items: ["Complete profile", "Polished essays", "Application tracker"]
              }
            ].map((stage, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="w-24 shrink-0">
                  <span className="text-sm font-semibold text-primary">{stage.grade}</span>
                </div>
                <div className="flex-1">
                  <ul className="space-y-1">
                    {stage.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center rounded-2xl border border-primary/20 bg-primary/5 p-8"
        >
          <h3 className="font-heading text-xl font-bold text-foreground mb-2">
            Everything you need to tell your story
          </h3>
          <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
            Keep building your journey, and we'll help you showcase it to colleges when the time comes.
          </p>
          <div className="flex items-center justify-center gap-1 text-primary font-semibold text-sm">
            Stay on your path <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}