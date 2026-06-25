import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/process-rules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { processAllDueRules } = await import("@/lib/rule-engine-runner.server");
        try {
          const result = await processAllDueRules();
          return Response.json(result);
        } catch (e) {
          return new Response((e as Error).message, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});
