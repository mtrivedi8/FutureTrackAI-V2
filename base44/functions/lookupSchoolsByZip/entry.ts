import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { zipcode } = await req.json();
    if (!zipcode || !/^\d{5}$/.test(zipcode)) {
      return Response.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    // Check DB first
    const existing = await base44.asServiceRole.entities.SchoolDirectory.filter({ zipcode });
    if (existing.length > 0) {
      console.log(`Cache hit for zip ${zipcode}: ${existing.length} schools`);
      return Response.json({ schools: existing, source: 'cache' });
    }

    // Fallback: fetch via LLM
    console.log(`Cache miss for zip ${zipcode}, fetching via LLM...`);
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Search the web and return all middle schools and high schools located in or serving US zip code ${zipcode}. Include school name, city, state, school type (middle, high, or middle_high), and district name. Return an empty array if nothing found.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          schools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                school_name: { type: 'string' },
                school_type: { type: 'string', enum: ['middle', 'high', 'middle_high'] },
                city: { type: 'string' },
                state: { type: 'string' },
                district: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const schools = result.schools || [];

    // Store in DB for future lookups
    for (const school of schools) {
      await base44.asServiceRole.entities.SchoolDirectory.create({ ...school, zipcode });
    }

    console.log(`Stored ${schools.length} schools for zip ${zipcode}`);
    return Response.json({ schools: schools.map(s => ({ ...s, zipcode })), source: 'fresh' });
  } catch (error) {
    console.error('lookupSchoolsByZip error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});