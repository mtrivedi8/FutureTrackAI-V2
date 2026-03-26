import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { zipcode } = await req.json();
    if (!zipcode || !/^\d{5}$/.test(zipcode)) {
      return Response.json({ error: 'Invalid zip code' }, { status: 400 });
    }

    // Look up from DB only (seeded nightly by seedSchoolDirectory)
    const existing = await base44.asServiceRole.entities.SchoolDirectory.filter({ zipcode });
    if (existing.length > 0) {
      console.log(`Found ${existing.length} schools for zip ${zipcode} in directory`);
      return Response.json({ schools: existing, source: 'directory' });
    }

    // Not yet seeded — return empty, UI will allow manual entry
    console.log(`No schools found in directory for zip ${zipcode}`);
    return Response.json({ schools: [], source: 'not_found' });

    // (LLM fallback removed — directory is seeded nightly by seedSchoolDirectory)
  } catch (error) {
    console.error('lookupSchoolsByZip error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});