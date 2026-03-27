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
  const studentBase = `Student: ${profile.display_name}, age ${profile.age}, grade ${profile.current_grade}. Interests: ${(profile.interests || []).join(', ')}. Strengths: ${(profile.strengths || []).join(', ')}. Dream Careers: ${(profile.dream_careers || []).join(', ')}. Goals: ${(profile.goals || []).join(', ')}.`;

  const allCoursesSummary = allCourses.slice(0, 40).map(c => `${c.name} (${c.subject_area}, ${c.level})`).join(', ');

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
    console.log(`[TRACK_${i + 1}] Starting generation...`);
    
    const trackPrompt = `You are a career counselor. Create ONE career track for a student.\n\nStudent: ${studentBase}\nHint: ${trackHints[i]}\n\nAvailable Courses (sample): ${allCoursesSummary}\n\nCreate a grade-by-grade roadmap (grades ${profile.current_grade}-12). For EACH grade provide: name, description, college_goals, and grades array with: grade number, focus, key_milestone, 4-6 school_courses (with name, subject_area, level), 2-3 clubs, 2-3 extracurriculars, online_courses, volunteer_opportunities, summer_activities.`;

    const llmSchema = {
      type: 'object',
      properties: { track: trackSchema }
    };

    try {
      console.log(`[TRACK_${i + 1}] Calling gpt_5_mini...`);
      let trackData = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: trackPrompt,
        model: 'gpt_5_mini',
        response_json_schema: llmSchema
      });

      if (!trackData || !trackData.track) {
        console.log(`[TRACK_${i + 1}] gpt_5_mini returned empty, trying claude_sonnet_4_6...`);
        trackData = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: trackPrompt,
          model: 'claude_sonnet_4_6',
          response_json_schema: llmSchema
        });
      }

      if (!trackData || !trackData.track) {
        console.error(`[TRACK_${i + 1}] Both LLMs returned empty`);
        return null;
      }
      
      console.log(`[TRACK_${i + 1}] Generated successfully`);
      const track = trackData.track;

      const courseByName = {};
      allCourses.forEach(c => { courseByName[c.name?.toLowerCase()] = c; });

      const fallbackCoursesForGrade = (gradeNum) => {
        const pool = gradeNum <= 8 ? (schoolMiddleResult.courses || []) : (schoolMiddleResult.courses || []);
        return pool.slice(0, 6).map(c => ({ name: c.name, subject_area: c.subject_area, level: c.level, recommended_for_track: false }));
      };

      const enhancedTrack = {
        ...track,
        grades: (track.grades || []).map(g => {
          const gradeNum = Number(g.grade);
          let gradeCourses = Array.isArray(g.school_courses) && g.school_courses.length > 0 ? g.school_courses : fallbackCoursesForGrade(gradeNum);
          return { ...g, school_courses: gradeCourses };
        })
      };

      return { index: i, track: enhancedTrack };
    } catch (err) {
      console.error(`[TRACK_${i + 1}] Error:`, err.message);
      return null;
    }
  });

  const results = await Promise.all(trackPromises);
  results.forEach(result => { if (result) tracks[result.index] = result.track; });

  const validTracks = tracks.filter(Boolean);
  console.log(`Generated ${validTracks.length} valid tracks`);

  if (validTracks.length === 0) {
    console.error('All track generations failed');
    const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    if (existingPlan[0]) await base44.asServiceRole.entities.CareerPlan.update(existingPlan[0].id, { is_generating: false });
    return;
  }

  const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  if (existing[0]) {
    await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { 
      career_tracks: validTracks,
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

  console.log(`Plan generation complete for ${profile.user_email}`);
}

async function runGeneration(base44, profile, journey, existingSchoolWebsite = null) {
  try {
    console.log('=== PLAN GENERATION START ===');
    console.log('Profile:', profile.display_name, 'School:', profile.high_school_name, 'Grade:', profile.current_grade);
    
    const schoolNameForCache = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ school_name: schoolNameForCache, zipcode: profile.zipcode });
    const cache = existingCache[0];
    const cacheValid = cache && new Date(cache.expires_at) > new Date();

    const cachedMiddle = cache?.cached_data?.middle_courses || [];
    const cachedHigh = cache?.cached_data?.high_courses || [];

    if (cacheValid && cachedMiddle.length > 0 || cachedHigh.length > 0) {
      console.log(`Using cached courses for ${schoolNameForCache}`);
      const schoolMiddleResult = { 
        courses: cachedMiddle,
        school_name: cache.cached_data.school_name,
        school_website: cache.cached_data.school_website,
        catalog_url: cache.cached_data.catalog_url,
        district_name: cache.cached_data.district_name,
      };
      const schoolHighResult = { courses: cachedHigh };
      await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, null, false);
      return;
    }

    console.log(`Cache miss/expired - fetching fresh courses for ${schoolNameForCache}`);
    
    const courseSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: { type: 'string' },
          subject_area: { type: 'string' },
          grade_levels: { type: 'array', items: { type: 'number' } },
          required_or_elective: { type: 'string' }
        }
      }
    };

    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'Unknown School';
    
    console.log(`Fetching courses for ${schoolName}...`);
    const schoolResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find the course catalog for "${schoolName}" in ${profile.city || profile.zipcode}. Extract courses with: name, level (Standard/Honors/AP/IB), subject_area, grade_levels (array of grade numbers), required_or_elective. Return as: { middle_courses: [...], high_courses: [...] }. Aim for 20+ courses per level.`,
      add_context_from_internet: true,
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          middle_courses: courseSchema,
          high_courses: courseSchema
        }
      }
    }).catch(err => {
      console.error('LLM course fetch failed:', err.message);
      return { middle_courses: [], high_courses: [] };
    });
    
    let middleCourses = schoolResult.middle_courses || [];
    let highCourses = schoolResult.high_courses || [];

    if (middleCourses.length === 0 && highCourses.length === 0) {
      console.log('No courses found - using generic US school courses');
      middleCourses = [
        { name: 'English 7', subject_area: 'English', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
        { name: 'Math 7', subject_area: 'Math', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
        { name: 'Science 7', subject_area: 'Science', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
      ];
      highCourses = [
        { name: 'English 9', subject_area: 'English', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
        { name: 'Algebra II', subject_area: 'Math', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
        { name: 'Biology', subject_area: 'Science', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
        { name: 'AP Computer Science', subject_area: 'Computer Science', level: 'AP', grade_levels: [10, 11, 12], required_or_elective: 'Elective' },
      ];
    }

    const schoolMiddleResult = { courses: middleCourses, school_name: schoolName };
    const schoolHighResult = { courses: highCourses };

    console.log(`Got ${middleCourses.length} middle + ${highCourses.length} high courses`);
    await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, null, false);

  } catch (err) {
    console.error('Generation error:', err.message, err.stack);
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
      EdgeRuntime.waitUntil(runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite));
    } else {
      runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite);
    }

    return Response.json({ status: 'generating' });

  } catch (error) {
    console.error('generateAcademicPlan error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});