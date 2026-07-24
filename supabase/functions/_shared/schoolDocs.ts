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

Each field must be either a real, directly-usable URL starting with http:// or https://, or omitted entirely. Never put explanations, hedging, or unverified guesses in a URL field - if you are not sure of the exact URL, leave that field out.`,
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

  const isRealUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim());

  const documentUrls: SchoolDocumentUrls = {};
  if (isRealUrl(docResult?.school_website)) documentUrls.school_website = docResult.school_website.trim();
  if (isRealUrl(docResult?.course_catalog_url)) documentUrls.course_catalog = docResult.course_catalog_url.trim();
  if (isRealUrl(docResult?.graduation_requirements_url)) documentUrls.graduation_requirements = docResult.graduation_requirements_url.trim();
  if (isRealUrl(docResult?.program_guide_url)) documentUrls.program_guide = docResult.program_guide_url.trim();

  const cacheData = {
    school_name: schoolName,
    zipcode,
    document_urls: documentUrls,
    cached_date: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const { data: upserted } = await supabaseAdmin
    .from('school_document_cache')
    .upsert(cacheData, { onConflict: 'school_name,zipcode' })
    .select()
    .single();

  return { cacheId: upserted?.id ?? cache?.id ?? null, documentUrls, fromCache: false };
}
