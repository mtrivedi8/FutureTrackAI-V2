import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { logEvent } from '../_shared/log.ts';

// Generates the detailed, dated "Path to Get In" roadmap for a single
// internship, on demand (when the student actually opens it) rather than
// during bulk search - doing this for every result up front was heavy
// enough (rich schema x many internships x several tracks) to silently hit
// the edge function's compute-time limit even at low effort.
const schema = {
  type: 'object',
  properties: {
    path_steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timeframe: { type: 'string' },
          category: { type: 'string', enum: ['Online Coursework', 'Extracurricular', 'Prerequisite', 'Evaluation', 'Application', 'Outreach', 'Project'] },
          title: { type: 'string' },
          description: { type: 'string' },
          resource_url: { type: 'string' },
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

    const { internshipId } = await req.json();
    if (!internshipId) return jsonResponse({ error: 'internshipId required' }, 400);

    const { data: internship } = await supabaseAdmin
      .from('internships').select('*').eq('id', internshipId).eq('user_email', user.email).single();
    if (!internship) return jsonResponse({ error: 'Internship not found' }, 404);

    if (internship.path_steps?.length > 0) {
      return jsonResponse({ path_steps: internship.path_steps });
    }

    const { data: profiles } = await supabaseAdmin
      .from('teen_profiles').select('*').eq('user_email', user.email).limit(1);
    const profile = profiles?.[0];
    const grade = profile?.current_grade || 9;
    const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const prompt = `A student is currently in grade ${grade}. Today is ${today}. They want to build the strongest possible application for this specific program:

Program: ${internship.title}${internship.organization ? ` at ${internship.organization}` : ''}
Description: ${internship.description || 'N/A'}
Eligibility: ${internship.eligibility || 'N/A'}
Application deadline: ${internship.deadline || 'Not specified'}
Selectivity: ${internship.selectivity || 'Not specified'}

Student's interests: ${(profile?.interests || []).join(', ') || 'Not specified'}
Student's strengths: ${(profile?.strengths || []).join(', ') || 'Not specified'}

Create a dated, step-by-step roadmap of 4-6 concrete steps from ${today} through the application deadline, in chronological order, showing exactly what this student should do ahead of time to maximize their probability of being selected. Each step needs:
- timeframe: a specific period anchored to today and the student's current grade (e.g. "Fall 2026 (Grade ${grade})", "December 2026 (Grade ${grade})", "January–March 2027 (Grade ${grade})") - advance the grade in later steps if the timeline spans into a new school year.
- category: one of Online Coursework, Extracurricular, Prerequisite, Evaluation, Application, Outreach, Project.
- title: a short, specific action (e.g. "Build Python & Git Proficiency", "Register for Online Prerequisites").
- description: 1-2 sentences on why this step matters for getting into THIS specific program.
- resource_url: a real, relevant URL if one genuinely helps - leave blank if you don't have a real one, never invent a URL.
The last step should always be the actual application/submission step for this program.`;

    const result = await invokeLLM({ source: 'generateInternshipPath', prompt, schema, webSearch: true, maxUses: 2, effort: 'low', maxTokens: 3000 });
    const pathSteps = result?.path_steps || [];

    if (pathSteps.length > 0) {
      await supabaseAdmin.from('internships').update({ path_steps: pathSteps }).eq('id', internshipId);
    } else {
      await logEvent('generateInternshipPath', 'warn', `No path steps generated for internship ${internshipId}`, undefined, user.email);
    }

    return jsonResponse({ path_steps: pathSteps });
  } catch (error) {
    console.error('generateInternshipPath error:', (error as Error).message);
    await logEvent('generateInternshipPath', 'error', 'Top-level handler error', { message: (error as Error)?.message });
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
