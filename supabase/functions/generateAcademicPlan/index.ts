import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { logEvent } from '../_shared/log.ts';
import { discoverSchoolDocuments } from '../_shared/schoolDocs.ts';

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

/** Canonical form for matching school names that differ only in casing/hyphenation/whitespace. */
function normalizeSchoolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Orders courses so ones relevant to the student's actual grade come first, before any top-N truncation. */
function prioritizeCoursesForGrade(middle: any[], high: any[], grade: number) {
  const isMiddleGrade = grade <= 8;
  const primary = isMiddleGrade ? middle : high;
  const secondary = isMiddleGrade ? high : middle;
  const byGradeMatch = (list: any[]) =>
    [...list].sort((a, b) => {
      const aMatch = (a.grade_levels || []).includes(grade) ? 0 : 1;
      const bMatch = (b.grade_levels || []).includes(grade) ? 0 : 1;
      return aMatch - bMatch;
    });
  return [...byGradeMatch(primary), ...byGradeMatch(secondary)];
}

async function fetchCourseCatalog(rawSchoolName: string, profile: any, grade: number) {
  const schoolName = normalizeSchoolName(rawSchoolName);
  const { data: existingCacheRows } = await supabaseAdmin
    .from('school_document_cache').select('*').eq('school_name', schoolName).eq('zipcode', profile.zipcode).limit(1);
  const cache = existingCacheRows?.[0];
  const cacheValid = cache?.expires_at && new Date(cache.expires_at) > new Date();

  if (cacheValid && cache?.cached_data?.middle_courses) {
    return {
      middle: cache.cached_data.middle_courses || [],
      high: cache.cached_data.high_courses || [],
      documentUrls: cache.document_urls || {},
    };
  }

  // Find the school's real course catalog/website first, so we scan an
  // actual document instead of guessing from general knowledge. Web-search
  // LLM calls have proven unreliable in practice (silent failures with no
  // error, seemingly regardless of effort/search-budget tuning) - guard
  // every one with a hard timeout so a flaky search can never leave the
  // whole plan generation hanging with is_generating stuck true.
  const withTimeout = async <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
      ]);
    } catch {
      return fallback;
    }
  };

  const { documentUrls } = await withTimeout(
    discoverSchoolDocuments({ schoolName, zipcode: profile.zipcode, city: profile.city, source: 'generateAcademicPlan' }),
    45000,
    { cacheId: null, documentUrls: {}, fromCache: false }
  );

  const promptBase = `Extract all courses from "${schoolName}"'s course catalog for ${profile.city || profile.zipcode}. Include: name, level (Standard/Honors/AP/IB/Dual Enrollment), subject_area, grade_levels array, required_or_elective. Return { middle_courses: [...], high_courses: [...] }. Aim for 25+ courses per level. Be quick and direct.`;
  const schema = { type: 'object', properties: { middle_courses: courseSchema, high_courses: courseSchema } };

  let result: any = null;
  if (documentUrls.course_catalog) {
    result = await withTimeout(
      invokeLLM({
        source: 'generateAcademicPlan',
        prompt: `${promptBase}\n\nOfficial course catalog to scan: ${documentUrls.course_catalog}`,
        schema, fileUrls: [documentUrls.course_catalog], effort: 'medium', maxTokens: 5000,
      }),
      45000, null
    );
  } else if (documentUrls.school_website) {
    result = await withTimeout(
      invokeLLM({
        source: 'generateAcademicPlan',
        prompt: `${promptBase}\n\nSchool website: ${documentUrls.school_website} — search this site for the course catalog.`,
        schema, webSearch: true, maxUses: 3, effort: 'low', maxTokens: 4000,
      }),
      45000, null
    );
  } else {
    // No document/website discovered (or discovery timed out) - fall back
    // to the model's own knowledge rather than another web search, since
    // that path is what has proven reliable elsewhere in this app.
    result = await invokeLLM({
      source: 'generateAcademicPlan',
      prompt: `${promptBase}\n\nUse your knowledge of typical course offerings for a school like "${schoolName}" in ${profile.city || profile.zipcode}. This student is in grade ${grade}, so it is CRITICAL that ${grade <= 8 ? 'middle_courses (grades 6-8)' : 'high_courses (grades 9-12)'} is fully populated with 15+ real, grade-appropriate course names - do not leave it empty or thin even if you spend less effort on the other band.`,
      schema, effort: 'medium', maxTokens: 6000,
    });
  }

  let middle = result?.middle_courses || [];
  let high = result?.high_courses || [];

  // The band the roadmap is actually being built for (grades 9-12 use high
  // school courses, grades 7-8 use middle school courses) must never come
  // back empty - if it did, the roadmap would be forced to pull from the
  // wrong band entirely (seen in practice: a 9th grader's plan filled with
  // "Physical Science 8" because high_courses came back empty while
  // middle_courses was fully populated).
  const isHighSchoolGrade = grade >= 9;
  const relevantBandEmpty = isHighSchoolGrade ? high.length === 0 : middle.length === 0;

  if (relevantBandEmpty) {
    await logEvent('generateAcademicPlan', 'warn', `Course catalog fetch returned no ${isHighSchoolGrade ? 'high school' : 'middle school'} courses for "${schoolName}" (grade ${grade}) - using generic fallback for that band`, { documentUrls, middleCount: middle.length, highCount: high.length }, profile.user_email);
    const fallbackHigh = [
      { name: 'English 9', subject_area: 'English', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
      { name: 'English 10', subject_area: 'English', level: 'Standard', grade_levels: [10], required_or_elective: 'Required' },
      { name: 'Algebra I', subject_area: 'Math', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
      { name: 'Algebra II', subject_area: 'Math', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
      { name: 'Geometry', subject_area: 'Math', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
      { name: 'Biology', subject_area: 'Science', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
      { name: 'Chemistry', subject_area: 'Science', level: 'Standard', grade_levels: [10, 11], required_or_elective: 'Required' },
      { name: 'World History', subject_area: 'Social Studies', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
      { name: 'Introduction to Computer Science', subject_area: 'Technology', level: 'Standard', grade_levels: [9, 10, 11, 12], required_or_elective: 'Elective' },
    ];
    const fallbackMiddle = [
      { name: 'English 7', subject_area: 'English', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
      { name: 'English 8', subject_area: 'English', level: 'Standard', grade_levels: [8], required_or_elective: 'Required' },
      { name: 'Math 7', subject_area: 'Math', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
      { name: 'Pre-Algebra', subject_area: 'Math', level: 'Standard', grade_levels: [7, 8], required_or_elective: 'Required' },
      { name: 'Life Science', subject_area: 'Science', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
      { name: 'Physical Science', subject_area: 'Science', level: 'Standard', grade_levels: [8], required_or_elective: 'Required' },
    ];
    if (isHighSchoolGrade) high = fallbackHigh; else middle = fallbackMiddle;
  }

  const cacheData = {
    school_name: schoolName,
    zipcode: profile.zipcode,
    document_urls: documentUrls,
    cached_data: { school_name: schoolName, middle_courses: middle, high_courses: high },
    cached_date: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  if (cache) {
    await supabaseAdmin.from('school_document_cache').update(cacheData).eq('id', cache.id);
  } else {
    await supabaseAdmin.from('school_document_cache').insert(cacheData);
  }

  return { middle, high, documentUrls };
}

async function generateTracks(profile: any, journey: any, orderedCourses: any[], schoolName: string, documentUrls: Record<string, string>, totalCoursesFound: number) {
  try {
    const school_info = {
      school_name: schoolName || profile.high_school_name || 'Your School',
      courses_found: totalCoursesFound,
      school_website: documentUrls.school_website || null,
      catalog_url: documentUrls.course_catalog || null,
      graduation_requirements_url: documentUrls.graduation_requirements || null,
    };

    let freshProfile = profile;
    const { data: latestProfiles } = await supabaseAdmin
      .from('teen_profiles').select('*').eq('user_email', profile.user_email).limit(1);
    if (latestProfiles?.[0]) freshProfile = { ...profile, ...latestProfiles[0] };

    const grade = freshProfile.current_grade || 9;

    const journeyParts = [
      (journey.completed_courses || []).length ? `Courses already taken: ${journey.completed_courses.join(', ')}` : '',
      (journey.completed_activities || []).length ? `Activities/internships done: ${journey.completed_activities.join(', ')}` : '',
      (journey.completed_recommendations || []).length ? `Completed suggestions: ${journey.completed_recommendations.join(', ')}` : '',
      (journey.skills_gained || []).length ? `Skills gained: ${journey.skills_gained.join(', ')}` : '',
    ].filter(Boolean);
    const journeyContext = journeyParts.length ? ' Journey so far — ' + journeyParts.join('. ') + '.' : '';

    const studentBase = `Student: ${freshProfile.display_name}, age ${freshProfile.age}, grade ${grade}. Interests: ${(freshProfile.interests || []).join(', ')}. Strengths: ${(freshProfile.strengths || []).join(', ')}. Goals: ${(freshProfile.goals || []).join(', ')}. Dream Careers: ${(freshProfile.dream_careers || []).join(', ')}.${journeyContext}`;
    const coursesForPrompt = orderedCourses.slice(0, 40);
    const allCoursesSummary = coursesForPrompt
      .map((c) => `${c.name} (${c.subject_area}${c.grade_levels?.length ? `, grades ${c.grade_levels.join('/')}` : ''})`)
      .join(', ');

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

name: a professional career-track title describing the FIELD, 2-6 words (e.g. "Astrophysics & Data Science Track", "Business & Entrepreneurship Track"). Never use the student's own name (${freshProfile.display_name}) as the track name.

This school's actual course catalog (name (subject, grades it's offered in)): ${allCoursesSummary || 'Not available - use realistic standard/honors/AP course names for this grade band.'}

Build grades ${grade}-12 roadmap. For each grade year, ONLY select school_courses from the catalog above whose grade_levels include (or are the closest available to) that specific grade - never assign a grade 11 physics elective to a 9th grader. If the catalog has no course for a subject area at that grade, choose the closest earlier prerequisite from the catalog instead of inventing one. For each grade include:
- grade, focus, key_milestone
- 4-6 school_courses tailored to this track AND actually offered at that grade per the catalog
- clubs: REAL named clubs/teams at their school or nationally recognized ones (e.g. Math League, Robotics, Model UN, DECA, Science Olympiad, Debate)
- extracurriculars: ELITE, named programs and competitions (e.g. AMC 10/12, AIME, Science Olympiad, MATHCOUNTS, DECA, Model UN, FIRST Robotics, hackathons, Regeneron ISEF, Siemens Competition, National History Bowl, journalism competitions, art portfolio programs). Match to the student's interests.
- online_courses: REAL named courses from Coursera, edX, MIT OpenCourseWare, Stanford Online, Khan Academy, or similar. Include provider name and course title.
- volunteer_opportunities: Specific named volunteer programs, tutoring orgs, community orgs relevant to career track (e.g. Code.org, tutoring centers, hospital volunteering, environmental orgs)
- summer_activities: ELITE named summer programs with real program names — research internships, pre-college programs (e.g. RSI, PRIMES, COSMOS, iD Tech, Yale Young Global Scholars, Wharton Leadership), summer jobs, and spring/summer/winter INTERNSHIPS when the student is in 10th grade or above. Always suggest at least 1 internship opportunity per grade for 10th grade and up.

Prioritize highly prestigious, competitive, and elite programs. Be SPECIFIC with real program names — never generic descriptions. Tailor everything tightly to this student's unique interests, strengths, and dream careers.`;

      try {
        const data = await invokeLLM({ source: 'generateAcademicPlan', prompt, schema: { type: 'object', properties: { track: trackSchema } }, effort: 'medium', maxTokens: 6000 });
        if (!data?.track) return null;
        const track = data.track;
        // Defensive fallback in case the model names the track after the
        // student despite the instruction not to (seen in practice).
        const isNamedAfterStudent = track.name && freshProfile.display_name &&
          track.name.trim().toLowerCase() === freshProfile.display_name.trim().toLowerCase();
        return {
          ...track,
          name: isNamedAfterStudent ? `${trackHints[i]} Track` : track.name,
          grades: (track.grades || []).map((g: any) => {
            const gradeMatched = coursesForPrompt.filter((c) => (c.grade_levels || []).includes(g.grade));
            return {
              ...g,
              school_courses: (g.school_courses || []).length > 0 ? g.school_courses : gradeMatched.slice(0, 6),
            };
          }),
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
      await logEvent('generateAcademicPlan', 'error', 'All 3 track generations produced no track', {
        results: results.map((r) => (r.status === 'rejected' ? { status: r.status, reason: String(r.reason?.message ?? r.reason) } : { status: r.status, value: r.value })),
      }, profile.user_email);
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
    await logEvent('generateAcademicPlan', 'error', 'generateTracks fatal error', {
      message: (err as Error)?.message, stack: (err as Error)?.stack,
    }, profile.user_email);
  }
}

async function runPlanGeneration(profile: any, journey: any) {
  const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
  const grade = profile.current_grade || 9;

  try {
    const { middle, high, documentUrls } = await fetchCourseCatalog(schoolName, profile, grade);
    const orderedCourses = prioritizeCoursesForGrade(middle, high, grade);
    await generateTracks(profile, journey, orderedCourses, schoolName, documentUrls, middle.length + high.length);
  } catch (err) {
    console.error('runPlanGeneration error:', (err as Error).message);
    await logEvent('generateAcademicPlan', 'error', 'runPlanGeneration fatal error', {
      message: (err as Error)?.message,
    }, profile.user_email);
    const { data: plans } = await supabaseAdmin
      .from('career_plans').select('*').eq('user_email', profile.user_email).limit(1);
    if (plans?.[0]) await supabaseAdmin.from('career_plans').update({ is_generating: false }).eq('id', plans[0].id);
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
    const profileWithEmail = { ...profile, user_email: user.email };

    const { data: existing } = await supabaseAdmin
      .from('career_plans').select('*').eq('user_email', user.email).limit(1);
    if (existing?.[0]) {
      await supabaseAdmin.from('career_plans').update({ is_generating: true }).eq('id', existing[0].id);
    } else {
      await supabaseAdmin.from('career_plans').insert({ user_email: user.email, is_generating: true });
    }

    // Document discovery + course-catalog scanning + track generation can
    // easily take well over a minute combined - run the whole thing in the
    // background rather than blocking this request.
    const work = runPlanGeneration(profileWithEmail, journey);
    try {
      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        EdgeRuntime.waitUntil(work);
      } else {
        work.catch((err) => console.error('background runPlanGeneration error:', err.message));
      }
    } catch (err) {
      await logEvent('generateAcademicPlan', 'warn', 'EdgeRuntime.waitUntil failed, background work may be cut short', {
        message: (err as Error)?.message,
      }, user.email);
    }

    return jsonResponse({ status: 'generating' });
  } catch (error) {
    console.error('generateAcademicPlan error:', (error as Error).message);
    await logEvent('generateAcademicPlan', 'error', 'Top-level request handler error', {
      message: (error as Error)?.message, stack: (error as Error)?.stack,
    });
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
