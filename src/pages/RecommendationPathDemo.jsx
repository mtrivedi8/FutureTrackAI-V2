import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, Zap, Star, BookOpen, Lightbulb, Target, Rocket } from "lucide-react";

const mockNodes = [
  { id: 1, title: "Intro to Python", type: "Course", status: "Completed", desc: "Learn the basics of programming", icon: BookOpen, color: "from-green-400 to-emerald-500" },
  { id: 2, title: "Join Robotics Club", type: "Activity", status: "Completed", desc: "Build and program robots with peers", icon: Zap, color: "from-green-400 to-emerald-500" },
  { id: 3, title: "Machine Learning Basics", type: "Skill", status: "In Progress", desc: "Understand how AI models learn from data", icon: Lightbulb, color: "from-blue-400 to-cyan-500" },
  { id: 4, title: "Science Fair Project", type: "Project", status: "Exploring", desc: "Design an experiment for district science fair", icon: Target, color: "from-violet-400 to-purple-500" },
  { id: 5, title: "AI Ethics Course", type: "Course", status: "New", desc: "Understand the social impact of artificial intelligence", icon: BookOpen, color: "from-slate-400 to-slate-500" },
  { id: 6, title: "Summer Research Internship", type: "Activity", status: "New", desc: "Work with university researchers on real projects", icon: Rocket, color: "from-slate-400 to-slate-500" },
  { id: 7, title: "Software Engineer", type: "Career Path", status: "New", desc: "Your dream destination — building tech that matters", icon: Star, color: "from-amber-400 to-orange-500" },
];

const statusConfig = {
  "Completed": { label: "Completed", ring: "ring-green-400", bg: "bg-green-500", text: "text-green-600", glow: "shadow-green-400/60" },
  "In Progress": { label: "In Progress", ring: "ring-blue-400", bg: "bg-blue-500", text: "text-blue-600", glow: "shadow-blue-400/60" },
  "Exploring": { label: "Exploring", ring: "ring-violet-400", bg: "bg-violet-500", text: "text-violet-600", glow: "shadow-violet-400/40" },
  "New": { label: "Not Started", ring: "ring-slate-300", bg: "bg-slate-300", text: "text-slate-500", glow: "" },
};

function PathNode({ node, index, isLeft, onClick, isSelected }) {
  const cfg = statusConfig[node.status];
  const Icon = node.icon;
  const isDone = node.status === "Completed";
  const isActive = node.status === "In Progress" || node.status === "Exploring";

  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.12, duration: 0.4 }}
      className={cn("flex items-center gap-4", isLeft ? "flex-row" : "flex-row-reverse")}
    >
      {/* Card */}
      <motion.button
        onClick={() => onClick(node)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "flex-1 max-w-[200px] text-left rounded-2xl p-4 border-2 transition-all duration-200 shadow-sm",
          isSelected ? "border-primary bg-primary/5 shadow-lg shadow-primary/20" :
          isDone ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800" :
          isActive ? "border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800" :
          "border-border bg-card hover:border-primary/40"
        )}
      >
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1", cfg.text)}>{node.type}</p>
        <p className="font-heading font-bold text-sm text-foreground leading-tight">{node.title}</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{node.desc}</p>
        <div className={cn("mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full inline-block", cfg.text, "bg-current/10")} style={{backgroundColor: 'transparent'}}>
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", 
            isDone ? "bg-green-100 text-green-700" : 
            node.status === "In Progress" ? "bg-blue-100 text-blue-700" :
            node.status === "Exploring" ? "bg-violet-100 text-violet-700" :
            "bg-muted text-muted-foreground"
          )}>
            {cfg.label}
          </span>
        </div>
      </motion.button>

      {/* Node bubble */}
      <div className="relative flex-shrink-0 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.12 + 0.1, type: "spring", stiffness: 200 }}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center ring-4 shadow-lg",
            `bg-gradient-to-br ${node.color}`,
            cfg.ring,
            cfg.glow && `shadow-lg ${cfg.glow}`,
            isActive && "animate-pulse"
          )}
        >
          <Icon className="w-6 h-6 text-white" />
        </motion.div>
        {isDone && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Spacer for alignment */}
      <div className="flex-1 max-w-[200px]" />
    </motion.div>
  );
}

export default function RecommendationPathDemo() {
  const [selected, setSelected] = useState(null);
  const [nodes, setNodes] = useState(mockNodes);

  const advanceStatus = (nodeId) => {
    const order = ["New", "Exploring", "In Progress", "Completed"];
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const next = order[Math.min(order.indexOf(n.status) + 1, order.length - 1)];
      return { ...n, status: next };
    }));
    setSelected(prev => {
      if (!prev || prev.id !== nodeId) return prev;
      const order = ["New", "Exploring", "In Progress", "Completed"];
      const next = order[Math.min(order.indexOf(prev.status) + 1, order.length - 1)];
      return { ...prev, status: next };
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 via-indigo-950 to-slate-950 p-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest mb-2">Your Discovery Path</p>
          <h1 className="font-heading text-3xl font-bold text-white">Career Journey</h1>
          <p className="text-violet-300/70 text-sm mt-2">Tap any node to track your progress</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            {["Completed", "In Progress", "Exploring", "New"].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-full",
                  s === "Completed" ? "bg-green-400" :
                  s === "In Progress" ? "bg-blue-400" :
                  s === "Exploring" ? "bg-violet-400" : "bg-slate-400"
                )} />
                <span className="text-white/60">{s}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Path */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-white/10" />
            <motion.div
              className="absolute top-0 left-0 right-0 bg-gradient-to-b from-green-400 via-blue-400 to-violet-400 rounded-full"
              initial={{ height: "0%" }}
              animate={{ height: "42%" }}
              transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
            />
          </div>

          <div className="space-y-8 relative z-10">
            {nodes.map((node, i) => (
              <PathNode
                key={node.id}
                node={node}
                index={i}
                isLeft={i % 2 === 0}
                onClick={setSelected}
                isSelected={selected?.id === node.id}
              />
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="text-center text-white/30 text-xs mt-10">
          ✨ This is a preview — data would come from your real recommendations
        </motion.p>
      </div>

      {/* Detail panel */}
      {selected && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 shadow-2xl z-50"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{selected.type}</p>
              <h3 className="font-heading text-xl font-bold text-foreground">{selected.title}</h3>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{selected.desc}</p>
          <div className="flex gap-3">
            <button
              onClick={() => advanceStatus(selected.id)}
              disabled={selected.status === "Completed"}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
            >
              {selected.status === "New" ? "Start Exploring →" :
               selected.status === "Exploring" ? "Mark In Progress →" :
               selected.status === "In Progress" ? "Mark Completed ✓" : "✓ Completed!"}
            </button>
            <button onClick={() => setSelected(null)} className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground">
              Close
            </button>
          </div>
        </motion.div>
      )}
      {selected && <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelected(null)} />}
    </div>
  );
}