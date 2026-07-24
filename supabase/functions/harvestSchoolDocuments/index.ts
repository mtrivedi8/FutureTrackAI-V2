import { getAuthedUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { discoverSchoolDocuments } from '../_shared/schoolDocs.ts';

// On-demand harvest: fetch curriculum document URLs for a single school.
// Called fire-and-forget from SchoolSearch.jsx when the cache is missing.
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { school_name, zipcode, city } = await req.json();
    if (!school_name || !zipcode) return jsonResponse({ error: 'school_name and zipcode required' }, 400);

    const { documentUrls, fromCache } = await discoverSchoolDocuments({
      schoolName: school_name, zipcode, city, source: 'harvestSchoolDocuments',
    });

    return jsonResponse({ status: fromCache ? 'cached' : 'harvested', document_urls: documentUrls });
  } catch (error) {
    console.error('harvestSchoolDocuments error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
