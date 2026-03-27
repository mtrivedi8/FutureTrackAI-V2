import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, regenerateTrackIndex = null) {
  const gradeRange = Array.from({ length: 13 - profile.current_grade }, (_, i) => profile.current_grade + i).join(', ');
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
      grades: { type: 'array', items: { type: 'object' } }
    }
  };

  const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'your school';
  const studentBase = `Student: ${profile.display_name}, age ${profile.age}, grade ${profile.current_grade}. Interests: ${(profile.interests || []).join(', ')}. Strengths: ${(profile.strengths || []).join(', ')}. Dream Careers: ${(profile.dream_careers || []).join(', ')}. School: ${schoolName}${profile.city ? ', ' + profile.city : ''}.`;

  const trackHints = [
    `most aligned with dream careers: ${(profile.dream_careers || []).slice(0, 2).join(', ') || 'technology'}`,
    `alternative creative/business/arts path`,
    `wildcard emerging field combining interests unexpectedly`,
  ];

  // Get existing plan to preserve other tracks if regenerating a specific one
  const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  const existingTracks = existingPlan[0]?.career_tracks || [];
  const tracks = regenerateTrackIndex !== null ? [...existingTracks] : [];

  // Generate all tracks in parallel
  const tracksToGenerate = regenerateTrackIndex !== null ? [regenerateTrackIndex] : [0, 1, 2];
  
  const trackPromises = tracksToGenerate.map(async (i) => {
    const trackData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Career track ${i + 1} (${trackHints[i]}) for ${profile.display_name}. Grades ${gradeRange}. For each grade: focus (1 sentence), key_milestone, clubs (2), special_programs (1-2), online_courses (1), extracurriculars (2), volunteer_opportunities (1), summer_activities (1). Return under key "track".`,
      model: 'gpt_5_mini',
      response_json_schema: { type: 'object', properties: { track: trackSchema } }
    }).catch(err => { console.error(`Track ${i + 1} failed:`, err.message); return null; });

    if (!trackData || !trackData.track) return null;
    
    const track = trackData.track;

    // Build per-grade course pools: use grade_levels if present, else smart fallback
    const middleCourses = schoolMiddleResult.courses || [];
    const highCourses = schoolHighResult.courses || [];

    const getCoursesForGrade = (gradeNum) => {
      const pool = gradeNum <= 8 ? middleCourses : highCourses;
      const matched = pool.filter(c => {
        if (Array.isArray(c.grade_levels) && c.grade_levels.length > 0) {
          return c.grade_levels.includes(gradeNum);
        }
        // Fallback: level-based heuristic
        const lvl = (c.level || '').toLowerCase();
        const isAP = lvl.includes('ap') || lvl.includes('ib') || lvl.includes('dual');
        const isHonors = lvl.includes('honors');
        if (isAP) return gradeNum >= 11;
        if (isHonors) return gradeNum >= 10;
        return true;
      });

      // Group by subject_area, keep up to 2 per subject for variety
      const bySubject = {};
      matched.forEach(c => {
        const subj = c.subject_area || 'Other';
        if (!bySubject[subj]) bySubject[subj] = [];
        bySubject[subj].push(c);
      });

      // Flatten: take up to 2 per subject, sort subjects alphabetically
      const grouped = [];
      Object.keys(bySubject).sort().forEach(subj => {
        bySubject[subj].slice(0, 2).forEach(c => grouped.push({ ...c, recommended_for_track: false }));
      });
      return grouped;
    };

    const enhancedTrack = {
      ...track,
      grades: (track.grades || []).map(g => {
        const gradeNum = Number(g.grade);
        const gradeCourses = getCoursesForGrade(gradeNum);
        return { ...g, school_courses: gradeCourses };
      })
    };

    return { index: i, track: enhancedTrack };
  });

  // Wait for all track generations in parallel
  const results = await Promise.all(trackPromises);
  
  // Save all tracks at once
  results.forEach(result => {
    if (result) tracks[result.index] = result.track;
  });

  const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  const planData = {
    user_email: profile.user_email,
    career_tracks: tracks,
    selected_track_index: existing[0]?.selected_track_index || 0,
    school_name: profile.school_name,
    current_grade: profile.current_grade,
    school_info,
    is_generating: true,
  };
  if (existing[0]) {
    await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, planData);
  } else {
    await base44.asServiceRole.entities.CareerPlan.create(planData);
  }
  console.log(`All tracks generated in parallel for ${profile.user_email}`);

  // Mark generation complete
  const existing2 = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  if (existing2[0]) {
    await base44.asServiceRole.entities.CareerPlan.update(existing2[0].id, { is_generating: false });
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

  console.log(`Plan generation complete for ${profile.user_email}: ${tracks.length} tracks, ${allCourses.length} courses`);
}

async function runGeneration(base44, profile, journey, existingSchoolWebsite = null) {
  try {
    // Check cache first
    const schoolNameForCache = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({
      school_name: schoolNameForCache,
      zipcode: profile.zipcode
    });
    const cache = existingCache[0];
    const now = new Date();
    const cacheValid = cache && new Date(cache.expires_at) > now;

    const cachedMiddle = cache?.cached_data?.middle_courses || [];
    const cachedHigh = cache?.cached_data?.high_courses || [];
    const cacheHasCourses = cachedMiddle.length > 0 || cachedHigh.length > 0;

    if (cacheValid && cache.cached_data && cacheHasCourses) {
      console.log(`Using cached data for ${profile.school_name} (${profile.zipcode})`);
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
      const regenerateIndex = journey?.regenerate_track_index;
      await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, regenerateIndex);
      return;
    }

    if (cacheValid && cache.cached_data && !cacheHasCourses) {
      console.log(`Cache exists but has no courses for ${schoolNameForCache} — falling back to LLM fetch`);
    }

    // Cache miss or expired — fetch fresh data
    console.log(`Cache miss/expired for ${profile.school_name} (${profile.zipcode}) — fetching fresh data`);
    
    const courseSchema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          credits: { type: 'string' },
          level: { type: 'string', description: 'e.g. Standard, Honors, AP, IB, Dual Enrollment' },
          subject_area: { type: 'string', description: 'e.g. English, Math, Science, Social Studies, Art, PE, Elective' },
          grade_levels: { type: 'array', items: { type: 'number' }, description: 'Specific grade levels this course is offered for, e.g. [9,10] or [11,12] or [7,8]' },
          required_or_elective: { type: 'string' },
          prerequisites: { type: 'string' }
        }
      }
    };

    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'Unknown School';
    const schoolResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: 'Get the full course catalog for "' + schoolName + '"' + (profile.zipcode ? ' zip ' + profile.zipcode : '') + '. For EACH course include: name, credits, level (Standard/Honors/AP/IB/Dual Enrollment), subject_area (English/Math/Science/Social Studies/World Language/Arts/PE/Elective/CTE), and grade_levels as an array of specific grade numbers this course is available for (e.g. [9,10] or [11,12]). Separate into middle_courses (grades 7-8) and high_courses (grades 9-12). Also extract graduation_requirements, school_website URL, catalog_url, enrollment_process.',
      add_context_from_internet: true,
      model: 'gemini_3_flash',
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
    }).catch(() => ({ middle_courses: [], high_courses: [] }));
    
    const schoolMiddleResult = { 
      ...schoolResult,
      courses: schoolResult.middle_courses || []
    };
    const schoolHighResult = {
      courses: schoolResult.high_courses || []
    };

    // Save to cache for future use
    const cacheData = {
      school_name: profile.middle_school_name || profile.high_school_name || profile.school_name || 'school',
      zipcode: profile.zipcode,
      cached_data: {
        school_name: schoolMiddleResult.school_name || profile.middle_school_name || profile.high_school_name || profile.school_name || 'Your School',
        school_website: existingSchoolWebsite || schoolMiddleResult.school_website,
        catalog_url: schoolMiddleResult.catalog_url,
        district_name: schoolMiddleResult.district_name,
        graduation_requirements: schoolMiddleResult.graduation_requirements,
        enrollment_process: schoolMiddleResult.enrollment_process,
        middle_courses: schoolMiddleResult.courses || [],
        high_courses: schoolHighResult.courses || [],
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

    console.log(`Cached ${schoolMiddleResult.courses?.length || 0} middle + ${schoolHighResult.courses?.length || 0} high school courses`);
    const regenerateIndex = journey?.regenerate_track_index;
    await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, regenerateIndex);

  } catch (err) {
    console.error('Background generation error:', err.message, err.stack);
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
    console.error('generateAcademicPlan error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});