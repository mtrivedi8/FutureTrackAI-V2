import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, regenerateTrackIndex = null, debugLogging = false) {
  const allCourses = [...(schoolMiddleResult.courses || []), ...(schoolHighResult.courses || [])];
  const school_info = {
    school_name: schoolMiddleResult.school_name || profile.middle_school_name || profile.high_school_name || profile.school_name || 'Your School',
    school_website: schoolMiddleResult.school_website,
    catalog_url: schoolMiddleResult.catalog_url,
    district_name: schoolMiddleResult.district_name,
    courses_found: allCourses.length,
    graduation_requirements: schoolMiddleResult.graduation_requirements,
    enrollment_process: schoolMiddleResult.enrollment_process,
  };

  const trackSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      emoji: { type: 'string' },
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
            special_programs: { type: 'array', items: { type: 'string' } },
            online_courses: { type: 'array', items: { type: 'string' } },
            extracurriculars: { type: 'array', items: { type: 'string' } },
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
                  required_or_elective: { type: 'string' },
                  recommended_for_track: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  };

  const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'your school';
  const studentBase = `Student: ${profile.display_name}, age ${profile.age}, grade ${profile.current_grade}. Interests: ${(profile.interests || []).join(', ')}. Strengths: ${(profile.strengths || []).join(', ')}. Dream Careers: ${(profile.dream_careers || []).join(', ')}. Goals: ${(profile.goals || []).join(', ')}. School: ${schoolName}${profile.city ? ', ' + profile.city : ''}.`;

  const allCoursesSummary = allCourses.map(c => ({
    name: c.name,
    subject: c.subject_area,
    level: c.level,
    grades: c.grade_levels,
    elective: c.required_or_elective
  }));

  const trackHints = [
    `most aligned with dream careers: ${(profile.dream_careers || []).slice(0, 2).join(', ') || 'technology'}`,
    `alternative creative/business/arts path`,
    `wildcard emerging field combining interests unexpectedly`,
  ];

  const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  const existingTracks = existingPlan[0]?.career_tracks || [];
  const tracks = regenerateTrackIndex !== null ? [...existingTracks] : [];

  const tracksToGenerate = regenerateTrackIndex !== null ? [regenerateTrackIndex] : [0, 1, 2];
  
  const trackPromises = tracksToGenerate.map(async (i) => {
    if (debugLogging) console.log(`[TRACK_${i + 1}] Starting generation...`);
    
    const trackPrompt = `Create one career track for ${profile.display_name}.\n\nHint for track ${i + 1}: ${trackHints[i] || 'balanced path combining strengths'}\n\nStudent Profile:\n${studentBase}\n\nAvailable Courses:\n${allCoursesSummary.slice(0, 50).map(c => `- ${c.name} (${c.subject}, ${c.level}, grades ${c.grades?.join(',') || 'TBD'})`).join('\n')}\n\nCreate a realistic 4-year grade-by-grade roadmap (grades ${profile.current_grade}-12). For EACH grade include:\n- 4-6 school courses from the available list\n- 2-3 extracurriculars\n- 1-2 clubs\n- Volunteer opportunities\n- Online courses (Coursera, Khan Academy)\n- Summer activities\n- Key milestone for that year`;

    const llmSchema = {
      type: 'object',
      properties: { track: trackSchema }
    };

    let trackData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: trackPrompt,
      model: 'gpt_5_mini',
      response_json_schema: llmSchema
    }).catch(err => { if (debugLogging) console.error(`Track ${i + 1} gpt_5_mini failed:`, err.message); return null; });

    if (!trackData || !trackData.track) {
      if (debugLogging) console.log(`Track ${i + 1}: gpt_5_mini returned no data, retrying with claude_sonnet_4_6`);
      trackData = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: trackPrompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: llmSchema
      }).catch(err => { if (debugLogging) console.error(`Track ${i + 1} claude fallback failed:`, err.message); return null; });
    }

    if (!trackData || !trackData.track) {
      if (debugLogging) console.error(`[TRACK_${i + 1}] Both models failed, skipping`);
      return null;
    }
    if (debugLogging) console.log(`[TRACK_${i + 1}] Generated successfully`);
    const track = trackData.track;

    const middleCourses = schoolMiddleResult.courses || [];
    const highCourses = schoolHighResult.courses || [];
    const courseByName = {};
    allCourses.forEach(c => { courseByName[c.name?.toLowerCase()] = c; });

    const fallbackCoursesForGrade = (gradeNum) => {
      const pool = gradeNum <= 8 ? middleCourses : highCourses;
      const matched = pool.filter(c => {
        if (Array.isArray(c.grade_levels) && c.grade_levels.length > 0) return c.grade_levels.includes(gradeNum);
        const lvl = (c.level || '').toLowerCase();
        if (lvl.includes('ap') || lvl.includes('ib') || lvl.includes('dual')) return gradeNum >= 11;
        if (lvl.includes('honors')) return gradeNum >= 10;
        return true;
      });
      const bySubject = {};
      matched.forEach(c => { const s = c.subject_area || 'Other'; if (!bySubject[s]) bySubject[s] = []; bySubject[s].push(c); });
      const grouped = [];
      Object.keys(bySubject).sort().forEach(s => bySubject[s].slice(0, 2).forEach(c => grouped.push({ ...c, recommended_for_track: false })));
      return grouped;
    };

    const enhancedTrack = {
      ...track,
      grades: (track.grades || []).map(g => {
        const gradeNum = Number(g.grade);
        let gradeCourses = Array.isArray(g.school_courses) && g.school_courses.length > 0
          ? g.school_courses.map(c => {
              const catalogMatch = courseByName[c.name?.toLowerCase()];
              return catalogMatch ? { ...catalogMatch, recommended_for_track: c.recommended_for_track ?? false } : c;
            })
          : fallbackCoursesForGrade(gradeNum);
        return { ...g, school_courses: gradeCourses };
      })
    };

    return { index: i, track: enhancedTrack };
  });

  const results = await Promise.all(trackPromises);
  results.forEach(result => { if (result) tracks[result.index] = result.track; });

  const validTracks = tracks.filter(Boolean);
  if (debugLogging) console.log(`Generated ${validTracks.length} valid tracks`);

  if (validTracks.length === 0) {
    if (debugLogging) console.error('All track generations failed');
    const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    if (existingPlan[0]) await base44.asServiceRole.entities.CareerPlan.update(existingPlan[0].id, { is_generating: false });
    return;
  }

  const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  if (existing[0]) {
    await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { 
      career_tracks: tracks,
      school_info,
      is_generating: false
    });
  }

  const month = new Date().toISOString().slice(0, 7);
  const usageRecords = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: profile.user_email, month });
  const usageRecord = usageRecords[0];
  const newTotal = (usageRecord?.total_cost || 0) + PLAN_COST;
  const nowBlocked = newTotal >= 5.0;
  if (usageRecord) {
    await base44.asServiceRole.entities.UsageCredit.update(usageRecord.id, { total_cost: newTotal, blocked: nowBlocked });
  } else {
    await base44.asServiceRole.entities.UsageCredit.create({ user_email: profile.user_email, month, total_cost: newTotal, blocked: nowBlocked });
  }

  if (debugLogging) console.log(`Plan generation complete for ${profile.user_email}`);
}

async function runGeneration(base44, profile, journey, existingSchoolWebsite = null, debugLogging = false) {
  try {
    if (debugLogging) console.log('=== START GENERATION ===');
    
    const schoolNameForCache = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ school_name: schoolNameForCache, zipcode: profile.zipcode });
    const cache = existingCache[0];
    const now = new Date();
    const cacheValid = cache && new Date(cache.expires_at) > now;

    const cachedMiddle = cache?.cached_data?.middle_courses || [];
    const cachedHigh = cache?.cached_data?.high_courses || [];
    const cacheHasCourses = cachedMiddle.length > 0 || cachedHigh.length > 0;

    if (cacheValid && cache.cached_data && cacheHasCourses) {
      if (debugLogging) console.log(`Using cached data for ${schoolNameForCache}`);
      const schoolMiddleResult = { 
        courses: cachedMiddle,
        school_name: cache.cached_data.school_name,
        school_website: cache.cached_data.school_website,
        catalog_url: cache.cached_data.catalog_url,
        district_name: cache.cached_data.district_name,
        graduation_requirements: cache.cached_data.graduation_requirements,
        enrollment_process: cache.cached_data.enrollment_process,
      };
      const schoolHighResult = { courses: cachedHigh };
      await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, null, debugLogging);
      return;
    }

    if (debugLogging) console.log(`Fetching fresh course data for ${schoolNameForCache}`);
    
    const courseSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          credits: { type: 'string' },
          level: { type: 'string' },
          subject_area: { type: 'string' },
          grade_levels: { type: 'array', items: { type: 'number' } },
          required_or_elective: { type: 'string' },
          prerequisites: { type: 'string' }
        }
      }
    };

    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'Unknown School';
    const locationStr = [profile.zipcode, profile.city].filter(Boolean).join(' ');
    
    let schoolResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Search for the official course catalog for "${schoolName}" in ${locationStr}. Extract EVERY course with: name, credits, level (Standard/Honors/AP/IB/Dual Enrollment), subject_area, grade_levels (array), required_or_elective, prerequisites. Separate into middle_courses (grades 7-8) and high_courses (grades 9-12). Also extract: school_website URL, catalog_url, graduation_requirements, enrollment_process.`,
      add_context_from_internet: true,
      model: 'gemini_3_pro',
      response_json_schema: {
        type: 'object',
        properties: {
          school_name: { type: 'string' },
          school_website: { type: 'string' },
          catalog_url: { type: 'string' },
          district_name: { type: 'string' },
          graduation_requirements: { type: 'object' },
          enrollment_process: { type: 'object' },
          middle_courses: courseSchema,
          high_courses: courseSchema
        }
      }
    }).catch(err => {
      if (debugLogging) console.error('Gemini failed:', err.message);
      return { middle_courses: [], high_courses: [] };
    });
    
    let middleCourses = schoolResult.middle_courses || [];
    let highCourses = schoolResult.high_courses || [];

    if (middleCourses.length === 0 && highCourses.length === 0) {
      if (debugLogging) console.log(`No courses found - generating generic US school courses`);
      const fallback = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive typical US public school course catalog for grades 7-12 with 40+ courses. Include: English/Language Arts, Math (Pre-Algebra through Calculus), Science (Life Science, Earth Science, Biology, Chemistry, Physics), Social Studies (World History, US History, Government, Economics), World Languages, Arts, PE/Health, Computer Science, electives. For each: name, credits (0.5 or 1.0), level (Standard/Honors/AP), subject_area, grade_levels (array), required_or_elective, prerequisites. Separate into middle_courses (grades 7-8) and high_courses (grades 9-12).`,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            middle_courses: courseSchema,
            high_courses: courseSchema
          }
        }
      }).catch(err => { if (debugLogging) console.error('Fallback failed:', err.message); return { middle_courses: [], high_courses: [] }; });
      middleCourses = fallback.middle_courses || [];
      highCourses = fallback.high_courses || [];
    }

    const schoolMiddleResult = { 
      ...schoolResult,
      courses: middleCourses
    };
    const schoolHighResult = { courses: highCourses };

    const cacheData = {
      school_name: schoolNameForCache,
      zipcode: profile.zipcode,
      cached_data: {
        school_name: schoolMiddleResult.school_name || schoolName,
        school_website: existingSchoolWebsite || schoolMiddleResult.school_website,
        catalog_url: schoolMiddleResult.catalog_url,
        district_name: schoolMiddleResult.district_name,
        graduation_requirements: schoolMiddleResult.graduation_requirements,
        enrollment_process: schoolMiddleResult.enrollment_process,
        middle_courses: middleCourses,
        high_courses: highCourses,
      },
      document_urls: {
        school_website: existingSchoolWebsite || schoolMiddleResult.school_website,
        catalog_url: schoolMiddleResult.catalog_url,
      },
      cached_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (cache) {
      await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, cacheData);
    } else {
      await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
    }

    await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, null, debugLogging);

  } catch (err) {
    if (debugLogging) console.error('Generation error:', err.message);
    const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email }).catch(() => []);
    if (existing[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { is_generating: false }).catch(() => {});
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allSettings = await base44.asServiceRole.entities.AppSettings.filter({});
    const debugLogging = allSettings.find(s => s.key === 'debug_logging')?.value === 'true';
    const monthlyLimitEnabled = allSettings.find(s => s.key === 'monthly_limit_enabled') ? allSettings.find(s => s.key === 'monthly_limit_enabled').value !== 'false' : true;

    if (monthlyLimitEnabled) {
      const month = new Date().toISOString().slice(0, 7);
      const usageRecords = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: user.email, month });
      const usageRecord = usageRecords[0];
      if (usageRecord && (usageRecord.blocked || usageRecord.total_cost >= 5.0)) {
        return Response.json({ error: 'USAGE_CAP_REACHED' }, { status: 429 });
      }
    }

    const { profile, journey } = await req.json();

    const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: user.email });
    if (existing[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { is_generating: true });
    } else {
      await base44.asServiceRole.entities.CareerPlan.create({ user_email: user.email, is_generating: true });
    }

    const profileWithEmail = { ...profile, user_email: user.email };
    const existingSchoolWebsite = existing[0]?.school_info?.school_website || null;
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite, debugLogging));
    } else {
      runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite, debugLogging);
    }

    return Response.json({ status: 'generating' });

  } catch (error) {
    console.error('generateAcademicPlan error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});