import { createFileRoute, useServerFn } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listContacts, upsertContact, deleteContact } from "@/lib/contacts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts · Reach CRM" }] }),
  component: ContactsPage,
});

const STATUSES = ["lead", "prospect", "customer", "lost"] as const;

function ContactsPage() {
  const list = useServerFn(listContacts);
  const upsert = useServerFn(upsertContact);
  const del = useServerFn(deleteContact);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [open, setOpen] = useState(false);

  const { data: contacts = [] } = useQuery({ queryKey: ["contacts"], queryFn: () => list() });

  const upsertM = useMutation({
    mutationFn: (vars: { id?: string; values: Parameters<typeof upsert>[0]["data"]["values"] }) =>
      upsert({ data: vars }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const filtered = contacts.filter((c) => {
    const s = q.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s) || (c.company ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Everyone in your CRM.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> New contact
            </Button>
          </DialogTrigger>
          <ContactDialog
            initial={editing}
            onSubmit={(values) => upsertM.mutate({ id: editing?.id, values })}
            saving={upsertM.isPending}
          />
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No contacts yet.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center font-medium">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[c.email, c.phone, c.company].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">{c.status}</Badge>
                  <div className="text-sm text-muted-foreground hidden sm:block">
                    ${Number(c.deal_value).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground hidden md:block">
                    {c.last_contacted_at
                      ? `last: ${new Date(c.last_contacted_at).toLocaleDateString()}`
                      : "never contacted"}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { if (confirm(`Delete ${c.name}?`)) delM.mutate(c.id); }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ContactValues = Parameters<typeof upsertContact>[0]["data"]["values"];

function ContactDialog({
  initial, onSubmit, saving,
}: {
  initial: Contact | null;
  onSubmit: (v: ContactValues) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [status, setStatus] = useState<Contact["status"]>(initial?.status ?? "lead");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [last, setLast] = useState(initial?.last_contacted_at?.slice(0, 10) ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [dealValue, setDealValue] = useState(String(initial?.deal_value ?? 0));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit contact" : "New contact"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            email: email || undefined,
            phone: phone || undefined,
            company: company || undefined,
            status,
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            last_contacted_at: last ? new Date(last).toISOString() : null,
            birthday: birthday || null,
            deal_value: Number(dealValue) || 0,
            notes: notes || undefined,
          });
        }}
      >
        <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Phone (E.164)"><Input placeholder="+15551234567" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as Contact["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Last contacted"><Input type="date" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
          <Field label="Birthday"><Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deal value ($)"><Input type="number" min="0" value={dealValue} onChange={(e) => setDealValue(e.target.value)} /></Field>
          <Field label="Tags (comma-separated)"><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save contact"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
