import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const PLAN_COST = 0.25;

const trackSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    college_goals: { type: 'string' },
    grades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          grade: { type: 'number' },
          focus: { type: 'string' },
          key_milestone: { type: 'string' },
          clubs: { type: 'array', items: { type: 'string' } },
          extracurriculars: { type: 'array', items: { type: 'string' } },
          online_courses: { type: 'array', items: { type: 'string' } },
          volunteer_opportunities: { type: 'array', items: { type: 'string' } },
          summer_activities: { type: 'array', items: { type: 'string' } },
          school_courses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                subject_area: { type: 'string' },
                level: { type: 'string' },
                recommended_for_track: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
};

async function generateTracks(profile: any, journey: any, middleCourses: any[], highCourses: any[], schoolName: string) {
  try {
    const allCourses = [...middleCourses, ...highCourses];
    const school_info = { school_name: schoolName || profile.high_school_name || 'Your School', courses_found: allCourses.length };

    let freshProfile = profile;
    const { data: latestProfiles } = await supabaseAdmin
      .from('teen_profiles').select('*').eq('user_email', profile.user_email).limit(1);
    if (latestProfiles?.[0]) freshProfile = { ...profile, ...latestProfiles[0] };

    const journeyParts = [
      (journey.completed_courses || []).length ? `Courses already taken: ${journey.completed_courses.join(', ')}` : '',
      (journey.completed_activities || []).length ? `Activities/internships done: ${journey.completed_activities.join(', ')}` : '',
      (journey.completed_recommendations || []).length ? `Completed suggestions: ${journey.completed_recommendations.join(', ')}` : '',
      (journey.skills_gained || []).length ? `Skills gained: ${journey.skills_gained.join(', ')}` : '',
    ].filter(Boolean);
    const journeyContext = journeyParts.length ? ' Journey so far — ' + journeyParts.join('. ') + '.' : '';

    const studentBase = `Student: ${freshProfile.display_name}, age ${freshProfile.age}, grade ${freshProfile.current_grade}. Interests: ${(freshProfile.interests || []).join(', ')}. Strengths: ${(freshProfile.strengths || []).join(', ')}. Goals: ${(freshProfile.goals || []).join(', ')}. Dream Careers: ${(freshProfile.dream_careers || []).join(', ')}.${journeyContext}`;
    const allCoursesSummary = allCourses.slice(0, 30).map((c) => `${c.name} (${c.subject_area})`).join(', ');

    const dreams = freshProfile.dream_careers || [];
    const interests = freshProfile.interests || [];
    const goals = freshProfile.goals || [];
    const trackHints = [
      dreams.slice(0, 2).join(' & ') || interests[0] || 'STEM / Technology',
      dreams[2] || interests[1] || goals[0] || 'Creative / Business / Arts',
      `Interdisciplinary combining ${interests.slice(0, 2).join(' + ') || 'emerging fields'}`,
    ];

    const trackPromises = [0, 1, 2].map(async (i) => {
      const prompt = `Create ONE career track for: ${studentBase}
Track ${i + 1} focus: ${trackHints[i]}
Goals: ${(freshProfile.goals || []).join(', ')}

Sample courses: ${allCoursesSummary}

Build grades ${freshProfile.current_grade}-12 roadmap. For each grade include:
- grade, focus, key_milestone
- 4-6 school_courses tailored to this track
- clubs: REAL named clubs/teams at their school or nationally recognized ones (e.g. Math League, Robotics, Model UN, DECA, Science Olympiad, Debate)
- extracurriculars: ELITE, named programs and competitions (e.g. AMC 10/12, AIME, Science Olympiad, MATHCOUNTS, DECA, Model UN, FIRST Robotics, hackathons, Regeneron ISEF, Siemens Competition, National History Bowl, journalism competitions, art portfolio programs). Match to the student's interests.
- online_courses: REAL named courses from Coursera, edX, MIT OpenCourseWare, Stanford Online, Khan Academy, or similar. Include provider name and course title.
- volunteer_opportunities: Specific named volunteer programs, tutoring orgs, community orgs relevant to career track (e.g. Code.org, tutoring centers, hospital volunteering, environmental orgs)
- summer_activities: ELITE named summer programs with real program names — research internships, pre-college programs (e.g. RSI, PRIMES, COSMOS, iD Tech, Yale Young Global Scholars, Wharton Leadership), summer jobs, and spring/summer/winter INTERNSHIPS when the student is in 10th grade or above. Always suggest at least 1 internship opportunity per grade for 10th grade and up.

Prioritize highly prestigious, competitive, and elite programs. Be SPECIFIC with real program names — never generic descriptions. Tailor everything tightly to this student's unique interests, strengths, and dream careers.`;

      try {
        const data = await invokeLLM({ prompt, schema: { type: 'object', properties: { track: trackSchema } } });
        if (!data?.track) return null;
        const track = data.track;
        return {
          ...track,
          grades: (track.grades || []).map((g: any) => ({
            ...g,
            school_courses: (g.school_courses || []).length > 0 ? g.school_courses : allCourses.slice(0, 6),
          })),
        };
      } catch (err) {
        console.error(`[TRACK_${i}] Error:`, (err as Error).message);
        return null;
      }
    });

    const results = await Promise.allSettled(trackPromises);
    const valid = results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);

    const { data: plans } = await supabaseAdmin
      .from('career_plans').select('*').eq('user_email', profile.user_email).limit(1);
    const plan = plans?.[0];

    if (valid.length === 0) {
      if (plan) await supabaseAdmin.from('career_plans').update({ is_generating: false }).eq('id', plan.id);
      return;
    }

    if (plan) {
      await supabaseAdmin.from('career_plans').update({
        career_tracks: valid, school_info, is_generating: false,
      }).eq('id', plan.id);
    }

    const month = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseAdmin
      .from('usage_credits').select('*').eq('user_email', profile.user_email).eq('month', month).limit(1);
    const record = usage?.[0];
    const newTotal = (record?.total_cost || 0) + PLAN_COST;
    if (record) {
      await supabaseAdmin.from('usage_credits').update({ total_cost: newTotal, blocked: newTotal >= 5.0 }).eq('id', record.id);
    } else {
      await supabaseAdmin.from('usage_credits').insert({ user_email: profile.user_email, month, total_cost: newTotal, blocked: newTotal >= 5.0 });
    }
  } catch (err) {
    console.error('[GENERATE_TRACKS] Fatal error:', (err as Error).message);
  }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: allSettings = [] } = await supabaseAdmin.from('app_settings').select('*');
    const monthlyLimitEnabled = allSettings.find((s) => s.key === 'monthly_limit_enabled')?.value !== 'false';

    if (monthlyLimitEnabled) {
      const month = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabaseAdmin
        .from('usage_credits').select('*').eq('user_email', user.email).eq('month', month).limit(1);
      const record = usage?.[0];
      if (record && (record.blocked || record.total_cost >= 5.0)) {
        return jsonResponse({ error: 'USAGE_CAP_REACHED' }, 429);
      }
    }

    const { profile, journey } = await req.json();

    const { data: existing } = await supabaseAdmin
      .from('career_plans').select('*').eq('user_email', user.email).limit(1);
    if (existing?.[0]) {
      await supabaseAdmin.from('career_plans').update({ is_generating: true }).eq('id', existing[0].id);
    } else {
      await supabaseAdmin.from('career_plans').insert({ user_email: user.email, is_generating: true });
    }

    const profileWithEmail = { ...profile, user_email: user.email };
    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';

    const { data: existingCacheRows } = await supabaseAdmin
      .from('school_document_cache').select('*').eq('school_name', schoolName).eq('zipcode', profile.zipcode).limit(1);
    const cache = existingCacheRows?.[0];
    const cacheValid = cache?.expires_at && new Date(cache.expires_at) > new Date();

    let middle: any[] = [];
    let high: any[] = [];

    if (cacheValid && cache?.cached_data?.middle_courses) {
      middle = cache.cached_data.middle_courses || [];
      high = cache.cached_data.high_courses || [];
    } else {
      const courseSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            level: { type: 'string' },
            subject_area: { type: 'string' },
            grade_levels: { type: 'array', items: { type: 'number' } },
            required_or_elective: { type: 'string' },
          },
        },
      };
      const documentUrls = cache?.document_urls || {};
      const catalogUrl = documentUrls.course_catalog;
      const schoolWebsite = documentUrls.school_website;
      const promptBase = `Extract all courses from "${schoolName}"'s course catalog for ${profile.city || profile.zipcode}. Include: name, level (Standard/Honors/AP/IB/Dual Enrollment), subject_area, grade_levels array, required_or_elective. Return { middle_courses: [...], high_courses: [...] }. Aim for 25+ courses per level.`;

      const schema = { type: 'object', properties: { middle_courses: courseSchema, high_courses: courseSchema } };
      let result: any = null;

      if (catalogUrl) {
        result = await invokeLLM({ prompt: `${promptBase}\n\nOfficial course catalog: ${catalogUrl}`, schema, fileUrls: [catalogUrl] });
      } else if (schoolWebsite) {
        result = await invokeLLM({ prompt: `${promptBase}\n\nSchool website: ${schoolWebsite} — search this site for the course catalog.`, schema, webSearch: true });
      } else {
        result = await invokeLLM({ prompt: `Find course catalog for "${schoolName}" in ${profile.city || profile.zipcode}. ${promptBase}`, schema, webSearch: true });
      }

      middle = result?.middle_courses || [];
      high = result?.high_courses || [];

      if (middle.length === 0 && high.length === 0) {
        middle = [
          { name: 'English 7', subject_area: 'English', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
          { name: 'Math 7', subject_area: 'Math', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
        ];
        high = [
          { name: 'English 9', subject_area: 'English', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
          { name: 'Algebra II', subject_area: 'Math', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
        ];
      }

      const cacheData = {
        school_name: schoolName,
        zipcode: profile.zipcode,
        cached_data: { school_name: schoolName, school_website: documentUrls.school_website || '', middle_courses: middle, high_courses: high },
        cached_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
      if (cache) {
        await supabaseAdmin.from('school_document_cache').update(cacheData).eq('id', cache.id);
      } else {
        await supabaseAdmin.from('school_document_cache').insert(cacheData);
      }
    }

    const backgroundWork = generateTracks(profileWithEmail, journey, middle, high, schoolName);
    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(backgroundWork);
    } else {
      backgroundWork.catch((err) => console.error('background generateTracks error:', err.message));
    }

    return jsonResponse({ status: 'generating' });
  } catch (error) {
    console.error('generateAcademicPlan error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
