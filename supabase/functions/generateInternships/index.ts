import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { logEvent } from '../_shared/log.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

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
          eligibility: { type: 'string' },
          selectivity: { type: 'string', enum: ['Open', 'Competitive', 'Selective', 'Highly Selective'] },
          admission_model: { type: 'string', enum: ['Pay to Play', 'Selective', 'Both'] },
          application_method: { type: 'string', enum: ['Online Application', 'Email Inquiry', 'Both'] },
          contact_email: { type: 'string' },
          path_to_get_in: { type: 'string' },
        },
      },
    },
  },
};

/** Next upcoming summer application cycle, e.g. if it's already past June this year, target next year's. */
function nextSummerYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

async function findInternshipsForBucket(opts: {
  bucketLabel: string;
  bucketDescription: string;
  profile: any;
  grade: number;
  season: string;
  journeySummary: string;
  pastInternships: string[];
  perTrack: number;
  excludeKeys: Set<string>;
}) {
  const { bucketLabel, bucketDescription, profile, grade, season, journeySummary, pastInternships, perTrack, excludeKeys } = opts;

  const prompt = `You are a career counselor finding REAL, currently available internships and structured pre-professional programs for a high-achieving student, targeting the ${season} application cycle.

Student: ${profile.display_name}, age ${profile.age}, grade ${grade}.
Location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'United States'}.
Interests: ${(profile.interests || []).join(', ') || 'Not specified'}.
Strengths: ${(profile.strengths || []).join(', ') || 'Not specified'}.
Dream careers: ${(profile.dream_careers || []).join(', ') || 'Not specified'}.
Focus area for this batch: ${bucketLabel} — ${bucketDescription}
Journey so far: ${journeySummary}.
${pastInternships.length ? `Already done these internships (do NOT repeat): ${pastInternships.join(', ')}` : ''}
${excludeKeys.size ? `Already suggested (do NOT repeat): ${[...excludeKeys].join('; ')}` : ''}

Find ${perTrack} REAL internships, research programs, or structured pre-professional experiences for the ${season} cycle that:
1. Fit this student's grade level (${grade}) — if under 10th grade, prioritize junior/pipeline programs, shadowing, or entry-level structured programs rather than formal paid internships which are rare before 10th grade.
2. Align tightly with "${bucketLabel}" and this student's interests and dream careers.
3. Are REAL, named programs/organizations with a genuine, working application URL (official program pages, company career pages, or well-known boards). Never invent a fake URL.
4. Include a realistic application deadline for the ${season} cycle, or "Rolling" if year-round.
5. Search the organization's official page for a real admissions/coordinator/contact email address for questions about the program. Only include contact_email if you actually find one published on an official source — leave it blank otherwise. Never invent an email address.
6. eligibility: one sentence on who qualifies (grade, citizenship, GPA, etc. if known).
7. selectivity: your best estimate (Open, Competitive, Selective, or Highly Selective) based on the program's reputation and acceptance rate if known.
8. admission_model: how you actually get a spot — "Pay to Play" if it's tuition/fee-based enrollment with little to no merit screening (e.g. most pre-college summer camps), "Selective" if admission is merit-based/competitive with no significant cost barrier (e.g. research programs, corporate internships, government programs), or "Both" if it's competitive AND has a real tuition/fee (e.g. elite pre-college research programs with paid tuition).
9. application_method: the actual next step to pursue it — "Online Application" if there's a formal online application/portal to fill out, "Email Inquiry" if the realistic next step is emailing a coordinator/admissions contact to ask about applying (common for smaller or informal opportunities), or "Both" if a formal application exists but reaching out directly is also a real, useful step.
10. path_to_get_in: 2-3 concrete sentences of specific, actionable advice for how this exact student could strengthen their application (skills to build, projects to show, who to ask for recommendations).

Be efficient - a short, high-confidence list beats an exhaustive search. For each: title, organization, description (2-3 sentences), why_recommended (specific to this student), application_url, deadline, grade_levels (array of grades this applies to), duration (e.g. "8 weeks, summer"), location (city/remote/hybrid), eligibility, selectivity, admission_model, application_method, contact_email, path_to_get_in.`;

  const result = await invokeLLM({ source: 'generateInternships', prompt, schema, webSearch: true, maxUses: 4, effort: 'medium', maxTokens: 4000 });
  return result?.internships || [];
}

async function runGeneration(user: { email: string }, perTrack: number) {
  try {
    const countPerBucket = Math.min(Math.max(perTrack || 6, 1), 10);

    const { data: profiles } = await supabaseAdmin
      .from('teen_profiles').select('*').eq('user_email', user.email).limit(1);
    const profile = profiles?.[0];
    if (!profile) return;

    const { data: plans } = await supabaseAdmin
      .from('career_plans').select('*').eq('user_email', user.email).limit(1);
    const plan = plans?.[0];
    const tracks = (plan?.career_tracks || []).filter((t: any) => t?.name);

    const { data: journeyEntries = [] } = await supabaseAdmin
      .from('journey_entries').select('*').eq('user_email', user.email);
    const pastInternships = journeyEntries.filter((e) => e.type === 'Internship').map((e) => e.title);
    const journeySummary = journeyEntries.length
      ? journeyEntries.map((e) => `${e.title} [${e.type}, ${e.status || 'Completed'}]`).join(', ')
      : 'None logged yet';

    const { data: existing = [] } = await supabaseAdmin
      .from('internships').select('title, organization').eq('user_email', user.email);
    const excludeKeys = new Set(existing.map((i) => `${i.title}|${i.organization || ''}`.toLowerCase().trim()));

    const grade = profile.current_grade || 9;
    const season = `Summer ${nextSummerYear()}`;

    const buckets = [
      { trackName: null, bucketLabel: 'General', bucketDescription: 'General career exploration matched to interests and dream careers' },
      ...tracks.map((t: any) => ({ trackName: t.name, bucketLabel: t.name, bucketDescription: t.description || '' })),
    ];

    const bucketResults = await Promise.allSettled(
      buckets.map((b) =>
        findInternshipsForBucket({
          bucketLabel: b.bucketLabel,
          bucketDescription: b.bucketDescription,
          profile, grade, season, journeySummary, pastInternships,
          perTrack: countPerBucket,
          excludeKeys,
        })
      )
    );

    let created = 0;
    for (let i = 0; i < buckets.length; i++) {
      const result = bucketResults[i];
      if (result.status !== 'fulfilled') {
        await logEvent('generateInternships', 'error', `Bucket "${buckets[i].bucketLabel}" failed`, {
          reason: String((result as PromiseRejectedResult).reason?.message ?? (result as PromiseRejectedResult).reason),
        }, user.email);
        continue;
      }
      for (const internship of result.value) {
        const key = `${internship.title}|${internship.organization || ''}`.toLowerCase().trim();
        if (!internship.title || excludeKeys.has(key)) continue;
        excludeKeys.add(key);
        await supabaseAdmin.from('internships').insert({
          ...internship,
          user_email: user.email,
          track_name: buckets[i].trackName,
          season,
          status: 'New',
        });
        created++;
      }
    }

    if (created === 0) {
      await logEvent('generateInternships', 'warn', 'No internships created across any bucket', {
        bucketCount: buckets.length,
      }, user.email);
    }
  } catch (error) {
    console.error('generateInternships background error:', (error as Error).message);
    await logEvent('generateInternships', 'error', 'Background generation error', { message: (error as Error)?.message }, user.email);
  }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { perTrack } = await req.json().catch(() => ({}));

    // Each bucket makes its own web-search LLM call, which can take well
    // over a minute - run them in the background and let the client poll
    // the internships table, rather than blocking this request (which would
    // risk hitting the edge function's compute-time limit).
    const work = runGeneration(user, parseInt(perTrack) || 6);
    try {
      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        EdgeRuntime.waitUntil(work);
      } else {
        work.catch((err) => console.error('runGeneration error:', err.message));
      }
    } catch {
      // ignore - work is already running regardless
    }

    return jsonResponse({ status: 'generating' });
  } catch (error) {
    console.error('generateInternships error:', (error as Error).message);
    await logEvent('generateInternships', 'error', 'Top-level handler error', { message: (error as Error)?.message });
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
