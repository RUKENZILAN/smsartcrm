
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Contacts
CREATE TYPE public.contact_status AS ENUM ('lead','prospect','customer','lost');
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  status contact_status NOT NULL DEFAULT 'lead',
  tags TEXT[] NOT NULL DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  birthday DATE,
  deal_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts all" ON public.contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX contacts_user_idx ON public.contacts(user_id);

-- Outreach rules
CREATE TABLE public.outreach_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- channels: array of 'email','sms','call'
  channels TEXT[] NOT NULL DEFAULT '{email}',
  -- conditions: jsonb { days_since_last_contact?: int, status?: contact_status,
  --   deal_value?: { op: '>'|'<'|'=', value: number },
  --   birthday_within_days?: int }
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- frequency_type: 'daily','weekly','monthly','custom_days','one_time'
  frequency_type TEXT NOT NULL DEFAULT 'daily',
  -- frequency_config: { weekday?: 0-6, day_of_month?: 1-31, every_n_days?: int, run_at?: ISO timestamp, hour?: 0-23 }
  frequency_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_subject TEXT,
  message_body TEXT NOT NULL DEFAULT '',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_rules TO authenticated;
GRANT ALL ON public.outreach_rules TO service_role;
ALTER TABLE public.outreach_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rules all" ON public.outreach_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX rules_next_run_idx ON public.outreach_rules(next_run_at) WHERE enabled = true;

-- Outreach logs
CREATE TABLE public.outreach_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.outreach_rules(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL, -- sent | failed | skipped
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.outreach_logs TO authenticated;
GRANT ALL ON public.outreach_logs TO service_role;
ALTER TABLE public.outreach_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs select" ON public.outreach_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own logs insert" ON public.outreach_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX logs_user_created_idx ON public.outreach_logs(user_id, created_at DESC);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER contacts_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rules_touch BEFORE UPDATE ON public.outreach_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
