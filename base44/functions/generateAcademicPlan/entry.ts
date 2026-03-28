import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function generateTracks(base44, profile, journey, schoolMiddleResult, schoolHighResult) {
  console.log('[GENERATE_TRACKS] Start');
  
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

    const existingPlan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    console.log('[GENERATE_TRACKS] Existing plan:', existingPlan.length > 0 ? 'Found' : 'Not found');
    
    const trackPromises = [0, 1, 2].map(async (i) => {
      console.log(`[TRACK_${i}] Starting...`);
      const prompt = `Create ONE career track for: ${studentBase}\nTrack ${i + 1} focus: ${trackHints[i]}\n\nSample courses: ${allCoursesSummary}\n\nBuild grades ${profile.current_grade}-12 roadmap with grades array containing grade number, focus, key_milestone, 4-6 school_courses, clubs, extracurriculars, online_courses, volunteer opportunities, summer activities.`;
      const schema = { type: 'object', properties: { track: trackSchema } };
      try {
        console.log(`[TRACK_${i}] Calling gpt_5_mini...`);
        let data = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          model: 'gpt_5_mini',
          response_json_schema: schema
        });
        console.log(`[TRACK_${i}] Response received:`, !!data?.track);
        if (!data || !data.track) {
          console.log(`[TRACK_${i}] Fallback to claude_sonnet_4_6...`);
          data = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt,
            model: 'claude_sonnet_4_6',
            response_json_schema: schema
          });
        }
        if (!data || !data.track) {
          console.error(`[TRACK_${i}] Both models failed`);
          return null;
        }
        console.log(`[TRACK_${i}] Success`);
        const track = data.track;
        return {
          ...track,
          grades: (track.grades || []).map(g => ({
            ...g,
            school_courses: (g.school_courses || []).length > 0 ? g.school_courses : allCourses.slice(0, 6)
          }))
        };
      } catch (err) {
        console.error(`[TRACK_${i}] Error:`, err.message);
        return null;
      }
    });

    const results = await Promise.allSettled(trackPromises);
    const tracks = results.map(r => r.status === 'fulfilled' ? r.value : null);

    const valid = tracks.filter(Boolean);
    console.log(`[GENERATE_TRACKS] Valid tracks: ${valid.length}/3`);

    if (valid.length === 0) {
      console.error('[GENERATE_TRACKS] No valid tracks generated');
      const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
      if (plan[0]) {
        await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, { is_generating: false });
      }
      return;
    }

    console.log('[GENERATE_TRACKS] Saving to database...');
    const plan = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    
    if (plan[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(plan[0].id, {
        career_tracks: valid,
        school_info,
        is_generating: false
      });
      console.log('[GENERATE_TRACKS] Plan updated');
    }

    // Update usage
    const month = new Date().toISOString().slice(0, 7);
    const usage = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: profile.user_email, month });
    const record = usage[0];
    const newTotal = (record?.total_cost || 0) + PLAN_COST;
    
    if (record) {
      await base44.asServiceRole.entities.UsageCredit.update(record.id, { total_cost: newTotal, blocked: newTotal >= 5.0 });
    } else {
      await base44.asServiceRole.entities.UsageCredit.create({ user_email: profile.user_email, month, total_cost: newTotal, blocked: newTotal >= 5.0 });
    }
    console.log('[GENERATE_TRACKS] Complete');
  } catch (err) {
    console.error('[GENERATE_TRACKS] Fatal error:', err.message);
    throw err;
  }
}

Deno.serve(async (req) => {
  console.log('[REQUEST] Start');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('[REQUEST] User:', user?.email);
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allSettings = await base44.asServiceRole.entities.AppSettings.filter({});
    const monthlyLimitEnabled = allSettings.find(s => s.key === 'monthly_limit_enabled')?.value !== 'false' ?? true;

    if (monthlyLimitEnabled) {
      const month = new Date().toISOString().slice(0, 7);
      const usage = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: user.email, month });
      const record = usage[0];
      
      if (record && (record.blocked || record.total_cost >= 5.0)) {
        console.log('[REQUEST] Usage limit reached');
        return Response.json({ error: 'USAGE_CAP_REACHED' }, { status: 429 });
      }
    }

    const { profile, journey } = await req.json();
    console.log('[REQUEST] Profile:', profile.display_name);

    const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: user.email });
    console.log('[REQUEST] Plan exists:', !!existing[0]);
    
    if (existing[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { is_generating: true });
    } else {
      await base44.asServiceRole.entities.CareerPlan.create({ user_email: user.email, is_generating: true });
    }

    const profileWithEmail = { ...profile, user_email: user.email };
    const existingSchoolWebsite = existing[0]?.school_info?.school_website || null;
    
    // Fetch courses
    console.log('[REQUEST] Fetching school courses...');
    const schoolName = profile.middle_school_name || profile.high_school_name || profile.school_name || 'school';
    
    const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ school_name: schoolName, zipcode: profile.zipcode });
    const cache = existingCache[0];
    const cacheValid = cache && new Date(cache.expires_at) > new Date();

    let middle = [], high = [];

    if (cacheValid && cache?.cached_data?.middle_courses) {
      console.log('[REQUEST] Using cached courses');
      middle = cache.cached_data.middle_courses || [];
      high = cache.cached_data.high_courses || [];
    } else {
      console.log('[REQUEST] Fetching courses from LLM...');
      
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

      // Check if we have a catalog URL in document_urls to use as source
      const documentUrls = cache?.document_urls || {};
      const catalogUrl = documentUrls.course_catalog;
      const schoolWebsite = documentUrls.school_website;

      let promptBase = `Extract all courses from "${schoolName}"'s course catalog for ${profile.city || profile.zipcode}. Include: name, level (Standard/Honors/AP/IB/Dual Enrollment), subject_area, grade_levels array, required_or_elective. Return { middle_courses: [...], high_courses: [...] }. Aim for 25+ courses per level.`;

      const llmParams = {
        response_json_schema: {
          type: 'object',
          properties: {
            middle_courses: courseSchema,
            high_courses: courseSchema
          }
        }
      };

      if (catalogUrl) {
        console.log('[REQUEST] Using catalog URL from document_urls:', catalogUrl);
        llmParams.prompt = `${promptBase}\n\nOfficial course catalog: ${catalogUrl}`;
        llmParams.file_urls = [catalogUrl];
        llmParams.model = 'gpt_5_mini';
      } else if (schoolWebsite) {
        console.log('[REQUEST] Using school website from document_urls:', schoolWebsite);
        llmParams.prompt = `${promptBase}\n\nSchool website: ${schoolWebsite} — search this site for the course catalog.`;
        llmParams.add_context_from_internet = true;
        llmParams.model = 'gemini_3_flash';
      } else {
        console.log('[REQUEST] No document_urls available, using general LLM knowledge');
        llmParams.prompt = `Find course catalog for "${schoolName}" in ${profile.city || profile.zipcode}. ${promptBase}`;
        llmParams.add_context_from_internet = true;
        llmParams.model = 'gemini_3_flash';
      }

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM(llmParams).catch(err => {
        console.error('[REQUEST] Course fetch error:', err.message);
        return { middle_courses: [], high_courses: [] };
      });

      middle = result.middle_courses || [];
      high = result.high_courses || [];
      
      if (middle.length === 0 && high.length === 0) {
        console.log('[REQUEST] No courses found, using fallback');
        middle = [
          { name: 'English 7', subject_area: 'English', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
          { name: 'Math 7', subject_area: 'Math', level: 'Standard', grade_levels: [7], required_or_elective: 'Required' },
        ];
        high = [
          { name: 'English 9', subject_area: 'English', level: 'Standard', grade_levels: [9], required_or_elective: 'Required' },
          { name: 'Algebra II', subject_area: 'Math', level: 'Standard', grade_levels: [9, 10], required_or_elective: 'Required' },
        ];
      }

      // Save to cache
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
    }

    console.log('[REQUEST] Courses ready:', { middle: middle.length, high: high.length });

    // Fire-and-forget track generation so mobile connections don't time out
    generateTracks(base44, profileWithEmail, journey, { courses: middle, school_name: schoolName }, { courses: high })
      .catch(err => console.error('[REQUEST] Background generateTracks error:', err.message));

    console.log('[REQUEST] Returning immediately, generation running in background');
    return Response.json({ status: 'generating' });

  } catch (error) {
    console.error('[REQUEST] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});