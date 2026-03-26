import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MONTHLY_CAP = 5.0;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, cost } = await req.json();
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    const records = await base44.asServiceRole.entities.UsageCredit.filter({
      user_email: user.email,
      month,
    });

    let record = records[0];

    if (action === 'check') {
      if (!record) return Response.json({ blocked: false, total_cost: 0, cap: MONTHLY_CAP });
      return Response.json({
        blocked: record.blocked || record.total_cost >= MONTHLY_CAP,
        total_cost: record.total_cost,
        cap: MONTHLY_CAP,
      });
    }

    if (action === 'add') {
      const newTotal = (record?.total_cost || 0) + (cost || 0);
      const blocked = newTotal >= MONTHLY_CAP;

      if (record) {
        await base44.asServiceRole.entities.UsageCredit.update(record.id, {
          total_cost: newTotal,
          blocked,
        });
      } else {
        await base44.asServiceRole.entities.UsageCredit.create({
          user_email: user.email,
          month,
          total_cost: newTotal,
          blocked,
        });
      }

      return Response.json({ blocked, total_cost: newTotal, cap: MONTHLY_CAP });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('trackUsage error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});