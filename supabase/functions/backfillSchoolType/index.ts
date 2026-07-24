import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user || user.role !== 'admin') return jsonResponse({ error: 'Admin access required' }, 403);

    const { data: caches = [] } = await supabaseAdmin
      .from('school_document_cache').select('*').order('created_date', { ascending: false }).limit(1000);

    let updated = 0;
    for (const cache of caches) {
      try {
        const { data: schools = [] } = await supabaseAdmin
          .from('school_directory').select('*').eq('zipcode', cache.zipcode).eq('school_name', cache.school_name);

        if (schools.length > 0) {
          const schoolType = schools[0].school_type;
          const updatedData = { ...(cache.cached_data || {}), school_type: schoolType };
          await supabaseAdmin.from('school_document_cache').update({ cached_data: updatedData }).eq('id', cache.id);
          updated++;
        }
      } catch (err) {
        console.error(`Error processing ${cache.school_name}:`, (err as Error).message);
      }
    }

    return jsonResponse({ success: true, message: `Updated ${updated} records with school_type` });
  } catch (error) {
    console.error('backfillSchoolType error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
