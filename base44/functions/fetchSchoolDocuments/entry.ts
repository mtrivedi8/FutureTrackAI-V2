import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all unique zipcodes from SchoolDirectory
    const allSchools = await base44.asServiceRole.entities.SchoolDirectory.list('-updated_date', 10000);
    const allUniqueZips = [...new Set(allSchools.map(s => s.zipcode))].filter(Boolean);

    // Use a rotating index so each run processes a different batch
    const settings = await base44.asServiceRole.entities.AppSettings.filter({ key: 'doc_discovery_zip_index' });
    let currentIndex = settings[0] ? parseInt(settings[0].value) || 0 : 0;
    if (currentIndex >= allUniqueZips.length) currentIndex = 0;

    // Process only 3 zips per run to avoid timeouts
    const BATCH_SIZE = 3;
    const uniqueZipcodes = allUniqueZips.slice(currentIndex, currentIndex + BATCH_SIZE);

    console.log(`[FETCH_DOCS] Processing zips ${currentIndex}–${currentIndex + uniqueZipcodes.length - 1} of ${allUniqueZips.length}`);

    let processed = 0;
    let documentsFound = 0;

    for (const zipcode of uniqueZipcodes) {
      const schoolsInZip = allSchools.filter(s => s.zipcode === zipcode);
      if (schoolsInZip.length === 0) continue;

      const schoolName = schoolsInZip[0].school_name;
      const city = schoolsInZip[0].city || '';

      // Check if cache already exists and is recent and valid
      const existingCache = await base44.asServiceRole.entities.SchoolDocumentCache.filter({
        school_name: schoolName,
        zipcode: zipcode
      });

      const cache = existingCache[0];
      const now = new Date();
      if (cache && cache.document_urls && Object.keys(cache.document_urls).length > 0) {
        const expiresAt = new Date(cache.expires_at);
        if (expiresAt > now) {
          console.log(`Cache still valid for ${schoolName} (${zipcode}) — skipping`);
          processed++;
          continue;
        }
      }

      console.log(`Fetching documents for ${schoolName} (${zipcode})...`);

      const docResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Find direct download links and document URLs for "${schoolName}"${city ? ' in ' + city : ''}${zipcode ? ' (zip ' + zipcode + ')' : ''} from their official school/district websites.

Search for and return URLs to:
1. Course Catalog PDF or webpage (middle school and high school)
2. School Handbook or Student Handbook PDF
3. Graduation Requirements document or page
4. Program Guide (AP, Honors, IB, Dual Enrollment if offered)
5. School Website homepage
6. District website homepage

Return ONLY direct URLs to official documents/pages. Verify each URL is current and accessible.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            school_website: { type: 'string' },
            district_website: { type: 'string' },
            course_catalog_url: { type: 'string' },
            student_handbook_url: { type: 'string' },
            graduation_requirements_url: { type: 'string' },
            program_guide_url: { type: 'string' },
            notes: { type: 'string' }
          }
        }
      }).catch(err => {
        console.warn(`Document lookup failed for ${schoolName}:`, err.message);
        return null;
      });

      if (!docResult) {
        processed++;
        continue;
      }

      const documentUrls = {};
      let urlCount = 0;

      if (docResult.school_website) { documentUrls.school_website = docResult.school_website; urlCount++; }
      if (docResult.district_website) { documentUrls.district_website = docResult.district_website; urlCount++; }
      if (docResult.course_catalog_url) { documentUrls.course_catalog = docResult.course_catalog_url; urlCount++; }
      if (docResult.student_handbook_url) { documentUrls.student_handbook = docResult.student_handbook_url; urlCount++; }
      if (docResult.graduation_requirements_url) { documentUrls.graduation_requirements = docResult.graduation_requirements_url; urlCount++; }
      if (docResult.program_guide_url) { documentUrls.program_guide = docResult.program_guide_url; urlCount++; }

      const cacheData = {
        school_name: schoolName,
        zipcode: zipcode,
        document_urls: documentUrls,
        cached_date: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (cache) {
        await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, cacheData);
      } else {
        await base44.asServiceRole.entities.SchoolDocumentCache.create(cacheData);
      }

      documentsFound += urlCount;
      processed++;
      console.log(`Saved ${urlCount} document URLs for ${schoolName}`);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Advance index for next run
    const nextIndex = currentIndex + BATCH_SIZE;
    const wrappedIndex = nextIndex >= allUniqueZips.length ? 0 : nextIndex;
    if (settings[0]) {
      await base44.asServiceRole.entities.AppSettings.update(settings[0].id, { value: String(wrappedIndex) });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'doc_discovery_zip_index', value: String(wrappedIndex) });
    }

    console.log(`[FETCH_DOCS] Done. Next run starts at index ${wrappedIndex}`);
    return Response.json({
      status: 'success',
      zipcodes_processed: processed,
      documents_found: documentsFound,
      next_index: wrappedIndex,
      total_zips: allUniqueZips.length,
    });

  } catch (error) {
    console.error('fetchSchoolDocuments error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});