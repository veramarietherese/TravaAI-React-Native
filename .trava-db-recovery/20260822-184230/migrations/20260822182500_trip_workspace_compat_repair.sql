-- TRAVA trip workspace compatibility repair
-- Safe/idempotent schema repair for trip detail tabs.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Trip members: detail view expects these fields.
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS member_id uuid DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.trip_members SET member_id = gen_random_uuid() WHERE member_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trip_members_trip_user_uidx ON public.trip_members (trip_id, user_id);

CREATE TABLE IF NOT EXISTS public.trip_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  day_number integer NOT NULL DEFAULT 1,
  activity_date date,
  title text NOT NULL DEFAULT 'Activity',
  category text NOT NULL DEFAULT 'other',
  location_name text NOT NULL DEFAULT 'Location',
  latitude double precision,
  longitude double precision,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time,
  notes text,
  estimated_cost numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS activity_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS day_number integer DEFAULT 1;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS activity_date date;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS title text DEFAULT 'Activity';
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS location_name text DEFAULT 'Location';
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS start_time time DEFAULT '09:00';
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS estimated_cost numeric(14,2) DEFAULT 0;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.trip_activities a SET created_by = t.user_id FROM public.trips t WHERE a.trip_id = t.trip_id AND a.created_by IS NULL;
CREATE INDEX IF NOT EXISTS trip_activities_trip_day_idx ON public.trip_activities (trip_id, day_number, start_time);

CREATE TABLE IF NOT EXISTS public.trip_budget_categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  name text NOT NULL,
  planned_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS category_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS planned_amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.trip_budget_categories b SET created_by = t.user_id FROM public.trips t WHERE b.trip_id = t.trip_id AND b.created_by IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trip_budget_categories_name_uidx ON public.trip_budget_categories (trip_id, lower(name));

CREATE TABLE IF NOT EXISTS public.expense_tracking (
  expense_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Trip expense',
  description text,
  category text NOT NULL DEFAULT 'Other',
  amount numeric(14,2) NOT NULL DEFAULT 0.01,
  expense_date date NOT NULL DEFAULT current_date,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  split_method text NOT NULL DEFAULT 'equal',
  receipt_url text,
  receipt_storage_path text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS expense_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(trip_id) ON DELETE CASCADE;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS title text DEFAULT 'Trip expense';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS category text DEFAULT 'Other';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS amount numeric(14,2) DEFAULT 0.01;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS expense_date date DEFAULT current_date;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS split_method text DEFAULT 'equal';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS receipt_storage_path text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.expense_tracking e SET
  user_id = coalesce(e.user_id, t.user_id),
  paid_by = coalesce(e.paid_by, e.user_id, t.user_id),
  created_by = coalesce(e.created_by, e.user_id, t.user_id),
  title = coalesce(nullif(trim(e.title), ''), 'Trip expense'),
  category = coalesce(nullif(trim(e.category), ''), 'Other'),
  amount = greatest(coalesce(e.amount, 0.01), 0.01),
  is_deleted = coalesce(e.is_deleted, false)
FROM public.trips t WHERE e.trip_id = t.trip_id;
CREATE INDEX IF NOT EXISTS expense_tracking_trip_date_idx ON public.expense_tracking (trip_id, expense_date, created_at);

CREATE TABLE IF NOT EXISTS public.expense_splits (
  split_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expense_tracking(expense_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS split_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS expense_splits_expense_user_uidx ON public.expense_splits (expense_id, user_id);

CREATE TABLE IF NOT EXISTS public.trip_flights (
  flight_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  flight_number text NOT NULL,
  flight_date date,
  provider text NOT NULL DEFAULT 'airlabs',
  status text,
  departure_airport_code text,
  arrival_airport_code text,
  terminal text,
  gate text,
  scheduled_departure text,
  estimated_departure text,
  scheduled_arrival text,
  estimated_arrival text,
  raw_snapshot jsonb,
  last_checked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
