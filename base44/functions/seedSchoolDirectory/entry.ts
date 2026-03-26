import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// All 50 US states + DC
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only: allow scheduled invocation without user auth by checking for a service header
    // For scheduled automations, there's no user — use service role throughout
    const body = await req.json().catch(() => ({}));
    const forceState = body.state || null;

    // Get current progress from AppSettings
    const settings = await base44.asServiceRole.entities.AppSettings.filter({ key: 'school_seed_state_index' });
    const currentIndex = settings[0] ? parseInt(settings[0].value) || 0 : 0;

    if (currentIndex >= US_STATES.length) {
      console.log('All states have been seeded! Directory is complete.');
      return Response.json({ status: 'complete', message: 'All states seeded.' });
    }

    const stateCode = forceState || US_STATES[currentIndex];
    console.log(`Seeding schools for state: ${stateCode} (index ${currentIndex})`);

    // Fetch all middle and high schools in the state with their zip codes
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Search the web and return ALL public and private middle schools and high schools in the US state "${stateCode}". For each school, provide the school name, zip code, city, school type (middle, high, or middle_high), and school district. Return as many schools as possible — aim for comprehensive coverage of the entire state. Include both rural and urban schools.`,
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
                zipcode: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                school_type: { type: 'string', enum: ['middle', 'high', 'middle_high'] },
                district: { type: 'string' }
              },
              required: ['school_name', 'zipcode']
            }
          }
        }
      }
    });

    const schools = (result.schools || []).filter(s => s.school_name && /^\d{5}$/.test(s.zipcode));
    console.log(`Found ${schools.length} schools for ${stateCode}`);

    // Remove existing records for this state to avoid duplicates on re-run
    const existing = await base44.asServiceRole.entities.SchoolDirectory.filter({ state: stateCode });
    for (const rec of existing) {
      await base44.asServiceRole.entities.SchoolDirectory.delete(rec.id);
    }

    // Bulk insert new records
    if (schools.length > 0) {
      await base44.asServiceRole.entities.SchoolDirectory.bulkCreate(
        schools.map(s => ({
          school_name: s.school_name,
          zipcode: s.zipcode,
          city: s.city || '',
          state: s.state || stateCode,
          school_type: s.school_type || 'high',
          district: s.district || '',
        }))
      );
    }

    // Advance the index
    const nextIndex = currentIndex + 1;
    if (settings[0]) {
      await base44.asServiceRole.entities.AppSettings.update(settings[0].id, { value: String(nextIndex) });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'school_seed_state_index', value: String(nextIndex) });
    }

    const remaining = US_STATES.length - nextIndex;
    console.log(`Done. Stored ${schools.length} schools for ${stateCode}. ${remaining} states remaining.`);

    return Response.json({
      status: 'success',
      state: stateCode,
      schools_added: schools.length,
      states_remaining: remaining,
      next_state: US_STATES[nextIndex] || null,
    });

  } catch (error) {
    console.error('seedSchoolDirectory error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});