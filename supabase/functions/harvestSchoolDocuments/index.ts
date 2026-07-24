import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

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

    const { data: existing } = await supabaseAdmin
      .from('school_document_cache').select('*').eq('school_name', school_name).eq('zipcode', zipcode).limit(1);
    const cache = existing?.[0];
    if (cache?.expires_at && new Date(cache.expires_at) > new Date() && cache.document_urls && Object.keys(cache.document_urls).length > 0) {
      return jsonResponse({ status: 'cached', document_urls: cache.document_urls });
    }

    const docResult = await invokeLLM({
      prompt: `Find official document URLs for "${school_name}"${city ? ' in ' + city : ''} (zip ${zipcode}). Search their official school/district website for:
1. Course Catalog PDF or webpage
2. School website homepage
3. Graduation requirements page or document
4. Program guide (AP/Honors/IB if offered)
5. Student handbook

Return ONLY verified URLs from official school or district sources.`,
      webSearch: true,
      schema: {
        type: 'object',
        properties: {
          school_website: { type: 'string' },
          course_catalog_url: { type: 'string' },
          graduation_requirements_url: { type: 'string' },
          program_guide_url: { type: 'string' },
          student_handbook_url: { type: 'string' },
        },
      },
    });

    const documentUrls: Record<string, string> = {};
    if (docResult?.school_website) documentUrls.school_website = docResult.school_website;
    if (docResult?.course_catalog_url) documentUrls.course_catalog = docResult.course_catalog_url;
    if (docResult?.graduation_requirements_url) documentUrls.graduation_requirements = docResult.graduation_requirements_url;
    if (docResult?.program_guide_url) documentUrls.program_guide = docResult.program_guide_url;
    if (docResult?.student_handbook_url) documentUrls.student_handbook = docResult.student_handbook_url;

    const cacheData = {
      school_name, zipcode, document_urls: documentUrls,
      cached_date: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    if (cache) {
      await supabaseAdmin.from('school_document_cache').update(cacheData).eq('id', cache.id);
    } else {
      await supabaseAdmin.from('school_document_cache').insert(cacheData);
    }

    return jsonResponse({ status: 'harvested', document_urls: documentUrls });
  } catch (error) {
    console.error('harvestSchoolDocuments error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
