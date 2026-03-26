import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Overnight job: refresh school directory for all zip codes that have been searched
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all unique zip codes currently in the directory
    const allRecords = await base44.asServiceRole.entities.SchoolDirectory.list('-created_date', 1000);
    const uniqueZips = [...new Set(allRecords.map(r => r.zipcode))];

    console.log(`Refreshing ${uniqueZips.length} zip codes...`);

    // Clear all existing records
    for (const record of allRecords) {
      await base44.asServiceRole.entities.SchoolDirectory.delete(record.id);
    }
    console.log(`Cleared ${allRecords.length} records`);

    // Re-fetch each zip code
    let totalAdded = 0;
    for (const zip of uniqueZips) {
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Search the web and return all middle schools and high schools located in or serving US zip code ${zip}. Include school name, city, state, school type (middle, high, or middle_high), and district name. Return an empty array if nothing found.`,
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
        for (const school of schools) {
          await base44.asServiceRole.entities.SchoolDirectory.create({ ...school, zipcode: zip });
        }
        totalAdded += schools.length;
        console.log(`Zip ${zip}: ${schools.length} schools`);
      } catch (e) {
        console.error(`Failed zip ${zip}:`, e.message);
      }
    }

    console.log(`Refresh complete. Added ${totalAdded} schools across ${uniqueZips.length} zip codes.`);
    return Response.json({ refreshed_zips: uniqueZips.length, total_schools: totalAdded });
  } catch (error) {
    console.error('refreshSchoolDirectory error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});