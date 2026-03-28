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

    // Get all unique zip codes from directory
    const allSchools = await base44.asServiceRole.entities.SchoolDirectory.list('-created_date', 10000);
    const uniqueZips = [...new Set(allSchools.map(s => s.zipcode))].filter(Boolean);

    if (uniqueZips.length === 0) {
      console.log('[NIGHTLY] No zip codes in directory yet. Run importNCESSchools first.');
      return Response.json({ status: 'no_zips' });
    }

    // Get current rotation index
    const settings = await base44.asServiceRole.entities.AppSettings.filter({ key: 'nightly_zip_refresh_index' });
    let currentIndex = settings[0] ? parseInt(settings[0].value) || 0 : 0;
    if (currentIndex >= uniqueZips.length) currentIndex = 0; // wrap around

    const zip = uniqueZips[currentIndex];
    console.log(`[NIGHTLY] Processing zip ${zip} (${currentIndex + 1}/${uniqueZips.length})`);

    // Step 1: Refresh school directory for this zip via LLM
    const schoolsInZip = allSchools.filter(s => s.zipcode === zip);
    console.log(`[NIGHTLY] Found ${schoolsInZip.length} existing schools for zip ${zip}`);

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Find all middle schools and high schools located in or serving US zip code ${zip}. For each school return: school_name, school_type (middle, high, or middle_high), city, state, district, and official website URL if known. Return empty array if nothing found.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          schools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                school_name: { type: 'string' },
                school_type: { type: 'string', enum: ['middle', 'high', 'middle_high'] },
                city: { type: 'string' },
                state: { type: 'string' },
                district: { type: 'string' },
                website: { type: 'string' }
              }
            }
          }
        }
      }
    }).catch(err => {
      console.error(`[NIGHTLY] School lookup failed for zip ${zip}:`, err.message);
      return { schools: [] };
    });

    const freshSchools = llmResult.schools || [];
    console.log(`[NIGHTLY] LLM returned ${freshSchools.length} schools for zip ${zip}`);

    // Delete stale records for this zip and re-insert fresh ones
    for (const s of schoolsInZip) {
      await base44.asServiceRole.entities.SchoolDirectory.delete(s.id);
    }
    for (const school of freshSchools) {
      await base44.asServiceRole.entities.SchoolDirectory.create({ ...school, zipcode: zip });
    }
    console.log(`[NIGHTLY] Directory refreshed for zip ${zip}: ${freshSchools.length} schools`);

    // Step 2: Refresh course catalog documents for schools in this zip
    const schoolsToProcess = freshSchools.length > 0 ? freshSchools : schoolsInZip;
    let docsRefreshed = 0;

    for (const school of schoolsToProcess) {
      const schoolName = school.school_name;
      const city = school.city || '';

      const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({
        school_name: schoolName,
        zipcode: zip
      });
      const cache = existingCache[0];

      // Skip if cache is still valid (not expired)
      if (cache && cache.expires_at && new Date(cache.expires_at) > new Date()) {
        console.log(`[NIGHTLY] Cache still valid for ${schoolName} — skipping`);
        continue;
      }

      console.log(`[NIGHTLY] Fetching course catalog for ${schoolName}...`);

      const docResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Find official document URLs for "${schoolName}"${city ? ' in ' + city : ''} (zip ${zip}). Search their official school/district website for:
1. Course Catalog PDF or webpage (high school and middle school)
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
      }).catch(err => {
        console.error(`[NIGHTLY] Doc lookup failed for ${schoolName}:`, err.message);
        return null;
      });

      if (!docResult) continue;

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

      if (cache) {
        await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, cacheData);
      } else {
        await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
      }

      docsRefreshed++;
      console.log(`[NIGHTLY] Docs updated for ${schoolName}: ${Object.keys(documentUrls).length} URLs`);

      await new Promise(r => setTimeout(r, 500));
    }

    // Advance the rotation index
    const nextIndex = (currentIndex + 1) % uniqueZips.length;
    if (settings[0]) {
      await base44.asServiceRole.entities.AppSettings.update(settings[0].id, { value: String(nextIndex) });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'nightly_zip_refresh_index', value: String(nextIndex) });
    }

    console.log(`[NIGHTLY] Done. Next run will process zip index ${nextIndex} (${uniqueZips[nextIndex] || 'wrap'})`);

    return Response.json({
      status: 'success',
      zip,
      schools_refreshed: freshSchools.length,
      docs_refreshed: docsRefreshed,
      next_zip_index: nextIndex,
      total_zips: uniqueZips.length,
    });

  } catch (error) {
    console.error('[NIGHTLY] Fatal error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});