import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLAN_COST = 0.25; // USD per plan generation

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Check usage cap before running
  const month = new Date().toISOString().slice(0, 7);
  const usageRecords = await base44.asServiceRole.entities.UsageCredit.filter({ user_email: user.email, month });
  const usageRecord = usageRecords[0];
  if (usageRecord && (usageRecord.blocked || usageRecord.total_cost >= 5.0)) {
    return Response.json({ error: 'USAGE_CAP_REACHED' }, { status: 429 });
  }

  const { profile, journey } = await req.json();

  const adaptMode = journey?.adapt_mode === true;

  const journeyContext = journey ? `

STUDENT'S JOURNEY SO FAR (${adaptMode ? 'CRITICAL: heavily personalize the plan based on this progress' : 'personalize the plan based on this'}):
- Completed activities: ${(journey.completed_recommendations || []).join(', ') || 'None yet'}
- Currently exploring: ${(journey.in_progress_recommendations || []).join(', ') || 'None'}
- Skills already gained: ${(journey.skills_gained || []).join(', ') || 'None listed'}
- Newly discovered interests: ${(journey.new_interests || []).join(', ') || 'None'}
- Recent milestones: ${(journey.recent_milestones || []).join(', ') || 'None'}
- Recent moods: ${(journey.moods || []).join(', ') || 'None'}
${adaptMode ? `
ADAPT MODE INSTRUCTIONS:
- Adjust the career tracks to reflect the student's demonstrated interests and skills
- Accelerate recommendations in areas where they have already gained skills
- Introduce new directions based on their newly discovered interests
- Skip or de-emphasize activities they have already completed
- Take the student's recent moods into account when setting the tone of the plan
- Show clear progression from their current skills and accomplishments` : 'IMPORTANT: Build on skills already gained, avoid repeating completed activities, incorporate new interests, and show progression from where the student currently is.'}` : '';

  // Step 1: Research school info with internet search (small, focused call)
  const schoolResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Search the web for the official course catalog and graduation requirements for "${profile.school_name}"${profile.city ? ' in ' + profile.city : ''}${profile.country ? ', ' + profile.country : ''}.

Find:
- School website URL and course catalog URL
- ALL courses offered (name, credits, level: Standard/Honors/AP/IB, subject area, required or elective, prerequisites)
- Graduation credit requirements (total and per subject)
- Enrollment/registration process (how to register, timeline, counselor info, AP/Honors enrollment requirements)
- Clubs, sports, special programs`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        school_name: { type: 'string' },
        school_website: { type: 'string' },
        catalog_url: { type: 'string' },
        district_name: { type: 'string' },
        courses_found: { type: 'number' },
        courses: {
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
        },
        graduation_requirements: {
          type: 'object',
          properties: {
            total_credits: { type: 'number' },
            english_credits: { type: 'number' },
            math_credits: { type: 'number' },
            science_credits: { type: 'number' },
            social_studies_credits: { type: 'number' },
            pe_health_credits: { type: 'number' },
            elective_credits: { type: 'number' },
            notes: { type: 'string' }
          }
        },
        enrollment_process: {
          type: 'object',
          properties: {
            how_to_register: { type: 'string' },
            registration_timeline: { type: 'string' },
            advisor_counselor_info: { type: 'string' },
            ap_honors_enrollment: { type: 'string' },
            notes: { type: 'string' }
          }
        }
      }
    }
  });

  const schoolCoursesSummary = schoolResult.courses?.length > 0
    ? `Available courses at ${profile.school_name}: ${schoolResult.courses.map(c => `${c.name} (${c.level || 'Standard'}, ${c.subject_area || ''}, ${c.required_or_elective || ''})`).join('; ')}`
    : `No specific course catalog found for ${profile.school_name}. Use typical high school courses.`;

  // Step 2: Generate the academic plan using school data (no internet needed)
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an expert academic counselor. Create 3 career tracks for this student using the real school course data provided.

Student:
- Name: ${profile.display_name}, Age: ${profile.age}, Grade: ${profile.current_grade}
- Interests: ${(profile.interests || []).join(', ')}
- Strengths: ${(profile.strengths || []).join(', ')}
- Dream Careers: ${(profile.dream_careers || []).join(', ')}
- Goals: ${(profile.goals || []).join(', ')}${journeyContext}

School: ${profile.school_name}
${schoolCoursesSummary}

For EACH track, create a grade-by-grade plan from grade ${profile.current_grade} to 12 (inclusive).
For each grade include: focus, key_milestone, credit_summary, school_courses (picked from the real course list above), clubs (2-3), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (2).`,
    response_json_schema: {
      type: 'object',
      properties: {
        tracks: {
          type: 'array',
          items: {
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
          }
        }
      }
    }
  });

  // Merge school info back
  result.school_info = {
    school_name: schoolResult.school_name,
    school_website: schoolResult.school_website,
    catalog_url: schoolResult.catalog_url,
    district_name: schoolResult.district_name,
    courses_found: schoolResult.courses_found || schoolResult.courses?.length || 0,
    graduation_requirements: schoolResult.graduation_requirements,
    enrollment_process: schoolResult.enrollment_process,
  };

  // Track usage after successful generation
  const newTotal = (usageRecord?.total_cost || 0) + PLAN_COST;
  const nowBlocked = newTotal >= 5.0;
  if (usageRecord) {
    await base44.asServiceRole.entities.UsageCredit.update(usageRecord.id, { total_cost: newTotal, blocked: nowBlocked });
  } else {
    await base44.asServiceRole.entities.UsageCredit.create({ user_email: user.email, month, total_cost: newTotal, blocked: nowBlocked });
  }

  return Response.json({
    tracks: result.tracks || [],
    school_info: result.school_info || {},
    usage: { total_cost: newTotal, cap: 5.0, blocked: nowBlocked },
  });
});