import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

async function runGeneration(base44, profile, journey, existingSchoolWebsite = null) {
  try {
    const adaptMode = journey?.adapt_mode === true;

    const journeyContext = journey ? `
STUDENT PROGRESS (${adaptMode ? 'CRITICAL: heavily adapt the plan' : 'personalize based on this'}):
- Completed: ${(journey.completed_recommendations || []).join(', ') || 'None'}
- In progress: ${(journey.in_progress_recommendations || []).join(', ') || 'None'}
- Skills gained: ${(journey.skills_gained || []).join(', ') || 'None'}
- New interests: ${(journey.new_interests || []).join(', ') || 'None'}
- Milestones: ${(journey.recent_milestones || []).join(', ') || 'None'}` : '';

    const gradeRange = Array.from({ length: 13 - profile.current_grade }, (_, i) => profile.current_grade + i).join(', ');

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
              school_courses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    credits: { type: 'string' },
                    level: { type: 'string' },
                    subject_area: { type: 'string' },
                    required_or_elective: { type: 'string' },
                    recommended_for_track: { type: 'boolean' },
                    prerequisites: { type: 'string' }
                  }
                }
              },
              clubs: { type: 'array', items: { type: 'string' } },
              special_programs: { type: 'array', items: { type: 'string' } },
              online_courses: { type: 'array', items: { type: 'string' } },
              extracurriculars: { type: 'array', items: { type: 'string' } },
              volunteer_opportunities: { type: 'array', items: { type: 'string' } },
              summer_activities: { type: 'array', items: { type: 'string' } },
              key_milestone: { type: 'string' },
              credit_summary: { type: 'string' }
            }
          }
        }
      }
    };

    const studentBase = `Student: ${profile.display_name}, age ${profile.age}, grade ${profile.current_grade}. Interests: ${(profile.interests || []).join(', ')}. Strengths: ${(profile.strengths || []).join(', ')}. Dream Careers: ${(profile.dream_careers || []).join(', ')}. School: ${profile.school_name}${profile.city ? ', ' + profile.city : ''}.${journeyContext}`;

    const trackHints = [
      `most aligned with dream careers: ${(profile.dream_careers || []).slice(0, 2).join(', ') || 'technology'}`,
      `alternative creative/business/arts path`,
      `wildcard emerging field combining interests unexpectedly`,
    ];

    // Fire ALL 5 LLM calls in parallel
    const schoolWebsiteHint = existingSchoolWebsite ? `${existingSchoolWebsite} and ` : '';
    const [schoolMiddleResult, schoolHighResult, ...trackResults] = await Promise.all([
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Using the school website ${schoolWebsiteHint}search for the official school information for "${profile.school_name}"${profile.city ? ', ' + profile.city : ''}${profile.zipcode ? ', zip ' + profile.zipcode : ''}". Find the official school website, official course catalog/handbook (PDF or page), graduation requirements, and list all middle school courses (grades 7-8). Prioritize official school district sources. Return school_website (official domain), catalog_url (official course catalog link), district_name, graduation_requirements object (total_credits, english_credits, math_credits, science_credits, social_studies_credits, pe_health_credits, elective_credits, notes), enrollment_process object (how_to_register, registration_timeline, advisor_counselor_info, ap_honors_enrollment, notes), and up to 40 middle school courses with accurate names.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            school_name: { type: 'string' },
            school_website: { type: 'string' },
            catalog_url: { type: 'string' },
            district_name: { type: 'string' },
            graduation_requirements: { type: 'object', properties: { total_credits: { type: 'number' }, english_credits: { type: 'number' }, math_credits: { type: 'number' }, science_credits: { type: 'number' }, social_studies_credits: { type: 'number' }, pe_health_credits: { type: 'number' }, elective_credits: { type: 'number' }, notes: { type: 'string' } } },
            enrollment_process: { type: 'object', properties: { how_to_register: { type: 'string' }, registration_timeline: { type: 'string' }, advisor_counselor_info: { type: 'string' }, ap_honors_enrollment: { type: 'string' }, notes: { type: 'string' } } },
            courses: courseSchema
          }
        }
      }).catch(() => ({ courses: [] })),

      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Using the school website ${schoolWebsiteHint}search for all official high school courses (grades 9-12) for "${profile.school_name}"${profile.city ? ', ' + profile.city : ''}${profile.zipcode ? ', zip ' + profile.zipcode : ''}" high school. Find courses from the school's official website or course catalog. Return up to 60 courses with accurate names, credits, level (Standard/Honors/AP/IB), subject_area (Math, English, Science, etc), required_or_elective, prerequisites. Prioritize official sources only.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: { type: 'object', properties: { courses: courseSchema } }
      }).catch(() => ({ courses: [] })),

      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an expert academic counselor. ${studentBase}\nCreate career track 1 (${trackHints[0]}) with a grade-by-grade plan for grades ${gradeRange}. Each grade needs: focus, key_milestone, credit_summary, school_courses (typical for this school type), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2). Return under key "track".`,
        response_json_schema: { type: 'object', properties: { track: trackSchema } }
      }).catch(err => { console.error('Track 1 failed:', err.message); return null; }),

      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an expert academic counselor. ${studentBase}\nCreate career track 2 (${trackHints[1]}) with a grade-by-grade plan for grades ${gradeRange}. Each grade needs: focus, key_milestone, credit_summary, school_courses (typical for this school type), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2). Return under key "track".`,
        response_json_schema: { type: 'object', properties: { track: trackSchema } }
      }).catch(err => { console.error('Track 2 failed:', err.message); return null; }),

      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an expert academic counselor. ${studentBase}\nCreate career track 3 (${trackHints[2]}) with a grade-by-grade plan for grades ${gradeRange}. Each grade needs: focus, key_milestone, credit_summary, school_courses (typical for this school type), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2). Return under key "track".`,
        response_json_schema: { type: 'object', properties: { track: trackSchema } }
      }).catch(err => { console.error('Track 3 failed:', err.message); return null; }),
    ]);

    const allCourses = [...(schoolMiddleResult.courses || []), ...(schoolHighResult.courses || [])];
    const school_info = {
      school_name: schoolMiddleResult.school_name,
      school_website: existingSchoolWebsite || schoolMiddleResult.school_website,
      catalog_url: schoolMiddleResult.catalog_url,
      district_name: schoolMiddleResult.district_name,
      courses_found: allCourses.length,
      graduation_requirements: schoolMiddleResult.graduation_requirements,
      enrollment_process: schoolMiddleResult.enrollment_process,
    };

    const tracks = trackResults
      .filter(Boolean)
      .map(r => r.track)
      .filter(Boolean)
      .map(track => {
        if (allCourses.length === 0) return track;
        return {
          ...track,
          grades: (track.grades || []).map(g => {
            const gradeNum = g.grade;
            const filtered = allCourses.filter(c => {
              const lvl = (c.level || '').toLowerCase();
              const isMiddleSchool = lvl.includes('middle');
              if (gradeNum >= 9) return !isMiddleSchool;
              if (gradeNum <= 8) return !lvl.includes('ap') && !lvl.includes('honors');
              return true;
            });
            const startIdx = Math.max(0, (gradeNum - 9) * 6);
            const gradeCourses = filtered.slice(startIdx, startIdx + 6);
            return { ...g, school_courses: gradeCourses.length > 0 ? gradeCourses.map(c => ({ ...c, recommended_for_track: false })) : (g.school_courses || []) };
          })
        };
      });

    // Save results to DB
    const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: profile.user_email });
    const planData = {
      user_email: profile.user_email,
      career_tracks: tracks || [],
      selected_track_index: 0,
      school_name: profile.school_name,
      current_grade: profile.current_grade,
      school_info,
      is_generating: false,
    };

    if (existing[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, planData);
    } else {
      await base44.asServiceRole.entities.CareerPlan.create(planData);
    }

    // Track usage
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
  } catch (err) {
    console.error('Background generation error:', err.message, err.stack);
    // Mark as not generating on failure so the UI doesn't spin forever
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

    const month = new Date().toISOString().slice(0, 7);
    const usageRecords = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: user.email, month });
    const usageRecord = usageRecords[0];
    if (usageRecord && (usageRecord.blocked || usageRecord.total_cost >= 5.0)) {
      return Response.json({ error: 'USAGE_CAP_REACHED' }, { status: 429 });
    }

    const { profile, journey } = await req.json();

    // Mark as generating in DB and get existing school_website
    const existing = await base44.asServiceRole.entities.CareerPlan.filter({ user_email: user.email });
    if (existing[0]) {
      await base44.asServiceRole.entities.CareerPlan.update(existing[0].id, { is_generating: true });
    } else {
      await base44.asServiceRole.entities.CareerPlan.create({ user_email: user.email, is_generating: true });
    }

    // Fire generation in background and return immediately
    const profileWithEmail = { ...profile, user_email: user.email };
    const existingSchoolWebsite = existing[0]?.school_info?.school_website || null;
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite));
    } else {
      // Fallback: run async without waiting (dev environment)
      runGeneration(base44, profileWithEmail, journey, existingSchoolWebsite);
    }

    // Return immediately — frontend will poll for completion
    return Response.json({ status: 'generating' });

  } catch (error) {
    console.error('generateAcademicPlan error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});