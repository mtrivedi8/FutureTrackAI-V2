import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PUBLIC_SCHOOLS_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/0e8df2dcbbc54e13833344e2ca8c0fa4/csv?layers=0';
const PRIVATE_SCHOOLS_URL = 'https://data-nces.opendata.arcgis.com/api/download/v1/items/1c004a108b18460bba1ddb29ec1f7982/csv?layers=0';

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

    console.log('Fetching NCES school data...');
    
    // Fetch both public and private school data in parallel
    const [publicSchools, privateSchools] = await Promise.all([
      fetchAndParseCSV(PUBLIC_SCHOOLS_URL),
      fetchAndParseCSV(PRIVATE_SCHOOLS_URL),
    ]);

    console.log(`Fetched ${publicSchools.length} public schools and ${privateSchools.length} private schools`);

    // Transform and normalize data
    const schoolsToImport = [];
    
    // Process public schools
    for (const school of publicSchools) {
      if (!school.NAME || !school.ZIP) continue;
      schoolsToImport.push({
        school_name: school.NAME,
        city: school.CITY || '',
        state: school.STATE || '',
        zipcode: String(school.ZIP).padStart(5, '0'),
        district: school.NMLEAID || '',
        school_type: 'high',
      });
    }

    // Process private schools
    for (const school of privateSchools) {
      if (!school.NAME || !school.ZIP) continue;
      schoolsToImport.push({
        school_name: school.NAME,
        city: school.CITY || '',
        state: school.STATE || '',
        zipcode: String(school.ZIP).padStart(5, '0'),
        district: '',
        school_type: 'high',
      });
    }

    // Remove duplicates
    const seen = new Set();
    const uniqueSchools = schoolsToImport.filter(s => {
      const key = `${s.school_name}|${s.zipcode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Importing ${uniqueSchools.length} unique schools...`);

    // Clear existing data and bulk insert
    const existing = await base44.asServiceRole.entities.SchoolDirectory.filter({});
    for (const record of existing) {
      await base44.asServiceRole.entities.SchoolDirectory.delete(record.id);
    }

    await base44.asServiceRole.entities.SchoolDirectory.bulkCreate(uniqueSchools);

    console.log(`Successfully imported ${uniqueSchools.length} schools`);

    return Response.json({ 
      status: 'success', 
      schools_imported: uniqueSchools.length,
      public_schools: publicSchools.length,
      private_schools: privateSchools.length,
    });
  } catch (error) {
    console.error('importNCESSchools error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});