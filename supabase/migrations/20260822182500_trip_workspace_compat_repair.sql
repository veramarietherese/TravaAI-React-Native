-- TRAVA trip workspace compatibility repair.
-- Designed for an existing/legacy production database.
-- IMPORTANT: no ALTER TYPE, no legacy-row normalization UPDATEs, no destructive column rewrites.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- TRIPS: only add fields the current API reads. Existing types/data are kept.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS number_of_days integer DEFAULT 1;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS cover_storage_path text;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS total_budget numeric(14,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'PHP';
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS travel_style text;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS travel_group text;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS flight_number text;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS flight_date date;
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS public.trips ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- MEMBERS: current API needs these columns to render Overview and permissions.
-- We deliberately leave existing legacy role/status types untouched.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS member_id uuid DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS invited_by uuid;
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- ITINERARY
-- ---------------------------------------------------------------------------
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
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS activity_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS trip_id uuid;
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
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_activities ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- BUDGET
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_budget_categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  name text NOT NULL,
  planned_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS category_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS trip_id uuid;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS planned_amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_budget_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- EXPENSES: preserve legacy rows/types; only add missing fields.
-- No UPDATE ... coalesce(...) block here: that was the production failure.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_tracking (
  expense_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL DEFAULT 'Trip expense',
  description text,
  category text NOT NULL DEFAULT 'Other',
  amount numeric(14,2) NOT NULL DEFAULT 0.01,
  expense_date date NOT NULL DEFAULT current_date,
  paid_by uuid,
  split_method text NOT NULL DEFAULT 'equal',
  receipt_url text,
  receipt_storage_path text,
  notes text,
  created_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS expense_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS trip_id uuid;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS title text DEFAULT 'Trip expense';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS category text DEFAULT 'Other';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS amount numeric(14,2) DEFAULT 0.01;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS expense_date date DEFAULT current_date;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS paid_by uuid;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS split_method text DEFAULT 'equal';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS receipt_storage_path text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create expense_splits using the *actual* legacy expense_id type so this cannot
-- fail if the old expense table used bigint/text instead of uuid.
DO $$
DECLARE
  expense_id_type text;
BEGIN
  IF to_regclass('public.expense_splits') IS NULL THEN
    SELECT format_type(a.atttypid, a.atttypmod)
      INTO expense_id_type
    FROM pg_attribute a
    WHERE a.attrelid = 'public.expense_tracking'::regclass
      AND a.attname = 'expense_id'
      AND NOT a.attisdropped;

    IF expense_id_type IS NULL THEN
      expense_id_type := 'uuid';
    END IF;

    EXECUTE format(
      'CREATE TABLE public.expense_splits (
         split_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         expense_id %s NOT NULL,
         user_id uuid NOT NULL,
         amount numeric(14,2) NOT NULL DEFAULT 0,
         created_at timestamptz NOT NULL DEFAULT now()
       )',
      expense_id_type
    );
  END IF;
END $$;

ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS split_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS amount numeric(14,2) DEFAULT 0;
ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add the relationship only when PostgreSQL confirms both columns share a type.
DO $$
DECLARE
  child_type oid;
  parent_type oid;
BEGIN
  SELECT atttypid INTO child_type FROM pg_attribute
  WHERE attrelid = 'public.expense_splits'::regclass AND attname = 'expense_id' AND NOT attisdropped;
  SELECT atttypid INTO parent_type FROM pg_attribute
  WHERE attrelid = 'public.expense_tracking'::regclass AND attname = 'expense_id' AND NOT attisdropped;

  IF child_type = parent_type AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expense_splits'::regclass
      AND contype = 'f'
  ) THEN
    BEGIN
      ALTER TABLE public.expense_splits
        ADD CONSTRAINT expense_splits_expense_id_fkey
        FOREIGN KEY (expense_id) REFERENCES public.expense_tracking(expense_id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping expense_splits FK compatibility constraint: %', SQLERRM;
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- FLIGHTS
-- ---------------------------------------------------------------------------
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
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS flight_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS trip_id uuid;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS flight_number text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS flight_date date;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS provider text DEFAULT 'airlabs';
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS departure_airport_code text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS arrival_airport_code text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS terminal text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS gate text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS scheduled_departure text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS estimated_departure text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS scheduled_arrival text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS estimated_arrival text;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS raw_snapshot jsonb;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

NOTIFY pgrst, 'reload schema';
