import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronRight, BookOpen, Trophy, RefreshCw, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import GradeTimeline from "@/components/plan/GradeTimeline";
import GradePlanCard from "@/components/plan/GradePlanCard";



export default function AcademicPlan() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageBlocked, setUsageBlocked] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const [profiles, plans, memberships, settings, usageRecords] = await Promise.all([
      base44.entities.TeenProfile.filter({ user_email: user.email }),
      base44.entities.CareerPlan.filter({ user_email: user.email }),
      base44.entities.Membership.filter({ user_email: user.email, status: 'active' }),
      base44.entities.AppSettings.filter({ key: 'payment_enabled' }),
      base44.entities.UsageCredit.filter({ user_email: user.email, month: new Date().toISOString().slice(0, 7) }),
    ]);
    const paymentEnabled = settings[0] ? settings[0].value === 'true' : true;
    if (paymentEnabled && memberships.length === 0) {
      navigate('/membership');
      return;
    }
    const p = profiles[0];
    setProfile(p);
    if (plans[0]) {
      setPlan(plans[0]);
      setSelectedTrack(plans[0].selected_track_index || 0);
    }
    if (usageRecords[0]) {
      setUsage(usageRecords[0]);
      setUsageBlocked(usageRecords[0].blocked || usageRecords[0].total_cost >= 5.0);
    }
    if (p) setSelectedGrade(p.current_grade || 7);
    setLoading(false);
  };

  const generatePlan = async (adaptToProgress = false) => {
    if (!profile) return;
    setGenerating(true);

    const user = await base44.auth.me();
    const [recs, updates] = await Promise.all([
      base44.entities.Recommendation.filter({ user_email: user.email }, "-updated_date", 50),
      base44.entities.ProgressUpdate.filter({ user_email: user.email }, "-created_date", 30),
    ]);

    const journey = {
      completed_recommendations: recs.filter(r => r.status === "Completed").map(r => r.title),
      in_progress_recommendations: recs.filter(r => r.status === "In Progress" || r.status === "Exploring").map(r => r.title),
      skills_gained: [...new Set(updates.flatMap(u => u.skills_gained || []))],
      new_interests: [...new Set(updates.flatMap(u => u.new_interests || []))],
      recent_milestones: updates.filter(u => u.update_type === "Achievement" || u.update_type === "Milestone").slice(0, 5).map(u => u.title),
      moods: updates.slice(0, 10).map(u => u.mood).filter(Boolean),
      adapt_mode: adaptToProgress,
    };

    const response = await base44.functions.invoke('generateAcademicPlan', { profile: { ...profile, current_grade: startGrade }, journey });

    if (response.status === 429 || response.data?.error === 'USAGE_CAP_REACHED') {
      toast.error('Monthly usage limit reached. Your credits reset next month.');
      setUsageBlocked(true);
      setGenerating(false);
      return;
    }

    const { tracks, school_info, usage: newUsage } = response.data;
    if (newUsage) {
      setUsage(newUsage);
      setUsageBlocked(newUsage.blocked);
    }

    const existing = await base44.entities.CareerPlan.filter({ user_email: user.email });

    const planData = {
      user_email: user.email,
      career_tracks: tracks || [],
      selected_track_index: 0,
      school_name: profile.school_name,
      current_grade: profile.current_grade,
    };

    let savedPlan;
    if (existing[0]) {
      await base44.entities.CareerPlan.update(existing[0].id, { ...planData, school_info });
      savedPlan = { ...existing[0], ...planData, school_info };
    } else {
      savedPlan = await base44.entities.CareerPlan.create({ ...planData, school_info });
    }

    setPlan(savedPlan);
    setSelectedTrack(0);
    const msg = adaptToProgress
      ? `Plan updated based on your progress! 🚀`
      : school_info?.courses_found > 0
        ? `Plan ready! Found ${school_info.courses_found} real courses from ${school_info.district_name || profile.school_name} 🎓`
        : 'Your academic plan is ready! 🎓';
    toast.success(msg);
    setGenerating(false);
  };

  const handleTrackSelect = async (idx) => {
    setSelectedTrack(idx);
    if (plan) {
      await base44.entities.CareerPlan.update(plan.id, { selected_track_index: idx });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentGrade = profile?.current_grade || 9;
  const startGrade = currentGrade;
  const grades = Array.from({ length: 13 - startGrade }, (_, i) => startGrade + i);

  const tracks = plan?.career_tracks || [];
  const currentTrack = tracks[selectedTrack];
  const gradeData = currentTrack?.grades?.find(g => g.grade === selectedGrade);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Usage meter */}
      {usage && (
        <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 text-sm ${
          usageBlocked ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/40'
        }`}>
          {usageBlocked ? (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          ) : (
            <Zap className="w-4 h-4 text-primary shrink-0" />
          )}
          <div className="flex-1">
            {usageBlocked ? (
              <p className="font-medium text-destructive">Monthly usage limit reached — resets next month</p>
            ) : (
              <>
                <p className="text-muted-foreground">AI Credits used this month: <span className="font-semibold text-foreground">${(usage.total_cost || 0).toFixed(2)} / $5.00</span></p>
                <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, ((usage.total_cost || 0) / 5.0) * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              🎓 Academic Roadmap
            </h1>
            <p className="text-muted-foreground mt-1">
              {profile?.school_name ? `${profile.school_name} · ` : ""}
              Grade {startGrade} → College
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {plan && (
              <Button
                onClick={() => generatePlan(true)}
                disabled={generating || usageBlocked}
                variant="outline"
                className="gap-2"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Adapt to My Progress</>
                )}
              </Button>
            )}
            <Button
              onClick={() => generatePlan(false)}
              disabled={generating || usageBlocked}
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Plan...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {plan ? "Regenerate Plan" : "Generate My Plan"}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {!plan && !generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold mb-2">No plan yet!</h2>
            <p className="text-muted-foreground max-w-md">
              Click "Generate My Plan" and AI will create a personalized grade-by-grade academic roadmap with career tracks, classes, clubs, and more.
            </p>
          </div>
          <Button onClick={generatePlan} disabled={generating} size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Sparkles className="w-5 h-5" /> Generate My Academic Plan
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h2 className="font-heading text-xl font-bold">Building your roadmap...</h2>
          <p className="text-muted-foreground">Searching {profile?.school_name ? `${profile.school_name}'s course catalog` : 'your school'} and crafting a grade {startGrade}–12 plan for you...</p>
        </div>
      )}

      {plan && !generating && (
        <div className="space-y-8">
          {/* Career Track Selector */}
          <div>
            <h2 className="font-heading text-lg font-semibold mb-3 text-muted-foreground">Choose a Career Track</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tracks.map((track, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTrackSelect(idx)}
                  className={cn(
                    "text-left p-4 rounded-2xl border transition-all duration-200",
                    selectedTrack === idx
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="text-2xl mb-2">{track.emoji || "🎯"}</div>
                  <h3 className="font-heading font-bold text-foreground text-sm">{track.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{track.description}</p>
                  {selectedTrack === idx && (
                    <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1">
                      Active Track <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {currentTrack && (
            <>
              {/* College Goal Banner */}
              {currentTrack.college_goals && (
                <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 p-4 flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-primary mb-0.5">College & Career Goal</p>
                    <p className="text-sm text-foreground">{currentTrack.college_goals}</p>
                  </div>
                </div>
              )}

              {/* Grade Timeline */}
              <div>
                <h2 className="font-heading text-lg font-semibold mb-3">Select a Grade Year</h2>
                <GradeTimeline
                  grades={grades}
                  selectedGrade={selectedGrade}
                  currentGrade={profile?.current_grade}
                  onSelect={setSelectedGrade}
                  trackGrades={currentTrack.grades || []}
                />
              </div>

              {/* Grade Plan Detail */}
              <AnimatePresence mode="wait">
                {gradeData && (
                  <motion.div
                    key={selectedGrade}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <GradePlanCard grade={selectedGrade} gradeData={gradeData} schoolName={profile?.school_name} schoolInfo={plan?.school_info} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </div>
  );
}