import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { profile, existingTitles } = await req.json();

    // Fetch journey entries to personalize suggestions and mark done items
    const journeyEntries = await base44.asServiceRole.entities.JourneyEntry.filter({ user_email: user.email });
    const journeyCourses = journeyEntries.filter(e => e.type === 'School Course').map(e => e.title);
    const journeyActivities = journeyEntries.filter(e => e.type !== 'School Course').map(e => `${e.title} [${e.type}]`);
    const journeyContext = [
      journeyCourses.length > 0 ? `Courses already taken: ${journeyCourses.join(', ')}` : '',
      journeyActivities.length > 0 ? `Activities/internships already done: ${journeyActivities.join(', ')}` : '',
    ].filter(Boolean).join('. ');

    // Auto-mark existing recommendations as Completed if they match journey entries
    const allJourneyTitles = journeyEntries.map(e => e.title.toLowerCase().trim());
    const existingRecs = await base44.asServiceRole.entities.Recommendation.filter({ user_email: user.email });
    for (const rec of existingRecs) {
      if (rec.status === 'Completed') continue;
      const recTitle = rec.title.toLowerCase().trim();
      const matched = allJourneyTitles.some(t => t.includes(recTitle) || recTitle.includes(t));
      if (matched) {
        await base44.asServiceRole.entities.Recommendation.update(rec.id, { status: 'Completed' });
        console.log(`Auto-marked as Completed: ${rec.title}`);
      }
    }

    const prompt = `You are an elite career counselor and academic advisor for high-achieving teenagers. Your job is to generate HIGHLY SPECIFIC, deeply personalized, and immediately actionable recommendations — not generic advice.

Student Profile:
- Name: ${profile.display_name}, Age: ${profile.age}, Grade: ${profile.current_grade || 'high school'}
- Location: ${[profile.city, profile.country].filter(Boolean).join(", ") || "United States"}
- School: ${profile.high_school_name || profile.middle_school_name || profile.school_name || "Not specified"}
- Interests: ${(profile.interests || []).join(", ") || "Not specified"}
- Strengths: ${(profile.strengths || []).join(", ") || "Not specified"}
- Goals: ${(profile.goals || []).join(", ") || "Not specified"}
- Dream Careers: ${(profile.dream_careers || []).join(", ") || "Not specified"}
- Learning Style: ${profile.preferred_learning_style || "Mixed"}
${journeyContext ? `- Journey so far: ${journeyContext}` : ''}

${existingTitles?.length ? `Already recommended (do NOT repeat or overlap): ${existingTitles.join(", ")}\n` : ""}
${journeyContext ? `Do NOT suggest anything already in their journey. Build on what they've done — suggest next-level opportunities.\n` : ''}
Generate 5 ELITE, highly specific recommendations. Rules:
1. CAREER PATH recs must name specific roles with a clear progression: high school → college major → first job → 5-year goal.
2. SKILL recs must name a specific technology or discipline (e.g. "Python for Data Analysis with Pandas & Matplotlib"). Include what project they should build.
3. COURSE recs must be real, named courses from Coursera, edX, MIT OpenCourseWare, Khan Academy, or university programs — with the actual course name and provider.
4. ACTIVITY recs should be specific named competitions, clubs, or programs (e.g. "FIRST Robotics", "Science Olympiad", "DECA", "AMC 10/12", hackathons, Regeneron ISEF) relevant to their interests.
5. PROJECT recs should be a specific, concrete project idea that connects their interests and dream career.

For each recommendation:
- description: 2-3 sentences SPECIFIC to THIS student's profile.
- why_recommended: Directly reference their specific interests, goals, and dream career.
- resources: 3 REAL working URLs only.
- difficulty_level and estimated_duration realistic for their grade.

Mix the 5 types: Career Path, Skill, Course, Activity, Project.`;

    const recSchema = {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['Career Path', 'Skill', 'Course', 'Activity', 'Project'] },
              title: { type: 'string' },
              description: { type: 'string' },
              why_recommended: { type: 'string' },
              difficulty_level: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] },
              estimated_duration: { type: 'string' },
              resources: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    };

    let result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'gpt_5_mini',
      response_json_schema: recSchema,
    });

    if (!result?.recommendations?.length) {
      console.log('gpt_5_mini returned no data, falling back to claude_sonnet_4_6');
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: recSchema,
      });
    }

    console.log('LLM raw result:', JSON.stringify(result).slice(0, 500));

    const recs = result.recommendations || [];

    // Build set of all existing titles to prevent duplicates
    const existingTitlesSet = new Set(existingRecs.map(r => r.title?.toLowerCase().trim()));

    let created = 0;
    for (const rec of recs) {
      const titleKey = rec.title?.toLowerCase().trim();
      if (!titleKey || existingTitlesSet.has(titleKey)) {
        console.log(`Skipping duplicate: ${rec.title}`);
        continue;
      }
      // Check if journey already covers this — mark as Completed automatically
      const journeyMatched = allJourneyTitles.some(t => t.includes(titleKey) || titleKey.includes(t));
      existingTitlesSet.add(titleKey);
      await base44.asServiceRole.entities.Recommendation.create({
        ...rec,
        user_email: user.email,
        status: journeyMatched ? 'Completed' : 'New',
      });
      created++;
    }

    console.log(`Generated ${created} new recommendations (skipped ${recs.length - created} duplicates) for ${user.email}`);
    return Response.json({ count: created });
  } catch (error) {
    console.error('generateRecommendations error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});