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
    const prompt = `You are a career mentor for a ${profile.age}-year-old teenager named ${profile.display_name}.

Location: ${[profile.city, profile.country].filter(Boolean).join(", ") || "Not specified"}
Their interests: ${(profile.interests || []).join(", ")}
Their strengths: ${(profile.strengths || []).join(", ")}
Their goals: ${(profile.goals || []).join(", ")}
Their dream careers: ${(profile.dream_careers || []).join(", ")}
Their learning style: ${profile.preferred_learning_style || "Mixed"}

${existingTitles ? `They already have these recommendations (do NOT repeat): ${existingTitles}` : ""}

Generate 3 NEW personalized recommendations. Mix career paths, skills, courses, activities, and projects.
Tailor suggestions to their location where relevant — mention local opportunities, programs, universities, or organizations available in ${profile.city || profile.country || "their area"} when applicable.
Each recommendation should be actionable, age-appropriate, and directly related to their interests/goals.
Include a clear explanation of WHY you're recommending it based on their profile and location.
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