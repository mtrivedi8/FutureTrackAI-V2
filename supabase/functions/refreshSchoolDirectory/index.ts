import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

// Overnight job: refresh school directory for all zip codes that have been searched.
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    // Admin-only: this wipes and re-fetches the entire directory via paid LLM calls.
    const user = await getAuthedUser(req);
    if (user?.role !== 'admin') return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);

    const { data: allRecords = [] } = await supabaseAdmin
      .from('school_directory').select('*').order('created_date', { ascending: false }).limit(1000);
    const uniqueZips = [...new Set(allRecords.map((r) => r.zipcode))];

    if (allRecords.length > 0) {
      await supabaseAdmin.from('school_directory').delete().in('id', allRecords.map((r) => r.id));
    }

    let totalAdded = 0;
    for (const zip of uniqueZips) {
      try {
        const result = await invokeLLM({
          prompt: `Search the web and return all middle schools and high schools located in or serving US zip code ${zip}. Include school name, city, state, school type (middle, high, or middle_high), and district name. Return an empty array if nothing found.`,
          webSearch: true,
          schema: {
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
                    district: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        const schools = result?.schools || [];
        if (schools.length > 0) {
          await supabaseAdmin.from('school_directory').insert(schools.map((s: any) => ({ ...s, zipcode: zip })));
        }
        totalAdded += schools.length;
      } catch (e) {
        console.error(`Failed zip ${zip}:`, (e as Error).message);
      }
    }

    return jsonResponse({ refreshed_zips: uniqueZips.length, total_schools: totalAdded });
  } catch (error) {
    console.error('refreshSchoolDirectory error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
