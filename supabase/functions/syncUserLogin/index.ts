import { getAuthedUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    return jsonResponse({
      success: true,
      user_email: user.email,
      full_name: user.full_name,
      user_id: user.id,
      logged_in_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('syncUserLogin error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
