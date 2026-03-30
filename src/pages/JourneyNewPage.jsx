import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import NativeSelect from "@/components/NativeSelect";
import { toast } from "sonner";

const TYPES = ["School Course", "Extracurricular", "Sport", "Internship", "Online Course", "Volunteer", "Competition", "Summer Program", "Other"];
const GRADES = [7, 8, 9, 10, 11, 12];

export default function JourneyNewPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", type: "School Course", grade: "", year: "", description: "", status: "Completed" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const user = await base44.auth.me();
    const entry = await base44.entities.JourneyEntry.create({
      ...form,
      grade: form.grade ? Number(form.grade) : undefined,
      user_email: user.email,
    });

    // Auto-match recommendations
    try {
      const recs = await base44.entities.Recommendation.filter({ user_email: user.email });
      const titleLower = entry.title.toLowerCase();
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
    } catch {}

    toast.success("Journey entry saved!");
    navigate(-1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto pb-10">
      <h1 className="font-heading text-xl font-bold mb-6 hidden sm:block">Add Journey Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Title *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. AP Computer Science, Science Olympiad"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Type</label>
            <NativeSelect value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} options={TYPES} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Grade</label>
            <NativeSelect
              value={form.grade}
              onValueChange={v => setForm(f => ({ ...f, grade: v }))}
              placeholder="Any"
              options={GRADES.map(g => ({ value: String(g), label: `${g}th` }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Year</label>
            <input
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
              placeholder="e.g. 2024-2025"
              autoCorrect="off"
              autoCapitalize="none"
              inputMode="text"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Status</label>
            <NativeSelect
              value={form.status}
              onValueChange={v => setForm(f => ({ ...f, status: v }))}
              options={["Completed", "In Progress"]}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Awards, grades, achievements, role..."
            rows={3}
            autoCorrect="on"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </form>
    </div>
  );
}