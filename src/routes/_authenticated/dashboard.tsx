import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/logs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Workflow, CheckCircle2, AlertCircle, MinusCircle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Reach CRM" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of contacts, rules, and recent outreach.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Contacts" value={data?.contactCount ?? "—"} icon={<Users className="size-5" />} loading={isLoading} />
        <Stat
          title="Active rules"
          value={data ? `${data.activeRules} / ${data.totalRules}` : "—"}
          icon={<Workflow className="size-5" />}
          loading={isLoading}
        />
        <Stat title="Sent (7d)" value={data?.last7.sent ?? "—"} icon={<CheckCircle2 className="size-5 text-[var(--success)]" />} loading={isLoading} />
        <Stat title="Failed (7d)" value={data?.last7.failed ?? "—"} icon={<AlertCircle className="size-5 text-destructive" />} loading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming runs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/rules">
                Manage <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data && data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active rules yet.{" "}
                <Link to="/rules" className="text-primary underline">
                  Create your first rule
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {data?.upcoming.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground">
                      {new Date(r.next_run_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <Mini icon={<CheckCircle2 className="size-5 text-[var(--success)]" />} label="Sent" value={data?.last7.sent ?? 0} />
              <Mini icon={<AlertCircle className="size-5 text-destructive" />} label="Failed" value={data?.last7.failed ?? 0} />
              <Mini icon={<MinusCircle className="size-5 text-muted-foreground" />} label="Skipped" value={data?.last7.skipped ?? 0} />
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Skipped means the channel wasn't configured (e.g. no Twilio or Resend secret). Add the API keys via project Secrets — they're never stored in code.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ title, value, icon, loading }: { title: string; value: React.ReactNode; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold mt-1">{loading ? "…" : value}</p>
          </div>
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-4 flex flex-col items-center gap-1">
      {icon}
      <span className="text-2xl font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
