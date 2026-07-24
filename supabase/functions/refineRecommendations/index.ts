import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

// Replaces the client-side base44.integrations.Core.InvokeLLM call that used
// to run directly in the browser from Profile.jsx - LLM calls now require an
// API key that must stay server-side.

const schema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['Career Path', 'Skill', 'Course', 'Activity', 'Project'] },
          title: { type: 'string' },
          description: { type: 'string' },
          why_recommended: { type: 'string' },
          difficulty_level: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] },
          estimated_duration: { type: 'string' },
          resources: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: profiles } = await supabaseAdmin
      .from('teen_profiles').select('*').eq('user_email', user.email).limit(1);
    const profile = profiles?.[0];
    if (!profile) return jsonResponse({ error: 'Profile not found' }, 404);

    const { data: updates = [] } = await supabaseAdmin
      .from('progress_updates').select('*').eq('user_email', user.email)
      .order('created_date', { ascending: false }).limit(20);
    const { data: recs = [] } = await supabaseAdmin
      .from('recommendations').select('*').eq('user_email', user.email)
      .order('created_date', { ascending: false }).limit(50);

    const completedRecs = recs.filter((r) => r.status === 'Completed').map((r) => r.title);
    const skippedRecs = recs.filter((r) => r.status === 'Skipped').map((r) => r.title);
    const recentSkills = updates.flatMap((u) => u.skills_gained || []);
    const newInterests = updates.flatMap((u) => u.new_interests || []);

    let interests = profile.interests || [];
    if (newInterests.length > 0) {
      interests = [...new Set([...interests, ...newInterests])];
      await supabaseAdmin.from('teen_profiles').update({ interests }).eq('id', profile.id);
    }

    const prompt = `Based on this teen's updated profile and progress, generate 3 new personalized recommendations.

Profile: ${profile.display_name}, age ${profile.age}
Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'Not specified'}
Interests: ${interests.join(', ')}
Strengths: ${(profile.strengths || []).join(', ')}
Goals: ${(profile.goals || []).join(', ')}
Dream careers: ${(profile.dream_careers || []).join(', ')}
Completed recommendations: ${completedRecs.join(', ') || 'None'}
Skipped recommendations: ${skippedRecs.join(', ') || 'None'}
Recently gained skills: ${recentSkills.join(', ') || 'None'}
New interests: ${newInterests.join(', ') || 'None'}
Recent moods: ${updates.slice(0, 5).map((u) => u.mood).join(', ') || 'None'}

Adapt your suggestions to reflect their growth. Don't repeat completed or skipped items. Factor in their moods and new skills.
Tailor suggestions to their location where relevant — mention local opportunities, programs, universities, or organizations available in ${profile.city || profile.country || 'their area'} when applicable.
For resources, provide 2-3 REAL working URLs (e.g. https://www.coursera.org, https://www.khanacademy.org, https://www.youtube.com/...) that are actually relevant to the topic. Only include valid https:// URLs, no placeholder or made-up links.`;

    const result = await invokeLLM({ source: 'refineRecommendations', prompt, schema });
    const newRecs = result?.recommendations || [];

    for (const rec of newRecs) {
      await supabaseAdmin.from('recommendations').insert({ ...rec, user_email: user.email, status: 'New' });
    }

    return jsonResponse({ count: newRecs.length });
  } catch (error) {
    console.error('refineRecommendations error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
