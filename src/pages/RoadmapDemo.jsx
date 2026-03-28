import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Star, Lock, CheckCircle2, Zap, X, ExternalLink, BookOpen, Lightbulb, Users, Target } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

const TYPE_ICONS = { "Course": BookOpen, "Skill": Lightbulb, "Activity": Users, "Project": Target, "Career Path": Star, "default": Zap };

const GRADE_COLORS = {
  7:  { node: "from-slate-500 to-slate-400",   ring: "ring-slate-400/60",  label: "bg-slate-700/80"  },
  8:  { node: "from-blue-600 to-blue-400",     ring: "ring-blue-400/60",   label: "bg-blue-900/80"   },
  9:  { node: "from-indigo-600 to-indigo-400", ring: "ring-indigo-400/60", label: "bg-indigo-900/80" },
  10: { node: "from-violet-600 to-violet-400", ring: "ring-violet-400/60", label: "bg-violet-900/80" },
  11: { node: "from-pink-600 to-pink-400",     ring: "ring-pink-400/60",   label: "bg-pink-900/80"   },
  12: { node: "from-amber-500 to-orange-400",  ring: "ring-amber-400/60",  label: "bg-amber-900/80"  },
  goal: { node: "from-yellow-400 to-amber-300", ring: "ring-yellow-300/80", label: "bg-yellow-900/80" },
};

// Build a layered node graph from career tracks + recs
function buildGraph(tracks, recommendations, currentGrade) {
  const nodes = [];
  const edges = [];

  // Origin node
  nodes.push({ id: "origin", label: "You", sublabel: `Grade ${currentGrade}`, grade: currentGrade, x: 0.5, y: 0.0, type: "origin", status: "Completed", recs: [] });

  const trackCount = Math.min(tracks.length, 3);
  const xPositions = trackCount === 1 ? [0.5] : trackCount === 2 ? [0.25, 0.75] : [0.15, 0.5, 0.85];

  tracks.slice(0, 3).forEach((track, ti) => {
    const tx = xPositions[ti];
    const grades = (track.grades || []).sort((a, b) => a.grade - b.grade);
    const visibleGrades = grades.slice(0, 4); // max 4 grade stops per track
    const totalRows = visibleGrades.length + 1; // +1 for goal

    let prevId = "origin";

    visibleGrades.forEach((g, gi) => {
      const nodeId = `track-${ti}-grade-${g.grade}`;
      const yFrac = (gi + 1) / (totalRows + 1);

      // Find matching recs for this grade
      const difficulty = g.grade <= 8 ? "Beginner" : g.grade <= 10 ? "Intermediate" : "Advanced";
      const gradeRecs = recommendations
        .filter(r => r.status !== "Skipped")
        .filter(r => r.difficulty_level === difficulty)
        .slice(0, 4);

      const isUnlocked = g.grade <= currentGrade + 1;
      const isDone = gradeRecs.length > 0 && gradeRecs.every(r => r.status === "Completed");
      const inProgress = gradeRecs.some(r => r.status === "In Progress" || r.status === "Exploring");

      nodes.push({
        id: nodeId,
        label: g.key_milestone ? g.key_milestone.split(" ").slice(0, 4).join(" ") : `Grade ${g.grade}`,
        sublabel: g.focus || track.name,
        grade: g.grade,
        x: tx,
        y: yFrac,
        trackIndex: ti,
        status: isDone ? "Completed" : inProgress ? "In Progress" : isUnlocked ? "Available" : "Locked",
        recs: gradeRecs,
        track,
        gradeData: g,
      });

      edges.push({ from: prevId, to: nodeId, unlocked: isUnlocked });
      prevId = nodeId;
    });

    // Goal node
    const goalId = `track-${ti}-goal`;
    nodes.push({
      id: goalId,
      label: track.college_goals ? track.college_goals.split(" ").slice(0, 5).join(" ") : track.name,
      sublabel: "Career Goal 🎯",
      grade: "goal",
      x: tx,
      y: (totalRows) / (totalRows + 1),
      trackIndex: ti,
      status: "Locked",
      recs: [],
      track,
      isGoal: true,
    });
    edges.push({ from: prevId, to: goalId, unlocked: false });
  });

  return { nodes, edges };
}

// ─── Small reusable helpers ─────────────────────────────────────────────────

function Section({ title, color, children }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${color}`}>{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${color}`}>{label}</span>
  );
}

// ─── SVG edges ───────────────────────────────────────────────────────────────

function Edges({ edges, nodes, width, height }) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {edges.map((e, i) => {
        const from = nodeMap[e.from];
        const to = nodeMap[e.to];
        if (!from || !to) return null;
        const x1 = from.x * width;
        const y1 = from.y * height + 24;
        const x2 = to.x * width;
        const y2 = to.y * height - 24;
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={e.unlocked ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.1)"}
            strokeWidth={e.unlocked ? 2 : 1.5}
            strokeDasharray={e.unlocked ? "none" : "5 4"}
            filter={e.unlocked ? "url(#glow)" : undefined}
          />
        );
      })}
    </svg>
  );
}

// ─── Single node ─────────────────────────────────────────────────────────────

function RoadmapNode({ node, onClick, isSelected, containerWidth, containerHeight }) {
  const colors = GRADE_COLORS[node.grade] || GRADE_COLORS[9];
  const isLocked = node.status === "Locked";
  const isDone = node.status === "Completed";
  const isOrigin = node.id === "origin";
  const size = isOrigin || node.isGoal ? 52 : 44;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: node.x * containerWidth - size / 2,
        top: node.y * containerHeight - size / 2,
        zIndex: 2,
        width: size,
        height: size,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + (node.y || 0) * 0.5, type: "spring", stiffness: 200, damping: 15 }}
    >
      <motion.button
        whileHover={!isLocked ? { scale: 1.15 } : {}}
        whileTap={!isLocked ? { scale: 0.92 } : {}}
        onClick={() => !isLocked && onClick(node)}
        className={cn(
          "w-full h-full rounded-full flex items-center justify-center ring-2 shadow-lg transition-all relative",
          isLocked ? "bg-slate-800 ring-slate-700/40 opacity-50 cursor-not-allowed" : `bg-gradient-to-br ${colors.node} ${colors.ring}`,
          isSelected && "ring-4 ring-white/70 scale-110 shadow-2xl",
          isDone && "shadow-green-500/40",
          node.status === "In Progress" && "shadow-violet-500/50",
        )}
      >
        {isLocked ? (
          <Lock className="w-4 h-4 text-slate-500" />
        ) : isOrigin ? (
          <span className="text-xl">🎓</span>
        ) : node.isGoal ? (
          <Star className="w-6 h-6 text-white fill-white" />
        ) : (
          <span className="text-lg">{["🚀","🧬","🎨"][node.trackIndex ?? 0]}</span>
        )}

        {isDone && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-slate-950">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
        {node.status === "In Progress" && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-400 rounded-full animate-ping" />
        )}
      </motion.button>

      {/* Label below node */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-center pointer-events-none" style={{ width: 80 }}>
        <p className="text-white text-[9px] font-semibold leading-tight line-clamp-2">{node.label}</p>
        {!isOrigin && (
          <p className="text-white/30 text-[8px] leading-tight mt-0.5 line-clamp-1">{node.sublabel}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoadmapDemo() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 340, height: 700 });
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentGrade, setCurrentGrade] = useState(9);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setDims({ width: w, height: Math.max(700, w * 2.2) });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [loading]);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [plans, recs, profiles] = await Promise.all([
      base44.entities.CareerPlan.filter({ user_email: user.email }),
      base44.entities.Recommendation.filter({ user_email: user.email }, "-updated_date", 100),
      base44.entities.TeenProfile.filter({ user_email: user.email }),
    ]);
    const grade = profiles[0]?.current_grade || 9;
    setCurrentGrade(grade);
    const plan = plans[0];
    if (plan?.career_tracks?.length > 0) {
      const tracks = plan.career_tracks.filter(t => t?.name);
      setGraph(buildGraph(tracks, recs, grade));
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

  if (graph.nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 flex flex-col items-center justify-center p-6 text-center gap-4">
        <Star className="w-12 h-12 text-violet-400" />
        <h2 className="font-heading text-2xl font-bold text-white">No Roadmap Yet</h2>
        <p className="text-white/50 text-sm max-w-xs">Generate your Academic Plan first to unlock your full roadmap.</p>
        <button onClick={() => navigate("/plan")} className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          Go to Academic Plan →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 overflow-x-hidden">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-bold text-white">Full Roadmap</h1>
          <p className="text-white/40 text-[10px]">Tap nodes to see what to do next</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {[["✅","Done"],["🔵","Active"],["🔒","Locked"]].map(([e,l]) => (
            <span key={l} className="text-white/30">{e} {l}</span>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="px-4 py-6 pb-40">
        <div
          ref={containerRef}
          className="relative mx-auto"
          style={{ width: "100%", maxWidth: 480, height: dims.height }}
        >
          {/* Background decorative circles */}
          {[0.2, 0.45, 0.7, 0.9].map((y, i) => (
            <div key={i} className="absolute left-1/2 -translate-x-1/2 rounded-full border border-white/5"
              style={{ width: dims.width * 0.9, height: dims.width * 0.9, top: y * dims.height - dims.width * 0.45, opacity: 0.3 }} />
          ))}

          <Edges edges={graph.edges} nodes={graph.nodes} width={dims.width} height={dims.height} />

          {graph.nodes.map(node => (
            <RoadmapNode
              key={node.id}
              node={node}
              onClick={setSelectedNode}
              isSelected={selectedNode?.id === node.id}
              containerWidth={dims.width}
              containerHeight={dims.height}
            />
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedNode(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 z-50 max-h-[70vh] overflow-y-auto"
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white/40 text-[10px] mb-0.5">{selectedNode.track?.name || "Your Journey"} {selectedNode.grade && selectedNode.grade !== "goal" ? `· Grade ${selectedNode.grade}` : ""}</p>
                  <h3 className="font-heading text-base font-bold text-white">{selectedNode.label}</h3>
                  <p className="text-white/40 text-xs mt-0.5">{selectedNode.sublabel}</p>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-white/30 hover:text-white text-2xl leading-none ml-3 shrink-0">×</button>
              </div>

              {selectedNode.isGoal ? (
                <div className="text-center py-6">
                  <p className="text-3xl mb-2">🎯</p>
                  <p className="text-white font-semibold text-sm mb-1">{selectedNode.track?.name}</p>
                  <p className="text-white/40 text-xs">{selectedNode.track?.college_goals || "Your ultimate career destination"}</p>
                  <p className="text-white/30 text-xs mt-3">{selectedNode.track?.description}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* School Courses */}
                  {selectedNode.gradeData?.school_courses?.length > 0 && (
                    <Section title="📚 School Courses" color="text-blue-300">
                      {selectedNode.gradeData.school_courses.map((c, i) => (
                        <Chip key={i} label={typeof c === "string" ? c : `${c.name}${c.level && c.level !== "Standard" ? " · " + c.level : ""}`} color="bg-blue-900/40 text-blue-300 border-blue-500/20" />
                      ))}
                    </Section>
                  )}

                  {/* Clubs */}
                  {selectedNode.gradeData?.clubs?.length > 0 && (
                    <Section title="🏆 Clubs" color="text-emerald-300">
                      {selectedNode.gradeData.clubs.map((c, i) => <Chip key={i} label={c} color="bg-emerald-900/40 text-emerald-300 border-emerald-500/20" />)}
                    </Section>
                  )}

                  {/* Extracurriculars */}
                  {selectedNode.gradeData?.extracurriculars?.length > 0 && (
                    <Section title="⚡ Extracurriculars" color="text-amber-300">
                      {selectedNode.gradeData.extracurriculars.map((c, i) => <Chip key={i} label={c} color="bg-amber-900/40 text-amber-300 border-amber-500/20" />)}
                    </Section>
                  )}

                  {/* Volunteer */}
                  {selectedNode.gradeData?.volunteer_opportunities?.length > 0 && (
                    <Section title="🤝 Volunteer" color="text-pink-300">
                      {selectedNode.gradeData.volunteer_opportunities.map((c, i) => <Chip key={i} label={c} color="bg-pink-900/40 text-pink-300 border-pink-500/20" />)}
                    </Section>
                  )}

                  {/* Online Courses */}
                  {selectedNode.gradeData?.online_courses?.length > 0 && (
                    <Section title="💻 Online Courses" color="text-violet-300">
                      {selectedNode.gradeData.online_courses.map((c, i) => <Chip key={i} label={c} color="bg-violet-900/40 text-violet-300 border-violet-500/20" />)}
                    </Section>
                  )}

                  {/* Summer */}
                  {selectedNode.gradeData?.summer_activities?.length > 0 && (
                    <Section title="☀️ Summer Activities" color="text-orange-300">
                      {selectedNode.gradeData.summer_activities.map((c, i) => <Chip key={i} label={c} color="bg-orange-900/40 text-orange-300 border-orange-500/20" />)}
                    </Section>
                  )}

                  {/* Suggestions from Explore */}
                  {selectedNode.recs?.length > 0 && (
                    <div>
                      <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-2">Explore Suggestions ({selectedNode.recs.length})</p>
                      <div className="space-y-2">
                        {selectedNode.recs.map((rec, i) => {
                          const Icon = TYPE_ICONS[rec.type] || TYPE_ICONS.default;
                          const statusClass = {
                            "Completed": "bg-green-900/50 text-green-300 border-green-500/30",
                            "In Progress": "bg-blue-900/50 text-blue-300 border-blue-500/30",
                            "Exploring": "bg-violet-900/50 text-violet-300 border-violet-500/30",
                            "New": "bg-slate-800/50 text-slate-400 border-slate-600/30",
                          }[rec.status] || "bg-slate-800/50 text-slate-400 border-slate-600/30";
                          return (
                            <motion.button
                              key={rec.id}
                              initial={{ opacity: 0, y: 6 }}
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
                                <div className={cn("mt-1 text-[9px] px-2 py-0.5 rounded-full border inline-block font-medium", statusClass)}>
                                  {rec.status || "New"}
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-white/20 shrink-0 mt-1" />
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!selectedNode.recs?.length && !selectedNode.gradeData?.clubs?.length && !selectedNode.gradeData?.school_courses?.length && (
                    <div className="text-center py-4">
                      <p className="text-white/30 text-xs">No data yet.</p>
                      <button onClick={() => { setSelectedNode(null); navigate("/recommendations"); }}
                        className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline">
                        Generate suggestions in Explore →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}