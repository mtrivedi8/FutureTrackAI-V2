import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Trophy, Dumbbell, Briefcase, Laptop, Heart, Star, Zap, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import JourneyEntryForm from "@/components/journey/JourneyEntryForm";

const TYPE_CONFIG = {
  "School Course":    { icon: BookOpen,  color: "bg-blue-100 text-blue-700 border-blue-200" },
  "Extracurricular":  { icon: Trophy,    color: "bg-purple-100 text-purple-700 border-purple-200" },
  "Sport":            { icon: Dumbbell,  color: "bg-green-100 text-green-700 border-green-200" },
  "Internship":       { icon: Briefcase, color: "bg-amber-100 text-amber-700 border-amber-200" },
  "Online Course":    { icon: Laptop,    color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  "Volunteer":        { icon: Heart,     color: "bg-red-100 text-red-700 border-red-200" },
  "Competition":      { icon: Star,      color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "Summer Program":   { icon: Zap,       color: "bg-orange-100 text-orange-700 border-orange-200" },
  "Other":            { icon: CheckCircle2, color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const GRADE_LABELS = { 7:"7th", 8:"8th", 9:"9th", 10:"10th", 11:"11th", 12:"12th" };

export default function Journey() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("All");

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.JourneyEntry.filter({ user_email: user.email }, "-created_date", 200);
    setEntries(data);
    setLoading(false);
  };

  const handleSaved = async (newEntry) => {
    setShowForm(false);
    await loadEntries();
    // Auto-match recommendations with similar titles and mark as Completed
    try {
      const user = await base44.auth.me();
      const recs = await base44.entities.Recommendation.filter({ user_email: user.email });
      const titleLower = newEntry.title.toLowerCase();
      const matches = recs.filter(r =>
        r.status !== "Completed" &&
        (r.title.toLowerCase().includes(titleLower) || titleLower.includes(r.title.toLowerCase()))
      );
      for (const rec of matches) {
        await base44.entities.Recommendation.update(rec.id, { status: "Completed" });
      }
      if (matches.length > 0) {
        toast.success(`Marked ${matches.length} suggestion${matches.length > 1 ? "s" : ""} as Completed! 🎉`);
      }
    } catch (e) {
      console.error("Auto-match error:", e);
    }
    toast.success("Journey entry saved!");
  };

  const handleDelete = async (id) => {
    await base44.entities.JourneyEntry.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const types = ["All", ...Object.keys(TYPE_CONFIG)];
  const filtered = filterType === "All" ? entries : entries.filter(e => e.type === filterType);

  // Group by grade
  const byGrade = {};
  for (const e of filtered) {
    const g = e.grade || "Other";
    if (!byGrade[g]) byGrade[g] = [];
    byGrade[g].push(e);
  }
  const sortedGrades = Object.keys(byGrade).sort((a, b) => Number(b) - Number(a));

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">My Journey</h1>
          <p className="text-muted-foreground text-sm mt-1">{entries.length} entries · used to personalize your roadmap & suggestions</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="w-4 h-4" /> Add Entry
        </Button>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              filterType === t ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:border-primary/40"
            )}>
            {t}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-foreground mb-1">Log your journey</h3>
          <p className="text-muted-foreground text-sm mb-4">Add courses, activities, sports, and programs you've done. Your roadmap and suggestions will adapt.</p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Your First Entry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGrades.map(grade => (
            <div key={grade}>
              <h2 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                {GRADE_LABELS[grade] || "Grade " + grade} Grade
              </h2>
              <div className="space-y-2">
                {byGrade[grade].map((entry, i) => {
                  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG["Other"];
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border shrink-0", cfg.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-foreground">{entry.title}</p>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", cfg.color)}>{entry.type}</span>
                          {entry.status === "Completed"
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Done</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> In Progress</span>
                          }
                        </div>
                        {entry.description && <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>}
                        {entry.year && <p className="text-[10px] text-muted-foreground mt-0.5">{entry.year}</p>}
                      </div>
                      <button onClick={() => handleDelete(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <JourneyEntryForm onSave={handleSaved} onClose={() => setShowForm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}