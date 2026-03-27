import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult) {
  const allCourses = [...(schoolMiddleResult.courses || []), ...(schoolHighResult.courses || [])];
  const school_info = {
    school_name: schoolMiddleResult.school_name || profile.high_school_name || 'Your School',
    courses_found: allCourses.length,
  };

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
                  recommended_for_track: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  };

  const studentBase = `Student: ${profile.display_name}, age ${profile.age}, grade ${profile.current_grade}. Interests: ${(profile.interests || []).join(', ')}. Strengths: ${(profile.strengths || []).join(', ')}. Dream Careers: ${(profile.dream_careers || []).join(', ')}.`;
  const allCoursesSummary = allCourses.slice(0, 30).map(c => `${c.name} (${c.subject_area})`).join(', ');

  const trackHints = [
    (profile.dream_careers || []).slice(0, 2).join(', ') || 'technology',
    'creative/business/arts',
    'emerging interdisciplinary field',
  ];

  const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  const tracks = [];
  
  const trackPromises = [0, 1, 2].map(async (i) => {
    console.log(`[TRACK_${i + 1}] Starting...`);
    
    const prompt = `Create ONE career track for: ${studentBase}\nTrack ${i + 1} focus: ${trackHints[i]}\n\nSample courses: ${allCoursesSummary}\n\nBuild grades ${profile.current_grade}-12 roadmap. Per grade: name, description, college_goals, and grades array with grade number, focus, key_milestone, 4-6 school_courses, 2-3 clubs, 2-3 extracurriculars, online_courses, volunteer opportunities, summer activities.`;

    const schema = { type: 'object', properties: { track: trackSchema } };

    try {
      let data = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: 'gpt_5_mini',
        response_json_schema: schema
      });

      if (!data || !data.track) {
        console.log(`[TRACK_${i + 1}] gpt_5_mini empty, trying claude_sonnet_4_6`);
        data = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          model: 'claude_sonnet_4_6',
          response_json_schema: schema
        });
      }

      if (!data || !data.track) {
        console.error(`[TRACK_${i + 1}] Both failed`);
        return null;
      }

      console.log(`[TRACK_${i + 1}] Success`);
      const track = data.track;

      const enhanced = {
        ...track,
        grades: (track.grades || []).map(g => ({
          ...g,
          school_courses: (g.school_courses || []).length > 0 ? g.school_courses : allCourses.slice(0, 6)
        }))
      };

      return { idx: i, track: enhanced };
    } catch (err) {
      console.error(`[TRACK_${i + 1}] Error:`, err.message);
      return null;
    }
  });

  const results = await Promise.all(trackPromises);
  results.forEach(r => { if (r) tracks[r.idx] = r.track; });

  const valid = tracks.filter(Boolean);
  console.log(`Generated ${valid.length} tracks`);

  if (valid.length === 0) {
    console.error('All tracks failed');
    const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    if (plan[0]) await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, { is_generating: false });
    return;
  }

  const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
  if (plan[0]) {
    await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, {
      career_tracks: valid,
      school_info,
      is_generating: false
    });
  }

  const month = new Date().toISOString().slice(0, 7);
  const usage = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: profile.user_email, month });
  const record = usage[0];
  const newTotal = (record?.total_cost || 0) + PLAN_COST;
  if (record) {
    await base44.asServiceRole.entities.UsageCredit.update(record.id, { total_cost: newTotal, blocked: newTotal >= 5.0 });
  } else {
    await base44.asServiceRole.entities.UsageCredit.create({ user_email: profile.user_email, month, total_cost: newTotal, blocked: newTotal >= 5.0 });
  }

  console.log(`Plan done for ${profile.user_email}`);
}

async function runGeneration(base44, profile, journey, existingSchoolWebsite) {
  try {
    console.log('=== GENERATION START ===', profile.display_name, profile.high_school_name);
    
    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ school_name: schoolName, zipcode: profile.zipcode });
    const cache = existingCache[0];
    const cacheValid = cache && new Date(cache.expires_at) > new Date();

    const cachedMiddle = cache?.cached_data?.middle_courses || [];
    const cachedHigh = cache?.cached_data?.high_courses || [];

    if (cacheValid && (cachedMiddle.length > 0 || cachedHigh.length > 0)) {
      console.log(`Using cached courses for ${schoolName}`);
      const schoolMiddleResult = { courses: cachedMiddle, school_name: cache.cached_data.school_name };
      const schoolHighResult = { courses: cachedHigh };
      await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult);
      return;
    }

    console.log(`Fetching courses for ${schoolName}...`);
    
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

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find course catalog for "${schoolName}" in ${profile.city || profile.zipcode}. Extract courses: name, level (Standard/Honors/AP/IB), subject_area, grade_levels (grades array), required_or_elective. Return { middle_courses: [...grades 7-8...], high_courses: [...grades 9-12...] }. Aim 25+ courses per level.`,
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          middle_courses: courseSchema,
          high_courses: courseSchema
        }
      }
    }).catch(err => {
      console.error('Course fetch failed:', err.message);
      return { middle_courses: [], high_courses: [] };
    });
    
    let middle = result.middle_courses || [];
    let high = result.high_courses || [];

    if (middle.length === 0 && high.length === 0) {
      console.log('No courses found, using fallback');
      middle = [
        { name: 'English 7', subject_area: 'English', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
        { name: 'Math 7', subject_area: 'Math', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
        { name: 'Science 7', subject_area: 'Science', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
      ];
      high = [
        { name: 'English 9', subject_area: 'English', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
        { name: 'Algebra II', subject_area: 'Math', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
        { name: 'Biology', subject_area: 'Science', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
        { name: 'AP Computer Science', subject_area: 'Computer Science', level: 'AP', grade_levels: [11, 12], required_or_elective: 'Elective' },
      ];
    }

    console.log(`Got ${middle.length} middle + ${high.length} high courses`);
    
    const cacheData = {
      school_name: schoolName,
      zipcode: profile.zipcode,
      cached_data: {
        school_name: schoolName,
        school_website: existingSchoolWebsite || '',
        middle_courses: middle,
        high_courses: high,
      },
      cached_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (cache) {
      await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, cacheData);
    } else {
      await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
    }

    await generateTracks(base44, profile, journey, { courses: middle, school_name: schoolName }, { courses: high });

  } catch (err) {
    console.error('Generation error:', err.message);
    const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email }).catch(() => []);
    if (plan[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, { is_generating: false }).catch(() => {});
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
      const usage = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: user.email, month });
      const record = usage[0];
      if (record && (record.blocked || record.total_cost >= 5.0)) {
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
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});