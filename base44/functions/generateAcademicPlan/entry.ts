import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { profile } = await req.json();

  // Step 1: Search for the school's course catalog online
  const schoolInfo = [profile.school_name, profile.city, profile.country].filter(Boolean).join(', ');

  const catalogSearch = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Search the web for the official course catalog or course selection guide for "${profile.school_name}" school in ${[profile.city, profile.country].filter(Boolean).join(', ')}.

Find the school district website and look for:
1. The full course catalog / course selection PDF or webpage
2. List of available clubs and extracurricular activities
3. Any special programs (AP, IB, vocational, honors, STEM programs, etc.)

Return ONLY a JSON with:
- school_courses: object where keys are grade levels (7,8,9,10,11,12) and values are arrays of actual course names available at that grade
- clubs: array of actual club names at this school
- special_programs: array of special programs (AP, honors, STEM, etc.)
- school_website: the school's official website URL
- district_name: the school district name
- notes: any relevant info about the school curriculum`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        school_courses: { type: 'object' },
        clubs: { type: 'array', items: { type: 'string' } },
        special_programs: { type: 'array', items: { type: 'string' } },
        school_website: { type: 'string' },
        district_name: { type: 'string' },
        notes: { type: 'string' },
      }
    }
  });

  // Step 2: Generate full grade-by-grade plan using real school data
  const schoolCoursesText = JSON.stringify(catalogSearch.school_courses || {}, null, 2);
  const clubsText = (catalogSearch.clubs || []).join(', ');
  const programsText = (catalogSearch.special_programs || []).join(', ');

  const planResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an expert academic counselor for ${profile.school_name || 'a middle/high school'} in ${[profile.city, profile.country].filter(Boolean).join(', ')}.

REAL SCHOOL DATA (use this as the primary source for course suggestions):
District: ${catalogSearch.district_name || 'Unknown'}
Actual courses available by grade: ${schoolCoursesText}
Actual clubs at this school: ${clubsText}
Special programs: ${programsText}
Notes: ${catalogSearch.notes || ''}

STUDENT PROFILE:
- Name: ${profile.display_name}, Age: ${profile.age}, Grade: ${profile.current_grade}
- Interests: ${(profile.interests || []).join(', ')}
- Strengths: ${(profile.strengths || []).join(', ')}
- Dream Careers: ${(profile.dream_careers || []).join(', ')}
- Goals: ${(profile.goals || []).join(', ')}
- Learning Style: ${profile.preferred_learning_style || 'Mixed'}

Generate 3 distinct career tracks that match this student's profile.
For EACH track, create a detailed grade-by-grade plan from grade 7 to grade 12.

For each grade, provide:
- focus: Theme for that year
- school_courses: 3-4 ACTUAL course names from the school's real catalog above that are relevant to this track and grade level. If real data isn't available, suggest appropriate courses.
- clubs: 2-3 ACTUAL clubs from the school's real list above that fit this track. Mix school clubs with suggested ones if needed.
- special_programs: Any AP, honors, IB, or special programs from the school to aim for (from real data)
- online_courses: 2 specific online courses with platform (e.g., "AP Computer Science Principles - Khan Academy", "Python Basics - Codecademy")
- extracurriculars: 2-3 sports or activities
- volunteer_opportunities: 1-2 specific local volunteer opportunities in ${profile.city || 'their area'} relevant to this track
- summer_activities: 1-2 summer programs, camps, or internships (with specific program names if possible)
- key_milestone: The ONE most important achievement to hit this grade year

IMPORTANT: Prioritize using REAL courses and clubs from the school's actual catalog. Only use generic suggestions when real data isn't available.`,
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
                    school_courses: { type: 'array', items: { type: 'string' } },
                    clubs: { type: 'array', items: { type: 'string' } },
                    special_programs: { type: 'array', items: { type: 'string' } },
                    online_courses: { type: 'array', items: { type: 'string' } },
                    extracurriculars: { type: 'array', items: { type: 'string' } },
                    volunteer_opportunities: { type: 'array', items: { type: 'string' } },
                    summer_activities: { type: 'array', items: { type: 'string' } },
                    key_milestone: { type: 'string' },
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
    tracks: planResult.tracks || [],
    school_info: {
      district_name: catalogSearch.district_name,
      school_website: catalogSearch.school_website,
      clubs_found: (catalogSearch.clubs || []).length,
      courses_found: Object.keys(catalogSearch.school_courses || {}).length > 0,
    }
  });
});