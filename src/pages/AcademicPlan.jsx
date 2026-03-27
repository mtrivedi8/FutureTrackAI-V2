import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronRight, BookOpen, Trophy, RefreshCw, AlertTriangle, Zap, XCircle } from "lucide-react";
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
  const [generatingTrackIndex, setGeneratingTrackIndex] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageBlocked, setUsageBlocked] = useState(false);
  const [monthlyLimitEnabled, setMonthlyLimitEnabled] = useState(true);
  const pollingRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
    const allSettings = await base44.entities.AppSettings.filter({});
    const [profiles, plans, memberships, usageRecords] = await Promise.all([
      base44.entities.TeenProfile.filter({ user_email: user.email }),
      base44.entities.CareerPlan.filter({ user_email: user.email }),
      base44.entities.Membership.filter({ user_email: user.email, status: 'active' }),
      base44.entities.UsageCredit.filter({ user_email: user.email, month: new Date().toISOString().slice(0, 7) }),
    ]);
    const paymentEnabled = allSettings.find(s => s.key === 'payment_enabled') ? allSettings.find(s => s.key === 'payment_enabled').value === 'true' : true;
    const monthlyLimitEnabledSetting = allSettings.find(s => s.key === 'monthly_limit_enabled') ? allSettings.find(s => s.key === 'monthly_limit_enabled').value !== 'false' : true;
    setMonthlyLimitEnabled(monthlyLimitEnabledSetting);
    if (paymentEnabled && memberships.length === 0) {
      navigate('/membership');
      return;
    }
    const p = profiles[0];
    setProfile(p);
    const existingPlan = plans[0];
    if (existingPlan) {
      setPlan(existingPlan);
      setSelectedTrack(existingPlan.selected_track_index || 0);
      // If plan is still generating (user left the page), start polling
      if (existingPlan.is_generating) {
        setGeneratingTrackIndex(0);
        startPolling(user.email);
      }
    }
    if (usageRecords[0]) {
      setUsage(usageRecords[0]);
      setUsageBlocked(usageRecords[0].blocked || usageRecords[0].total_cost >= 5.0);
    }
    if (p) setSelectedGrade(p.current_grade || 7);
    setLoading(false);
    } catch (err) {
      console.error('AcademicPlan loadData error:', err);
      setLoading(false);
    }
  };

  const startPolling = (userEmail, isFullPlan = false) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const plans = await base44.entities.CareerPlan.filter({ user_email: userEmail });
      const p = plans[0];
      if (p && !p.is_generating && p.career_tracks?.length > 0) {
        clearInterval(pollingRef.current);
        setPlan(p);
        setSelectedTrack(p.selected_track_index || 0);
        setGeneratingTrackIndex(null);
        toast.success(isFullPlan ? 'Your academic plan is ready! 🎓' : 'Track updated! 🎓');
      }
    }, 5000);
  };

  const generatePlan = async (adaptToProgress = false, trackIndex = null) => {
    if (!profile) return;
    
    // If trackIndex specified, regenerate that track only
    if (trackIndex !== null) {
      setGeneratingTrackIndex(trackIndex);
    } else {
      setGeneratingTrackIndex(0);
    }

    try {
      const user = await base44.auth.me();
      const currentGrade = profile.current_grade || 9;

      // Mark as generating in DB so re-visits know it's in progress
      const existingForMark = await base44.entities.CareerPlan.filter({ user_email: user.email });
      let generatingPlanId = null;
      if (existingForMark[0]) {
        await base44.entities.CareerPlan.update(existingForMark[0].id, { is_generating: true });
        generatingPlanId = existingForMark[0].id;
      } else {
        const created = await base44.entities.CareerPlan.create({ user_email: user.email, is_generating: trackIndex !== null });
        generatingPlanId = created.id;
      }

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
        regenerate_track_index: trackIndex,
      };

      let response;
      let retries = 0;
      const maxRetries = 3;
      while (retries < maxRetries) {
        try {
          response = await base44.functions.invoke('generateAcademicPlan', { profile: { ...profile, current_grade: currentGrade }, journey });
          break;
        } catch (invokeErr) {
          retries++;
          console.error(`Invoke attempt ${retries} failed:`, invokeErr.message);
          if (retries >= maxRetries) {
            throw new Error('Failed to reach the plan generator after multiple attempts. Please check your connection and try again.');
          }
          await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
        }
      }

      if (response.status === 429 || response.data?.error === 'USAGE_CAP_REACHED') {
        toast.error('Monthly usage limit reached. Your credits reset next month.');
        setUsageBlocked(true);
        setGeneratingTrackIndex(null);
        const existingPlans = await base44.entities.CareerPlan.filter({ user_email: user.email });
        if (existingPlans[0]) {
          await base44.entities.CareerPlan.update(existingPlans[0].id, { is_generating: false });
        }
        return;
      }

      // Backend returns immediately; poll DB for completion
      startPolling(user.email, trackIndex === null);
    } catch (err) {
      console.error('generatePlan error:', err);
      if (err.response?.status === 429) {
        toast.error('Monthly usage limit reached. Your credits reset next month.');
        setUsageBlocked(true);
      } else {
        toast.error('Failed to generate plan. Please try again.');
      }
      setGeneratingTrackIndex(null);
      const user = await base44.auth.me();
      const existingPlans = await base44.entities.CareerPlan.filter({ user_email: user.email });
      if (existingPlans[0]) {
        await base44.entities.CareerPlan.update(existingPlans[0].id, { is_generating: false });
      }
    }
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

  const tracks = (plan?.career_tracks || []).filter(t => t && t.name);
  const currentTrack = tracks[selectedTrack];
  const gradeData = currentTrack?.grades?.find(g => Number(g.grade) === Number(selectedGrade)) || (currentTrack?.grades?.[0] || null);

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
              <p className="font-medium text-destructive">Monthly plan limit reached — resets next month</p>
            ) : (() => {
              const plansUsed = Math.round((usage.total_cost || 0) / 0.25);
              const plansTotal = 20;
              const remaining = plansTotal - plansUsed;
              return (
                <>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{plansUsed} of {plansTotal}</span> plan generations used this month
                    {remaining > 0 && <span className="text-muted-foreground"> · {remaining} remaining</span>}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (plansUsed / plansTotal) * 100)}%` }}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Academic Roadmap
            </h1>
            <p className="text-muted-foreground mt-1">
              {profile?.school_name ? `${profile.school_name} · ` : ""}
              Grade {startGrade} → College
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {plan && tracks.length > 0 && (
              <Button
                onClick={() => generatePlan(true)}
                disabled={generatingTrackIndex !== null || (usageBlocked && monthlyLimitEnabled)}
                variant="outline"
                className="gap-2"
              >
                {generatingTrackIndex !== null ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Adapt to My Progress</>
                )}
              </Button>
            )}
            <Button
              onClick={() => generatePlan(false)}
              disabled={generatingTrackIndex !== null || (usageBlocked && monthlyLimitEnabled)}
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
            >
              {generatingTrackIndex !== null ? (
               <><Loader2 className="w-4 h-4 animate-spin" /> Generating Plan...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {plan && tracks.length > 0 ? "Regenerate Plan" : "Generate My Plan"}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {(!plan || tracks.length === 0) && generatingTrackIndex === null && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold mb-2">Create Your Academic Plan</h2>
            <p className="text-muted-foreground max-w-md">
              Click "Generate My Plan" and AI will create a personalized grade-by-grade academic roadmap with career tracks, classes, clubs, and more.
            </p>
          </div>
          <Button onClick={generatePlan} disabled={generatingTrackIndex !== null} size="lg" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Sparkles className="w-5 h-5" /> Generate My Academic Plan
          </Button>
        </div>
      )}

      {(!plan || tracks.length === 0) && generatingTrackIndex !== null && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h2 className="font-heading text-xl font-bold">Building your roadmap</h2>
          <p className="text-muted-foreground">Searching {profile?.school_name ? `${profile.school_name}'s course catalog` : 'your school'} and crafting a grade {startGrade}–12 plan for you</p>
          <button
            onClick={async () => {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setGeneratingTrackIndex(null);
              const user = await base44.auth.me();
              const plans = await base44.entities.CareerPlan.filter({ user_email: user.email });
              if (plans[0]) await base44.entities.CareerPlan.update(plans[0].id, { is_generating: false });
              toast.info('Plan generation cancelled.');
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors mt-2"
          >
            <XCircle className="w-4 h-4" /> Cancel generation
          </button>
        </div>
      )}

      {plan && tracks.length > 0 && (
        <div className="space-y-8">
          {/* Career Track Selector */}
          <div>
            <h2 className="font-heading text-lg font-semibold mb-3">Choose a Career Track</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tracks.map((track, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="relative">
                    <button
                      onClick={() => handleTrackSelect(idx)}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all duration-200",
                        selectedTrack === idx
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      {track.emoji && <div className="text-2xl mb-2" style={{display: 'none'}}>{track.emoji}</div>}
                      <h3 className="font-heading font-bold text-foreground text-sm">{track.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{track.description}</p>
                      {selectedTrack === idx && (
                        <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1">
                          Active Track <ChevronRight className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                    {generatingTrackIndex === idx && (
                     <div className="absolute inset-0 rounded-2xl bg-black/5 flex items-center justify-center">
                       <Loader2 className="w-5 h-5 text-primary animate-spin" />
                     </div>
                    )}
                    {selectedTrack === idx && generatingTrackIndex !== idx && (
                     <Button
                        onClick={(e) => { e.stopPropagation(); generatePlan(false, idx); }}
                        disabled={generatingTrackIndex !== null || (usageBlocked && monthlyLimitEnabled)}
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Regenerate this track"
                      >
                        {generatingTrackIndex === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
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
                    <p className="text-xs font-medium text-primary mb-0.5">College and Career Goal</p>
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
                {gradeData ? (
                  <motion.div
                    key={selectedGrade}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <GradePlanCard grade={selectedGrade} gradeData={gradeData} schoolName={profile?.school_name} schoolInfo={plan?.school_info} />
                  </motion.div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Grade plan data not available</p>
                  </div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </div>
  );
}