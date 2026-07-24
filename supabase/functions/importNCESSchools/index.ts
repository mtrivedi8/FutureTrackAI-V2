import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const PUBLIC_SCHOOLS_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/0e8df2dcbbc54e13833344e2ca8c0fa4/csv?layers=0';
const PRIVATE_SCHOOLS_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/1c004a108b18460bba1ddb29ec1f7982/csv?layers=0';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

function parseCSV(text: string) {
  const lines = text.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

async function fetchAndParseCSV(url: string) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return parseCSV(text);
  } catch (err) {
    console.error(`Failed to fetch CSV from ${url}:`, (err as Error).message);
    return [];
  }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (user?.role !== 'admin') return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);

    const { data: settingsRows } = await supabaseAdmin
      .from('app_settings').select('*').eq('key', 'school_import_state_index').limit(1);
    const currentIndex = settingsRows?.[0] ? parseInt(settingsRows[0].value) || 0 : 0;

    if (currentIndex >= US_STATES.length) return jsonResponse({ status: 'complete', message: 'All states imported' });

    const [publicSchools, privateSchools] = await Promise.all([
      fetchAndParseCSV(PUBLIC_SCHOOLS_URL),
      fetchAndParseCSV(PRIVATE_SCHOOLS_URL),
    ]);

    const stateCode = US_STATES[currentIndex];
    const stateSchools: any[] = [];

    const schoolNames = [...new Set([
      ...publicSchools.filter((s) => s.STATE === stateCode).map((s) => s.NAME),
      ...privateSchools.filter((s) => s.STATE === stateCode).map((s) => s.NAME),
    ])].slice(0, 30);

    let websiteMap: Record<string, string> = {};
    if (schoolNames.length > 0) {
      try {
        const result = await invokeLLM({ source: 'importNCESSchools',
          prompt: `Find official website URLs for these schools in ${stateCode}. Return a JSON object with school name as key and website URL as value (empty string if not found): ${JSON.stringify(schoolNames)}`,
          webSearch: true,
          schema: { type: 'object', properties: { websites: { type: 'object' } } },
        });
        websiteMap = result?.websites || {};
      } catch (e) {
        console.warn('Website lookup failed, continuing without websites:', (e as Error).message);
      }
    }

    for (const school of publicSchools) {
      if (school.STATE !== stateCode || !school.NAME || !school.ZIP) continue;
      stateSchools.push({
        school_name: school.NAME, city: school.CITY || '', state: stateCode,
        zipcode: String(school.ZIP).padStart(5, '0'), district: school.NMLEAID || '',
        school_type: 'high', website: websiteMap[school.NAME] || '',
      });
    }
    for (const school of privateSchools) {
      if (school.STATE !== stateCode || !school.NAME || !school.ZIP) continue;
      stateSchools.push({
        school_name: school.NAME, city: school.CITY || '', state: stateCode,
        zipcode: String(school.ZIP).padStart(5, '0'), district: '',
        school_type: 'high', website: websiteMap[school.NAME] || '',
      });
    }

    const seen = new Set<string>();
    const uniqueState = stateSchools.filter((s) => {
      const key = `${s.school_name}|${s.zipcode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let stateImported = 0;
    if (uniqueState.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < uniqueState.length; i += batchSize) {
        const batch = uniqueState.slice(i, i + batchSize);
        const { error } = await supabaseAdmin.from('school_directory').insert(batch);
        if (error) {
          console.warn(`Batch ${Math.floor(i / batchSize) + 1} failed for ${stateCode}, stopping`);
          break;
        }
        stateImported += batch.length;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const nextIndex = currentIndex + 1;
    if (settingsRows?.[0]) {
      await supabaseAdmin.from('app_settings').update({ value: String(nextIndex) }).eq('id', settingsRows[0].id);
    } else {
      await supabaseAdmin.from('app_settings').insert({ key: 'school_import_state_index', value: String(nextIndex) });
    }

    return jsonResponse({
      status: 'success',
      state: stateCode,
      schools_imported: stateImported,
      progress: `${currentIndex + 1}/${US_STATES.length}`,
      states_remaining: US_STATES.length - nextIndex,
    });
  } catch (error) {
    console.error('importNCESSchools error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
