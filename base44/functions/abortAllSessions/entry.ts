import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Use service role to access ALL users' plans
    const allPlans = await base44.asServiceRole.entities.CareerPlan.list();
    const stuck = allPlans.filter(p => p.is_generating);

    await Promise.all(
      stuck.map(p => base44.asServiceRole.entities.CareerPlan.update(p.id, { is_generating: false }))
    );

    console.log(`Aborted ${stuck.length} stuck sessions`);
    return Response.json({ aborted: stuck.length });
  } catch (error) {
    console.error('abortAllSessions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});