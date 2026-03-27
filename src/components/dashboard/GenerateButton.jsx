import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GenerateButton({ profile, existingRecs = [], onGenerated }) {
  const [loading, setLoading] = useState(false);

  const generateRecommendations = async () => {
    if (!profile) return;
    setLoading(true);

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
5. PROJECT recs should be a specific, concrete project idea that directly connects their interests and dream career.

For each recommendation:
- description: 2-3 sentences that are SPECIFIC to THIS student's profile, not generic.
- why_recommended: Directly reference their specific interests, goals, and dream career. Be personal and precise.
- resources: Provide 3 REAL, working URLs — verified, specific links only.
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
      await base44.entities.Recommendation.create({
        ...rec,
        user_email: profile.user_email,
        status: "New",
      });
    }

    toast.success(`${recs.length} new recommendations generated!`);
    onGenerated?.();
    setLoading(false);
  };

  return (
    <Button
      onClick={generateRecommendations}
      disabled={loading || !profile}
      className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          Get New Suggestions
        </>
      )}
    </Button>
  );
}