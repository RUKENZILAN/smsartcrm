import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("outreach_logs")
      .select("*, contacts(name,email,phone), outreach_rules(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [contacts, rules, logs] = await Promise.all([
      context.supabase.from("contacts").select("id", { count: "exact", head: true }),
      context.supabase.from("outreach_rules").select("id, enabled, next_run_at, name"),
      context.supabase
        .from("outreach_logs")
        .select("status,created_at")
        .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    ]);
    const sent = (logs.data ?? []).filter((l) => l.status === "sent").length;
    const failed = (logs.data ?? []).filter((l) => l.status === "failed").length;
    const skipped = (logs.data ?? []).filter((l) => l.status === "skipped").length;
    const upcoming = (rules.data ?? [])
      .filter((r) => r.enabled)
      .sort((a, b) => +new Date(a.next_run_at) - +new Date(b.next_run_at))
      .slice(0, 5);
    return {
      contactCount: contacts.count ?? 0,
      activeRules: (rules.data ?? []).filter((r) => r.enabled).length,
      totalRules: (rules.data ?? []).length,
      last7: { sent, failed, skipped },
      upcoming,
    };
  });
