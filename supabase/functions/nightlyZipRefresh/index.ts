import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { isAdminOrServiceRole } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

// Nightly job (see supabase/migrations/0002_cron.sql): process ONE zip code
// per run - refresh school directory + course-catalog document cache for it.
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    if (!(await isAdminOrServiceRole(req))) return jsonResponse({ error: 'Forbidden' }, 403);

    const { data: allSettings = [] } = await supabaseAdmin.from('app_settings').select('*');
    const settingsByKey: Record<string, any> = {};
    for (const s of allSettings) settingsByKey[s.key] = s;

    let uniqueZips: string[] = [];
    const zipListSetting = settingsByKey['nightly_zip_list'];
    if (zipListSetting?.value) {
      uniqueZips = JSON.parse(zipListSetting.value);
    } else {
      const { data: allSchools = [] } = await supabaseAdmin
        .from('school_directory').select('zipcode').order('created_date', { ascending: false }).limit(10000);
      uniqueZips = [...new Set(allSchools.map((s) => s.zipcode))].filter(Boolean);
      await supabaseAdmin.from('app_settings').insert({ key: 'nightly_zip_list', value: JSON.stringify(uniqueZips) });
    }

    if (uniqueZips.length === 0) return jsonResponse({ status: 'no_zips' });

    const indexSetting = settingsByKey['nightly_zip_refresh_index'];
    let currentIndex = indexSetting ? parseInt(indexSetting.value) || 0 : 0;
    if (currentIndex >= uniqueZips.length) currentIndex = 0;

    const zip = uniqueZips[currentIndex];
    const { data: schoolsInZip = [] } = await supabaseAdmin.from('school_directory').select('*').eq('zipcode', zip);

    const { data: allCaches = [] } = await supabaseAdmin.from('school_document_cache').select('*').eq('zipcode', zip);
    const cacheByName: Record<string, any> = {};
    for (const c of allCaches) cacheByName[c.school_name] = c;

    let schoolToRefresh: any = null;
    let existingCache: any = null;
    for (const school of schoolsInZip) {
      const cache = cacheByName[school.school_name];
      if (!cache || !cache.expires_at || new Date(cache.expires_at) <= new Date()) {
        schoolToRefresh = school;
        existingCache = cache || null;
        break;
      }
    }

    let docsRefreshed = 0;

    if (schoolToRefresh) {
      const schoolName = schoolToRefresh.school_name;
      const city = schoolToRefresh.city || '';

      const llmTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout after 25s')), 25000));
      const docResult = await Promise.race([
        invokeLLM({ source: 'nightlyZipRefresh',
          prompt: `Find official document URLs for "${schoolName}"${city ? ' in ' + city : ''} (zip ${zip}). Search their official school/district website for:
1. Course Catalog PDF or webpage
2. School website homepage
3. Graduation requirements page or document
4. Program guide (AP/Honors/IB if offered)

Return ONLY verified URLs from official sources.`,
          webSearch: true,
          schema: {
            type: 'object',
            properties: {
              school_website: { type: 'string' },
              course_catalog_url: { type: 'string' },
              graduation_requirements_url: { type: 'string' },
              program_guide_url: { type: 'string' },
            },
          },
        }),
        llmTimeout,
      ]).catch((err) => {
        console.error(`Doc lookup failed for ${schoolName}:`, (err as Error).message);
        return null;
      }) as any;

      if (docResult) {
        const documentUrls: Record<string, string> = {};
        if (docResult.school_website) documentUrls.school_website = docResult.school_website;
        if (docResult.course_catalog_url) documentUrls.course_catalog = docResult.course_catalog_url;
        if (docResult.graduation_requirements_url) documentUrls.graduation_requirements = docResult.graduation_requirements_url;
        if (docResult.program_guide_url) documentUrls.program_guide = docResult.program_guide_url;

        const cacheData = {
          school_name: schoolName,
          zipcode: zip,
          document_urls: documentUrls,
          cached_date: new Date().toISOString(),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        };

        if (existingCache) {
          await supabaseAdmin.from('school_document_cache').update(cacheData).eq('id', existingCache.id);
        } else {
          await supabaseAdmin.from('school_document_cache').insert(cacheData);
        }
        docsRefreshed = 1;
      }
    }

    const nextIndex = (currentIndex + 1) % uniqueZips.length;
    if (indexSetting) {
      await supabaseAdmin.from('app_settings').update({ value: String(nextIndex) }).eq('id', indexSetting.id);
    } else {
      await supabaseAdmin.from('app_settings').insert({ key: 'nightly_zip_refresh_index', value: String(nextIndex) });
    }

    return jsonResponse({ status: 'success', zip, docs_refreshed: docsRefreshed, next_zip_index: nextIndex, total_zips: uniqueZips.length });
  } catch (error) {
    console.error('nightlyZipRefresh error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
