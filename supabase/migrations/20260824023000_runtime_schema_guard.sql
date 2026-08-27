-- TRAVA final runtime schema guard (idempotent).
-- This version is safe against:
--   * an existing notifications table
--   * an existing notifications policy
--   * user_id stored as uuid OR text
--   * notifications already added to supabase_realtime
--   * a prior failed attempt of this same migration

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Persisted collaboration state.
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS trava_workspace jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS trava_workspace_updated_at timestamptz DEFAULT now();

-- Compatibility columns for trip membership.
CREATE TABLE IF NOT EXISTS public.trip_members (
  member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(trip_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS member_id uuid DEFAULT gen_random_uuid();

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS invited_by uuid;

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

ALTER TABLE IF EXISTS public.trip_members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Compatibility profile fields used by exact collaborator lookup.
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'traveler';

-- Notifications can already exist in older TRAVA schemas, so create first,
-- then independently add every field used by the current app.
CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid,
  title text NOT NULL DEFAULT 'TRAVA update',
  message text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS notification_id uuid DEFAULT gen_random_uuid();

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS trip_id uuid;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS title text DEFAULT 'TRAVA update';

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS message text DEFAULT '';

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Configure RLS without assuming the legacy user_id column's SQL type.
-- Casting both values to text makes this policy work whether user_id is uuid
-- or text, which is the compatibility issue that can make `user_id = auth.uid()`
-- fail during CREATE POLICY.
DO $trava_notifications_policy$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON TABLE public.notifications TO authenticated;

  DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
  DROP POLICY IF EXISTS "trava_notifications_select_own" ON public.notifications;

  CREATE POLICY "notifications_select_own"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (user_id::text = auth.uid()::text);
END
$trava_notifications_policy$;

-- Make realtime publication setup idempotent.
DO $trava_realtime$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Replica identity guard skipped: %', SQLERRM;
  END;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
WHEN others THEN
  RAISE NOTICE 'Realtime publication guard skipped: %', SQLERRM;
END
$trava_realtime$;

NOTIFY pgrst, 'reload schema';
