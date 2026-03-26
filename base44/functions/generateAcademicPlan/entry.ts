import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

  // Single combined call: scrape school data AND generate plan in one shot
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an expert academic counselor and school researcher.

TASK 1 - RESEARCH: Search the web for the official course catalog, graduation requirements, and enrollment process for "${profile.school_name}"${profile.city ? ' in ' + profile.city : ''}${profile.country ? ', ' + profile.country : ''}.

Find:
- School website URL and course catalog URL
- ALL courses offered (name, credits, level: Standard/Honors/AP/IB, subject area, required or elective, prerequisites)
- Graduation credit requirements (total and per subject)
- Enrollment/registration process (how to register, timeline, counselor info, AP/Honors enrollment requirements, level change process, any portal)
- Clubs, sports, special programs

TASK 2 - PLAN: Using that real school data, create 3 career tracks for this student:
- Name: ${profile.display_name}, Age: ${profile.age}, Grade: ${profile.current_grade}
- Interests: ${(profile.interests || []).join(', ')}
- Strengths: ${(profile.strengths || []).join(', ')}
- Dream Careers: ${(profile.dream_careers || []).join(', ')}
- Goals: ${(profile.goals || []).join(', ')}${journeyContext}

For EACH track, create a grade-by-grade plan from grade ${profile.current_grade} to 12 (inclusive).
IMPORTANT: Start from grade ${profile.current_grade}, not grade 9. If current grade is 8, include grades 8, 9, 10, 11, 12.
For EACH grade also include detailed summer_activities for the summer AFTER that grade (e.g., summer programs, internships, camps, volunteer, self-study, jobs relevant to the track).
For each grade include:
- focus, key_milestone, credit_summary
- school_courses: real courses from the catalog (name, credits, level, subject_area, required_or_elective, recommended_for_track, prerequisites)
- clubs (2-3 real ones), special_programs, online_courses (2), extracurriculars (2-3), volunteer_opportunities (1-2), summer_activities (1-2)`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        school_info: {
          type: 'object',
          properties: {
            school_name: { type: 'string' },
            school_website: { type: 'string' },
            catalog_url: { type: 'string' },
            district_name: { type: 'string' },
            courses_found: { type: 'number' },
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
                level_change_process: { type: 'string' },
                registration_portal: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          }
        },
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

  return Response.json({
    tracks: result.tracks || [],
    school_info: result.school_info || {}
  });
});