import { supabase } from '@/lib/supabaseClient';

// Thin shim over Supabase that mirrors the shape the app used to call
// through the base44 SDK (auth.me()/entities.X.filter()/functions.invoke()),
// so pages didn't need a rewrite - just a different backend underneath.

const TABLES = {
  TeenProfile: 'teen_profiles',
  CareerPlan: 'career_plans',
  JourneyEntry: 'journey_entries',
  Membership: 'memberships',
  ProgressUpdate: 'progress_updates',
  Recommendation: 'recommendations',
  AppSettings: 'app_settings',
  SchoolDirectory: 'school_directory',
  SchoolDocumentCache: 'school_document_cache',
  UsageCredit: 'usage_credits',
  Internship: 'internships',
};

function makeEntity(table) {
  return {
    async filter(query = {}, sort, limit) {
      let q = supabase.from(table).select('*').match(query);
      if (sort) {
        const desc = sort.startsWith('-');
        q = q.order(desc ? sort.slice(1) : sort, { ascending: !desc });
      }
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

const entities = Object.fromEntries(
  Object.entries(TABLES).map(([name, table]) => [name, makeEntity(table)])
);

async function me() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', session.user.id).single();

  return {
    id: session.user.id,
    email: session.user.email,
    full_name: profile?.full_name || session.user.user_metadata?.full_name || '',
    role: profile?.role || 'user',
  };
}

async function logout(redirectUrl) {
  await supabase.auth.signOut();
  window.location.href = redirectUrl || '/';
}

async function invoke(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Edge functions return a JSON body ({ error: "..." }) even on failure
    // status codes - surface that instead of throwing, so callers that read
    // response.data.error (e.g. the checkout flow) keep working.
    if (error.context?.json) {
      try {
        return { data: await error.context.json() };
      } catch {
        // fall through to throw below
      }
    }
    throw error;
  }
  return { data };
}

export const apiClient = {
  auth: { me, logout },
  entities,
  functions: { invoke },
};
