import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, BookOpen, Lightbulb, Target, Rocket, Zap, Star, Palette, Code2, Microscope, Users, Globe, Trophy, Loader2, GraduationCap, Map } from "lucide-react";

const TRACK_THEMES = [
  { color: "from-blue-500 to-cyan-400", ringColor: "ring-blue-400", bgLight: "bg-blue-950/40", borderColor: "border-blue-400/40", textColor: "text-blue-300", emoji: "🚀" },
  { color: "from-emerald-500 to-teal-400", ringColor: "ring-emerald-400", bgLight: "bg-emerald-950/40", borderColor: "border-emerald-400/40", textColor: "text-emerald-300", emoji: "🧬" },
  { color: "from-pink-500 to-violet-400", ringColor: "ring-pink-400", bgLight: "bg-pink-950/40", borderColor: "border-pink-400/40", textColor: "text-pink-300", emoji: "🎨" },
];

const TYPE_ICONS = { "Course": BookOpen, "Skill": Lightbulb, "Activity": Users, "Project": Target, "Career Path": Star, "clubs": Users, "extracurriculars": Trophy, "online_courses": Globe, "volunteer": Zap };

const statusStyles = {
  "Completed":   { dot: "bg-green-400",  badge: "bg-green-900/60 text-green-300 border-green-500/30",   glow: "shadow-green-500/50" },
  "In Progress": { dot: "bg-blue-400 animate-pulse", badge: "bg-blue-900/60 text-blue-300 border-blue-500/30", glow: "shadow-blue-500/50" },
  "Exploring":   { dot: "bg-violet-400", badge: "bg-violet-900/60 text-violet-300 border-violet-500/30", glow: "shadow-violet-500/30" },
  "New":         { dot: "bg-slate-500",  badge: "bg-slate-800/60 text-slate-400 border-slate-600/30",   glow: "" },
};

// Build nodes from a career track grade data
function buildNodesFromTrack(track, recommendations) {
  const nodes = [];
  const grades = track.grades || [];

  // Pull key milestones from each grade (max 5 nodes total)
  const step = Math.max(1, Math.floor(grades.length / 4));
  const selectedGrades = grades.filter((_, i) => i % step === 0).slice(0, 4);

  selectedGrades.forEach((g, i) => {
    // Find a matching recommendation for this focus if possible
    const matchingRec = recommendations.find(r =>
      r.title?.toLowerCase().includes((g.focus || "").toLowerCase().split(" ")[0]) ||
      r.type === (i === 0 ? "Skill" : i === 1 ? "Course" : i === 2 ? "Activity" : "Project")
    );

    nodes.push({
      id: `${track.name}-grade-${g.grade}`,
      title: g.key_milestone || `Grade ${g.grade} Milestone`,
      subtitle: g.focus || "",
      type: i === 0 ? "Skill" : i === 1 ? "Course" : i === 2 ? "Activity" : "Project",
      grade: g.grade,
      status: matchingRec?.status === "Completed" ? "Completed"
            : matchingRec?.status === "In Progress" ? "In Progress"
            : matchingRec?.status === "Exploring" ? "Exploring"
            : "New",
      icon: i === 0 ? Lightbulb : i === 1 ? BookOpen : i === 2 ? Users : Target,
    });
  });

  // Final node = career goal
  nodes.push({
    id: `${track.name}-goal`,
    title: track.college_goals || track.name,
    subtitle: track.description || "",
    type: "Career Goal",
    status: "New",
    icon: Star,
    isFinal: true,
  });

  return nodes;
}

function TrackNode({ node, track, index, onClick, isSelected }) {
  const ss = statusStyles[node.status] || statusStyles["New"];
  const Icon = node.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      className="flex flex-col items-center"
    >
      <div className={cn("w-0.5 rounded-full", index === 0 ? "h-0" : "h-6 opacity-30 bg-white/30")} />

      <motion.button
        onClick={() => onClick({ ...node, track })}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative flex items-center justify-center rounded-full ring-2 shadow-lg transition-all duration-200",
          node.isFinal ? "w-14 h-14 ring-4" : "w-11 h-11",
          `bg-gradient-to-br ${track.color}`,
          track.ringColor,
          ss.glow && `shadow-lg ${ss.glow}`,
          isSelected && "ring-4 ring-white/70 scale-110",
        )}
      >
        <Icon className={cn("text-white", node.isFinal ? "w-7 h-7" : "w-5 h-5")} />
        {node.status === "Completed" && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border border-white/30">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
        {node.status === "In Progress" && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
        )}
      </motion.button>

      <div className="mt-1.5 text-center px-1">
        <p className="text-white text-[10px] font-semibold leading-tight max-w-[72px] line-clamp-2">{node.title}</p>
        <div className={cn("mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full border inline-block font-medium", ss.badge)}>
          {node.status}
        </div>
      </div>
    </motion.div>
  );
}

function TrackColumn({ track, theme, nodes, selectedNode, onNodeClick }) {
  const completedCount = nodes.filter(n => n.status === "Completed").length;
  const progress = completedCount / nodes.length;
  const isActive = selectedNode?.track?.name === track.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn(
        "flex flex-col items-center rounded-3xl border p-3 pt-4 transition-all duration-300",
        theme.bgLight, theme.borderColor,
        isActive && "ring-2 ring-white/20 shadow-2xl"
      )}
    >
      <div className="text-center mb-3">
        <div className="text-xl mb-0.5">{theme.emoji}</div>
        <p className={cn("font-heading font-bold text-xs leading-tight", theme.textColor)}>{track.name}</p>
        <div className="mt-1.5 w-14 h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", theme.color)}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 1, delay: 0.6 }}
          />
        </div>
        <p className="text-white/30 text-[9px] mt-0.5">{completedCount}/{nodes.length}</p>
      </div>

      <div className="flex flex-col items-center w-full">
        {nodes.map((node, i) => (
          <TrackNode
            key={node.id}
            node={node}
            track={{ ...track, ...theme }}
            index={i}
            onClick={onNodeClick}
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
  const [trackNodes, setTrackNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [plans, recs] = await Promise.all([
      base44.entities.CareerPlan.filter({ user_email: user.email }),
      base44.entities.Recommendation.filter({ user_email: user.email }, "-updated_date", 100),
    ]);
    setRecommendations(recs);
    const plan = plans[0];
    if (plan?.career_tracks?.length > 0) {
      const validTracks = plan.career_tracks.filter(t => t?.name);
      setTracks(validTracks);
      setTrackNodes(validTracks.map(t => buildNodesFromTrack(t, recs)));
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
        <p className="text-white/50 text-sm max-w-xs">Generate your Academic Plan first to see your forking career roadmap here.</p>
        <button onClick={() => navigate("/plan")} className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
          Go to Academic Plan →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 p-4 pb-32">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6 pt-4">
          <p className="text-violet-300/60 text-xs font-semibold uppercase tracking-widest mb-1">Your Career Roadmap</p>
          <h1 className="font-heading text-2xl font-bold text-white">Choose Your Path</h1>
          <p className="text-white/40 text-xs mt-1">Tap any node to see details & track progress</p>

          {/* Legend */}
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            {["Completed", "In Progress", "Exploring", "New"].map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn("w-2 h-2 rounded-full", statusStyles[s].dot.replace("animate-pulse", ""))} />
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
          <p className="text-white/50 text-[10px] font-semibold mt-1 uppercase tracking-wide">Start Here</p>
          <div className="relative w-full mt-2 h-6">
            <svg viewBox="0 0 300 24" className="w-full max-w-sm mx-auto block" fill="none">
              <path d="M150 0 L50 24" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3"/>
              <path d="M150 0 L150 24" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3"/>
              <path d="M150 0 L250 24" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
          </div>
        </motion.div>

        {/* Track columns */}
        <div className="grid grid-cols-3 gap-2">
          {tracks.map((track, i) => (
            <TrackColumn
              key={track.name}
              track={track}
              theme={TRACK_THEMES[i % TRACK_THEMES.length]}
              nodes={trackNodes[i] || []}
              selectedNode={selectedNode}
              onNodeClick={setSelectedNode}
            />
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="flex justify-center mt-6">
          <button onClick={() => navigate("/plan")} className="text-white/30 text-xs hover:text-white/60 transition-colors flex items-center gap-1">
            <GraduationCap className="w-3 h-3" /> View full Academic Plan
          </button>
        </motion.div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedNode(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 shadow-2xl z-50"
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">{selectedNode.track?.name} · {selectedNode.type} {selectedNode.grade ? `· Grade ${selectedNode.grade}` : ""}</p>
                  <h3 className="font-heading text-lg font-bold text-foreground leading-tight">{selectedNode.title}</h3>
                  {selectedNode.subtitle && <p className="text-sm text-muted-foreground mt-1">{selectedNode.subtitle}</p>}
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none ml-2">×</button>
              </div>

              <div className={cn("inline-block text-xs px-2.5 py-1 rounded-full border font-medium mb-4", statusStyles[selectedNode.status]?.badge)}>
                {selectedNode.status}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate("/plan")}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                >
                  View in Academic Plan →
                </button>
                <button onClick={() => setSelectedNode(null)} className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}