import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25;

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

    // Fire ALL 5 LLM calls in parallel simultaneously — school research + all 3 tracks at once
    const [schoolMiddleResult, schoolHighResult, ...trackResults] = await Promise.all([
      // School call 1: info + middle school courses
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Search for "${profile.school_name}"${profile.city ? ' in ' + profile.city : ''} school website, course catalog, graduation requirements, and middle school courses (grades 7-8). Return school_website, catalog_url, district_name, graduation_requirements object (total_credits, english_credits, math_credits, science_credits, social_studies_credits, pe_health_credits, elective_credits, notes), enrollment_process object (how_to_register, registration_timeline, advisor_counselor_info, ap_honors_enrollment, notes), and up to 40 middle school courses.`,
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

      // School call 2: high school courses
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Search for "${profile.school_name}"${profile.city ? ' in ' + profile.city : ''} high school courses (grades 9-12). Return up to 60 courses with name, credits, level (Standard/Honors/AP/IB), subject_area, required_or_elective, prerequisites.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: { courses: courseSchema }
        }
      }).catch(() => ({ courses: [] })),

      // Track 1
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an expert academic counselor. ${studentBase}\nCreate career track 1 (${trackHints[0]}) with a grade-by-grade plan for grades ${gradeRange}. Each grade needs: focus, key_milestone, credit_summary, school_courses (typical for this school type), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2). Return under key "track".`,
        response_json_schema: { type: 'object', properties: { track: trackSchema } }
      }).catch(err => { console.error('Track 1 failed:', err.message); return null; }),

      // Track 2
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an expert academic counselor. ${studentBase}\nCreate career track 2 (${trackHints[1]}) with a grade-by-grade plan for grades ${gradeRange}. Each grade needs: focus, key_milestone, credit_summary, school_courses (typical for this school type), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2). Return under key "track".`,
        response_json_schema: { type: 'object', properties: { track: trackSchema } }
      }).catch(err => { console.error('Track 2 failed:', err.message); return null; }),

      // Track 3
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an expert academic counselor. ${studentBase}\nCreate career track 3 (${trackHints[2]}) with a grade-by-grade plan for grades ${gradeRange}. Each grade needs: focus, key_milestone, credit_summary, school_courses (typical for this school type), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2). Return under key "track".`,
        response_json_schema: { type: 'object', properties: { track: trackSchema } }
      }).catch(err => { console.error('Track 3 failed:', err.message); return null; }),
    ]);

    // Merge school courses from both calls
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

    // If we got real school courses, inject them into each track's grades
    const tracks = trackResults
      .filter(Boolean)
      .map(r => r.track)
      .filter(Boolean)
      .map(track => {
        if (allCourses.length === 0) return track;
        return {
          ...track,
          grades: (track.grades || []).map(g => {
            // Pick courses appropriate for this grade level
            const gradeNum = g.grade;
            const gradeCourses = allCourses.filter(c => {
              const lvl = (c.level || '').toLowerCase();
              if (gradeNum <= 8) return !lvl.includes('ap') && !lvl.includes('honors');
              if (gradeNum === 9 || gradeNum === 10) return !lvl.includes('ap');
              return true;
            }).slice(0, 6);
            return { ...g, school_courses: gradeCourses.length > 0 ? gradeCourses.map(c => ({ ...c, recommended_for_track: false })) : (g.school_courses || []) };
          })
        };
      });

    // Track usage
    const newTotal = (usageRecord?.total_cost || 0) + PLAN_COST;
    const nowBlocked = newTotal >= 5.0;
    if (usageRecord) {
      await base44.asServiceRole.entities.UsageCredit.update(usageRecord.id, { total_cost: newTotal, blocked: nowBlocked });
    } else {
      await base44.asServiceRole.entities.UsageCredit.create({ user_email: user.email, month, total_cost: newTotal, blocked: nowBlocked });
    }

    return Response.json({
      tracks,
      school_info,
      usage: { total_cost: newTotal, cap: 5.0, blocked: nowBlocked },
    });

  } catch (error) {
    console.error('generateAcademicPlan error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});