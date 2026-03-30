import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Nightly job: process ONE zip code per run.
 * - Refreshes school directory for that zip via NCES/LLM
 * - Refreshes course catalog documents for those schools
 * Rotates through all zip codes in the SchoolDirectory nightly.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Load all settings in one call
    const allSettings = await base44.asServiceRole.entities.AppSettings.filter({});
    const settingsByKey = {};
    for (const s of allSettings) settingsByKey[s.key] = s;

    // Get or build cached zip list (avoid fetching 10k records every run)
    let uniqueZips = [];
    const zipListSetting = settingsByKey['nightly_zip_list'];
    if (zipListSetting?.value) {
      uniqueZips = JSON.parse(zipListSetting.value);
    } else {
      // Build zip list once and cache it
      const allSchools = await base44.asServiceRole.entities.SchoolDirectory.list('-created_date', 10000);
      uniqueZips = [...new Set(allSchools.map(s => s.zipcode))].filter(Boolean);
      const zipJson = JSON.stringify(uniqueZips);
      await base44.asServiceRole.entities.AppSettings.create({ key: 'nightly_zip_list', value: zipJson });
      console.log(`[NIGHTLY] Built zip list cache: ${uniqueZips.length} zips`);
    }

    if (uniqueZips.length === 0) {
      console.log('[NIGHTLY] No zip codes in directory yet. Run importNCESSchools first.');
      return Response.json({ status: 'no_zips' });
    }

    // Get current rotation index
    const indexSetting = settingsByKey['nightly_zip_refresh_index'];
    let currentIndex = indexSetting ? parseInt(indexSetting.value) || 0 : 0;
    if (currentIndex >= uniqueZips.length) currentIndex = 0;

    const zip = uniqueZips[currentIndex];

    // Fetch only schools for this specific zip (not all schools)
    const schoolsInZip = await base44.asServiceRole.entities.SchoolDirectory.filter({ zipcode: zip });
    console.log(`[NIGHTLY] Processing zip ${zip} (${currentIndex + 1}/${uniqueZips.length}), ${schoolsInZip.length} schools`);

    // Batch-fetch all existing caches for this zip at once
    const allCaches = await base44.asServiceRole.entities.SchoolDocumentCache.filter({ zipcode: zip });
    const cacheByName = {};
    for (const c of allCaches) cacheByName[c.school_name] = c;

    // Find the first school with a missing or expired cache
    let schoolToRefresh = null;
    let existingCache = null;
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
      console.log(`[NIGHTLY] Fetching course catalog for ${schoolName}...`);

      const llmTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout after 25s')), 25000)
      );

      const docResult = await Promise.race([
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Find official document URLs for "${schoolName}"${city ? ' in ' + city : ''} (zip ${zip}). Search their official school/district website for:
1. Course Catalog PDF or webpage
2. School website homepage
3. Graduation requirements page or document
4. Program guide (AP/Honors/IB if offered)

Return ONLY verified URLs from official sources.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              school_website: { type: 'string' },
              course_catalog_url: { type: 'string' },
              graduation_requirements_url: { type: 'string' },
              program_guide_url: { type: 'string' }
            }
          }
        }),
        llmTimeout
      ]).catch(err => {
        console.error(`[NIGHTLY] Doc lookup failed for ${schoolName}:`, err.message);
        return null;
      });

      if (docResult) {
        const documentUrls = {};
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
          await base44.asServiceRole.entities.SchoolDocumentCache.update(existingCache.id, cacheData);
        } else {
          await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
        }
        docsRefreshed = 1;
        console.log(`[NIGHTLY] Docs updated for ${schoolName}: ${Object.keys(documentUrls).length} URLs`);
      }
    } else {
      console.log(`[NIGHTLY] All schools in zip ${zip} have valid cache — skipping`);
    }

    // Advance the rotation index
    const nextIndex = (currentIndex + 1) % uniqueZips.length;
    if (indexSetting) {
      await base44.asServiceRole.entities.AppSettings.update(indexSetting.id, { value: String(nextIndex) });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'nightly_zip_refresh_index', value: String(nextIndex) });
    }

    console.log(`[NIGHTLY] Done. Next run: zip index ${nextIndex}`);

    return Response.json({
      status: 'success',
      zip,
      docs_refreshed: docsRefreshed,
      next_zip_index: nextIndex,
      total_zips: uniqueZips.length,
    });

  } catch (error) {
    console.error('[NIGHTLY] Fatal error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});