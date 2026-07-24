import { supabaseAdmin } from './supabaseAdmin.ts';

function safeSerialize(value: unknown) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (val instanceof Error) return { message: val.message, name: val.name, stack: val.stack };
        if (typeof val === 'bigint') return val.toString();
        return val;
      })
    );
  } catch {
    try {
      return { unserializable: true, stringValue: String(value) };
    } catch {
      return { unserializable: true };
    }
  }
}

/** Best-effort log write - never throws, so logging failures can't break the caller. */
export async function logEvent(
  functionName: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  detail?: unknown,
  userEmail?: string
) {
  try {
    const { error } = await supabaseAdmin.from('function_logs').insert({
      function_name: functionName,
      level,
      message,
      detail: detail === undefined ? null : safeSerialize(detail),
      user_email: userEmail ?? null,
    });
    if (error) console.error('[logEvent] insert error:', error.message);
  } catch (err) {
    console.error('[logEvent] failed to write log:', (err as Error)?.message ?? String(err));
  }
}
