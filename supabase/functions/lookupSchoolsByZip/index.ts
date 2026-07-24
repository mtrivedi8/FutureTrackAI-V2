import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { logEvent } from '../_shared/log.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

async function searchAndCache(zipcode: string, userEmail: string) {
  await logEvent('lookupSchoolsByZip', 'info', `background search started for zip ${zipcode}`, undefined, userEmail);
  try {
    const result = await invokeLLM({ source: 'lookupSchoolsByZip',
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

    const schools = (result?.schools || [])
      .filter((s: any) => s.school_name)
      .map((s: any) => ({
        school_name: s.school_name,
        school_type: ['middle', 'high', 'middle_high'].includes(s.school_type) ? s.school_type : 'high',
        city: s.city || '',
        state: s.state || '',
        district: s.district || '',
        zipcode,
        website: '',
      }));

    if (schools.length > 0) {
      // Cache in school_directory so future lookups for this zip are instant and free.
      const { error: insertError } = await supabaseAdmin.from('school_directory').insert(schools);
      if (insertError) {
        await logEvent('lookupSchoolsByZip', 'warn', 'Failed to cache LLM results in school_directory', { message: insertError.message }, userEmail);
      }
    } else {
      await logEvent('lookupSchoolsByZip', 'info', `No schools found for zip ${zipcode}`, undefined, userEmail);
    }
  } catch (err) {
    await logEvent('lookupSchoolsByZip', 'error', 'Background search failed', { message: (err as Error)?.message }, userEmail);
  }
}

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

    // A web-search LLM call can take well over a minute, longer than an edge
    // function is allowed to run synchronously - kick it off in the
    // background and let the client poll school_directory for results.
    const hasWaitUntil = typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function';
    await logEvent('lookupSchoolsByZip', 'info', `dispatching background search, hasWaitUntil=${hasWaitUntil}`, undefined, user.email);
    const work = searchAndCache(zipcode, user.email);
    try {
      if (hasWaitUntil) {
        EdgeRuntime.waitUntil(work);
      } else {
        work.catch((err) => console.error('searchAndCache error:', err.message));
      }
    } catch {
      // ignore - work is already running regardless
    }

    return jsonResponse({ schools: [], source: 'pending' });
  } catch (error) {
    console.error('lookupSchoolsByZip error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
