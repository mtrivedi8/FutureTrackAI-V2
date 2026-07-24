import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const schema = {
  type: 'object',
  properties: {
    internships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          organization: { type: 'string' },
          description: { type: 'string' },
          why_recommended: { type: 'string' },
          application_url: { type: 'string' },
          deadline: { type: 'string' },
          grade_levels: { type: 'array', items: { type: 'number' } },
          duration: { type: 'string' },
          location: { type: 'string' },
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

    const { trackIndex } = await req.json().catch(() => ({}));

    const { data: profiles } = await supabaseAdmin
      .from('teen_profiles').select('*').eq('user_email', user.email).limit(1);
    const profile = profiles?.[0];
    if (!profile) return jsonResponse({ error: 'Profile not found' }, 404);

    const { data: plans } = await supabaseAdmin
      .from('career_plans').select('*').eq('user_email', user.email).limit(1);
    const plan = plans?.[0];
    const tracks = plan?.career_tracks || [];
    const idx = typeof trackIndex === 'number' ? trackIndex : (plan?.selected_track_index || 0);
    const track = tracks[idx] || null;

    const { data: journeyEntries = [] } = await supabaseAdmin
      .from('journey_entries').select('*').eq('user_email', user.email);
    const pastInternships = journeyEntries.filter((e) => e.type === 'Internship').map((e) => e.title);
    const journeySummary = journeyEntries.length
      ? journeyEntries.map((e) => `${e.title} [${e.type}, ${e.status || 'Completed'}]`).join(', ')
      : 'None logged yet';

    const { data: existing = [] } = await supabaseAdmin
      .from('internships').select('title, organization').eq('user_email', user.email);
    const existingKeys = new Set(existing.map((i) => `${i.title}|${i.organization || ''}`.toLowerCase().trim()));

    const grade = profile.current_grade || 9;
    const trackContext = track
      ? `Selected career track: "${track.name}" — ${track.description || ''}. College goals: ${track.college_goals || 'N/A'}.`
      : 'No career track generated yet — base suggestions on interests and dream careers only.';

    const gradeEntry = track?.grades?.find((g: any) => g.grade === grade);
    const gradeContext = gradeEntry
      ? `This grade's plan focus: ${gradeEntry.focus || ''}. Suggested summer activities already on the roadmap: ${(gradeEntry.summer_activities || []).join(', ') || 'none listed'}.`
      : '';

    const prompt = `You are a career counselor finding REAL, currently available internships and structured pre-professional programs for a high-achieving student.

Student: ${profile.display_name}, age ${profile.age}, grade ${grade}.
Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'United States'}.
Interests: ${(profile.interests || []).join(', ') || 'Not specified'}.
Strengths: ${(profile.strengths || []).join(', ') || 'Not specified'}.
Dream careers: ${(profile.dream_careers || []).join(', ') || 'Not specified'}.
${trackContext}
${gradeContext}
Journey so far: ${journeySummary}.
${pastInternships.length ? `Already done these internships (do NOT repeat): ${pastInternships.join(', ')}` : ''}
${existingKeys.size ? `Already suggested (do NOT repeat): ${[...existingKeys].join('; ')}` : ''}

Find 5 REAL internships, research programs, or structured pre-professional experiences that:
1. Fit this student's grade level (${grade}) — if under 10th grade, prioritize junior/pipeline programs, shadowing, or entry-level structured programs rather than formal paid internships which are rare before 10th grade.
2. Align tightly with their career track, interests, and dream careers.
3. Are REAL, named programs/organizations with a genuine, working application URL (company career pages, program sites, or well-known internship boards like handshake, indeed, or the org's own site). Never invent a fake URL.
4. Include a realistic application deadline or note "Rolling" if year-round.

For each: title, organization, description (2-3 sentences), why_recommended (specific to this student), application_url, deadline, grade_levels (array of grades this applies to), duration (e.g. "8 weeks, summer"), location (city/remote/hybrid).`;

    const result = await invokeLLM({ prompt, schema, webSearch: true, maxUses: 8 });
    const internships = result?.internships || [];

    let created = 0;
    for (const internship of internships) {
      const key = `${internship.title}|${internship.organization || ''}`.toLowerCase().trim();
      if (!internship.title || existingKeys.has(key)) continue;
      existingKeys.add(key);
      await supabaseAdmin.from('internships').insert({
        ...internship,
        user_email: user.email,
        track_name: track?.name || null,
        status: 'New',
      });
      created++;
    }

    return jsonResponse({ count: created });
  } catch (error) {
    console.error('generateInternships error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
