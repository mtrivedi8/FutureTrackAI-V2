import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { zipcode } = await req.json();
    if (!zipcode || !/^\d{5}$/.test(zipcode)) return jsonResponse({ error: 'Invalid zip code' }, 400);

    const { data: existing = [] } = await supabaseAdmin.from('school_directory').select('*').eq('zipcode', zipcode);
    if (existing.length > 0) return jsonResponse({ schools: existing, source: 'directory' });

    const result = await invokeLLM({
      prompt: `Find all middle schools and high schools in the ${zipcode} zip code area. For each school, provide: school_name, school_type (middle or high), city, state, district. Return as JSON array.`,
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
                school_type: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                district: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const schools = (result?.schools || []).map((s: any) => ({ ...s, zipcode, website: '' }));
    return jsonResponse({ schools, source: schools.length > 0 ? 'llm' : 'not_found' });
  } catch (error) {
    console.error('lookupSchoolsByZip error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
