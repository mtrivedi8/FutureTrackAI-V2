import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, BookOpen, Lightbulb, Target, Rocket, Zap, Star, Palette, Code2, Microscope, Users, Globe, Trophy } from "lucide-react";

const tracks = [
  {
    id: "tech",
    name: "Tech & AI",
    emoji: "🤖",
    color: "from-blue-500 to-cyan-400",
    ringColor: "ring-blue-400",
    bgLight: "bg-blue-950/40",
    borderColor: "border-blue-400/40",
    textColor: "text-blue-300",
    nodes: [
      { id: "t1", title: "Intro to Python", type: "Course", status: "Completed", icon: Code2 },
      { id: "t2", title: "Machine Learning Basics", type: "Skill", status: "In Progress", icon: Lightbulb },
      { id: "t3", title: "AI Ethics Course", type: "Course", status: "Exploring", icon: Globe },
      { id: "t4", title: "Build a Chatbot", type: "Project", status: "New", icon: Target },
      { id: "t5", title: "Software Engineer", type: "Career Path", status: "New", icon: Star },
    ]
  },
  {
    id: "bio",
    name: "BioMed",
    emoji: "🧬",
    color: "from-emerald-500 to-teal-400",
    ringColor: "ring-emerald-400",
    bgLight: "bg-emerald-950/40",
    borderColor: "border-emerald-400/40",
    textColor: "text-emerald-300",
    nodes: [
      { id: "b1", title: "AP Biology", type: "Course", status: "Completed", icon: Microscope },
      { id: "b2", title: "Lab Research Club", type: "Activity", status: "In Progress", icon: Users },
      { id: "b3", title: "Science Fair Project", type: "Project", status: "Exploring", icon: Trophy },
      { id: "b4", title: "Medical Volunteering", type: "Activity", status: "New", icon: Zap },
      { id: "b5", title: "Physician / Researcher", type: "Career Path", status: "New", icon: Star },
    ]
  },
  {
    id: "creative",
    name: "Creative",
    emoji: "🎨",
    color: "from-pink-500 to-violet-400",
    ringColor: "ring-pink-400",
    bgLight: "bg-pink-950/40",
    borderColor: "border-pink-400/40",
    textColor: "text-pink-300",
    nodes: [
      { id: "c1", title: "Digital Art Basics", type: "Skill", status: "Completed", icon: Palette },
      { id: "c2", title: "UX Design Course", type: "Course", status: "Completed", icon: BookOpen },
      { id: "c3", title: "Portfolio Project", type: "Project", status: "In Progress", icon: Target },
      { id: "c4", title: "Internship at Studio", type: "Activity", status: "New", icon: Rocket },
      { id: "c5", title: "Art Director / Designer", type: "Career Path", status: "New", icon: Star },
    ]
  }
];

const statusStyles = {
  "Completed": { dot: "bg-green-400", badge: "bg-green-900/60 text-green-300 border-green-500/30", glow: "shadow-green-500/50" },
  "In Progress": { dot: "bg-blue-400 animate-pulse", badge: "bg-blue-900/60 text-blue-300 border-blue-500/30", glow: "shadow-blue-500/50" },
  "Exploring": { dot: "bg-violet-400", badge: "bg-violet-900/60 text-violet-300 border-violet-500/30", glow: "shadow-violet-500/30" },
  "New": { dot: "bg-slate-500", badge: "bg-slate-800/60 text-slate-400 border-slate-600/30", glow: "" },
};

function TrackNode({ node, track, index, onClick, isSelected }) {
  const ss = statusStyles[node.status];
  const Icon = node.icon;
  const isLast = node.type === "Career Path";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      className="flex flex-col items-center"
    >
      {/* Connector line above (except first) */}
      <div className={cn("w-0.5 h-6 rounded-full", index === 0 ? "opacity-0" : "opacity-60 bg-white/20")} />

      {/* Node */}
      <motion.button
        onClick={() => onClick({ ...node, track })}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative w-12 h-12 rounded-full flex items-center justify-center ring-2 shadow-lg transition-all",
          `bg-gradient-to-br ${track.color}`,
          track.ringColor,
          ss.glow && `shadow-lg ${ss.glow}`,
          isSelected && "ring-4 ring-white/60 scale-110",
          isLast && "w-14 h-14 ring-4"
        )}
      >
        <Icon className="w-5 h-5 text-white" />
        {node.status === "Completed" && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}
      </motion.button>

      {/* Label */}
      <div className="mt-2 text-center px-1">
        <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2 max-w-[72px]">{node.title}</p>
        <div className={cn("mt-1 text-[9px] px-1.5 py-0.5 rounded-full border inline-block font-medium", ss.badge)}>
          {node.status}
        </div>
      </div>
    </motion.div>
  );
}

function TrackColumn({ track, selectedNode, onNodeClick, isActiveTrack }) {
  const completedCount = track.nodes.filter(n => n.status === "Completed").length;
  const progress = completedCount / track.nodes.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn(
        "flex flex-col items-center rounded-3xl border p-4 pt-5 transition-all duration-300",
        track.bgLight,
        track.borderColor,
        isActiveTrack && "ring-2 ring-white/30 shadow-xl"
      )}
    >
      {/* Track header */}
      <div className="text-center mb-4">
        <div className="text-2xl mb-1">{track.emoji}</div>
        <p className={cn("font-heading font-bold text-sm", track.textColor)}>{track.name}</p>
        {/* Progress bar */}
        <div className="mt-2 w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", track.color)}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
        <p className="text-white/30 text-[9px] mt-1">{completedCount}/{track.nodes.length} done</p>
      </div>

      {/* Nodes */}
      <div className="flex flex-col items-center w-full">
        {track.nodes.map((node, i) => (
          <TrackNode
            key={node.id}
            node={node}
            track={track}
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
  const [allTracks, setAllTracks] = useState(tracks);
  const [selectedNode, setSelectedNode] = useState(null);

  const advanceStatus = (nodeId, trackId) => {
    const order = ["New", "Exploring", "In Progress", "Completed"];
    setAllTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, nodes: t.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const next = order[Math.min(order.indexOf(n.status) + 1, order.length - 1)];
        return { ...n, status: next };
      })};
    }));
    setSelectedNode(prev => {
      if (!prev || prev.id !== nodeId) return prev;
      const order = ["New", "Exploring", "In Progress", "Completed"];
      const next = order[Math.min(order.indexOf(prev.status) + 1, order.length - 1)];
      return { ...prev, status: next };
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 p-4 pb-32">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 pt-4">
          <p className="text-violet-300/60 text-xs font-semibold uppercase tracking-widest mb-2">Choose Your Path</p>
          <h1 className="font-heading text-3xl font-bold text-white">Career Roadmap</h1>
          <p className="text-white/40 text-sm mt-2">Three paths, one future — tap any node to track progress</p>
        </motion.div>

        {/* Fork origin */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex flex-col items-center mb-2">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-4 ring-amber-400/40 shadow-lg shadow-amber-500/30">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <p className="text-white/60 text-xs font-semibold mt-1">Your Journey Starts Here</p>

          {/* Fork lines */}
          <div className="relative w-full mt-3 h-8 flex items-end justify-center">
            <svg viewBox="0 0 300 32" className="w-full max-w-sm" fill="none">
              <path d="M150 0 L50 32" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 3"/>
              <path d="M150 0 L150 32" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 3"/>
              <path d="M150 0 L250 32" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 3"/>
            </svg>
          </div>
        </motion.div>

        {/* Three track columns */}
        <div className="grid grid-cols-3 gap-3">
          {allTracks.map((track) => (
            <TrackColumn
              key={track.id}
              track={track}
              selectedNode={selectedNode}
              onNodeClick={setSelectedNode}
              isActiveTrack={selectedNode?.track?.id === track.id}
            />
          ))}
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="text-center text-white/20 text-xs mt-8">
          ✨ Preview — real data would come from your actual recommendations
        </motion.p>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedNode(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 shadow-2xl z-50"
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{selectedNode.track?.emoji}</span>
                    <p className="text-xs text-muted-foreground font-medium">{selectedNode.track?.name} · {selectedNode.type}</p>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">{selectedNode.title}</h3>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>

              <div className={cn("inline-block text-xs px-2.5 py-1 rounded-full border font-medium mb-4", statusStyles[selectedNode.status]?.badge)}>
                {selectedNode.status}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => advanceStatus(selectedNode.id, selectedNode.track?.id)}
                  disabled={selectedNode.status === "Completed"}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
                >
                  {selectedNode.status === "New" ? "🚀 Start Exploring" :
                   selectedNode.status === "Exploring" ? "⚡ Mark In Progress" :
                   selectedNode.status === "In Progress" ? "✅ Mark Completed" : "🎉 Completed!"}
                </button>
                <button onClick={() => setSelectedNode(null)} className="px-5 py-3 rounded-xl border border-border text-sm text-muted-foreground">
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