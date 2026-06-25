import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const StatusEnum = z.enum(["lead", "prospect", "customer", "lost"]);

const ContactInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  status: StatusEnum.default("lead"),
  tags: z.array(z.string().max(40)).max(20).default([]),
  last_contacted_at: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  deal_value: z.number().min(0).max(1e9).default(0),
  notes: z.string().max(2000).optional(),
});

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; values: z.infer<typeof ContactInput> }) => ({
    id: d.id,
    values: ContactInput.parse(d.values),
  }))
  .handler(async ({ data, context }) => {
    const payload: Database["public"]["Tables"]["contacts"]["Insert"] = {
      user_id: context.userId,
      name: data.values.name,
      email: data.values.email || null,
      phone: data.values.phone || null,
      company: data.values.company || null,
      status: data.values.status,
      tags: data.values.tags,
      last_contacted_at: data.values.last_contacted_at || null,
      birthday: data.values.birthday || null,
      deal_value: data.values.deal_value,
      notes: data.values.notes || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("contacts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("contacts").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
