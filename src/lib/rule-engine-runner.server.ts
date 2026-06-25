// Server-only runner used by manual "Run now" and the cron route.
import {
  contactMatches,
  computeNextRun,
  renderTemplate,
  type Conditions,
  type FrequencyConfig,
} from "./rule-engine.server";
import { sendEmail, sendSms, sendCall, type SendResult } from "./senders.server";

export interface RunSummary {
  matched: number;
  sends: number;
  ok: boolean;
}

export async function processRuleForUser(userId: string, ruleId: string): Promise<RunSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rule, error: re } = await supabaseAdmin
    .from("outreach_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!rule) throw new Error("Rule not found");

  const { data: contacts, error: ce } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .eq("user_id", userId);
  if (ce) throw new Error(ce.message);

  const conds = (rule.conditions ?? {}) as Conditions;
  const matched = (contacts ?? []).filter((c) => contactMatches(c, conds));

  let sends = 0;
  for (const contact of matched) {
    const subject = renderTemplate(rule.message_subject ?? "", contact);
    const body = renderTemplate(rule.message_body ?? "", contact);
    for (const channel of rule.channels) {
      let r: SendResult;
      if (channel === "email") r = await sendEmail({ to: contact.email ?? "", subject, body });
      else if (channel === "sms") r = await sendSms({ to: contact.phone ?? "", body });
      else if (channel === "call") r = await sendCall({ to: contact.phone ?? "", body });
      else r = { status: "skipped", detail: `Unknown channel ${channel}` };

      await supabaseAdmin.from("outreach_logs").insert({
        user_id: userId,
        rule_id: rule.id,
        contact_id: contact.id,
        channel,
        status: r.status,
        detail: r.detail,
      });
      if (r.status === "sent") sends++;
    }
  }

  const next =
    rule.frequency_type === "one_time"
      ? null
      : computeNextRun(rule.frequency_type, (rule.frequency_config ?? {}) as FrequencyConfig);

  await supabaseAdmin
    .from("outreach_rules")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: next ? next.toISOString() : new Date(Date.now() + 365 * 86_400_000).toISOString(),
      enabled: rule.frequency_type === "one_time" ? false : rule.enabled,
    })
    .eq("id", rule.id);

  return { matched: matched.length, sends, ok: true };
}

export async function processAllDueRules(): Promise<{ processed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: due, error } = await supabaseAdmin
    .from("outreach_rules")
    .select("id,user_id")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString())
    .limit(100);
  if (error) throw new Error(error.message);

  let n = 0;
  for (const r of due ?? []) {
    try {
      await processRuleForUser(r.user_id, r.id);
      n++;
    } catch (e) {
      console.error("rule run failed", r.id, e);
    }
  }
  return { processed: n };
}
