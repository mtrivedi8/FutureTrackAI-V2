import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, regenerateTrackIndex = null) {
  const gradeRange = Array.from({ length: 13 - profile.current_grade }, (_, i) => profile.current_grade + i).join(', ');
  const allCourses = [...(schoolMiddleResult.courses || []), ...(schoolHighResult.courses || [])];
  const school_info = {
    school_name: schoolMiddleResult.school_name,
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

  const studentBase = `Student: ${profile.display_name}, age ${profile.age}, grade ${profile.current_grade}. Interests: ${(profile.interests || []).join(', ')}. Strengths: ${(profile.strengths || []).join(', ')}. Dream Careers: ${(profile.dream_careers || []).join(', ')}. School: ${profile.school_name}${profile.city ? ', ' + profile.city : ''}.`;

  const trackHints = [
    `most aligned with dream careers: ${(profile.dream_careers || []).slice(0, 2).join(', ') || 'technology'}`,
    `alternative creative/business/arts path`,
    `wildcard emerging field combining interests unexpectedly`,
  ];

  // Get existing plan to preserve other tracks if regenerating a specific one
  const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  const existingTracks = existingPlan[0]?.career_tracks || [];
  const tracks = regenerateTrackIndex !== null ? [...existingTracks] : [];

  // Generate and save tracks sequentially so they appear in UI as they complete
  const tracksToGenerate = regenerateTrackIndex !== null ? [regenerateTrackIndex] : [0, 1, 2];
  
  for (const i of tracksToGenerate) {
    const trackData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Career track ${i + 1} (${trackHints[i]}) for ${profile.display_name}. Grades ${gradeRange}. For each grade: focus (1 sentence), key_milestone, clubs (2), special_programs (1-2), online_courses (1), extracurriculars (2), volunteer_opportunities (1), summer_activities (1). Return under key "track".`,
      model: 'gpt_5_mini',
      response_json_schema: { type: 'object', properties: { track: trackSchema } }
    }).catch(err => { console.error(`Track ${i + 1} failed:`, err.message); return null; });

    if (!trackData || !trackData.track) continue;
    
    const track = trackData.track;
    const enhancedTrack = {
      ...track,
      grades: (track.grades || []).map(g => {
        const gradeNum = g.grade;
        const gradeCourses = allCourses.filter(c => {
          const lvl = (c.level || '').toLowerCase();
          const courseName = (c.name || '').toLowerCase();
          const isMiddleSchool = lvl.includes('middle') || /\bgrade\s+[67]|\b[67](?:th)?\b/.test(courseName);
          const isHighSchool = lvl.includes('high') || /\bgrade\s+(?:9|10|11|12)|\b(?:9|10|11|12)(?:th)?\b/.test(courseName);
          const isAP = lvl.includes('ap');
          const isHonors = lvl.includes('honors');
          const isDual = lvl.includes('dual');
          const isIB = lvl.includes('ib');
          const isStandard = !isAP && !isHonors && !isDual && !isIB;
          if (gradeNum === 7) return isMiddleSchool;
          if (gradeNum === 8) return isMiddleSchool || (isHighSchool && isStandard && !isAP);
          if (gradeNum === 9) return !isMiddleSchool && (isStandard || (isHonors && courseName.match(/9th|grade 9/)));
          if (gradeNum === 10) return !isMiddleSchool && (isStandard || isHonors || (isAP && courseName.match(/10th|grade 10/)));
          if (gradeNum === 11) return !isMiddleSchool && (isStandard || isHonors || isAP || isDual);
          if (gradeNum === 12) return !isMiddleSchool && (isStandard || isHonors || isAP || isDual || isIB);
          return !isMiddleSchool;
        }).slice(0, 5);
        return { ...g, school_courses: gradeCourses.length > 0 ? gradeCourses.map(c => ({ ...c, recommended_for_track: false })) : (g.school_courses || []) };
      })
    };

    tracks[i] = enhancedTrack;

    // Save immediately after generating each track
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
    console.log(`Track ${i + 1} added/updated for ${profile.user_email}`);
  }

  // Mark generation complete
  const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  if (existing[0]) {
    await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { is_generating: false });
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
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({
      school_name: profile.school_name,
      zipcode: profile.zipcode
    });
    const cache = existingCache[0];
    const now = new Date();
    const cacheValid = cache && new Date(cache.expires_at) > now;

    if (cacheValid && cache.cached_data) {
      console.log(`Using cached data for ${profile.school_name} (${profile.zipcode})`);
      const schoolMiddleResult = { 
        courses: cache.cached_data.middle_courses || [],
        school_name: cache.cached_data.school_name,
        school_website: cache.cached_data.school_website,
        catalog_url: cache.cached_data.catalog_url,
        district_name: cache.cached_data.district_name,
        graduation_requirements: cache.cached_data.graduation_requirements,
        enrollment_process: cache.cached_data.enrollment_process,
      };
      const schoolHighResult = { courses: cache.cached_data.high_courses || [] };
      const regenerateIndex = journey?.regenerate_track_index;
      await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult, regenerateIndex);
      return;
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
          level: { type: 'string' },
          subject_area: { type: 'string' },
          required_or_elective: { type: 'string' },
          prerequisites: { type: 'string' }
        }
      }
    };

    const schoolResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Get middle school (grades 7-8) and high school (grades 9-12) course catalog for "${profile.school_name}"${profile.zipcode ? ' zip ' + profile.zipcode : ''}. Include: course names, credits, level (Standard/Honors/AP/IB/Dual), subject area. Extract: graduation requirements, school_website URL, catalog_url, enrollment_process. Return as middle_courses and high_courses arrays.`,
      add_context_from_internet: true,
      model: 'gpt_5_mini',
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
      school_name: profile.school_name,
      zipcode: profile.zipcode,
      cached_data: {
        school_name: schoolMiddleResult.school_name,
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