import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { profile } = await req.json();

  // Step 1: Deep-scrape the school's website + course catalog
  const catalogSearch = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a research assistant. Search the web for the official school website and course catalog / course selection guide for "${profile.school_name}" school${profile.city ? ' in ' + profile.city : ''}${profile.country ? ', ' + profile.country : ''}.

IMPORTANT: 
- Find the actual school or district website URL.
- Find the actual course catalog PDF or webpage URL (look for "course catalog", "course guide", "course selection", "program of studies").
- Extract the COMPLETE list of courses offered, organized by grade level (7-12). Include ALL course variants (e.g., Algebra 1, Algebra 1 Honors, Algebra 2, Geometry, Geometry Honors, Pre-Calculus, AP Calculus AB, AP Calculus BC).
- For each course, include: the exact course name as listed, the credit value (e.g., 0.5, 1.0), whether it's required or elective, and the level (Standard, Honors, AP, IB, Dual Enrollment).
- Extract graduation credit requirements (total credits needed, credits per subject area).
- Extract clubs, sports teams, and special programs (AP, IB, STEM, Dual Enrollment, etc.).
- Return the actual source URLs where you found each piece of information.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        school_name: { type: 'string' },
        school_website: { type: 'string' },
        catalog_url: { type: 'string' },
        district_name: { type: 'string' },
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
        courses_by_grade: {
          type: 'object',
          description: 'Keys are grade levels (7,8,9,10,11,12), values are arrays of course objects'
        },
        courses_all: {
          type: 'array',
          description: 'ALL courses found in the catalog',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              grade_levels: { type: 'array', items: { type: 'string' } },
              credits: { type: 'string' },
              level: { type: 'string', description: 'Standard, Honors, AP, IB, Dual Enrollment' },
              subject_area: { type: 'string' },
              required_or_elective: { type: 'string' },
              prerequisites: { type: 'string' }
            }
          }
        },
        clubs: { type: 'array', items: { type: 'string' } },
        sports: { type: 'array', items: { type: 'string' } },
        special_programs: { type: 'array', items: { type: 'string' } },
        data_sources: { type: 'array', items: { type: 'string' }, description: 'URLs where data was found' }
      }
    }
  });

  // Step 2: Generate plan using real scraped data
  const allCoursesText = JSON.stringify(catalogSearch.courses_all || [], null, 2);
  const gradReqs = JSON.stringify(catalogSearch.graduation_requirements || {}, null, 2);

  const planResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an expert academic counselor for ${catalogSearch.school_name || profile.school_name}.

REAL SCHOOL DATA (scraped from official school sources):
District: ${catalogSearch.district_name || 'Unknown'}
School Website: ${catalogSearch.school_website || 'N/A'}
Course Catalog URL: ${catalogSearch.catalog_url || 'N/A'}
Graduation Requirements: ${gradReqs}
ALL AVAILABLE COURSES (from real catalog): ${allCoursesText}
Clubs: ${(catalogSearch.clubs || []).join(', ')}
Sports: ${(catalogSearch.sports || []).join(', ')}
Special Programs: ${(catalogSearch.special_programs || []).join(', ')}

STUDENT PROFILE:
- Name: ${profile.display_name}, Age: ${profile.age}, Grade: ${profile.current_grade}
- Interests: ${(profile.interests || []).join(', ')}
- Strengths: ${(profile.strengths || []).join(', ')}
- Dream Careers: ${(profile.dream_careers || []).join(', ')}
- Goals: ${(profile.goals || []).join(', ')}
- Learning Style: ${profile.preferred_learning_style || 'Mixed'}

Generate 3 distinct career tracks tailored to this student.
For EACH track, create a grade-by-grade plan from grade ${profile.current_grade} to 12.

CRITICAL RULES for school_courses:
1. List ALL relevant courses from the REAL catalog above for that subject area and grade level — do NOT pick just one. For example, if the catalog has Algebra 1, Algebra 1 Honors, Geometry, Geometry Honors — list ALL of them.
2. Mark which ones are RECOMMENDED for this career track.
3. Include credit value for each course exactly as shown in the catalog.
4. Include course level (Standard, Honors, AP, IB, Dual Enrollment).
5. Include whether it's Required or Elective.
6. If a course has prerequisites, note them.

For each grade provide:
- focus: Theme for that year
- school_courses: Array of course objects (ALL relevant courses, not just recommended ones) from the real catalog
- clubs: 2-3 real clubs from the school
- special_programs: AP/honors/IB programs to aim for
- online_courses: 2 specific online courses with platform
- extracurriculars: 2-3 activities
- volunteer_opportunities: 1-2 local volunteer opportunities
- summer_activities: 1-2 summer programs
- key_milestone: Most important achievement this year
- credit_summary: Total credits for this grade year and running total toward graduation`,
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

  return Response.json({
    tracks: planResult.tracks || [],
    school_info: {
      district_name: catalogSearch.district_name,
      school_website: catalogSearch.school_website,
      catalog_url: catalogSearch.catalog_url,
      graduation_requirements: catalogSearch.graduation_requirements,
      data_sources: catalogSearch.data_sources || [],
      courses_found: (catalogSearch.courses_all || []).length,
    }
  });
});