import Anthropic from 'npm:@anthropic-ai/sdk@0.68';

// Replaces base44's hosted LLM gateway (`integrations.Core.InvokeLLM`).
// Always uses Claude Opus 4.8 per project defaults. Structured JSON output is
// obtained by forcing a single "submit_result" tool call whose input_schema
// is the caller's desired schema; optional web grounding uses Anthropic's
// server-side web_search tool (executes inline, no extra round trip needed).

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const MODEL = 'claude-opus-4-8';

export interface InvokeLLMOptions {
  prompt: string;
  schema: Record<string, unknown>;
  webSearch?: boolean;
  maxUses?: number;
  /** URLs of PDFs/documents to attach as context (e.g. a course catalog). */
  fileUrls?: string[];
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
}

async function fetchAsBase64Document(url: string): Promise<{ type: 'document'; source: { type: 'base64'; media_type: string; data: string } } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'application/pdf';
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return {
      type: 'document',
      source: { type: 'base64', media_type: contentType.split(';')[0], data: btoa(binary) },
    };
  } catch (err) {
    console.warn('[llm] failed to fetch document', url, (err as Error).message);
    return null;
  }
}

async function runOnce(opts: InvokeLLMOptions, forceTool: boolean): Promise<any | null> {
  const tools: Anthropic.Tool[] = [];
  if (opts.webSearch) {
    tools.push({
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: opts.maxUses ?? 5,
    } as unknown as Anthropic.Tool);
  }
  tools.push({
    name: 'submit_result',
    description: 'Call this exactly once with the final answer, matching the schema.',
    input_schema: opts.schema as Anthropic.Tool.InputSchema,
  });

  const content: Anthropic.MessageParam['content'] = [];
  for (const url of opts.fileUrls ?? []) {
    const doc = await fetchAsBase64Document(url);
    if (doc) content.push(doc as any);
  }
  content.push({ type: 'text', text: opts.prompt });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: opts.effort ?? 'high' },
    tools,
    tool_choice: forceTool && !opts.webSearch ? { type: 'tool', name: 'submit_result' } : { type: 'auto' },
    messages: [{ role: 'user', content }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_result'
  );
  return toolUse ? toolUse.input : null;
}

/** Invokes Claude and returns the parsed structured result, or null if it never called submit_result. */
export async function invokeLLM(opts: InvokeLLMOptions): Promise<any | null> {
  try {
    const first = await runOnce(opts, true);
    if (first) return first;
  } catch (err) {
    console.error('[llm] first attempt failed:', (err as Error).message);
  }

  // Fallback: force the tool call directly (mirrors base44's multi-model
  // fallback - here we retry once without web search, forcing the answer).
  try {
    return await runOnce({ ...opts, webSearch: false }, true);
  } catch (err) {
    console.error('[llm] fallback attempt failed:', (err as Error).message);
    return null;
  }
}
