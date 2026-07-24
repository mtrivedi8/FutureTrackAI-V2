import { getAuthedUser } from '../_shared/auth.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { query } = await req.json();
    if (!query || query.length < 2) return jsonResponse({ schools: [] });

    const result = await invokeLLM({
      prompt: `Search for US middle schools and high schools (grades 6-12) whose name matches or contains "${query}".
Return real schools from across the United States. Include the school name, city, and state.
Return up to 20 results. Only include schools that actually exist.`,
      webSearch: true,
      schema: {
        type: 'object',
        properties: {
          schools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
              },
            },
          },
        },
      },
    });

    return jsonResponse({ schools: result?.schools || [] });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
