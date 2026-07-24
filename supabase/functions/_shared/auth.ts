import { supabaseAdmin } from './supabaseAdmin.ts';

export interface AuthedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
}

/** Validates the caller's access token and loads their profile row. Returns null if unauthenticated. */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, role')
    .eq('id', data.user.id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email!,
    full_name: profile?.full_name ?? data.user.user_metadata?.full_name ?? null,
    role: (profile?.role as 'admin' | 'user') ?? 'user',
  };
}

/**
 * True if the caller is either an admin user, or the request is coming from
 * our own infra (pg_cron / another edge function) authenticated with the
 * service-role key. Use this for system jobs like nightlyZipRefresh that
 * have no end-user attached but still shouldn't be publicly invocable.
 */
export function isServiceRoleCaller(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return !!token && !!serviceKey && token === serviceKey;
}

export async function isAdminOrServiceRole(req: Request): Promise<boolean> {
  if (isServiceRoleCaller(req)) return true;
  const user = await getAuthedUser(req);
  return user?.role === 'admin';
}
