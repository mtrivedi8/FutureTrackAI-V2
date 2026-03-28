import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Star, Lock, CheckCircle2, Zap, BookOpen, Lightbulb, Users, Target, ExternalLink, GraduationCap } from "lucide-react";

const TYPE_ICONS = { "Course": BookOpen, "Skill": Lightbulb, "Activity": Users, "Project": Target, "Career Path": Star, "default": Zap };

const TRACK_THEMES = [
  { bg: "bg-blue-500",    text: "text-blue-400",    dim: "bg-blue-950/50",    border: "border-blue-500/40",  line: "#3b82f6", emoji: "🚀", label: "text-blue-300" },
  { bg: "bg-emerald-500", text: "text-emerald-400", dim: "bg-emerald-950/50", border: "border-emerald-500/40",line: "#10b981", emoji: "🧬", label: "text-emerald-300" },
  { bg: "bg-pink-500",    text: "text-pink-400",    dim: "bg-pink-950/50",    border: "border-pink-500/40",  line: "#ec4899", emoji: "🎨", label: "text-pink-300" },
];

// Grade → difficulty mapping (more granular: each grade gets its own band)
function getDifficultyForGrade(grade) {
  if (grade <= 7) return "Beginner";
  if (grade <= 8) return "Beginner";
  if (grade <= 9) return "Intermediate";
  if (grade <= 10) return "Intermediate";
  return "Advanced";
}

function getRecsForGrade(recs, grade) {
  const difficulty = getDifficultyForGrade(grade);
  return recs.filter(r => r.status !== "Skipped" && r.difficulty_level === difficulty).slice(0, 5);
}

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

function TrackTree({ track, theme, recommendations, currentGrade, onNodeTap, selectedKey }) {
  const grades = (track.grades || []).sort((a, b) => a.grade - b.grade).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("rounded-2xl border p-4", theme.dim, theme.border)}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border", theme.dim, theme.border)}>
          {theme.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-heading font-bold text-sm leading-tight", theme.label)}>{track.name}</p>
          {track.description && <p className="text-white/30 text-[10px] mt-0.5 line-clamp-1">{track.description}</p>}
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex items-center min-w-max gap-0">
          <div className="w-4 h-0.5 opacity-30" style={{ backgroundColor: theme.line }} />

          {grades.map((g, i) => {
            const gradeRecs = getRecsForGrade(recommendations, g.grade);
            const completed = gradeRecs.filter(r => r.status === "Completed").length;
            const inProgress = gradeRecs.some(r => r.status === "In Progress" || r.status === "Exploring");
            const allDone = gradeRecs.length > 0 && completed === gradeRecs.length;
            const isUnlocked = g.grade <= currentGrade + 1;
            const isCurrent = g.grade === currentGrade;
            const nodeKey = `${track.name}-${g.grade}`;
            const isSelected = selectedKey === nodeKey;

            return (
              <div key={g.grade} className="flex items-center gap-0">
                <motion.button
                  whileHover={isUnlocked ? { scale: 1.08 } : {}}
                  whileTap={isUnlocked ? { scale: 0.95 } : {}}
                  onClick={() => isUnlocked && onNodeTap({ g, theme, gradeRecs, allDone, inProgress, trackName: track.name })}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all duration-200 w-[72px] shrink-0",
                    isSelected ? "bg-white/15 border-white/40 shadow-lg"
                      : isUnlocked ? cn(theme.border, "hover:bg-white/10 cursor-pointer")
                      : "bg-slate-900/30 border-white/5 opacity-40 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                    allDone ? "bg-green-500 text-white"
                      : isUnlocked ? cn(theme.bg, "text-white")
                      : "bg-slate-700 text-slate-500"
                  )}>
                    {!isUnlocked ? <Lock className="w-3 h-3" /> : allDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : g.grade}
                  </div>

                  <p className="text-white text-[8px] font-semibold leading-tight text-center line-clamp-2 w-full">
                    {g.key_milestone ? g.key_milestone.split(" ").slice(0, 3).join(" ") : `Grade ${g.grade}`}
                  </p>

                  {isUnlocked && gradeRecs.length > 0 && (
                    <p className={cn("text-[7px] font-medium", allDone ? "text-green-400" : inProgress ? "text-blue-300" : "text-white/25")}>
                      {completed}/{gradeRecs.length} · {getDifficultyForGrade(g.grade)}
                    </p>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-[6px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      YOU
                    </div>
                  )}
                  {inProgress && !allDone && isUnlocked && (
                    <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-400 rounded-full animate-ping" />
                  )}
                </motion.button>

                {i < grades.length - 1 && (
                  <div className="w-3 h-0.5 opacity-30 shrink-0" style={{ backgroundColor: theme.line }} />
                )}
              </div>
            );
          })}

          <div className="w-3 h-0.5 opacity-30 shrink-0" style={{ backgroundColor: theme.line }} />
          <div className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 w-[72px] shrink-0", theme.dim, theme.border)}>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", theme.dim)}>
              <Star className={cn("w-4 h-4", theme.text)} />
            </div>
            <p className="text-white/50 text-[8px] leading-tight text-center line-clamp-2">
              {track.college_goals ? track.college_goals.split(" ").slice(0, 4).join(" ") + "…" : "Goal"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function RecommendationMapView({ tracks, recommendations, currentGrade }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const selectedKey = selected ? `${selected.trackName}-${selected.g.grade}` : null;

  if (!tracks.length) return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="text-muted-foreground text-sm">No career tracks yet — generate your Academic Roadmap first.</p>
      <button onClick={() => navigate("/plan")} className="mt-3 text-sm text-primary hover:underline">
        Go to Academic Roadmap →
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4">
        {[["bg-green-500","Completed"],["bg-blue-400","In Progress"],["bg-slate-600","Locked"]].map(([dot,label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", dot)} />
            <span className="text-muted-foreground text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Track trees */}
      <div className="rounded-2xl bg-slate-950/60 p-4 space-y-3">
        {tracks.slice(0, 3).map((track, i) => (
          <TrackTree
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
                  <p className="text-white/40 text-[10px] mb-0.5">
                    {selected.trackName} · Grade {selected.g.grade} · {getDifficultyForGrade(selected.g.grade)}
                  </p>
                  <h3 className="font-heading text-base font-bold text-white">{selected.g.key_milestone || `Grade ${selected.g.grade} Milestone`}</h3>
                  {selected.g.focus && <p className="text-white/40 text-xs mt-0.5">{selected.g.focus}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white text-2xl leading-none ml-3">×</button>
              </div>

              <div className="space-y-4">
                {selected.gradeRecs?.length > 0 && (
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-2">✨ Explore Suggestions ({selected.gradeRecs.length})</p>
                    <div className="space-y-2">
                      {selected.gradeRecs.map((rec) => {
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
                {selected.g?.summer_activities?.length > 0 && (
                  <Section title="☀️ Summer" color="text-orange-300">
                    {selected.g.summer_activities.map((c, i) => <Chip key={i} label={c} color="bg-orange-900/40 text-orange-300 border-orange-500/20" />)}
                  </Section>
                )}

                {!selected.gradeRecs?.length && !selected.g?.school_courses?.length && (
                  <div className="text-center py-4">
                    <p className="text-white/30 text-xs">No suggestions for this grade yet.</p>
                    <button onClick={() => { setSelected(null); navigate("/recommendations"); }}
                      className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline">
                      Generate suggestions →
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