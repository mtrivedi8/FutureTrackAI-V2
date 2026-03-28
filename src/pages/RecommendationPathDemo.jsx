import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  CheckCircle2, BookOpen, Lightbulb, Target, Star,
  Users, Globe, Trophy, Loader2, GraduationCap, Map, Zap, ExternalLink
} from "lucide-react";

const TRACK_THEMES = [
  { color: "from-blue-500 to-cyan-400", ringColor: "ring-blue-400", bgLight: "bg-blue-950/40", borderColor: "border-blue-400/40", textColor: "text-blue-300", emoji: "🚀" },
  { color: "from-emerald-500 to-teal-400", ringColor: "ring-emerald-400", bgLight: "bg-emerald-950/40", borderColor: "border-emerald-400/40", textColor: "text-emerald-300", emoji: "🧬" },
  { color: "from-pink-500 to-violet-400", ringColor: "ring-pink-400", bgLight: "bg-pink-950/40", borderColor: "border-pink-400/40", textColor: "text-pink-300", emoji: "🎨" },
];

const statusStyles = {
  "Completed":   { dot: "bg-green-400",  badge: "bg-green-900/60 text-green-300 border-green-500/30",   glow: "shadow-green-500/50" },
  "In Progress": { dot: "bg-blue-400 animate-pulse", badge: "bg-blue-900/60 text-blue-300 border-blue-500/30", glow: "shadow-blue-500/50" },
  "Exploring":   { dot: "bg-violet-400", badge: "bg-violet-900/60 text-violet-300 border-violet-500/30", glow: "shadow-violet-500/30" },
  "New":         { dot: "bg-slate-500",  badge: "bg-slate-800/60 text-slate-400 border-slate-600/30",   glow: "" },
  "Skipped":     { dot: "bg-slate-600",  badge: "bg-slate-800/40 text-slate-500 border-slate-600/20",   glow: "" },
};

const TYPE_ICONS = { "Course": BookOpen, "Skill": Lightbulb, "Activity": Users, "Project": Target, "Career Path": Star, "default": Zap };

const DIFFICULTY_FOR_GRADE = (grade) => {
  if (grade <= 8) return "Beginner";
  if (grade <= 10) return "Intermediate";
  return "Advanced";
};

function getRecsForGrade(recs, grade) {
  const difficulty = DIFFICULTY_FOR_GRADE(grade);
  const matching = recs.filter(r => r.difficulty_level === difficulty && r.status !== "Skipped");
  const others = recs.filter(r => r.difficulty_level !== difficulty && r.status !== "Skipped");
  return [...matching, ...others].slice(0, 5);
}

function buildNodesFromTrack(track) {
  const grades = (track.grades || []).sort((a, b) => a.grade - b.grade);
  const nodes = grades.map(g => ({
    id: `${track.name}-${g.grade}`,
    title: g.key_milestone || `Grade ${g.grade}`,
    subtitle: g.focus || "",
    grade: g.grade,
    isFinal: false,
  }));
  nodes.push({
    id: `${track.name}-goal`,
    title: track.college_goals || "Career Goal",
    subtitle: track.description || "",
    grade: null,
    isFinal: true,
  });
  return nodes;
}

function TrackNode({ node, track, theme, index, recommendations, onTap, isSelected }) {
  const gradeRecs = node.grade ? getRecsForGrade(recommendations, node.grade) : [];
  const completed = gradeRecs.filter(r => r.status === "Completed").length;
  const hasProgress = gradeRecs.some(r => r.status === "In Progress" || r.status === "Exploring");
  const allDone = gradeRecs.length > 0 && completed === gradeRecs.length;

  const status = allDone ? "Completed" : hasProgress ? "In Progress" : "New";
  const ss = statusStyles[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08 }}
      className="flex flex-col items-center"
    >
      <div className={cn("w-0.5 rounded-full bg-white/20", index === 0 ? "h-0" : "h-5")} />

      <motion.button
        onClick={() => onTap({ ...node, track, theme, gradeRecs })}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.93 }}
        className={cn(
          "relative flex items-center justify-center rounded-full ring-2 shadow-lg transition-all duration-200",
          node.isFinal ? "w-14 h-14 ring-4" : "w-10 h-10",
          `bg-gradient-to-br ${theme.color}`,
          theme.ringColor,
          ss.glow && `shadow-lg ${ss.glow}`,
          isSelected && "ring-4 ring-white/70 scale-110",
        )}
      >
        {node.isFinal
          ? <Star className="w-6 h-6 text-white" />
          : <span className="text-white text-[11px] font-bold">{node.grade}</span>}

        {allDone && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border border-white/30">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        {hasProgress && !allDone && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
        )}
      </motion.button>

      <div className="mt-1 text-center px-0.5">
        <p className="text-white text-[9px] font-semibold leading-tight max-w-[68px] line-clamp-2">{node.title}</p>
        {gradeRecs.length > 0 && (
          <p className="text-white/30 text-[8px] mt-0.5">{completed}/{gradeRecs.length}</p>
        )}
      </div>
    </motion.div>
  );
}

function TrackColumn({ track, theme, recommendations, selectedNode, onNodeTap }) {
  const nodes = buildNodesFromTrack(track);
  const allRecs = recommendations.filter(r => r.status !== "Skipped");
  const completed = allRecs.filter(r => r.status === "Completed").length;
  const progress = allRecs.length ? completed / allRecs.length : 0;
  const isActive = selectedNode?.track?.name === track.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className={cn(
        "flex flex-col items-center rounded-3xl border p-3 pt-4 transition-all duration-300",
        theme.bgLight, theme.borderColor,
        isActive && "ring-2 ring-white/20 shadow-2xl"
      )}
    >
      <div className="text-center mb-3">
        <div className="text-xl mb-0.5">{theme.emoji}</div>
        <p className={cn("font-heading font-bold text-[11px] leading-tight", theme.textColor)}>{track.name}</p>
        <div className="mt-1.5 w-14 h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", theme.color)}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
        <p className="text-white/25 text-[8px] mt-0.5">{completed}/{allRecs.length}</p>
      </div>

      <div className="flex flex-col items-center w-full">
        {nodes.map((node, i) => (
          <TrackNode
            key={node.id}
            node={node}
            track={track}
            theme={theme}
            index={i}
            recommendations={recommendations}
            onTap={onNodeTap}
            isSelected={selectedNode?.id === node.id}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function RecommendationPathDemo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [currentGrade, setCurrentGrade] = useState(9);
  const [selectedNode, setSelectedNode] = useState(null);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 p-4 pb-20">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5 pt-4">
          <p className="text-violet-300/60 text-xs font-semibold uppercase tracking-widest mb-1">Career Roadmap</p>
          <h1 className="font-heading text-2xl font-bold text-white">Your 3 Paths</h1>
          <p className="text-white/40 text-xs mt-1">Tap any grade node to see what to do</p>
          {/* Legend */}
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            {[["Completed","bg-green-400"],["In Progress","bg-blue-400"],["New","bg-slate-500"]].map(([s, dot]) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn("w-2 h-2 rounded-full", dot)} />
                <span className="text-white/40 text-[10px]">{s}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Fork origin */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col items-center mb-2">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-4 ring-amber-400/30 shadow-lg shadow-amber-500/30">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <p className="text-white/40 text-[10px] font-semibold mt-1 uppercase tracking-wide">Grade {currentGrade} → College</p>
          <div className="relative w-full mt-2 h-5">
            <svg viewBox="0 0 300 20" className="w-full max-w-sm mx-auto block" fill="none">
              <path d="M150 0 L50 20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3"/>
              <path d="M150 0 L150 20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3"/>
              <path d="M150 0 L250 20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
          </div>
        </motion.div>

        {/* 3-column grid */}
        <div className="grid grid-cols-3 gap-2">
          {tracks.slice(0, 3).map((track, i) => (
            <TrackColumn
              key={track.name}
              track={track}
              theme={TRACK_THEMES[i % TRACK_THEMES.length]}
              recommendations={recommendations}
              selectedNode={selectedNode}
              onNodeTap={setSelectedNode}
            />
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="flex justify-center gap-4 mt-6">
          <button onClick={() => navigate("/plan")} className="text-white/25 text-xs hover:text-white/50 transition-colors flex items-center gap-1">
            <GraduationCap className="w-3 h-3" /> Academic Plan
          </button>
          <button onClick={() => navigate("/recommendations")} className="text-white/25 text-xs hover:text-white/50 transition-colors flex items-center gap-1">
            <Zap className="w-3 h-3" /> Explore
          </button>
        </motion.div>
      </div>

      {/* Bottom sheet — node detail + suggestions */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedNode(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 shadow-2xl z-50 max-h-[75vh] overflow-y-auto"
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white/40 text-[10px] font-medium mb-0.5">{selectedNode.track?.name} {selectedNode.grade ? `· Grade ${selectedNode.grade}` : ""}</p>
                  <h3 className="font-heading text-base font-bold text-white leading-tight">{selectedNode.title}</h3>
                  {selectedNode.subtitle && <p className="text-white/40 text-xs mt-0.5">{selectedNode.subtitle}</p>}
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-white/30 hover:text-white text-2xl leading-none ml-3 shrink-0">×</button>
              </div>

              {/* Suggestions list */}
              {selectedNode.gradeRecs?.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold">
                    📚 Suggestions for this grade ({selectedNode.gradeRecs.length})
                  </p>
                  {selectedNode.gradeRecs.map((rec, i) => {
                    const Icon = TYPE_ICONS[rec.type] || TYPE_ICONS.default;
                    const ss = statusStyles[rec.status] || statusStyles["New"];
                    return (
                      <motion.button
                        key={rec.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => { setSelectedNode(null); navigate(`/recommendations?id=${rec.id}`); }}
                        className="w-full flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-white/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold leading-tight">{rec.title}</p>
                          <p className="text-white/40 text-[10px] mt-0.5 line-clamp-1">{rec.description}</p>
                          <div className={cn("mt-1 text-[9px] px-2 py-0.5 rounded-full border inline-block font-medium", ss.badge)}>
                            {rec.status || "New"}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-white/20 shrink-0 mt-1" />
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 text-center py-4">
                  <p className="text-white/30 text-xs">No suggestions yet.</p>
                  <button onClick={() => { setSelectedNode(null); navigate("/recommendations"); }}
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline">
                    Go to Explore to generate some →
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}