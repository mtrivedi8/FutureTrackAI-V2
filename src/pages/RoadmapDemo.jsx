import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/apiClient";
import { Loader2, Star, Lock, CheckCircle2, Zap, BookOpen, Lightbulb, Users, Target, ExternalLink, GraduationCap } from "lucide-react";

const TYPE_ICONS = { "Course": BookOpen, "Skill": Lightbulb, "Activity": Users, "Project": Target, "Career Path": Star, "default": Zap };

const TRACK_THEMES = [
  { bg: "bg-blue-500",    ring: "ring-blue-400",    text: "text-blue-400",    dim: "bg-blue-950/50",    border: "border-blue-500/40",  line: "#3b82f6", emoji: "🚀", label: "text-blue-300" },
  { bg: "bg-emerald-500", ring: "ring-emerald-400", text: "text-emerald-400", dim: "bg-emerald-950/50", border: "border-emerald-500/40",line: "#10b981", emoji: "🧬", label: "text-emerald-300" },
  { bg: "bg-pink-500",    ring: "ring-pink-400",    text: "text-pink-400",    dim: "bg-pink-950/50",    border: "border-pink-500/40",  line: "#ec4899", emoji: "🎨", label: "text-pink-300" },
];

function getRecsForGrade(recs, grade) {
  const difficulty = grade <= 8 ? "Beginner" : grade <= 10 ? "Intermediate" : "Advanced";
  return recs.filter(r => r.status !== "Skipped" && r.difficulty_level === difficulty).slice(0, 4);
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

function OpportunitiesPanel({ selected, navigate }) {
  return (
    <div className="sticky top-4 rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">✨ Special Programs & Opportunities</p>
      {selected ? (
        <div className="space-y-4">
          <div>
            <p className="text-white/40 text-[10px] mb-1">{selected.trackName} · Grade {selected.g.grade}</p>
            <p className="text-white text-sm font-bold">{selected.g.key_milestone || `Grade ${selected.g.grade}`}</p>
          </div>
          {selected.g?.special_programs?.length > 0 && (
            <div>
              <p className="text-purple-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">🎓 Special Programs</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.g.special_programs.map((p, i) => <Chip key={i} label={p} color="bg-purple-900/40 text-purple-300 border-purple-500/20" />)}
              </div>
            </div>
          )}
          {selected.g?.clubs?.length > 0 && (
            <div>
              <p className="text-emerald-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">🏆 Clubs</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.g.clubs.map((c, i) => <Chip key={i} label={c} color="bg-emerald-900/40 text-emerald-300 border-emerald-500/20" />)}
              </div>
            </div>
          )}
          {selected.g?.extracurriculars?.length > 0 && (
            <div>
              <p className="text-amber-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">⚡ Extracurriculars</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.g.extracurriculars.map((c, i) => <Chip key={i} label={c} color="bg-amber-900/40 text-amber-300 border-amber-500/20" />)}
              </div>
            </div>
          )}
          {selected.g?.volunteer_opportunities?.length > 0 && (
            <div>
              <p className="text-pink-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">🤝 Volunteer</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.g.volunteer_opportunities.map((c, i) => <Chip key={i} label={c} color="bg-pink-900/40 text-pink-300 border-pink-500/20" />)}
              </div>
            </div>
          )}
          {selected.g?.online_courses?.length > 0 && (
            <div>
              <p className="text-violet-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">💻 Online Courses</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.g.online_courses.map((c, i) => <Chip key={i} label={c} color="bg-violet-900/40 text-violet-300 border-violet-500/20" />)}
              </div>
            </div>
          )}
          {selected.g?.summer_activities?.length > 0 && (
            <div>
              <p className="text-orange-300 text-[10px] uppercase tracking-wider font-semibold mb-1.5">☀️ Summer</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.g.summer_activities.map((c, i) => <Chip key={i} label={c} color="bg-orange-900/40 text-orange-300 border-orange-500/20" />)}
              </div>
            </div>
          )}
          {!selected.g?.special_programs?.length && !selected.g?.clubs?.length && !selected.g?.extracurriculars?.length && !selected.g?.volunteer_opportunities?.length && !selected.g?.online_courses?.length && !selected.g?.summer_activities?.length && (
            <p className="text-white/30 text-xs">No special programs listed for this grade.</p>
          )}
        </div>
      ) : (
        <p className="text-white/30 text-xs">Tap a grade node to see programs & opportunities.</p>
      )}
    </div>
  );
}

export default function RoadmapDemo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [currentGrade, setCurrentGrade] = useState(9);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await apiClient.auth.me();
    const [plans, recs, profiles] = await Promise.all([
      apiClient.entities.CareerPlan.filter({ user_email: user.email }),
      apiClient.entities.Recommendation.filter({ user_email: user.email }, "-updated_date", 100),
      apiClient.entities.TeenProfile.filter({ user_email: user.email }),
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

      {/* You are here */}
      <div className="flex flex-col items-center justify-center pt-4 pb-2 px-4 gap-2">
        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5">
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 text-xs font-semibold">You are here · Grade {currentGrade}</span>
        </div>
        <p className="text-white/40 text-[10px]">Tap any grade node to see activities & suggestions</p>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-2 px-4">
        {[["bg-green-500","Completed"],["bg-blue-400","In Progress"],["bg-slate-700","Locked"]].map(([dot,label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", dot)} />
            <span className="text-white/40 text-[10px] hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="px-4 pb-32 pt-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks.slice(0, 3).map((track, i) => {
            const grades = (track.grades || []).sort((a, b) => a.grade - b.grade).slice(0, 6);
            const theme = TRACK_THEMES[i % TRACK_THEMES.length];

            return (
              <motion.div
                key={track.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={cn("rounded-2xl border p-4 flex flex-col h-full", theme.dim, theme.border)}
              >
                {/* Track header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0", theme.bg + "/20 border " + theme.border)}>
                    {theme.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-heading font-bold text-xs leading-tight", theme.label)}>{track.name}</p>
                    {track.description && <p className="text-white/30 text-[8px] mt-0.5 line-clamp-1">{track.description}</p>}
                  </div>
                </div>

                {/* Vertical timeline */}
                <div className="flex-1 space-y-2">
                  {grades.map((g, idx) => {
                    const gradeRecs = getRecsForGrade(recommendations, g.grade);
                    const completed = gradeRecs.filter(r => r.status === "Completed").length;
                    const inProgress = gradeRecs.some(r => r.status === "In Progress" || r.status === "Exploring");
                    const allDone = gradeRecs.length > 0 && completed === gradeRecs.length;
                    const isUnlocked = g.grade <= currentGrade + 1;
                    const isCurrent = g.grade === currentGrade;
                    const nodeKey = `${track.name}-${g.grade}`;
                    const isSelected = selectedKey === nodeKey;

                    return (
                      <div key={g.grade} className="flex gap-3 relative">
                        {/* Vertical line */}
                        {idx < grades.length - 1 && (
                          <div
                            className="absolute left-3.5 top-10 w-0.5 h-8"
                            style={{ backgroundColor: theme.line, opacity: 0.3 }}
                          />
                        )}

                        {/* Grade node */}
                        <motion.button
                          whileHover={isUnlocked ? { scale: 1.05 } : {}}
                          whileTap={isUnlocked ? { scale: 0.95 } : {}}
                          onClick={() => isUnlocked && setSelected({ g, theme, gradeRecs, allDone, inProgress, trackName: track.name })}
                          className={cn(
                            "relative flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-all duration-200 shrink-0 w-20 h-20",
                            isSelected
                              ? "bg-white/15 border-white/40 shadow-lg"
                              : isUnlocked
                                ? cn("border-opacity-60", theme.border, "hover:bg-white/10 cursor-pointer")
                                : "bg-slate-900/30 border-white/5 opacity-40 cursor-not-allowed"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                            allDone ? "bg-green-500 text-white" :
                            isUnlocked ? cn(theme.bg, "text-white") :
                            "bg-slate-700 text-slate-500"
                          )}>
                            {!isUnlocked ? <Lock className="w-3 h-3" /> : allDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : g.grade}
                          </div>

                          <p className="text-white text-[7px] font-semibold leading-tight text-center line-clamp-2 w-full">
                            {g.key_milestone ? g.key_milestone.split(" ").slice(0, 2).join(" ") : `Gr. ${g.grade}`}
                          </p>

                          {isUnlocked && gradeRecs.length > 0 && (
                            <p className={cn("text-[6px] font-medium", allDone ? "text-green-400" : inProgress ? "text-blue-300" : "text-white/25")}>
                              {completed}/{gradeRecs.length}
                            </p>
                          )}

                          {isCurrent && (
                            <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 bg-amber-400 text-slate-900 text-[5px] font-bold px-1 py-0.5 rounded-full whitespace-nowrap">
                              YOU
                            </div>
                          )}

                          {inProgress && !allDone && isUnlocked && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                          )}
                        </motion.button>

                        {/* Details section */}
                        <div className="flex-1 pt-1 min-w-0">
                          <p className="text-white/50 text-[7px] leading-tight line-clamp-1">{g.key_milestone}</p>
                          {g.focus && <p className="text-white/30 text-[6px] leading-tight line-clamp-1 mt-0.5">{g.focus}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Goal marker */}
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 text-[7px]">
                    <Star className="w-3 h-3 text-white/40" />
                    <p className="text-white/40 line-clamp-1">{track.college_goals || "College Goal"}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
                {selected.gradeRecs?.length > 0 && (
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-2">✨ Explore Suggestions ({selected.gradeRecs.length})</p>
                    <div className="space-y-2">
                      {selected.gradeRecs.map((rec) => {
                        const Icon = TYPE_ICONS[rec.type] || TYPE_ICONS.default;
                        const sc = { "Completed": "bg-green-900/50 text-green-300 border-green-500/30", "In Progress": "bg-blue-900/50 text-blue-300 border-blue-500/30", "Exploring": "bg-violet-900/50 text-violet-300 border-violet-500/30" }[rec.status] || "bg-slate-800/50 text-slate-400 border-slate-600/30";
                        return (
                          <button key={rec.id} onClick={() => { setSelected(null); navigate(`/recommendations/${rec.id}`, { state: { title: rec.title } }); }}
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