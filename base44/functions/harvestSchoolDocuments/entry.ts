import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * On-demand harvest: fetch curriculum document URLs for a single school.
 * Called in fire-and-forget fashion from the frontend when cache is missing.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { school_name, zipcode, city } = await req.json();

    if (!school_name || !zipcode) {
      return Response.json({ error: 'school_name and zipcode required' }, { status: 400 });
    }

    // Check if valid fresh cache already exists
    const existing = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ school_name, zipcode });
    const cache = existing[0];
    if (cache && cache.expires_at && new Date(cache.expires_at) > new Date() && cache.document_urls && Object.keys(cache.document_urls).length > 0) {
      console.log(`[HARVEST] Cache still valid for ${school_name} — skipping`);
      return Response.json({ status: 'cached', document_urls: cache.document_urls });
    }

    console.log(`[HARVEST] Looking up documents for ${school_name} (zip ${zipcode})...`);

    const docResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find official document URLs for "${school_name}"${city ? ' in ' + city : ''} (zip ${zipcode}). Search their official school/district website for:
1. Course Catalog PDF or webpage
2. School website homepage
3. Graduation requirements page or document
4. Program guide (AP/Honors/IB if offered)
5. Student handbook

Return ONLY verified URLs from official school or district sources.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          school_website: { type: 'string' },
          course_catalog_url: { type: 'string' },
          graduation_requirements_url: { type: 'string' },
          program_guide_url: { type: 'string' },
          student_handbook_url: { type: 'string' }
        }
      }
    });

    const documentUrls = {};
    if (docResult.school_website) documentUrls.school_website = docResult.school_website;
    if (docResult.course_catalog_url) documentUrls.course_catalog = docResult.course_catalog_url;
    if (docResult.graduation_requirements_url) documentUrls.graduation_requirements = docResult.graduation_requirements_url;
    if (docResult.program_guide_url) documentUrls.program_guide = docResult.program_guide_url;
    if (docResult.student_handbook_url) documentUrls.student_handbook = docResult.student_handbook_url;

    const cacheData = {
      school_name,
      zipcode,
      document_urls: documentUrls,
      cached_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (cache) {
      await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, cacheData);
    } else {
      await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
    }

    console.log(`[HARVEST] Done for ${school_name}: ${Object.keys(documentUrls).length} URLs found`);
    return Response.json({ status: 'harvested', document_urls: documentUrls });

  } catch (error) {
    console.error('[HARVEST] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});