// Pure logic: condition evaluation + next-run computation.
// Safe to import from server functions and the cron route.

import type { Database } from "@/integrations/supabase/types";

type Rule = Database["public"]["Tables"]["outreach_rules"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export interface Conditions {
  days_since_last_contact?: number;
  status?: Contact["status"];
  deal_value?: { op: ">" | "<" | "="; value: number };
  birthday_within_days?: number;
}

export interface FrequencyConfig {
  weekday?: number; // 0=Sun..6=Sat
  day_of_month?: number; // 1..31
  every_n_days?: number;
  run_at?: string; // ISO for one-time
  hour?: number; // 0..23 default 9
}

export function contactMatches(contact: Contact, conditions: Conditions): boolean {
  if (conditions.status && contact.status !== conditions.status) return false;

  if (typeof conditions.days_since_last_contact === "number") {
    const last = contact.last_contacted_at ? new Date(contact.last_contacted_at).getTime() : 0;
    const days = (Date.now() - last) / 86_400_000;
    if (days < conditions.days_since_last_contact) return false;
  }

  if (conditions.deal_value) {
    const v = Number(contact.deal_value ?? 0);
    const t = conditions.deal_value.value;
    if (conditions.deal_value.op === ">" && !(v > t)) return false;
    if (conditions.deal_value.op === "<" && !(v < t)) return false;
    if (conditions.deal_value.op === "=" && v !== t) return false;
  }

  if (typeof conditions.birthday_within_days === "number") {
    if (!contact.birthday) return false;
    const today = new Date();
    const bd = new Date(contact.birthday);
    const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      next.setFullYear(today.getFullYear() + 1);
    }
    const days = (next.getTime() - today.getTime()) / 86_400_000;
    if (days > conditions.birthday_within_days) return false;
  }

  return true;
}

export function computeNextRun(
  frequencyType: string,
  cfg: FrequencyConfig,
  from: Date = new Date(),
): Date | null {
  const hour = typeof cfg.hour === "number" ? cfg.hour : 9;
  const base = new Date(from);
  base.setSeconds(0, 0);

  switch (frequencyType) {
    case "daily": {
      const n = new Date(base);
      n.setHours(hour, 0, 0, 0);
      if (n <= from) n.setDate(n.getDate() + 1);
      return n;
    }
    case "weekly": {
      const target = cfg.weekday ?? 1;
      const n = new Date(base);
      n.setHours(hour, 0, 0, 0);
      const diff = (target - n.getDay() + 7) % 7;
      n.setDate(n.getDate() + diff);
      if (n <= from) n.setDate(n.getDate() + 7);
      return n;
    }
    case "monthly": {
      const dom = cfg.day_of_month ?? 1;
      const n = new Date(base.getFullYear(), base.getMonth(), dom, hour, 0, 0, 0);
      if (n <= from) n.setMonth(n.getMonth() + 1);
      return n;
    }
    case "custom_days": {
      const every = Math.max(1, cfg.every_n_days ?? 7);
      const n = new Date(base);
      n.setHours(hour, 0, 0, 0);
      n.setDate(n.getDate() + every);
      return n;
    }
    case "one_time": {
      // One-time rules don't re-arm.
      return null;
    }
    default:
      return null;
  }
}

export function renderTemplate(
  tmpl: string,
  contact: Pick<Contact, "name" | "email" | "company">,
): string {
  return tmpl
    .replaceAll("{{name}}", contact.name ?? "")
    .replaceAll("{{email}}", contact.email ?? "")
    .replaceAll("{{company}}", contact.company ?? "");
}

export type RuleRow = Rule;
export type ContactRow = Contact;
