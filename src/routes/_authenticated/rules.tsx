import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listRules, upsertRule, deleteRule, toggleRule, runRuleNow } from "@/lib/rules.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, PlayCircle, Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Rule = Database["public"]["Tables"]["outreach_rules"]["Row"];

export const Route = createFileRoute("/_authenticated/rules")({
  head: () => ({ meta: [{ title: "Rules · Reach CRM" }] }),
  component: RulesPage,
});

const CHANNEL_ICONS = { email: Mail, sms: MessageSquare, call: Phone } as const;

function RulesPage() {
  const list = useServerFn(listRules);
  const upsert = useServerFn(upsertRule);
  const del = useServerFn(deleteRule);
  const toggle = useServerFn(toggleRule);
  const run = useServerFn(runRuleNow);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rules = [] } = useQuery({ queryKey: ["rules"], queryFn: () => list() });

  const upsertM = useMutation({
    mutationFn: (vars: { id?: string; values: Parameters<typeof upsert>[0]["data"]["values"] }) =>
      upsert({ data: vars }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["rules"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["rules"] }); },
  });
  const toggleM = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
  const runM = useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Matched ${r.matched} contact(s), ${r.sends} sent`);
      qc.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Outreach rules</h1>
          <p className="text-muted-foreground">Trigger an email, SMS, or call when conditions are met.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> New rule</Button>
          </DialogTrigger>
          <RuleDialog
            initial={editing}
            onSubmit={(values) => upsertM.mutate({ id: editing?.id, values })}
            saving={upsertM.isPending}
          />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {rules.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">No rules yet.</CardContent></Card>
        ) : rules.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <Switch checked={r.enabled} onCheckedChange={(v) => toggleM.mutate({ id: r.id, enabled: v })} />
              <div className="min-w-0 flex-1">
                <div className="font-medium flex items-center gap-2">
                  {r.name}
                  <div className="flex gap-1">
                    {r.channels.map((c) => {
                      const Icon = CHANNEL_ICONS[c as keyof typeof CHANNEL_ICONS] ?? Mail;
                      return <Icon key={c} className="size-3.5 text-muted-foreground" />;
                    })}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {describeFrequency(r)} · next {new Date(r.next_run_at).toLocaleString()}
                  {r.last_run_at && ` · last ${new Date(r.last_run_at).toLocaleString()}`}
                </div>
              </div>
              <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? "Active" : "Paused"}</Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => runM.mutate(r.id)} title="Run now">
                  <PlayCircle className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete ${r.name}?`)) delM.mutate(r.id); }}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function describeFrequency(r: Rule): string {
  const cfg = (r.frequency_config ?? {}) as { weekday?: number; day_of_month?: number; every_n_days?: number; run_at?: string };
  switch (r.frequency_type) {
    case "daily": return "Daily";
    case "weekly": return `Weekly (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][cfg.weekday ?? 1]})`;
    case "monthly": return `Monthly (day ${cfg.day_of_month ?? 1})`;
    case "custom_days": return `Every ${cfg.every_n_days ?? 7} days`;
    case "one_time": return `Once${cfg.run_at ? ` at ${new Date(cfg.run_at).toLocaleString()}` : ""}`;
    default: return r.frequency_type;
  }
}

type RuleValues = Parameters<typeof upsertRule>[0]["data"]["values"];

function RuleDialog({
  initial, onSubmit, saving,
}: {
  initial: Rule | null;
  onSubmit: (v: RuleValues) => void;
  saving: boolean;
}) {
  const initCfg = (initial?.frequency_config ?? {}) as { weekday?: number; day_of_month?: number; every_n_days?: number; run_at?: string; hour?: number };
  const initCond = (initial?.conditions ?? {}) as { days_since_last_contact?: number; status?: string; deal_value?: { op: ">"|"<"|"="; value: number }; birthday_within_days?: number };

  const [name, setName] = useState(initial?.name ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [channels, setChannels] = useState<string[]>(initial?.channels ?? ["email"]);
  const [subject, setSubject] = useState(initial?.message_subject ?? "");
  const [body, setBody] = useState(initial?.message_body ?? "Hi {{name}},\n\n");
  const [freq, setFreq] = useState<RuleValues["frequency_type"]>(
    (initial?.frequency_type as RuleValues["frequency_type"]) ?? "daily",
  );
  const [hour, setHour] = useState(initCfg.hour ?? 9);
  const [weekday, setWeekday] = useState(initCfg.weekday ?? 1);
  const [dom, setDom] = useState(initCfg.day_of_month ?? 1);
  const [everyN, setEveryN] = useState(initCfg.every_n_days ?? 7);
  const [runAt, setRunAt] = useState(initCfg.run_at?.slice(0, 16) ?? "");

  const [useDays, setUseDays] = useState(initCond.days_since_last_contact != null);
  const [days, setDays] = useState(initCond.days_since_last_contact ?? 14);
  const [useStatus, setUseStatus] = useState(!!initCond.status);
  const [statusCond, setStatusCond] = useState(initCond.status ?? "lead");
  const [useDeal, setUseDeal] = useState(!!initCond.deal_value);
  const [dealOp, setDealOp] = useState<">"|"<"|"=">(initCond.deal_value?.op ?? ">");
  const [dealVal, setDealVal] = useState(String(initCond.deal_value?.value ?? 1000));
  const [useBday, setUseBday] = useState(initCond.birthday_within_days != null);
  const [bdayDays, setBdayDays] = useState(initCond.birthday_within_days ?? 0);

  function toggleChannel(c: string) {
    setChannels((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit rule" : "New rule"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (channels.length === 0) return toast.error("Pick at least one channel");
          const frequency_config: RuleValues["frequency_config"] = { hour };
          if (freq === "weekly") frequency_config.weekday = weekday;
          if (freq === "monthly") frequency_config.day_of_month = dom;
          if (freq === "custom_days") frequency_config.every_n_days = everyN;
          if (freq === "one_time") frequency_config.run_at = runAt ? new Date(runAt).toISOString() : new Date().toISOString();

          const conditions: RuleValues["conditions"] = {};
          if (useDays) conditions.days_since_last_contact = days;
          if (useStatus) conditions.status = statusCond as RuleValues["conditions"]["status"];
          if (useDeal) conditions.deal_value = { op: dealOp, value: Number(dealVal) || 0 };
          if (useBday) conditions.birthday_within_days = bdayDays;

          onSubmit({
            name, enabled,
            channels: channels as RuleValues["channels"],
            conditions,
            frequency_type: freq,
            frequency_config,
            message_subject: subject || undefined,
            message_body: body,
          });
        }}
      >
        <Section title="Basics">
          <Field label="Rule name"><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly check-in" /></Field>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </Section>

        <Section title="Channels">
          <div className="flex gap-2 flex-wrap">
            {(["email", "sms", "call"] as const).map((c) => {
              const Icon = CHANNEL_ICONS[c];
              const on = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm capitalize transition-colors ${
                    on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="size-4" /> {c}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Conditions (all must match)">
          <CondRow checked={useDays} onCheck={setUseDays} label="Days since last contact ≥">
            <Input type="number" min="0" className="w-24" value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={!useDays} />
          </CondRow>
          <CondRow checked={useStatus} onCheck={setUseStatus} label="Status equals">
            <Select value={statusCond} onValueChange={setStatusCond} disabled={!useStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["lead","prospect","customer","lost"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </CondRow>
          <CondRow checked={useDeal} onCheck={setUseDeal} label="Deal value">
            <Select value={dealOp} onValueChange={(v) => setDealOp(v as ">"|"<"|"=")} disabled={!useDeal}>
              <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=">">{">"}</SelectItem>
                <SelectItem value="<">{"<"}</SelectItem>
                <SelectItem value="=">{"="}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" className="w-28" value={dealVal} onChange={(e) => setDealVal(e.target.value)} disabled={!useDeal} />
          </CondRow>
          <CondRow checked={useBday} onCheck={setUseBday} label="Birthday within (days)">
            <Input type="number" min="0" className="w-24" value={bdayDays} onChange={(e) => setBdayDays(Number(e.target.value))} disabled={!useBday} />
          </CondRow>
        </Section>

        <Section title="Frequency">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={freq} onValueChange={(v) => setFreq(v as RuleValues["frequency_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom_days">Every N days</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {freq !== "one_time" && (
              <Field label="Hour of day (0-23)">
                <Input type="number" min="0" max="23" value={hour} onChange={(e) => setHour(Number(e.target.value))} />
              </Field>
            )}
            {freq === "weekly" && (
              <Field label="Weekday">
                <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
                      <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {freq === "monthly" && (
              <Field label="Day of month">
                <Input type="number" min="1" max="31" value={dom} onChange={(e) => setDom(Number(e.target.value))} />
              </Field>
            )}
            {freq === "custom_days" && (
              <Field label="Every N days">
                <Input type="number" min="1" value={everyN} onChange={(e) => setEveryN(Number(e.target.value))} />
              </Field>
            )}
            {freq === "one_time" && (
              <Field label="Run at">
                <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
              </Field>
            )}
          </div>
        </Section>

        <Section title="Message">
          <Field label="Subject (email only)">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick hello, {{name}}" />
          </Field>
          <Field label="Body">
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use {{name}} and {{company}} as variables." />
          </Field>
          <p className="text-xs text-muted-foreground">
            Variables: <code>{`{{name}}`}</code>, <code>{`{{company}}`}</code>, <code>{`{{email}}`}</code>
          </p>
        </Section>

        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save rule"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
function CondRow({
  checked, onCheck, label, children,
}: { checked: boolean; onCheck: (v: boolean) => void; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheck(!!v)} />
      <Label className="flex-1 min-w-32">{label}</Label>
      {children}
    </div>
  );
}
