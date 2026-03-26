import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all SchoolDocumentCache records
    const caches = await base44.asServiceRole.entities.SchoolDocumentCache.list('-created_date', 1000);
    
    let updated = 0;
    
    for (const cache of caches) {
      try {
        // Find matching school in SchoolDirectory
        const schools = await base44.asServiceRole.entities.SchoolDirectory.filter({
          zipcode: cache.zipcode,
          school_name: cache.school_name
        });
        
        if (schools.length > 0) {
          const school = schools[0];
          const schoolType = school.school_type; // "middle", "high", or "middle_high"
          
          // Update cached_data with school_type
          const updatedData = {
            ...cache.cached_data,
            school_type: schoolType
          };
          
          await base44.asServiceRole.entities.SchoolDocumentCache.update(cache.id, {
            cached_data: updatedData
          });
          
          updated++;
          console.log(`Updated ${cache.school_name} (${cache.zipcode}) with school_type: ${schoolType}`);
        }
      } catch (err) {
        console.error(`Error processing ${cache.school_name}:`, err.message);
      }
    }
    
    return Response.json({ 
      success: true, 
      message: `Updated ${updated} records with school_type`
    });
  } catch (error) {
    console.error('backfillSchoolType error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});