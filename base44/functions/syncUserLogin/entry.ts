import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // User is authenticated - the platform automatically handles User entity
    // This function confirms the user is in the system and logs them
    return Response.json({
      success: true,
      user_email: user.email,
      full_name: user.full_name,
      user_id: user.id,
      logged_in_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('syncUserLogin error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});