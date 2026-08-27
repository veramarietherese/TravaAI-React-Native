-- TRAVA UX/runtime schema guard.
-- Additive only: no type rewrites, no destructive row updates.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS trava_workspace jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS trava_workspace_updated_at timestamptz DEFAULT now();

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

ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS member_id uuid DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS invited_by uuid;
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE IF EXISTS public.trip_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'traveler';

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid,
  title text NOT NULL DEFAULT 'TRAVA update',
  message text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Realtime publication guard skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
