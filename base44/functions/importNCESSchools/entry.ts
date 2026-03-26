import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PUBLIC_SCHOOLS_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/0e8df2dcbbc54e13833344e2ca8c0fa4/csv?layers=0';
const PRIVATE_SCHOOLS_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/1c004a108b18460bba1ddb29ec1f7982/csv?layers=0';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

function parseCSV(text) {
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

async function fetchAndParseCSV(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return parseCSV(text);
  } catch (err) {
    console.error(`Failed to fetch CSV from ${url}:`, err.message);
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get current state progress
    const settings = await base44.asServiceRole.entities.AppSettings.filter({ key: 'school_import_state_index' });
    const currentIndex = settings[0] ? parseInt(settings[0].value) || 0 : 0;

    if (currentIndex >= US_STATES.length) {
      return Response.json({ status: 'complete', message: 'All states imported' });
    }

    console.log('Fetching NCES school data...');
    
    // Fetch both public and private school data
    const [publicSchools, privateSchools] = await Promise.all([
      fetchAndParseCSV(PUBLIC_SCHOOLS_URL),
      fetchAndParseCSV(PRIVATE_SCHOOLS_URL),
    ]);

    console.log(`Fetched ${publicSchools.length} public schools and ${privateSchools.length} private schools`);

    // Process single state
    const stateCode = US_STATES[currentIndex];
    const stateSchools = [];
    
    // Batch fetch websites for schools in this state
    const schoolNames = [...new Set([
      ...publicSchools.filter(s => s.STATE === stateCode).map(s => s.NAME),
      ...privateSchools.filter(s => s.STATE === stateCode).map(s => s.NAME)
    ])].slice(0, 30); // Limit to 30 per batch to avoid timeouts
    
    let websiteMap = {};
    if (schoolNames.length > 0) {
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Find official website URLs for these schools in ${stateCode}. Return a JSON object with school name as key and website URL as value (empty string if not found): ${JSON.stringify(schoolNames)}`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: { type: 'object', additionalProperties: { type: 'string' } }
        });
        websiteMap = result || {};
      } catch (e) {
        console.warn('Website lookup failed, continuing without websites:', e.message);
      }
    }
    
    // Public schools for this state
    for (const school of publicSchools) {
      if (school.STATE !== stateCode || !school.NAME || !school.ZIP) continue;
      stateSchools.push({
        school_name: school.NAME,
        city: school.CITY || '',
        state: stateCode,
        zipcode: String(school.ZIP).padStart(5, '0'),
        district: school.NMLEAID || '',
        school_type: 'high',
        website: websiteMap[school.NAME] || '',
      });
    }
    
    // Private schools for this state
    for (const school of privateSchools) {
      if (school.STATE !== stateCode || !school.NAME || !school.ZIP) continue;
      stateSchools.push({
        school_name: school.NAME,
        city: school.CITY || '',
        state: stateCode,
        zipcode: String(school.ZIP).padStart(5, '0'),
        district: '',
        school_type: 'high',
        website: websiteMap[school.NAME] || '',
      });
    }
    
    // Remove duplicates within state
    const seen = new Set();
    const uniqueState = stateSchools.filter(s => {
      const key = `${s.school_name}|${s.zipcode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Insert state schools in smaller batches with delays
    let stateImported = 0;
    if (uniqueState.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < uniqueState.length; i += batchSize) {
        const batch = uniqueState.slice(i, i + batchSize);
        try {
          await base44.asServiceRole.entities.SchoolDirectory.bulkCreate(batch);
          stateImported += batch.length;
        } catch (e) {
          console.warn(`Batch ${Math.floor(i / batchSize) + 1} failed for ${stateCode}, stopping`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      console.log(`Imported ${stateImported} schools for ${stateCode}`);
    }
    
    // Update progress
    const nextIndex = currentIndex + 1;
    if (settings[0]) {
      await base44.asServiceRole.entities.AppSettings.update(settings[0].id, { value: String(nextIndex) });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'school_import_state_index', value: String(nextIndex) });
    }
    
    const remaining = US_STATES.length - nextIndex;

    console.log(`Imported ${stateImported} schools for state ${currentIndex + 1}/${US_STATES.length}`);

    return Response.json({ 
      status: 'success', 
      state: stateCode,
      schools_imported: stateImported,
      progress: `${currentIndex + 1}/${US_STATES.length}`,
      states_remaining: remaining,
    });
  } catch (error) {
    console.error('importNCESSchools error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});