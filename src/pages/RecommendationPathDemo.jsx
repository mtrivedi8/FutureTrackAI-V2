import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  CheckCircle2, BookOpen, Lightbulb, Target, Rocket, Star,
  Users, Globe, Trophy, Loader2, GraduationCap, Map,
  ChevronDown, ChevronRight, Zap, ExternalLink
} from "lucide-react";

const TRACK_THEMES = [
  { color: "from-blue-500 to-cyan-400", ringColor: "ring-blue-400", bg: "bg-blue-950/30", border: "border-blue-400/30", text: "text-blue-300", accent: "bg-blue-500", lightBadge: "bg-blue-900/50 text-blue-200 border-blue-500/30" },
  { color: "from-emerald-500 to-teal-400", ringColor: "ring-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-400/30", text: "text-emerald-300", accent: "bg-emerald-500", lightBadge: "bg-emerald-900/50 text-emerald-200 border-emerald-500/30" },
  { color: "from-pink-500 to-violet-400", ringColor: "ring-pink-400", bg: "bg-pink-950/30", border: "border-pink-400/30", text: "text-pink-300", accent: "bg-pink-500", lightBadge: "bg-pink-900/50 text-pink-200 border-pink-500/30" },
];

const TRACK_EMOJIS = ["🚀", "🧬", "🎨"];

const TYPE_ICONS = {
  "Course": BookOpen, "Skill": Lightbulb, "Activity": Users,
  "Project": Target, "Career Path": Star, "default": Zap
};

const DIFFICULTY_FOR_GRADE = (grade) => {
  if (grade <= 8) return "Beginner";
  if (grade <= 10) return "Intermediate";
  return "Advanced";
};

const statusColors = {
  "Completed":   "bg-green-500/20 text-green-300 border-green-500/30",
  "In Progress": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Exploring":   "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "New":         "bg-slate-700/40 text-slate-400 border-slate-600/30",
  "Skipped":     "bg-slate-700/40 text-slate-500 border-slate-600/20",
};

const statusDot = {
  "Completed": "bg-green-400", "In Progress": "bg-blue-400 animate-pulse",
  "Exploring": "bg-violet-400", "New": "bg-slate-500", "Skipped": "bg-slate-600",
};

// Match recommendations relevant to a grade node
function getRecsForGrade(recs, grade, trackName) {
  const difficulty = DIFFICULTY_FOR_GRADE(grade);
  // Priority: matching difficulty, then all others
  const matching = recs.filter(r => r.difficulty_level === difficulty && r.status !== "Skipped");
  const others = recs.filter(r => r.difficulty_level !== difficulty && r.status !== "Skipped");
  return [...matching, ...others].slice(0, 5);
}

function RecItem({ rec, onNavigate }) {
  const Icon = TYPE_ICONS[rec.type] || TYPE_ICONS.default;
  const statusClass = statusColors[rec.status] || statusColors["New"];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
      onClick={onNavigate}
    >
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-white/70" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold leading-tight">{rec.title}</p>
        <p className="text-white/40 text-[10px] mt-0.5 line-clamp-1">{rec.description}</p>
        <div className={cn("mt-1.5 text-[9px] px-2 py-0.5 rounded-full border inline-block font-medium", statusClass)}>
          {rec.status || "New"}
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 shrink-0 mt-1 transition-colors" />
    </motion.div>
  );
}

function GradeNode({ gradeData, theme, recs, gradeIndex, totalGrades, onRecNavigate }) {
  const [open, setOpen] = useState(false);
  const gradeRecs = getRecsForGrade(recs, gradeData.grade, "");
  const completedRecs = gradeRecs.filter(r => r.status === "Completed").length;
  const isCurrent = gradeIndex === 0;
  const isFinal = gradeIndex === totalGrades - 1;

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0">
        <motion.div
          whileHover={{ scale: 1.15 }}
          onClick={() => setOpen(o => !o)}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center ring-2 shadow-md cursor-pointer transition-all",
            `bg-gradient-to-br ${theme.color}`,
            theme.ringColor,
            isCurrent && "ring-4 shadow-lg",
            isFinal && "w-10 h-10"
          )}
        >
          {isFinal ? <Star className="w-5 h-5 text-white" /> : <span className="text-white text-[11px] font-bold">{gradeData.grade}</span>}
        </motion.div>
        {!isFinal && <div className="w-0.5 flex-1 min-h-[16px] bg-white/10 rounded-full my-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full text-left flex items-start justify-between gap-2 group"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-semibold leading-tight">
                {isFinal ? "🎯 Career Goal" : `Grade ${gradeData.grade}`}
              </p>
              {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold">YOU ARE HERE</span>}
            </div>
            <p className="text-white/40 text-[11px] mt-0.5 line-clamp-1">{gradeData.focus || gradeData.key_milestone}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {!isFinal && <span className="text-white/30 text-[10px]">{completedRecs}/{gradeRecs.length}</span>}
            {open ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {gradeData.key_milestone && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-amber-300 font-semibold uppercase tracking-wide">Key Milestone</p>
                      <p className="text-white/70 text-xs mt-0.5">{gradeData.key_milestone}</p>
                    </div>
                  </div>
                )}

                {gradeRecs.length > 0 && (
                  <>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold px-1">
                      📚 Suggested from Explore ({gradeRecs.length})
                    </p>
                    {gradeRecs.map((rec, i) => (
                      <motion.div key={rec.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <RecItem rec={rec} onNavigate={() => onRecNavigate(rec.id)} />
                      </motion.div>
                    ))}
                  </>
                )}

                {gradeRecs.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-3">No suggestions yet — go to Explore to generate some!</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TrackCard({ track, theme, emoji, index, recommendations, currentGrade, onRecNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const grades = (track.grades || []);
  const completedRecs = recommendations.filter(r => r.status === "Completed").length;
  const progress = recommendations.length ? completedRecs / recommendations.length : 0;

  // Sort grades starting from current grade
  const sortedGrades = [...grades].sort((a, b) => a.grade - b.grade);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn("rounded-2xl border overflow-hidden", theme.bg, theme.border)}
    >
      {/* Track header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-md", theme.color)}>
          <span className="text-lg">{emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-heading font-bold text-sm", theme.text)}>{track.name}</p>
          <p className="text-white/40 text-[10px] mt-0.5 line-clamp-1">{track.description}</p>
          {/* Progress bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className={cn("h-full rounded-full bg-gradient-to-r transition-all", theme.color)} style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="text-white/30 text-[9px] shrink-0">{completedRecs}/{recommendations.length} done</span>
          </div>
        </div>
        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center transition-transform", expanded ? "rotate-90" : "")}>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>
      </button>

      {/* Expanded grade nodes */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/10">
              {sortedGrades.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-4">No grade data available</p>
              ) : (
                sortedGrades.map((g, i) => (
                  <GradeNode
                    key={g.grade}
                    gradeData={g}
                    theme={theme}
                    recs={recommendations}
                    gradeIndex={i}
                    totalGrades={sortedGrades.length}
                    onRecNavigate={onRecNavigate}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RecommendationPathDemo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [currentGrade, setCurrentGrade] = useState(9);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [plans, recs, profiles] = await Promise.all([
      base44.entities.CareerPlan.filter({ user_email: user.email }),
      base44.entities.Recommendation.filter({ user_email: user.email }, "-updated_date", 100),
      base44.entities.TeenProfile.filter({ user_email: user.email }),
    ]);
    setRecommendations(recs);
    if (profiles[0]?.current_grade) setCurrentGrade(profiles[0].current_grade);
    const plan = plans[0];
    if (plan?.career_tracks?.length > 0) {
      setTracks(plan.career_tracks.filter(t => t?.name));
    }
    setLoading(false);
  };

  const handleRecNavigate = (recId) => {
    navigate(`/recommendations?id=${recId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 flex flex-col items-center justify-center p-6 text-center gap-4">
        <Map className="w-12 h-12 text-violet-400" />
        <h2 className="font-heading text-2xl font-bold text-white">No Career Tracks Yet</h2>
        <p className="text-white/50 text-sm max-w-xs">Generate your Academic Plan first to unlock your career roadmap.</p>
        <button onClick={() => navigate("/plan")} className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          Go to Academic Plan →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 p-4 pb-16">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6 pt-4">
          <p className="text-violet-300/60 text-xs font-semibold uppercase tracking-widest mb-1">Career Roadmap</p>
          <h1 className="font-heading text-2xl font-bold text-white">Your 3 Paths</h1>
          <p className="text-white/40 text-xs mt-1">Tap a track to expand → tap a grade to see what to do</p>
        </motion.div>

        {/* Fork icon */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-col items-center mb-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-4 ring-amber-400/20 shadow-lg">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <p className="text-white/30 text-[10px] font-semibold mt-1 uppercase tracking-wide">Grade {currentGrade} → College</p>
          <div className="w-0.5 h-4 bg-white/10 mt-1 rounded-full" />
        </motion.div>

        {/* Track cards */}
        <div className="space-y-3">
          {tracks.map((track, i) => (
            <TrackCard
              key={track.name}
              track={track}
              theme={TRACK_THEMES[i % TRACK_THEMES.length]}
              emoji={TRACK_EMOJIS[i % TRACK_EMOJIS.length]}
              index={i}
              recommendations={recommendations}
              currentGrade={currentGrade}
              onRecNavigate={handleRecNavigate}
            />
          ))}
        </div>

        <div className="flex justify-center mt-6 gap-4">
          <button onClick={() => navigate("/plan")} className="text-white/25 text-xs hover:text-white/50 transition-colors flex items-center gap-1">
            <GraduationCap className="w-3 h-3" /> Academic Plan
          </button>
          <button onClick={() => navigate("/recommendations")} className="text-white/25 text-xs hover:text-white/50 transition-colors flex items-center gap-1">
            <Zap className="w-3 h-3" /> Explore Suggestions
          </button>
        </div>
      </div>
    </div>
  );
}