import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PUBLIC_CSV_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/0e8df2dcbbc54e13833344e2ca8c0fa4/csv?layers=0';
const PRIVATE_CSV_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/1c004a108b18460bba1ddb29ec1f7982/csv?layers=0';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV parse (handles quoted fields)
    const values = [];
    let inQuote = false;
    let current = '';
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function detectSchoolType(name) {
  const n = (name || '').toLowerCase();
  if (/\b(middle|junior high|jr\.?\s*high|6th|7th|8th)\b/.test(n)) return 'middle';
  if (/\b(high school|senior high|sr\.?\s*high|9th|10th|11th|12th)\b/.test(n)) return 'high';
  if (/\b(k-?12|secondary|6-12|7-12)\b/.test(n)) return 'middle_high';
  return null; // Not clearly a middle/high school — will be filtered out
}

function isMiddleOrHigh(name) {
  return detectSchoolType(name) !== null;
}

function normalizeZip(zip) {
  if (!zip) return '';
  const z = String(zip).replace(/\D/g, '').slice(0, 5);
  return z.padStart(5, '0');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const forceState = body.state || null; // optionally limit to one state

    // Get progress index
    const settings = await base44.asServiceRole.entities.AppSettings.filter({ key: 'nces_import_state_index' });
    const currentIndex = settings[0] ? parseInt(settings[0].value) || 0 : 0;

    if (!forceState && currentIndex >= US_STATES.length) {
      return Response.json({ status: 'complete', message: 'All states imported from NCES.' });
    }

    const stateCode = forceState || US_STATES[currentIndex];
    console.log(`[NCES Import] Processing state: ${stateCode} (index ${currentIndex})`);

    // Fetch both CSVs in parallel
    const [pubRes, privRes] = await Promise.all([
      fetch(PUBLIC_CSV_URL),
      fetch(PRIVATE_CSV_URL),
    ]);

    const [pubText, privText] = await Promise.all([
      pubRes.text(),
      privRes.text(),
    ]);

    console.log(`[NCES Import] Fetched CSVs. Public: ${pubText.length} chars, Private: ${privText.length} chars`);

    // Parse CSVs
    const publicRows = parseCSV(pubText);
    const privateRows = parseCSV(privText);

    // Filter for this state's middle/high schools
    const publicSchools = publicRows
      .filter(r => r.STATE === stateCode && isMiddleOrHigh(r.NAME))
      .map(r => ({
        school_name: r.NAME,
        zipcode: normalizeZip(r.ZIP),
        city: r.CITY,
        state: r.STATE,
        school_type: detectSchoolType(r.NAME),
        district: r.LEAID || '',
      }));

    const privateSchools = privateRows
      .filter(r => r.STATE === stateCode && isMiddleOrHigh(r.NAME))
      .map(r => ({
        school_name: r.NAME,
        zipcode: normalizeZip(r.ZIP),
        city: r.CITY,
        state: r.STATE,
        school_type: detectSchoolType(r.NAME),
        district: '',
      }));

    // Deduplicate by school_name + zipcode
    const seen = new Set();
    const allSchools = [...publicSchools, ...privateSchools].filter(s => {
      if (!s.school_name || !s.zipcode) return false;
      const key = `${s.school_name}|${s.zipcode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[NCES Import] ${stateCode}: ${publicSchools.length} public + ${privateSchools.length} private = ${allSchools.length} unique middle/high schools`);

    // Delete existing records for this state
    const existing = await base44.asServiceRole.entities.SchoolDirectory.filter({ state: stateCode });
    console.log(`[NCES Import] Deleting ${existing.length} existing records for ${stateCode}`);
    await Promise.all(existing.map(r => base44.asServiceRole.entities.SchoolDirectory.delete(r.id)));

    // Bulk insert in batches of 100
    const BATCH = 100;
    for (let i = 0; i < allSchools.length; i += BATCH) {
      const batch = allSchools.slice(i, i + BATCH);
      await base44.asServiceRole.entities.SchoolDirectory.bulkCreate(batch);
    }

    // Advance progress index
    if (!forceState) {
      const nextIndex = currentIndex + 1;
      if (settings[0]) {
        await base44.asServiceRole.entities.AppSettings.update(settings[0].id, { value: String(nextIndex) });
      } else {
        await base44.asServiceRole.entities.AppSettings.create({ key: 'nces_import_state_index', value: String(nextIndex) });
      }
      const remaining = US_STATES.length - nextIndex;
      console.log(`[NCES Import] Done ${stateCode}. ${remaining} states remaining.`);
      return Response.json({
        status: 'success',
        state: stateCode,
        schools_imported: allSchools.length,
        states_remaining: remaining,
        next_state: US_STATES[nextIndex] || null,
      });
    }

    return Response.json({ status: 'success', state: stateCode, schools_imported: allSchools.length });

  } catch (error) {
    console.error('[NCES Import] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});