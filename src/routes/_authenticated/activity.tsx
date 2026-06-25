import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listLogs } from "@/lib/logs.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Phone, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity · Reach CRM" }] }),
  component: Activity,
});

const CHANNEL_ICONS: Record<string, typeof Mail> = { email: Mail, sms: MessageSquare, call: Phone };
const STATUS_ICONS: Record<string, { icon: typeof Mail; cls: string }> = {
  sent: { icon: CheckCircle2, cls: "text-[var(--success)]" },
  failed: { icon: AlertCircle, cls: "text-destructive" },
  skipped: { icon: MinusCircle, cls: "text-muted-foreground" },
};

function Activity() {
  const fn = useServerFn(listLogs);
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["logs"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">Every send attempt, latest first.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No activity yet.</div>
          ) : (
            <div className="divide-y">
              {logs.map((l) => {
                const ChannelIcon = CHANNEL_ICONS[l.channel] ?? Mail;
                const S = STATUS_ICONS[l.status] ?? STATUS_ICONS.skipped;
                const StatusIcon = S.icon;
                return (
                  <div key={l.id} className="p-4 flex flex-wrap items-start gap-3">
                    <StatusIcon className={`size-5 mt-0.5 ${S.cls}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <ChannelIcon className="size-3.5 text-muted-foreground" />
                        {l.contacts?.name ?? "Unknown contact"}
                        <span className="text-muted-foreground font-normal">via</span>
                        <span className="font-normal">{l.outreach_rules?.name ?? "deleted rule"}</span>
                      </div>
                      {l.detail && <div className="text-xs text-muted-foreground mt-1">{l.detail}</div>}
                    </div>
                    <Badge variant="secondary" className="capitalize">{l.status}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
