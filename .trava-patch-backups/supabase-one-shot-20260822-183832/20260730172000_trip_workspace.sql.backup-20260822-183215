-- TRAVA AI production trip workspace: trips, itinerary, collaboration, budgets,
-- expenses, flight configuration, and private trip media.
-- Local checklist and local documents are intentionally not persisted here.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.trips (
  trip_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_name text NOT NULL,
  destination text NOT NULL,
  description text,
  start_date date,
  end_date date,
  number_of_days integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  cover_image_url text,
  cover_storage_path text,
  total_budget numeric(14,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'PHP',
  travel_style text,
  travel_group text,
  flight_number text,
  flight_date date,
  origin_code text,
  destination_code text,
  origin_airport_name text,
  destination_airport_name text,
  flight_status text,
  flight_status_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_name text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS number_of_days integer DEFAULT 1;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cover_storage_path text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS total_budget numeric(14,2) DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'PHP';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS travel_style text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS travel_group text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS flight_number text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS flight_date date;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin_code text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination_code text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin_airport_name text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination_airport_name text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS flight_status text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS flight_status_updated_at timestamptz;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.trips
SET
  trip_name = coalesce(nullif(trim(trip_name), ''), nullif(trim(destination), ''), 'Untitled Trip'),
  destination = coalesce(nullif(trim(destination), ''), 'Destination pending'),
  number_of_days = greatest(coalesce(number_of_days, 1), 1),
  status = CASE
    WHEN lower(coalesce(status, '')) IN ('draft', 'upcoming', 'ongoing', 'completed') THEN lower(status)
    WHEN start_date IS NULL THEN 'draft'
    WHEN end_date IS NOT NULL AND end_date < current_date THEN 'completed'
    WHEN start_date <= current_date AND coalesce(end_date, start_date) >= current_date THEN 'ongoing'
    ELSE 'upcoming'
  END,
  total_budget = greatest(coalesce(total_budget, 0), 0),
  currency_code = upper(coalesce(nullif(trim(currency_code), ''), 'PHP')),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

CREATE INDEX IF NOT EXISTS trips_user_dates_idx ON public.trips (user_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS public.trip_members (
  member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS member_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(trip_id) ON DELETE CASCADE;
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.trip_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.trip_members
SET
  role = CASE WHEN lower(coalesce(role, '')) = 'owner' THEN 'owner' ELSE 'member' END,
  status = CASE
    WHEN lower(coalesce(status, '')) IN ('accepted', 'active', 'joined', 'owner') THEN 'accepted'
    WHEN lower(coalesce(status, '')) IN ('rejected', 'declined') THEN 'rejected'
    ELSE 'pending'
  END,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

DELETE FROM public.trip_members a
USING public.trip_members b
WHERE a.ctid < b.ctid
  AND a.trip_id = b.trip_id
  AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS trip_members_trip_user_uidx ON public.trip_members (trip_id, user_id);
CREATE INDEX IF NOT EXISTS trip_members_user_status_idx ON public.trip_members (user_id, status, created_at);

INSERT INTO public.trip_members (trip_id, user_id, role, status, invited_by, responded_at)
SELECT trip_id, user_id, 'owner', 'accepted', user_id, now()
FROM public.trips
WHERE user_id IS NOT NULL
ON CONFLICT (trip_id, user_id) DO UPDATE SET
  role = 'owner',
  status = 'accepted',
  responded_at = coalesce(public.trip_members.responded_at, now()),
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.trip_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  activity_date date,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  location_name text NOT NULL,
  latitude double precision,
  longitude double precision,
  start_time time NOT NULL,
  end_time time,
  notes text,
  estimated_cost numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_activities_day_check CHECK (day_number BETWEEN 1 AND 365),
  CONSTRAINT trip_activities_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT trip_activities_lng_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT trip_activities_cost_check CHECK (estimated_cost >= 0),
  CONSTRAINT trip_activities_time_check CHECK (end_time IS NULL OR end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS trip_activities_trip_day_idx ON public.trip_activities (trip_id, day_number, start_time);

CREATE TABLE IF NOT EXISTS public.trip_budget_categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  name text NOT NULL,
  planned_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_budget_categories_amount_check CHECK (planned_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_budget_categories_name_uidx
  ON public.trip_budget_categories (trip_id, lower(name));

CREATE TABLE IF NOT EXISTS public.expense_tracking (
  expense_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  amount numeric(14,2) NOT NULL,
  expense_date date NOT NULL DEFAULT current_date,
  paid_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  split_method text NOT NULL DEFAULT 'equal',
  receipt_url text,
  receipt_storage_path text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_tracking_amount_check CHECK (amount > 0)
);

ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS expense_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(trip_id) ON DELETE CASCADE;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS amount numeric(14,2);
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS expense_date date DEFAULT current_date;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS split_method text DEFAULT 'equal';
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS receipt_storage_path text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.expense_tracking ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.expense_tracking
SET
  title = coalesce(nullif(trim(title), ''), nullif(trim(description), ''), 'Trip expense'),
  category = coalesce(nullif(trim(category), ''), 'Other'),
  amount = greatest(coalesce(amount, 0.01), 0.01),
  expense_date = coalesce(expense_date, current_date),
  paid_by = coalesce(paid_by, user_id, created_by),
  created_by = coalesce(created_by, user_id, paid_by),
  split_method = CASE WHEN lower(coalesce(split_method, '')) IN ('equal', 'exact', 'payer_only') THEN lower(split_method) ELSE 'equal' END,
  is_deleted = coalesce(is_deleted, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

CREATE INDEX IF NOT EXISTS expense_tracking_trip_date_idx ON public.expense_tracking (trip_id, expense_date, created_at);

CREATE TABLE IF NOT EXISTS public.expense_splits (
  split_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expense_tracking(expense_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_splits_amount_check CHECK (amount >= 0)
);

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
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS flight_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(trip_id) ON DELETE CASCADE;
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
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.trip_flights ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.trip_flights f
SET
  provider = coalesce(nullif(trim(f.provider), ''), 'airlabs'),
  flight_number = upper(regexp_replace(coalesce(f.flight_number, ''), '[^A-Z0-9]', '', 'g')),
  created_by = coalesce(f.created_by, (SELECT t.user_id FROM public.trips t WHERE t.trip_id = f.trip_id)),
  created_at = coalesce(f.created_at, now()),
  updated_at = coalesce(f.updated_at, now());

DELETE FROM public.trip_flights a
USING public.trip_flights b
WHERE a.ctid < b.ctid
  AND a.trip_id = b.trip_id
  AND a.flight_number = b.flight_number
  AND coalesce(a.flight_date, '1900-01-01'::date) = coalesce(b.flight_date, '1900-01-01'::date);

CREATE UNIQUE INDEX IF NOT EXISTS trip_flights_trip_number_date_uidx
  ON public.trip_flights (trip_id, flight_number, coalesce(flight_date, '1900-01-01'::date));

CREATE OR REPLACE FUNCTION public.trava_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trava_normalize_trip()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.trip_name := coalesce(nullif(trim(NEW.trip_name), ''), nullif(trim(NEW.destination), ''), 'Untitled Trip');
  NEW.destination := coalesce(nullif(trim(NEW.destination), ''), 'Destination pending');
  NEW.currency_code := upper(coalesce(nullif(trim(NEW.currency_code), ''), 'PHP'));
  NEW.total_budget := greatest(coalesce(NEW.total_budget, 0), 0);
  NEW.flight_number := nullif(upper(regexp_replace(coalesce(NEW.flight_number, ''), '[^A-Z0-9]', '', 'g')), '');

  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Trip end date must be on or after the start date';
  END IF;

  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    NEW.number_of_days := greatest(1, (NEW.end_date - NEW.start_date) + 1);
  ELSE
    NEW.number_of_days := greatest(coalesce(NEW.number_of_days, 1), 1);
  END IF;

  IF lower(coalesce(NEW.status, '')) = 'draft' OR NEW.start_date IS NULL THEN
    NEW.status := 'draft';
  ELSIF lower(coalesce(NEW.status, '')) = 'completed' OR coalesce(NEW.end_date, NEW.start_date) < current_date THEN
    NEW.status := 'completed';
  ELSIF NEW.start_date <= current_date AND coalesce(NEW.end_date, NEW.start_date) >= current_date THEN
    NEW.status := 'ongoing';
  ELSE
    NEW.status := 'upcoming';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trava_normalize_trip_before_write ON public.trips;
CREATE TRIGGER trava_normalize_trip_before_write
BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trava_normalize_trip();

DROP TRIGGER IF EXISTS trava_touch_trip_members ON public.trip_members;
CREATE TRIGGER trava_touch_trip_members
BEFORE UPDATE ON public.trip_members
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();

DROP TRIGGER IF EXISTS trava_touch_trip_activities ON public.trip_activities;
CREATE TRIGGER trava_touch_trip_activities
BEFORE UPDATE ON public.trip_activities
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();

DROP TRIGGER IF EXISTS trava_touch_trip_budget_categories ON public.trip_budget_categories;
CREATE TRIGGER trava_touch_trip_budget_categories
BEFORE UPDATE ON public.trip_budget_categories
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();

DROP TRIGGER IF EXISTS trava_touch_expense_tracking ON public.expense_tracking;
CREATE TRIGGER trava_touch_expense_tracking
BEFORE UPDATE ON public.expense_tracking
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();

DROP TRIGGER IF EXISTS trava_touch_trip_flights ON public.trip_flights;
CREATE TRIGGER trava_touch_trip_flights
BEFORE UPDATE ON public.trip_flights
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.trip_id = p_trip_id AND t.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_participant(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.is_trip_owner(p_trip_id) OR EXISTS (
    SELECT 1 FROM public.trip_members tm
    WHERE tm.trip_id = p_trip_id
      AND tm.user_id = auth.uid()
      AND lower(tm.status) = 'accepted'
  );
$$;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_flights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trips_select_participant ON public.trips;
CREATE POLICY trips_select_participant ON public.trips FOR SELECT TO authenticated
USING (public.is_trip_participant(trip_id));
DROP POLICY IF EXISTS trips_insert_owner ON public.trips;
DROP POLICY IF EXISTS trips_update_owner ON public.trips;
DROP POLICY IF EXISTS trips_delete_owner ON public.trips;

DROP POLICY IF EXISTS trip_members_select_related ON public.trip_members;
CREATE POLICY trip_members_select_related ON public.trip_members FOR SELECT TO authenticated
USING (public.is_trip_participant(trip_id) OR user_id = auth.uid());
DROP POLICY IF EXISTS trip_members_insert_owner ON public.trip_members;
DROP POLICY IF EXISTS trip_members_update_related ON public.trip_members;
DROP POLICY IF EXISTS trip_members_delete_related ON public.trip_members;

DROP POLICY IF EXISTS trip_activities_select_participant ON public.trip_activities;
CREATE POLICY trip_activities_select_participant ON public.trip_activities FOR SELECT TO authenticated
USING (public.is_trip_participant(trip_id));
DROP POLICY IF EXISTS trip_activities_insert_participant ON public.trip_activities;
DROP POLICY IF EXISTS trip_activities_update_author ON public.trip_activities;
DROP POLICY IF EXISTS trip_activities_delete_author ON public.trip_activities;

DROP POLICY IF EXISTS trip_budget_categories_select_participant ON public.trip_budget_categories;
CREATE POLICY trip_budget_categories_select_participant ON public.trip_budget_categories FOR SELECT TO authenticated
USING (public.is_trip_participant(trip_id));
DROP POLICY IF EXISTS trip_budget_categories_write_owner ON public.trip_budget_categories;

DROP POLICY IF EXISTS expense_tracking_select_participant ON public.expense_tracking;
CREATE POLICY expense_tracking_select_participant ON public.expense_tracking FOR SELECT TO authenticated
USING (public.is_trip_participant(trip_id) AND coalesce(is_deleted, false) = false);
DROP POLICY IF EXISTS expense_tracking_insert_participant ON public.expense_tracking;
DROP POLICY IF EXISTS expense_tracking_update_author ON public.expense_tracking;
DROP POLICY IF EXISTS expense_tracking_delete_author ON public.expense_tracking;

DROP POLICY IF EXISTS expense_splits_select_participant ON public.expense_splits;
CREATE POLICY expense_splits_select_participant ON public.expense_splits FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.expense_tracking e
  WHERE e.expense_id = expense_splits.expense_id
    AND public.is_trip_participant(e.trip_id)
));

DROP POLICY IF EXISTS trip_flights_select_participant ON public.trip_flights;
CREATE POLICY trip_flights_select_participant ON public.trip_flights FOR SELECT TO authenticated
USING (public.is_trip_participant(trip_id));
DROP POLICY IF EXISTS trip_flights_write_owner ON public.trip_flights;

REVOKE ALL ON public.trips, public.trip_members, public.trip_activities,
  public.trip_budget_categories, public.expense_tracking, public.expense_splits,
  public.trip_flights FROM anon, authenticated;
GRANT SELECT ON public.trips, public.trip_members, public.trip_activities,
  public.trip_budget_categories, public.expense_tracking, public.expense_splits,
  public.trip_flights TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_owner(uuid), public.is_trip_participant(uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-media',
  'trip-media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS trip_media_insert_own_folder ON storage.objects;
CREATE POLICY trip_media_insert_own_folder ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS trip_media_select_own_folder ON storage.objects;
CREATE POLICY trip_media_select_own_folder ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS trip_media_update_own_folder ON storage.objects;
CREATE POLICY trip_media_update_own_folder ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'trip-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'trip-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS trip_media_delete_own_folder ON storage.objects;
CREATE POLICY trip_media_delete_own_folder ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'trip-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

NOTIFY pgrst, 'reload schema';
