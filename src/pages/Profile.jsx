import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Edit3, Save, Sparkles, Loader2, LogOut, School, RotateCcw } from "lucide-react";
import SchoolSearch from "@/components/profile/SchoolSearch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

const INTERESTS = [
  "Technology", "Art & Design", "Science", "Music", "Sports", "Writing",
  "Gaming", "Environment", "Business", "Medicine", "Education", "Film & Media",
  "Cooking", "Fashion", "Engineering", "Social Impact", "Math", "Photography"
];

const STRENGTHS = [
  "Problem Solving", "Creativity", "Leadership", "Communication", "Teamwork",
  "Analytical Thinking", "Empathy", "Organization", "Public Speaking",
  "Adaptability", "Persistence", "Curiosity"
];

const AVATARS = ["🚀", "🌟", "🎨", "🔬", "🎵", "⚡", "🌍", "💡", "🎮", "🦋", "🔥", "🌈"];

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.TeenProfile.filter({ user_email: user.email });
    if (!profiles.length) {
      navigate("/onboarding");
      return;
    }
    setProfile(profiles[0]);
    setForm(profiles[0]);
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, []);

  const toggleItem = (field, item) => {
    setForm(prev => ({
      ...prev,
      [field]: (prev[field] || []).includes(item)
        ? prev[field].filter(i => i !== item)
        : [...(prev[field] || []), item]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by, ...data } = form;
    await base44.entities.TeenProfile.update(profile.id, data);
    setProfile({ ...profile, ...data });
    setEditing(false);
    toast.success("Profile updated!");
    setSaving(false);
  };

  const refreshRecommendations = async () => {
    setRefreshing(true);
    const user = await base44.auth.me();

    // Get progress updates to inform the AI
    const updates = await base44.entities.ProgressUpdate.filter({ user_email: user.email }, "-created_date", 20);
    const recs = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 50);

    const completedRecs = recs.filter(r => r.status === "Completed").map(r => r.title);
    const skippedRecs = recs.filter(r => r.status === "Skipped").map(r => r.title);
    const recentSkills = updates.flatMap(u => u.skills_gained || []);
    const newInterests = updates.flatMap(u => u.new_interests || []);

    if (newInterests.length > 0) {
      const updatedInterests = [...new Set([...(profile.interests || []), ...newInterests])];
      await base44.entities.TeenProfile.update(profile.id, { interests: updatedInterests });
      setProfile(p => ({ ...p, interests: updatedInterests }));
      setForm(p => ({ ...p, interests: updatedInterests }));
    }

    const prompt = `Based on this teen's updated profile and progress, generate 3 new personalized recommendations.

Profile: ${profile.display_name}, age ${profile.age}
Location: ${[profile.city, profile.country].filter(Boolean).join(", ") || "Not specified"}
Interests: ${[...(profile.interests || []), ...newInterests].join(", ")}
Strengths: ${(profile.strengths || []).join(", ")}
Goals: ${(profile.goals || []).join(", ")}
Dream careers: ${(profile.dream_careers || []).join(", ")}
Completed recommendations: ${completedRecs.join(", ") || "None"}
Skipped recommendations: ${skippedRecs.join(", ") || "None"}
Recently gained skills: ${recentSkills.join(", ") || "None"}
New interests: ${newInterests.join(", ") || "None"}
Recent moods: ${updates.slice(0, 5).map(u => u.mood).join(", ") || "None"}

Adapt your suggestions to reflect their growth. Don't repeat completed or skipped items. Factor in their moods and new skills.
Tailor suggestions to their location where relevant — mention local opportunities, programs, universities, or organizations available in ${profile.city || profile.country || "their area"} when applicable.
For resources, provide 2-3 REAL working URLs (e.g. https://www.coursera.org, https://www.khanacademy.org, https://www.youtube.com/...) that are actually relevant to the topic. Only include valid https:// URLs, no placeholder or made-up links.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Career Path", "Skill", "Course", "Activity", "Project"] },
                title: { type: "string" },
                description: { type: "string" },
                why_recommended: { type: "string" },
                difficulty_level: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"] },
                estimated_duration: { type: "string" },
                resources: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    });

    for (const rec of result.recommendations || []) {
      await base44.entities.Recommendation.create({
        ...rec,
        user_email: user.email,
        status: "New",
      });
    }

    toast.success("New refined recommendations generated based on your progress!");
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Profile header */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center text-3xl shadow-lg">
              {editing ? (
                <div className="grid grid-cols-4 gap-1 p-1">
                  {AVATARS.map(e => (
                    <button
                      key={e}
                      onClick={() => setForm(p => ({ ...p, avatar_emoji: e }))}
                      className={cn("text-sm p-0.5 rounded", form.avatar_emoji === e && "bg-primary/20")}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              ) : (
                profile?.avatar_emoji || "🚀"
              )}
            </div>
            <div className="flex-1">
              {editing ? (
                <Input
                  value={form.display_name}
                  onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                  className="text-lg font-bold"
                />
              ) : (
                <h1 className="font-heading text-2xl font-bold text-foreground">{profile?.display_name}</h1>
              )}
              <p className="text-sm text-muted-foreground mt-1">Age: {profile?.age} · {profile?.preferred_learning_style} learner</p>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2">
                <Edit3 className="w-4 h-4" /> Edit
              </Button>
            ) : (
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* School & Grade (edit mode) */}
      {editing && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><School className="w-5 h-5" /> School Info</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">School Name</label>
            <SchoolSearch
              value={form.school_name || ""}
              onChange={v => setForm(p => ({ ...p, school_name: v }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Grade</label>
            <Select value={String(form.current_grade || "")} onValueChange={v => setForm(p => ({ ...p, current_grade: parseInt(v) }))}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select your grade" /></SelectTrigger>
              <SelectContent>
                {[7,8,9,10,11,12].map(g => (
                  <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}

      {/* School info display (view mode) */}
      {!editing && (profile?.school_name || profile?.current_grade) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-muted/50 px-4 py-3 flex items-center gap-3">
          <School className="w-5 h-5 text-muted-foreground" />
          <div>
            {profile.school_name && <p className="text-sm font-medium">{profile.school_name}</p>}
            {profile.current_grade && <p className="text-xs text-muted-foreground">Grade {profile.current_grade}</p>}
          </div>
        </motion.div>
      )}

      {/* Interests */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Interests</h2>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            INTERESTS.map(i => (
              <button
                key={i}
                onClick={() => toggleItem("interests", i)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
                  (form.interests || []).includes(i)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i}
              </button>
            ))
          ) : (
            (profile?.interests || []).map(i => (
              <Badge key={i} variant="secondary" className="bg-primary/10 text-primary">{i}</Badge>
            ))
          )}
        </div>
      </motion.div>

      {/* Strengths */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Strengths</h2>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            STRENGTHS.map(s => (
              <button
                key={s}
                onClick={() => toggleItem("strengths", s)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
                  (form.strengths || []).includes(s)
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {s}
              </button>
            ))
          ) : (
            (profile?.strengths || []).map(s => (
              <Badge key={s} variant="secondary" className="bg-secondary/10 text-secondary">{s}</Badge>
            ))
          )}
        </div>
      </motion.div>

      {/* Goals & Dreams */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Goals & Dream Careers</h2>
        <div className="flex flex-wrap gap-2">
          {(profile?.goals || []).map(g => (
            <Badge key={g} variant="outline">{g}</Badge>
          ))}
          {(profile?.dream_careers || []).map(c => (
            <Badge key={c} className="bg-accent/10 text-accent border-accent/20">{c}</Badge>
          ))}
        </div>
      </motion.div>

      {/* Learning Style */}
      {editing && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Learning Style</h2>
          <Select value={form.preferred_learning_style} onValueChange={v => setForm(p => ({ ...p, preferred_learning_style: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Visual", "Hands-on", "Reading", "Social", "Mixed"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Refresh Recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="rounded-2xl border border-border p-5 text-center space-y-3">
          <Sparkles className="w-6 h-6 text-primary mx-auto" />
          <h3 className="font-heading font-semibold">Refresh Your Recommendations</h3>
          <p className="text-sm text-muted-foreground">
            Get new suggestions based on your latest progress and evolving interests
          </p>
          <Button
            onClick={refreshRecommendations}
            disabled={refreshing}
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {refreshing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Get Refined Suggestions</>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <div className="pt-4 flex items-center gap-4">
        <Button
          variant="ghost"
          className="text-muted-foreground gap-2"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive gap-2"
          onClick={async () => {
            if (!confirm("This will delete ALL your data (profile, plan, recommendations, progress) and restart onboarding. Are you sure?")) return;
            const user = await base44.auth.me();
            const [profiles, plans, recs, updates] = await Promise.all([
              base44.entities.TeenProfile.filter({ user_email: user.email }),
              base44.entities.CareerPlan.filter({ user_email: user.email }),
              base44.entities.Recommendation.filter({ user_email: user.email }),
              base44.entities.ProgressUpdate.filter({ user_email: user.email }),
            ]);
            await Promise.all([
              ...profiles.map(r => base44.entities.TeenProfile.delete(r.id)),
              ...plans.map(r => base44.entities.CareerPlan.delete(r.id)),
              ...recs.map(r => base44.entities.Recommendation.delete(r.id)),
              ...updates.map(r => base44.entities.ProgressUpdate.delete(r.id)),
            ]);
            navigate("/onboarding");
          }}
        >
          <RotateCcw className="w-4 h-4" /> Start From Scratch
        </Button>
      </div>
    </div>
  );
}