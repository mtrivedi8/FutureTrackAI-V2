import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import NativeSelect from "@/components/NativeSelect";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const UPDATE_TYPES = ["Achievement", "Milestone", "Reflection", "Interest Change", "Feedback"];
const MOODS = [
  { value: "Excited", emoji: "🔥" },
  { value: "Motivated", emoji: "💪" },
  { value: "Curious", emoji: "🤔" },
  { value: "Neutral", emoji: "😊" },
  { value: "Struggling", emoji: "😤" },
  { value: "Uncertain", emoji: "🤷" },
];

export default function ProgressForm({ recommendations = [], onClose, onCreated }) {
  const [form, setForm] = useState({
    update_type: "Achievement",
    title: "",
    description: "",
    mood: "Motivated",
    recommendation_id: "",
    new_interests: [],
    skills_gained: [],
  });
  const [interestInput, setInterestInput] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.ProgressUpdate.create({
      ...form,
      user_email: user.email,
    });
    toast.success("Progress logged! 🎉");
    onCreated?.();
    onClose?.();
    setSaving(false);
  };

  const addTag = (field, value, setter) => {
    if (value.trim()) {
      setForm(p => ({ ...p, [field]: [...p[field], value.trim()] }));
      setter("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold">Log Progress</h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Type</label>
            <NativeSelect value={form.update_type} onValueChange={v => setForm(p => ({ ...p, update_type: v }))} options={UPDATE_TYPES} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Title</label>
            <Input
              placeholder="What did you accomplish?"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Details</label>
            <Textarea
              placeholder="Tell us more about it..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
            />
          </div>

          {recommendations.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Related to</label>
              <NativeSelect
                value={form.recommendation_id}
                onValueChange={v => setForm(p => ({ ...p, recommendation_id: v }))}
                placeholder="Select a recommendation (optional)"
                options={recommendations.map(r => ({ value: r.id, label: r.title }))}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">How are you feeling?</label>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map(({ value, emoji }) => (
                <button
                  key={value}
                  onClick={() => setForm(p => ({ ...p, mood: value }))}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all",
                    form.mood === value
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {emoji} {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Skills gained</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Python, public speaking..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTag("skills_gained", skillInput, setSkillInput)}
              />
              <Button variant="secondary" size="icon" onClick={() => addTag("skills_gained", skillInput, setSkillInput)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.skills_gained.map((s, i) => (
                <span key={i} className="px-2.5 py-1 bg-secondary/10 text-secondary text-xs rounded-lg flex items-center gap-1">
                  {s}
                  <button onClick={() => setForm(p => ({ ...p, skills_gained: p.skills_gained.filter((_, idx) => idx !== i) }))}>×</button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">New interests discovered</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., AI, robotics..."
                value={interestInput}
                onChange={e => setInterestInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTag("new_interests", interestInput, setInterestInput)}
              />
              <Button variant="secondary" size="icon" onClick={() => addTag("new_interests", interestInput, setInterestInput)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.new_interests.map((s, i) => (
                <span key={i} className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-lg flex items-center gap-1">
                  {s}
                  <button onClick={() => setForm(p => ({ ...p, new_interests: p.new_interests.filter((_, idx) => idx !== i) }))}>×</button>
                </span>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={saving || !form.title.trim()} className="w-full">
            {saving ? "Saving..." : "Log Progress"}
          </Button>
        </div>
      </div>
    </div>
  );
}