import { supabaseAdmin } from './supabaseAdmin.ts';
import { invokeLLM } from './llm.ts';

export interface SchoolDocumentUrls {
  school_website?: string;
  course_catalog?: string;
  graduation_requirements?: string;
  program_guide?: string;
  student_handbook?: string;
}

/**
 * Finds (and caches) official document URLs for a school - course catalog,
 * website, graduation requirements, etc. Shared by harvestSchoolDocuments
 * (on-demand, triggered from SchoolSearch.jsx) and generateAcademicPlan
 * (which needs the real catalog to scan rather than guessing at courses).
 * Uses a low web-search budget to stay well under the edge function's
 * compute-time limit.
 */
export async function discoverSchoolDocuments(opts: {
  schoolName: string;
  zipcode: string;
  city?: string;
  source: string;
}): Promise<{ cacheId: string | null; documentUrls: SchoolDocumentUrls; fromCache: boolean }> {
  const { schoolName, zipcode, city, source } = opts;

  const { data: existing } = await supabaseAdmin
    .from('school_document_cache').select('*').eq('school_name', schoolName).eq('zipcode', zipcode).limit(1);
  const cache = existing?.[0];
  const isFresh = cache?.expires_at && new Date(cache.expires_at) > new Date();
  if (isFresh && cache.document_urls && Object.keys(cache.document_urls).length > 0) {
    return { cacheId: cache.id, documentUrls: cache.document_urls, fromCache: true };
  }

  const docResult = await invokeLLM({
    source,
    prompt: `Find official document URLs for "${schoolName}"${city ? ' in ' + city : ''} (zip ${zipcode}). Search their official school/district website for:
1. Course Catalog PDF or webpage
2. School website homepage
3. Graduation requirements page or document
4. Program guide (AP/Honors/IB if offered)

Return ONLY verified URLs from official sources. Be quick and direct.`,
    webSearch: true,
    maxUses: 3,
    effort: 'low',
    maxTokens: 1500,
    schema: {
      type: 'object',
      properties: {
        school_website: { type: 'string' },
        course_catalog_url: { type: 'string' },
        graduation_requirements_url: { type: 'string' },
        program_guide_url: { type: 'string' },
      },
    },
  });

  const documentUrls: SchoolDocumentUrls = {};
  if (docResult?.school_website) documentUrls.school_website = docResult.school_website;
  if (docResult?.course_catalog_url) documentUrls.course_catalog = docResult.course_catalog_url;
  if (docResult?.graduation_requirements_url) documentUrls.graduation_requirements = docResult.graduation_requirements_url;
  if (docResult?.program_guide_url) documentUrls.program_guide = docResult.program_guide_url;

  const cacheData = {
    school_name: schoolName,
    zipcode,
    document_urls: documentUrls,
    cached_date: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };

  let cacheId = cache?.id ?? null;
  if (cache) {
    await supabaseAdmin.from('school_document_cache').update(cacheData).eq('id', cache.id);
  } else {
    const { data: inserted } = await supabaseAdmin.from('school_document_cache').insert(cacheData).select().single();
    cacheId = inserted?.id ?? null;
  }

  return { cacheId, documentUrls, fromCache: false };
}
