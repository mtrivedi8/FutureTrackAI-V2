import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const SCHOOL_SCHEMA = {
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
          district: { type: 'string' },
        },
        required: ['school_name', 'zipcode'],
      },
    },
  },
};

async function fetchSchoolsForType(stateCode: string, schoolType: 'middle' | 'high') {
  const typeLabel = schoolType === 'middle' ? 'middle schools (grades 6-8)' : 'high schools (grades 9-12)';
  try {
    const result = await invokeLLM({
      prompt: `Search the web and return public and private ${typeLabel} in the US state "${stateCode}". For each school provide: school name, zip code (5 digits), city, school type (middle, high, or middle_high), and school district. Focus on accuracy of zip codes. Return up to 150 schools.`,
      webSearch: true,
      maxUses: 10,
      schema: SCHOOL_SCHEMA,
    });
    return (result?.schools || []).filter((s: any) => s.school_name && /^\d{5}$/.test(s.zipcode));
  } catch (err) {
    console.error(`Failed to fetch ${schoolType} schools for ${stateCode}:`, (err as Error).message);
    return [];
  }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    // Admin-only: this seeds/replaces state-wide directory data via paid LLM calls.
    const user = await getAuthedUser(req);
    if (user?.role !== 'admin') return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const forceState = body.state || null;

    const { data: settingsRows } = await supabaseAdmin
      .from('app_settings').select('*').eq('key', 'school_seed_state_index').limit(1);
    const currentIndex = settingsRows?.[0] ? parseInt(settingsRows[0].value) || 0 : 0;

    if (currentIndex >= US_STATES.length) {
      return jsonResponse({ status: 'complete', message: 'All states seeded.' });
    }

    const stateCode = forceState || US_STATES[currentIndex];

    const [middleSchools, highSchools] = await Promise.all([
      fetchSchoolsForType(stateCode, 'middle'),
      fetchSchoolsForType(stateCode, 'high'),
    ]);

    const seen = new Set<string>();
    const schools = [...middleSchools, ...highSchools].filter((s) => {
      const key = `${s.school_name}|${s.zipcode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { data: existingForState = [] } = await supabaseAdmin
      .from('school_directory').select('id').eq('state', stateCode);
    if (existingForState.length > 0) {
      await supabaseAdmin.from('school_directory').delete().eq('state', stateCode);
    }

    if (schools.length > 0) {
      await supabaseAdmin.from('school_directory').insert(
        schools.map((s: any) => ({
          school_name: s.school_name,
          zipcode: s.zipcode,
          city: s.city || '',
          state: s.state || stateCode,
          school_type: s.school_type || 'high',
          district: s.district || '',
        }))
      );
    }

    if (!forceState) {
      const nextIndex = currentIndex + 1;
      if (settingsRows?.[0]) {
        await supabaseAdmin.from('app_settings').update({ value: String(nextIndex) }).eq('id', settingsRows[0].id);
      } else {
        await supabaseAdmin.from('app_settings').insert({ key: 'school_seed_state_index', value: String(nextIndex) });
      }

      return jsonResponse({
        status: 'success',
        state: stateCode,
        schools_added: schools.length,
        states_remaining: US_STATES.length - nextIndex,
        next_state: US_STATES[nextIndex] || null,
      });
    }

    return jsonResponse({ status: 'success', state: stateCode, schools_added: schools.length });
  } catch (error) {
    console.error('seedSchoolDirectory error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
