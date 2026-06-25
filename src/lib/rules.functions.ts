import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeNextRun, type FrequencyConfig, type Conditions } from "./rule-engine.server";

const ChannelEnum = z.enum(["email", "sms", "call"]);
const FreqEnum = z.enum(["daily", "weekly", "monthly", "custom_days", "one_time"]);

const Conds = z.object({
  days_since_last_contact: z.number().int().min(0).max(3650).optional(),
  status: z.enum(["lead", "prospect", "customer", "lost"]).optional(),
  deal_value: z
    .object({ op: z.enum([">", "<", "="]), value: z.number() })
    .optional(),
  birthday_within_days: z.number().int().min(0).max(366).optional(),
});

const FreqCfg = z.object({
  weekday: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
  every_n_days: z.number().int().min(1).max(365).optional(),
  run_at: z.string().optional(),
  hour: z.number().int().min(0).max(23).optional(),
});

const RuleInput = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  channels: z.array(ChannelEnum).min(1),
  conditions: Conds.default({}),
  frequency_type: FreqEnum,
  frequency_config: FreqCfg.default({}),
  message_subject: z.string().max(200).optional(),
  message_body: z.string().max(2000).default(""),
});

export const listRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("outreach_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: z.infer<typeof RuleInput> }) => ({
    id: d.id,
    values: RuleInput.parse(d.values),
  }))
  .handler(async ({ data, context }) => {
    const v = data.values;
    const next =
      v.frequency_type === "one_time"
        ? v.frequency_config.run_at
          ? new Date(v.frequency_config.run_at)
          : new Date()
        : computeNextRun(v.frequency_type, v.frequency_config as FrequencyConfig);

    const payload = {
      user_id: context.userId,
      name: v.name,
      enabled: v.enabled,
      channels: v.channels,
      conditions: v.conditions as Conditions,
      frequency_type: v.frequency_type,
      frequency_config: v.frequency_config,
      message_subject: v.message_subject ?? null,
      message_body: v.message_body,
      next_run_at: (next ?? new Date()).toISOString(),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("outreach_rules")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("outreach_rules").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const toggleRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("outreach_rules")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("outreach_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runRuleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { processRuleForUser } = await import("./rule-engine-runner.server");
    const result = await processRuleForUser(context.userId, data.id);
    return result;
  });
