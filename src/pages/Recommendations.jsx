import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import RecommendationDetail from "../components/recommendations/RecommendationDetail";
import GenerateButton from "../components/dashboard/GenerateButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const FILTERS = ["All", "New", "Exploring", "In Progress", "Completed", "Skipped"];

export default function Recommendations() {
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const generateRecs = async (profile, existingRecs) => {
    const existingTitles = existingRecs.map(r => r.title).join(", ");

    const prompt = `You are an elite career counselor and academic advisor for high-achieving teenagers. Your job is to generate HIGHLY SPECIFIC, deeply personalized, and immediately actionable recommendations — not generic advice.

Student Profile:
- Name: ${profile.display_name}, Age: ${profile.age}, Grade: ${profile.current_grade || 'high school'}
- Location: ${[profile.city, profile.country].filter(Boolean).join(", ") || "United States"}
- School: ${profile.high_school_name || profile.middle_school_name || profile.school_name || "Not specified"}
- Interests: ${(profile.interests || []).join(", ") || "Not specified"}
- Strengths: ${(profile.strengths || []).join(", ") || "Not specified"}
- Goals: ${(profile.goals || []).join(", ") || "Not specified"}
- Dream Careers: ${(profile.dream_careers || []).join(", ") || "Not specified"}
- Learning Style: ${profile.preferred_learning_style || "Mixed"}

${existingTitles ? `Already recommended (do NOT repeat or overlap with these): ${existingTitles}\n\n` : ""}

Generate 5 ELITE, highly specific recommendations. Rules:
1. CAREER PATH recs must name specific roles (e.g. "Biomedical Engineer at a startup" not just "engineering"), with a clear progression from high school → college major → first job → 5-year goal.
2. SKILL recs must name a specific technology, framework, or discipline (e.g. "Python for Data Analysis with Pandas & Matplotlib", not just "coding"). Include what project they should build to demonstrate the skill.
3. COURSE recs must be real, named courses from platforms like Coursera, edX, MIT OpenCourseWare, Khan Academy, or specific university programs — with the actual course name and provider.
4. ACTIVITY recs should be specific named competitions, clubs, or programs (e.g. "FIRST Robotics Competition", "Science Olympiad", "DECA", "Speech & Debate") relevant to their location if possible.
5. PROJECT recs should be a specific, concrete project idea that directly connects their interests and dream career (e.g. "Build a mental health chatbot using OpenAI API and Flask that connects teens to resources").

For each recommendation:
- description: 2-3 sentences that are SPECIFIC to THIS student's profile, not generic.
- why_recommended: Directly reference their specific interests, goals, and dream career. Be personal and precise.
- resources: Provide 3 REAL, working URLs (e.g. https://www.coursera.org/learn/python, https://www.firstinspires.org) — verified, specific links only.
- difficulty_level and estimated_duration must be realistic for their grade level.

Mix the 5 types across: Career Path, Skill, Course, Activity, Project.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
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

    const recs = result.recommendations || [];
    for (const rec of recs) {
      await base44.entities.Recommendation.create({ ...rec, user_email: profile.user_email, status: "New" });
    }
    return recs;
  };

  const loadData = async (autoGenerate = false) => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.TeenProfile.filter({ user_email: user.email });
    const p = profiles[0] || null;
    if (p) setProfile(p);
    const recs = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100);

    // Auto-generate on first visit if no recommendations exist
    if (autoGenerate && p && recs.length === 0) {
      setLoading(true);
      await generateRecs(p, []);
      const fresh = await base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100);
      setRecommendations(fresh);
      toast.success("Your first recommendations are ready!");
    } else {
      setRecommendations(recs);
    }

    setLoading(false);

    const urlParams = new URLSearchParams(window.location.search);
    const recId = urlParams.get("id");
    if (recId) {
      const found = recs.find(r => r.id === recId);
      if (found) setSelected(found);
    }
  };

  useEffect(() => { loadData(true); }, []);

  const filtered = filter === "All" ? recommendations : recommendations.filter(r => r.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Compass className="w-6 h-6 text-primary" />
            Explore Paths
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{recommendations.length} recommendations tailored for you</p>
        </div>
        <GenerateButton profile={profile} existingRecs={recommendations} onGenerated={loadData} />
      </motion.div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted/50 w-full sm:w-auto overflow-x-auto flex">
          {FILTERS.map(f => (
            <TabsTrigger key={f} value={f} className="text-xs">{f}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <RecommendationCard recommendation={rec} onClick={setSelected} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No {filter !== "All" ? filter.toLowerCase() : ""} recommendations yet</p>
        </div>
      )}

      {selected && (
        <RecommendationDetail
          recommendation={selected}
          onClose={() => setSelected(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}