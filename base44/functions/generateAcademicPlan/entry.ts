import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult) {
  console.log('[GENERATE_TRACKS] Start:', { user: profile.user_email, courses: (schoolMiddleResult.courses || []).length });
  
  try {
    const allCourses = [...(schoolMiddleResult.courses || []), ...(schoolHighResult.courses || [])];
    console.log('[GENERATE_TRACKS] Total courses:', allCourses.length);
    
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

    console.log('[GENERATE_TRACKS] Fetching existing plan...');
    const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    console.log('[GENERATE_TRACKS] Existing plan:', existingPlan.length > 0 ? 'Found' : 'Not found');
    
    const tracks = [];
    const trackIndices = [0, 1, 2];
    
    console.log('[GENERATE_TRACKS] Creating track promises for indices:', trackIndices);
    const trackPromises = trackIndices.map(async (i) => {
      console.log(`[TRACK_${i}] Init`);
      
      const prompt = `Create ONE career track for: ${studentBase}\nTrack ${i + 1} focus: ${trackHints[i]}\n\nSample courses: ${allCoursesSummary}\n\nBuild grades ${profile.current_grade}-12 roadmap. Per grade: name, description, college_goals, and grades array with grade number, focus, key_milestone, 4-6 school_courses, 2-3 clubs, 2-3 extracurriculars, online_courses, volunteer opportunities, summer activities.`;

      const schema = { type: 'object', properties: { track: trackSchema } };

      try {
        console.log(`[TRACK_${i}] Calling gpt_5_mini...`);
        let data = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          model: 'gpt_5_mini',
          response_json_schema: schema
        });
        
        console.log(`[TRACK_${i}] gpt_5_mini response:`, data ? 'Received' : 'Empty');
        if (data && data.track) {
          console.log(`[TRACK_${i}] Track name: "${data.track.name}", grades: ${data.track.grades?.length || 0}`);
        }

        if (!data || !data.track) {
          console.log(`[TRACK_${i}] gpt_5_mini failed, trying claude_sonnet_4_6...`);
          data = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            model: 'claude_sonnet_4_6',
            response_json_schema: schema
          });
          console.log(`[TRACK_${i}] claude response:`, data ? 'Received' : 'Empty');
        }

        if (!data || !data.track) {
          console.error(`[TRACK_${i}] Both models returned empty`);
          return null;
        }

        console.log(`[TRACK_${i}] Success - returning track`);
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
        console.error(`[TRACK_${i}] Exception:`, err.message, err.stack);
        return null;
      }
    });

    console.log('[GENERATE_TRACKS] Waiting for all track promises...');
    const results = await Promise.all(trackPromises);
    console.log('[GENERATE_TRACKS] Track results:', results.map(r => r ? `Track${r.idx}:success` : 'null').join(', '));
    
    results.forEach(r => { 
      if (r) {
        console.log(`[GENERATE_TRACKS] Assigning track ${r.idx}`);
        tracks[r.idx] = r.track;
      }
    });

    const valid = tracks.filter(Boolean);
    console.log(`[GENERATE_TRACKS] Valid tracks: ${valid.length}/${tracks.length}`);

    if (valid.length === 0) {
      console.error('[GENERATE_TRACKS] No valid tracks - marking is_generating false');
      const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
      if (plan[0]) {
        console.log('[GENERATE_TRACKS] Updating plan to is_generating=false');
        await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, { is_generating: false });
      }
      return;
    }

    console.log('[GENERATE_TRACKS] Fetching plan to update...');
    const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    console.log('[GENERATE_TRACKS] Plan found:', plan.length > 0 ? 'Yes' : 'No');
    
    if (plan[0]) {
      console.log('[GENERATE_TRACKS] Updating plan with', valid.length, 'tracks');
      const updateData = {
        career_tracks: valid,
        school_info,
        is_generating: false
      };
      console.log('[GENERATE_TRACKS] Update data keys:', Object.keys(updateData).join(', '));
      await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, updateData);
      console.log('[GENERATE_TRACKS] Plan updated successfully');
    } else {
      console.log('[GENERATE_TRACKS] No plan found to update');
    }

    console.log('[GENERATE_TRACKS] Updating usage credit...');
    const month = new Date().toISOString().slice(0, 7);
    const usage = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: profile.user_email, month });
    console.log('[GENERATE_TRACKS] Usage records for month:', usage.length);
    
    const record = usage[0];
    const newTotal = (record?.total_cost || 0) + PLAN_COST;
    console.log('[GENERATE_TRACKS] Usage cost:', record?.total_cost || 0, '+ PLAN_COST =', newTotal);
    
    if (record) {
      console.log('[GENERATE_TRACKS] Updating existing usage record');
      await base44.asServiceRole.entities.UsageCredit.update(record.id, { total_cost: newTotal, blocked: newTotal >= 5.0 });
    } else {
      console.log('[GENERATE_TRACKS] Creating new usage record');
      await base44.asServiceRole.entities.UsageCredit.create({ user_email: profile.user_email, month, total_cost: newTotal, blocked: newTotal >= 5.0 });
    }

    console.log('[GENERATE_TRACKS] Complete ✓');
  } catch (err) {
    console.error('[GENERATE_TRACKS] Fatal error:', err.message, err.stack);
    throw err;
  }
}

async function runGeneration(base44, profile, journey, existingSchoolWebsite) {
  console.log('\n\n============ GENERATION START ============');
  console.log('Time:', new Date().toISOString());
  console.log('User:', profile.user_email);
  console.log('Profile:', { name: profile.display_name, school: profile.high_school_name, grade: profile.current_grade });
  
  try {
    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
    console.log('\n[FETCH_COURSES] School name:', schoolName);
    console.log('[FETCH_COURSES] Checking cache...');
    
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ school_name: schoolName, zipcode: profile.zipcode });
    const cache = existingCache[0];
    console.log('[FETCH_COURSES] Cache found:', !!cache);
    
    const cacheValid = cache && new Date(cache.expires_at) > new Date();
    console.log('[FETCH_COURSES] Cache valid:', cacheValid);

    const cachedMiddle = cache?.cached_data?.middle_courses || [];
    const cachedHigh = cache?.cached_data?.high_courses || [];
    console.log('[FETCH_COURSES] Cached courses:', { middle: cachedMiddle.length, high: cachedHigh.length });

    if (cacheValid && (cachedMiddle.length > 0 || cachedHigh.length > 0)) {
      console.log('[FETCH_COURSES] Using cache ✓');
      const schoolMiddleResult = { courses: cachedMiddle, school_name: cache.cached_data.school_name };
      const schoolHighResult = { courses: cachedHigh };
      console.log('[FETCH_COURSES] Calling generateTracks with cached data...');
      await generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult);
      console.log('[GENERATION] Completed via cache\n============ GENERATION END ============\n');
      return;
    }

    console.log('\n[FETCH_COURSES] Cache miss - calling LLM...');
    console.log('[FETCH_COURSES] School location:', profile.city || profile.zipcode);
    
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

    console.log('[FETCH_COURSES] Invoking LLM...');
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
      console.error('[FETCH_COURSES] LLM error:', err.message);
      console.error('[FETCH_COURSES] LLM error details:', err.toString());
      return { middle_courses: [], high_courses: [] };
    });
    
    console.log('[FETCH_COURSES] LLM response received');
    
    let middle = result.middle_courses || [];
    let high = result.high_courses || [];
    console.log('[FETCH_COURSES] Courses from LLM:', { middle: middle.length, high: high.length });

    if (middle.length === 0 && high.length === 0) {
      console.log('[FETCH_COURSES] No courses found, using fallback');
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
      console.log('[FETCH_COURSES] Fallback courses:', { middle: middle.length, high: high.length });
    }

    console.log('[CACHE_SAVE] Saving to cache...');
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
      console.log('[CACHE_SAVE] Updating existing cache');
      await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, cacheData);
    } else {
      console.log('[CACHE_SAVE] Creating new cache');
      await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
    }
    console.log('[CACHE_SAVE] Cache saved ✓');

    console.log('\n[GENERATE] Calling generateTracks with fresh data...');
    await generateTracks(base44, profile, journey, { courses: middle, school_name: schoolName }, { courses: high });
    console.log('[GENERATION] Completed successfully\n============ GENERATION END ============\n');

  } catch (err) {
    console.error('[GENERATION_ERROR] Fatal error:', err.message);
    console.error('[GENERATION_ERROR] Stack:', err.stack);
    const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email }).catch(() => []);
    if (plan[0]) {
      console.log('[GENERATION_ERROR] Marking plan as not generating...');
      await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, { is_generating: false }).catch(() => {});
    }
  }
}

Deno.serve(async (req) => {
  console.log('\n\n========== REQUEST START ==========');
  console.log('Time:', new Date().toISOString());
  
  try {
    const base44 = createClientFromRequest(req);
    console.log('[REQUEST] Created base44 client');
    
    const user = await base44.auth.me();
    console.log('[REQUEST] Auth user:', user?.email);
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.log('[REQUEST] Fetching app settings...');
    const allSettings = await base44.asServiceRole.entities.AppSettings.filter({});
    const monthlyLimitEnabled = allSettings.find(s => s.key === 'monthly_limit_enabled') ? allSettings.find(s => s.key === 'monthly_limit_enabled').value !== 'false' : true;
    console.log('[REQUEST] Monthly limit enabled:', monthlyLimitEnabled);

    if (monthlyLimitEnabled) {
      const month = new Date().toISOString().slice(0, 7);
      const usage = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: user.email, month });
      const record = usage[0];
      console.log('[REQUEST] Usage check - month:', month, 'cost:', record?.total_cost);
      
      if (record && (record.blocked || record.total_cost >= 5.0)) {
        console.log('[REQUEST] Usage limit reached');
        return Response.json({ error: 'USAGE_CAP_REACHED' }, { status: 429 });
      }
    }

    console.log('[REQUEST] Parsing request body...');
    const { profile, journey } = await req.json();
    console.log('[REQUEST] Profile:', profile.display_name, 'Journey adapt mode:', journey?.adapt_mode);

    console.log('[REQUEST] Fetching existing plan...');
    const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: user.email });
    console.log('[REQUEST] Existing plan:', existing.length > 0 ? 'Found' : 'Not found');
    
    if (existing[0]) {
      console.log('[REQUEST] Updating plan to is_generating=true');
      await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { is_generating: true });
    } else {
      console.log('[REQUEST] Creating new plan with is_generating=true');
      await base44.asServiceRole.entities.CareerPlan.create({ user_email: user.email, is_generating: true });
    }

    const profileWithEmail = { ...profile, user_email: user.email };
    const existingSchoolWebsite = existing[0]?.school_info?.school_website || null;
    
    console.log('[REQUEST] Starting background generation...');
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      console.log('[REQUEST] Using EdgeRuntime.waitUntil');
      EdgeRuntime.waitUntil(runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite));
    } else {
      console.log('[REQUEST] Direct function call (no EdgeRuntime)');
      runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite);
    }

    console.log('[REQUEST] Returning 200 status');
    console.log('========== REQUEST END ==========\n');
    return Response.json({ status: 'generating' });

  } catch (error) {
    console.error('[REQUEST_ERROR] Exception:', error.message);
    console.error('[REQUEST_ERROR] Stack:', error.stack);
    console.log('========== REQUEST END (ERROR) ==========\n');
    return Response.json({ error: error.message }, { status: 500 });
  }
});