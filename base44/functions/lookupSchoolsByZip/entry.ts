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

    // Look up from DB first
    const existing = await base44.asServiceRole.entities.SchoolDirectory.filter({ zipcode });
    if (existing.length > 0) {
      console.log(`Found ${existing.length} schools for zip ${zipcode} in directory`);
      return Response.json({ schools: existing, source: 'directory' });
    }

    // Fallback to LLM if directory is empty
    console.log(`No schools in directory for ${zipcode}, fetching via LLM...`);
    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find all middle schools and high schools in the ${zipcode} zip code area. For each school, provide: school_name, school_type (middle or high), city, state, district. Return as JSON array.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          schools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                school_name: { type: 'string' },
                school_type: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                district: { type: 'string' }
              }
            }
          }
        }
      }
    }).catch(err => {
      console.error('LLM school lookup failed:', err.message);
      return { schools: [] };
    });

    const schools = (llmResult.schools || []).map(s => ({
      ...s,
      zipcode,
      website: ''
    }));

    return Response.json({ schools, source: llmResult.schools?.length > 0 ? 'llm' : 'not_found' });

  } catch (error) {
    console.error('lookupSchoolsByZip error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});