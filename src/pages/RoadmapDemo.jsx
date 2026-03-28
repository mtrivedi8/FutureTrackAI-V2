import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Star, Lock, CheckCircle2, Zap, BookOpen, Lightbulb, Users, Target, ExternalLink, GraduationCap } from "lucide-react";

const TYPE_ICONS = { "Course": BookOpen, "Skill": Lightbulb, "Activity": Users, "Project": Target, "Career Path": Star, "default": Zap };

const TRACK_THEMES = [
  { bg: "bg-blue-500",    ring: "ring-blue-400",    text: "text-blue-400",    dim: "bg-blue-950/40",   line: "bg-blue-500/40",   emoji: "🚀" },
  { bg: "bg-emerald-500", ring: "ring-emerald-400", text: "text-emerald-400", dim: "bg-emerald-950/40",line: "bg-emerald-500/40", emoji: "🧬" },
  { bg: "bg-pink-500",    ring: "ring-pink-400",    text: "text-pink-400",    dim: "bg-pink-950/40",   line: "bg-pink-500/40",   emoji: "🎨" },
];

function getRecsForGrade(recs, grade) {
  const difficulty = grade <= 8 ? "Beginner" : grade <= 10 ? "Intermediate" : "Advanced";
  return recs.filter(r => r.status !== "Skipped" && r.difficulty_level === difficulty).slice(0, 4);
}

function GradeNode({ g, theme, index, isLast, recommendations, currentGrade, onTap, isSelected }) {
  const gradeRecs = getRecsForGrade(recommendations, g.grade);
  const completed = gradeRecs.filter(r => r.status === "Completed").length;
  const inProgress = gradeRecs.some(r => r.status === "In Progress" || r.status === "Exploring");
  const allDone = gradeRecs.length > 0 && completed === gradeRecs.length;
  const isUnlocked = g.grade <= currentGrade + 1;
  const isCurrent = g.grade === currentGrade;

  return (
    <div className="flex flex-col items-center">
      {/* Connector line above (skip for first) */}
      {index > 0 && (
        <div className={cn("w-0.5 h-6", isUnlocked ? theme.line : "bg-white/10")} />
      )}

      {/* Node button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.07 }}
        onClick={() => isUnlocked && onTap({ g, theme, gradeRecs, allDone, inProgress })}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border transition-all duration-200 w-full px-2 py-3 gap-1",
          isUnlocked
            ? isSelected
              ? `${theme.dim} border-white/40 ring-2 ring-white/30 scale-105 shadow-xl`
              : `${theme.dim} border-white/10 hover:border-white/30 hover:scale-105`
            : "bg-slate-900/40 border-white/5 opacity-40 cursor-not-allowed"
        )}
      >
        {/* Grade badge */}
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm",
          allDone ? "bg-green-500 text-white" : isUnlocked ? `${theme.bg} text-white` : "bg-slate-700 text-slate-500"
        )}>
          {!isUnlocked ? <Lock className="w-3.5 h-3.5" /> : allDone ? <CheckCircle2 className="w-4 h-4" /> : g.grade}
        </div>

        {/* Label */}
        <p className="text-white text-[9px] font-semibold leading-tight text-center line-clamp-2 max-w-[60px]">
          {g.key_milestone ? g.key_milestone.split(" ").slice(0, 4).join(" ") : `Grade ${g.grade}`}
        </p>

        {/* Status dot */}
        {isUnlocked && gradeRecs.length > 0 && (
          <p className={cn("text-[8px] font-medium", allDone ? "text-green-400" : inProgress ? "text-blue-300" : "text-white/30")}>
            {completed}/{gradeRecs.length}
          </p>
        )}

        {/* Current grade indicator */}
        {isCurrent && (
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
            YOU
          </div>
        )}

        {/* In-progress pulse */}
        {inProgress && !allDone && (
          <div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping" />
        )}
      </motion.button>

      {/* Connector line below (skip for last) */}
      {!isLast && (
        <div className={cn("w-0.5 h-6", isUnlocked ? theme.line : "bg-white/10")} />
      )}
    </div>
  );
}

function TrackColumn({ track, theme, recommendations, currentGrade, onNodeTap, selectedKey }) {
  const grades = (track.grades || []).sort((a, b) => a.grade - b.grade).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col items-center gap-0"
    >
      {/* Track header */}
      <div className={cn("w-full rounded-2xl border border-white/10 p-3 mb-3 text-center", theme.dim)}>
        <div className="text-2xl mb-1">{theme.emoji}</div>
        <p className={cn("font-bold text-xs leading-tight", theme.text)}>{track.name}</p>
      </div>

      {/* Grade nodes */}
      {grades.map((g, i) => (
        <GradeNode
          key={g.grade}
          g={g}
          theme={theme}
          index={i}
          isLast={i === grades.length - 1}
          recommendations={recommendations}
          currentGrade={currentGrade}
          onTap={(data) => onNodeTap({ ...data, trackName: track.name })}
          isSelected={selectedKey === `${track.name}-${g.grade}`}
        />
      ))}

      {/* Goal node */}
      <div className={cn("w-0.5 h-6", theme.line)} />
      <div className={cn("w-full rounded-2xl border border-white/10 p-3 text-center", theme.dim)}>
        <Star className={cn("w-4 h-4 mx-auto mb-1", theme.text)} />
        <p className="text-white/50 text-[9px] leading-tight line-clamp-2">
          {track.college_goals ? track.college_goals.split(" ").slice(0, 6).join(" ") + "…" : "Career Goal"}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

function Section({ title, color, children }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${color}`}>{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ label, color }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${color}`}>{label}</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoadmapDemo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [currentGrade, setCurrentGrade] = useState(9);
  const [selected, setSelected] = useState(null); // { g, theme, gradeRecs, allDone, inProgress, trackName }

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [plans, recs, profiles] = await Promise.all([
      base44.entities.CareerPlan.filter({ user_email: user.email }),
      base44.entities.Recommendation.filter({ user_email: user.email }, "-updated_date", 100),
      base44.entities.TeenProfile.filter({ user_email: user.email }),
    ]);
    if (profiles[0]?.current_grade) setCurrentGrade(profiles[0].current_grade);
    setRecommendations(recs);
    const plan = plans[0];
    if (plan?.career_tracks?.length > 0) setTracks(plan.career_tracks.filter(t => t?.name));
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  );

  if (!tracks.length) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 flex flex-col items-center justify-center p-6 text-center gap-4">
      <GraduationCap className="w-12 h-12 text-violet-400" />
      <h2 className="font-heading text-2xl font-bold text-white">No Roadmap Yet</h2>
      <p className="text-white/50 text-sm max-w-xs">Generate your Academic Plan first.</p>
      <button onClick={() => navigate("/plan")} className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
        Go to Academic Plan →
      </button>
    </div>
  );

  const selectedKey = selected ? `${selected.trackName}-${selected.g.grade}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <h1 className="font-heading text-lg font-bold text-white">Career Roadmap</h1>
        <p className="text-white/40 text-[10px]">Tap any grade to see what to work on</p>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-3 px-4">
        {[["bg-green-500","Completed"],["bg-blue-400","In Progress"],["bg-slate-700","Locked"]].map(([dot,label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", dot)} />
            <span className="text-white/40 text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Origin */}
      <div className="flex justify-center mb-2 px-4">
        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5">
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 text-xs font-semibold">You are here · Grade {currentGrade}</span>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="px-3 pb-32 pt-2">
        <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto items-start">
          {tracks.slice(0, 3).map((track, i) => (
            <TrackColumn
              key={track.name}
              track={track}
              theme={TRACK_THEMES[i % TRACK_THEMES.length]}
              recommendations={recommendations}
              currentGrade={currentGrade}
              onNodeTap={setSelected}
              selectedKey={selectedKey}
            />
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelected(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 z-50 max-h-[75vh] overflow-y-auto"
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white/40 text-[10px] mb-0.5">{selected.trackName} · Grade {selected.g.grade}</p>
                  <h3 className="font-heading text-base font-bold text-white">{selected.g.key_milestone || `Grade ${selected.g.grade} Milestone`}</h3>
                  {selected.g.focus && <p className="text-white/40 text-xs mt-0.5">{selected.g.focus}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white text-2xl leading-none ml-3">×</button>
              </div>

              <div className="space-y-4">
                {selected.g?.school_courses?.length > 0 && (
                  <Section title="📚 School Courses" color="text-blue-300">
                    {selected.g.school_courses.map((c, i) => (
                      <Chip key={i} label={typeof c === "string" ? c : `${c.name}${c.level && c.level !== "Standard" ? " · " + c.level : ""}`} color="bg-blue-900/40 text-blue-300 border-blue-500/20" />
                    ))}
                  </Section>
                )}
                {selected.g?.clubs?.length > 0 && (
                  <Section title="🏆 Clubs" color="text-emerald-300">
                    {selected.g.clubs.map((c, i) => <Chip key={i} label={c} color="bg-emerald-900/40 text-emerald-300 border-emerald-500/20" />)}
                  </Section>
                )}
                {selected.g?.extracurriculars?.length > 0 && (
                  <Section title="⚡ Extracurriculars" color="text-amber-300">
                    {selected.g.extracurriculars.map((c, i) => <Chip key={i} label={c} color="bg-amber-900/40 text-amber-300 border-amber-500/20" />)}
                  </Section>
                )}
                {selected.g?.volunteer_opportunities?.length > 0 && (
                  <Section title="🤝 Volunteer" color="text-pink-300">
                    {selected.g.volunteer_opportunities.map((c, i) => <Chip key={i} label={c} color="bg-pink-900/40 text-pink-300 border-pink-500/20" />)}
                  </Section>
                )}
                {selected.g?.online_courses?.length > 0 && (
                  <Section title="💻 Online Courses" color="text-violet-300">
                    {selected.g.online_courses.map((c, i) => <Chip key={i} label={c} color="bg-violet-900/40 text-violet-300 border-violet-500/20" />)}
                  </Section>
                )}
                {selected.g?.summer_activities?.length > 0 && (
                  <Section title="☀️ Summer" color="text-orange-300">
                    {selected.g.summer_activities.map((c, i) => <Chip key={i} label={c} color="bg-orange-900/40 text-orange-300 border-orange-500/20" />)}
                  </Section>
                )}

                {selected.gradeRecs?.length > 0 && (
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-2">Explore Suggestions ({selected.gradeRecs.length})</p>
                    <div className="space-y-2">
                      {selected.gradeRecs.map((rec, i) => {
                        const Icon = TYPE_ICONS[rec.type] || TYPE_ICONS.default;
                        const sc = { "Completed": "bg-green-900/50 text-green-300 border-green-500/30", "In Progress": "bg-blue-900/50 text-blue-300 border-blue-500/30", "Exploring": "bg-violet-900/50 text-violet-300 border-violet-500/30" }[rec.status] || "bg-slate-800/50 text-slate-400 border-slate-600/30";
                        return (
                          <button key={rec.id} onClick={() => { setSelected(null); navigate(`/recommendations?id=${rec.id}`); }}
                            className="w-full flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-white/60" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-semibold">{rec.title}</p>
                              <p className="text-white/40 text-[10px] mt-0.5 line-clamp-1">{rec.description}</p>
                              <div className={cn("mt-1 text-[9px] px-2 py-0.5 rounded-full border inline-block font-medium", sc)}>{rec.status || "New"}</div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-white/20 shrink-0 mt-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!selected.gradeRecs?.length && !selected.g?.clubs?.length && !selected.g?.school_courses?.length && (
                  <div className="text-center py-4">
                    <p className="text-white/30 text-xs">No data yet.</p>
                    <button onClick={() => { setSelected(null); navigate("/recommendations"); }} className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline">
                      Generate suggestions in Explore →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}