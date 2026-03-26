import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query } = await req.json();
    if (!query || query.length < 2) return Response.json({ schools: [] });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Search for US middle schools and high schools (grades 6-12) whose name matches or contains "${query}".
Return real schools from across the United States. Include the school name, city, and state.
Return up to 20 results. Only include schools that actually exist.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          schools: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                city: { type: "string" },
                state: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({ schools: result.schools || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});