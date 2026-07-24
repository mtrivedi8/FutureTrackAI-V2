import { supabaseAdmin } from './supabaseAdmin.ts';

/** Best-effort log write - never throws, so logging failures can't break the caller. */
export async function logEvent(
  functionName: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  detail?: unknown,
  userEmail?: string
) {
  try {
    await supabaseAdmin.from('function_logs').insert({
      function_name: functionName,
      level,
      message,
      detail: detail === undefined ? null : JSON.parse(JSON.stringify(detail)),
      user_email: userEmail ?? null,
    });
  } catch (err) {
    console.error('[logEvent] failed to write log:', (err as Error).message);
  }
}
