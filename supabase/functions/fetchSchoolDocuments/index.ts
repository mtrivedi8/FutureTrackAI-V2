import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { isAdminOrServiceRole } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (!(await isAdminOrServiceRole(req))) return jsonResponse({ error: 'Forbidden' }, 403);

    const { data: allSchools = [] } = await supabaseAdmin
      .from('school_directory').select('*').order('updated_date', { ascending: false }).limit(10000);
    const allUniqueZips = [...new Set(allSchools.map((s) => s.zipcode))].filter(Boolean);

    const { data: settingsRows } = await supabaseAdmin
      .from('app_settings').select('*').eq('key', 'doc_discovery_zip_index').limit(1);
    let currentIndex = settingsRows?.[0] ? parseInt(settingsRows[0].value) || 0 : 0;
    if (currentIndex >= allUniqueZips.length) currentIndex = 0;

    const BATCH_SIZE = 1;
    const uniqueZipcodes = allUniqueZips.slice(currentIndex, currentIndex + BATCH_SIZE);

    let processed = 0;
    let documentsFound = 0;

    for (const zipcode of uniqueZipcodes) {
      const schoolsInZip = allSchools.filter((s) => s.zipcode === zipcode);
      if (schoolsInZip.length === 0) continue;

      const schoolName = schoolsInZip[0].school_name;
      const city = schoolsInZip[0].city || '';

      const { data: existingCacheRows } = await supabaseAdmin
        .from('school_document_cache').select('*').eq('school_name', schoolName).eq('zipcode', zipcode).limit(1);
      const cache = existingCacheRows?.[0];
      const now = new Date();
      if (cache?.document_urls && Object.keys(cache.document_urls).length > 0 && cache.expires_at && new Date(cache.expires_at) > now) {
        processed++;
        continue;
      }

      const llmTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout after 25s')), 25000));
      const docResult = await Promise.race([
        invokeLLM({ source: 'fetchSchoolDocuments',
          prompt: `Find direct download links and document URLs for "${schoolName}"${city ? ' in ' + city : ''}${zipcode ? ' (zip ' + zipcode + ')' : ''} from their official school/district websites.

Search for and return URLs to:
1. Course Catalog PDF or webpage (middle school and high school)
2. School Handbook or Student Handbook PDF
3. Graduation Requirements document or page
4. Program Guide (AP, Honors, IB, Dual Enrollment if offered)
5. School Website homepage
6. District website homepage

Return ONLY direct URLs to official documents/pages. Verify each URL is current and accessible.`,
          webSearch: true,
          schema: {
            type: 'object',
            properties: {
              school_website: { type: 'string' },
              district_website: { type: 'string' },
              course_catalog_url: { type: 'string' },
              student_handbook_url: { type: 'string' },
              graduation_requirements_url: { type: 'string' },
              program_guide_url: { type: 'string' },
              notes: { type: 'string' },
            },
          },
        }),
        llmTimeout,
      ]).catch((err) => {
        console.warn(`Document lookup failed for ${schoolName}:`, (err as Error).message);
        return null;
      }) as any;

      if (!docResult) { processed++; continue; }

      const documentUrls: Record<string, string> = {};
      let urlCount = 0;
      if (docResult.school_website) { documentUrls.school_website = docResult.school_website; urlCount++; }
      if (docResult.district_website) { documentUrls.district_website = docResult.district_website; urlCount++; }
      if (docResult.course_catalog_url) { documentUrls.course_catalog = docResult.course_catalog_url; urlCount++; }
      if (docResult.student_handbook_url) { documentUrls.student_handbook = docResult.student_handbook_url; urlCount++; }
      if (docResult.graduation_requirements_url) { documentUrls.graduation_requirements = docResult.graduation_requirements_url; urlCount++; }
      if (docResult.program_guide_url) { documentUrls.program_guide = docResult.program_guide_url; urlCount++; }

      const cacheData = {
        school_name: schoolName, zipcode, document_urls: documentUrls,
        cached_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (cache) {
        await supabaseAdmin.from('school_document_cache').update(cacheData).eq('id', cache.id);
      } else {
        await supabaseAdmin.from('school_document_cache').insert(cacheData);
      }

      documentsFound += urlCount;
      processed++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const nextIndex = currentIndex + BATCH_SIZE;
    const wrappedIndex = nextIndex >= allUniqueZips.length ? 0 : nextIndex;
    if (settingsRows?.[0]) {
      await supabaseAdmin.from('app_settings').update({ value: String(wrappedIndex) }).eq('id', settingsRows[0].id);
    } else {
      await supabaseAdmin.from('app_settings').insert({ key: 'doc_discovery_zip_index', value: String(wrappedIndex) });
    }

    return jsonResponse({
      status: 'success', zipcodes_processed: processed, documents_found: documentsFound,
      next_index: wrappedIndex, total_zips: allUniqueZips.length,
    });
  } catch (error) {
    console.error('fetchSchoolDocuments error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
