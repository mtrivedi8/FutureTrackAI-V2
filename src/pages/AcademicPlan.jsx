import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronRight, BookOpen, Trophy, RefreshCw, AlertTriangle, Zap, XCircle, School } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import GradeTimeline from "@/components/plan/GradeTimeline";
import GradePlanCard from "@/components/plan/GradePlanCard";
import RoadmapDemo from "@/pages/RoadmapDemo";
import { LayoutGrid, GitBranch } from "lucide-react";



export default function AcademicPlan() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(() => {
    // Pre-populate from localStorage so mobile remounts don't flash empty state
    try {
      const cached = localStorage.getItem('academic_plan_cache');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [generatingTrackIndex, setGeneratingTrackIndex] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageBlocked, setUsageBlocked] = useState(false);
  const [monthlyLimitEnabled, setMonthlyLimitEnabled] = useState(true);
  const [view, setView] = useState("list");
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const pollingRef = useRef(null);
  const carouselRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const setPlanWithCache = (p) => {
    setPlan(p);
    try {
      if (p) localStorage.setItem('academic_plan_cache', JSON.stringify(p));
      else localStorage.removeItem('academic_plan_cache');
    } catch {}
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(false);
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
      setPlanWithCache(existingPlan);
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
      setLoadError(true);
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
        setPlanWithCache(p);
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
          // Extract only serializable profile fields to avoid circular references
          const cleanProfile = {
            user_email: user.email,
            display_name: profile.display_name,
            age: profile.age,
            zipcode: profile.zipcode,
            city: profile.city,
            country: profile.country,
            current_grade: currentGrade,
            interests: profile.interests || [],
            strengths: profile.strengths || [],
            goals: profile.goals || [],
            dream_careers: profile.dream_careers || [],
            preferred_learning_style: profile.preferred_learning_style,
            middle_school_name: profile.middle_school_name,
            high_school_name: profile.high_school_name,
            school_name: profile.school_name,
          };
          response = await base44.functions.invoke('generateAcademicPlan', { profile: cleanProfile, journey });
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
      console.error('generatePlan error:', err.message || err);
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

      {/* School Resources */}
      {plan?.school_info && (plan.school_info.school_website || plan.school_info.catalog_url) && (
        <div className="mb-6 rounded-2xl border border-border bg-gradient-to-r from-primary/5 to-secondary/5 p-4 flex items-start gap-4">
          <School className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-foreground">{plan.school_info.school_name}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {plan.school_info.school_website && (
                <a
                  href={plan.school_info.school_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  School Website →
                </a>
              )}
              {plan.school_info.catalog_url && (
                <a
                  href={plan.school_info.catalog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-secondary hover:underline font-medium"
                >
                  Course Catalog →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header with View Toggle */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                Academic Roadmap
              </h1>
              <p className="text-muted-foreground mt-1">
                {profile?.school_name ? `${profile.school_name} · ` : ""}Grade {startGrade} → College
              </p>
            </div>
            {/* View Toggle - Desktop */}
            <div className="hidden sm:flex items-center rounded-full border-2 border-primary/30 bg-primary/5 p-1 gap-0 shrink-0">
              <button
                onClick={() => setView("list")}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all",
                  view === "list" ? "bg-primary text-primary-foreground shadow-lg" : "text-foreground hover:text-primary"
                )}
              >
                <LayoutGrid className="w-4 h-4" /> List
              </button>
              <button
                onClick={() => setView("map")}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all",
                  view === "map" ? "bg-primary text-primary-foreground shadow-lg" : "text-foreground hover:text-primary"
                )}
              >
                <GitBranch className="w-4 h-4" /> Map
              </button>
            </div>
            {/* View Toggle - Mobile */}
            <div className="sm:hidden flex items-center gap-1 shrink-0">
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
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-center">
            {plan && tracks.length > 0 && (
              <Button
                onClick={() => generatePlan(true)}
                disabled={generatingTrackIndex !== null || (usageBlocked && monthlyLimitEnabled)}
                variant="outline"
                className="gap-2 hidden sm:flex"
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

      {view === "map" && plan?.career_tracks?.length > 0 ? (
        <RoadmapDemo />
      ) : (!plan || tracks.length === 0) && generatingTrackIndex === null ? (
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
      ) : (!plan || tracks.length === 0) && generatingTrackIndex !== null ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h2 className="font-heading text-xl font-bold">Generating your comprehensive plan</h2>
          <p className="text-muted-foreground max-w-sm">
            Searching {profile?.school_name ? `${profile.school_name}'s course catalog` : 'your school'} and crafting a personalized grade {startGrade}–12 roadmap with career tracks, courses, and activities.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 rounded-xl px-4 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            This usually takes 2–3 minutes — please keep this page open
          </div>
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
      ) : (
        <div className="space-y-8">
          {/* Career Track Selector */}
          <div>
            <h2 className="font-heading text-lg font-semibold mb-3">Choose a Career Track</h2>
            
            {/* Desktop Grid */}
            <div className="hidden sm:grid grid-cols-3 gap-3">
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
                      <p className={`text-xs text-muted-foreground mt-1 ${expandedTrack === idx ? '' : 'line-clamp-2'}`}>{track.description}</p>
                      {track.description && track.description.length > 80 && (
                        <span
                          onClick={e => { e.stopPropagation(); setExpandedTrack(expandedTrack === idx ? null : idx); }}
                          className="text-[10px] text-primary font-medium mt-1 hover:underline cursor-pointer block"
                        >
                          {expandedTrack === idx ? 'See less' : 'See more'}
                        </span>
                      )}
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

            {/* Mobile Carousel */}
            <div className="sm:hidden space-y-3">
              <div className="relative">
                <div 
                  ref={carouselRef}
                  className="overflow-x-auto flex-1 snap-x snap-mandatory"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  onScroll={(e) => {
                    const el = e.target;
                    const itemWidth = window.innerWidth * 0.7 + 12;
                    const newIndex = Math.max(0, Math.round(el.scrollLeft / itemWidth));
                    setActiveCarouselIndex(newIndex);
                    handleTrackSelect(newIndex);
                  }}
                >
                  <div className="flex gap-3 pb-2">
                    {tracks.map((track, idx) => (
                      <div key={idx} className="flex-shrink-0 w-[70vw]">
                        <div className="relative">
                          <button
                            onClick={() => handleTrackSelect(idx)}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border-2 transition-all duration-200",
                              activeCarouselIndex === idx
                                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                : "border-border bg-card hover:border-primary/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-heading font-bold text-foreground text-sm flex-1">{track.name}</h3>
                              {activeCarouselIndex === idx && <span className="text-primary text-lg leading-none">✓</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{track.description}</p>
                            {activeCarouselIndex === idx && (
                              <div className="mt-3 text-xs text-primary font-semibold">Active Track →</div>
                            )}
                          </button>
                          {generatingTrackIndex === idx && (
                            <div className="absolute inset-0 rounded-2xl bg-black/5 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Overlay arrow buttons */}
                <button
                  onClick={() => {
                    if (carouselRef.current) {
                      carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                    }
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border bg-card/95 hover:bg-muted flex items-center justify-center z-20"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <button
                  onClick={() => {
                    if (carouselRef.current) {
                      carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border bg-card/95 hover:bg-muted flex items-center justify-center z-20"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 py-2">
                {tracks.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      activeCarouselIndex === idx ? 'bg-primary w-6' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {currentTrack && (
            <>

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