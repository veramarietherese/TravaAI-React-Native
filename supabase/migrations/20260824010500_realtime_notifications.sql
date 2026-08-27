-- TRAVA persisted collaboration state for the current legacy trips table.
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS trava_workspace jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS trava_workspace_updated_at timestamptz DEFAULT now();

-- TRAVA realtime notification delivery.
-- Safe compatibility migration: only changes the publication when the table exists.

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON TABLE public.notifications TO authenticated;
      DROP POLICY IF EXISTS trava_notifications_select_own ON public.notifications;
      CREATE POLICY trava_notifications_select_own ON public.notifications
        FOR SELECT TO authenticated
        USING (user_id = auth.uid());
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not configure notifications select policy: %', SQLERRM;
    END;

    BEGIN
      ALTER TABLE public.notifications REPLICA IDENTITY FULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not set notifications replica identity: %', SQLERRM;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN others THEN
      RAISE NOTICE 'Could not add notifications to realtime publication: %', SQLERRM;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
