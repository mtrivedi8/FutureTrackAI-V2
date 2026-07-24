import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (user?.role !== 'admin') return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);

    const { data: allPlans = [] } = await supabaseAdmin.from('career_plans').select('*');
    const stuck = allPlans.filter((p) => p.is_generating);

    await Promise.all(
      stuck.map((p) => supabaseAdmin.from('career_plans').update({ is_generating: false }).eq('id', p.id))
    );

    return jsonResponse({ aborted: stuck.length });
  } catch (error) {
    console.error('abortAllSessions error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
