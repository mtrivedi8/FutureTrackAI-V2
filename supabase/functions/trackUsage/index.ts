import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const MONTHLY_CAP = 5.0;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { action, cost } = await req.json();
    const month = new Date().toISOString().slice(0, 7);

    const { data: records } = await supabaseAdmin
      .from('usage_credits').select('*').eq('user_email', user.email).eq('month', month).limit(1);
    const record = records?.[0];

    if (action === 'check') {
      if (!record) return jsonResponse({ blocked: false, total_cost: 0, cap: MONTHLY_CAP });
      return jsonResponse({
        blocked: record.blocked || record.total_cost >= MONTHLY_CAP,
        total_cost: record.total_cost,
        cap: MONTHLY_CAP,
      });
    }

    if (action === 'add') {
      const newTotal = (record?.total_cost || 0) + (cost || 0);
      const blocked = newTotal >= MONTHLY_CAP;

      if (record) {
        await supabaseAdmin.from('usage_credits').update({ total_cost: newTotal, blocked }).eq('id', record.id);
      } else {
        await supabaseAdmin.from('usage_credits').insert({ user_email: user.email, month, total_cost: newTotal, blocked });
      }

      return jsonResponse({ blocked, total_cost: newTotal, cap: MONTHLY_CAP });
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('trackUsage error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
