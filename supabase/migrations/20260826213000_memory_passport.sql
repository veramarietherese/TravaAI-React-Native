-- TRAVA Memory Passport
-- Shared/private trip memory albums for the React Native traveler app.

DO $$
BEGIN
  IF to_regclass('public.trava_trip_workspaces') IS NULL THEN
    RAISE EXCEPTION 'public.trava_trip_workspaces is required before Memory Passport can be installed';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.trava_trip_memory_albums (
  album_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.trava_trip_workspaces(id) ON DELETE CASCADE,
  album_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trava_trip_memories (
  memory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES public.trava_trip_memory_albums(album_id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trava_trip_workspaces(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_name text,
  storage_path text NOT NULL UNIQUE,
  caption text,
  location_name text,
  taken_at timestamptz,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trava_trip_memories_trip_created_idx
  ON public.trava_trip_memories(trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trava_trip_memories_uploader_idx
  ON public.trava_trip_memories(trip_id, uploaded_by);

ALTER TABLE public.trava_trip_memory_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trava_trip_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trava_memory_albums_select ON public.trava_trip_memory_albums;
CREATE POLICY trava_memory_albums_select ON public.trava_trip_memory_albums
FOR SELECT TO authenticated
USING (
  public.trava_is_trip_owner(trip_id)
  OR public.trava_is_trip_member(trip_id)
);

DROP POLICY IF EXISTS trava_memory_albums_insert ON public.trava_trip_memory_albums;
CREATE POLICY trava_memory_albums_insert ON public.trava_trip_memory_albums
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.trava_is_trip_owner(trip_id)
    OR public.trava_is_trip_member(trip_id)
  )
);

DROP POLICY IF EXISTS trava_memory_albums_update ON public.trava_trip_memory_albums;
CREATE POLICY trava_memory_albums_update ON public.trava_trip_memory_albums
FOR UPDATE TO authenticated
USING (
  public.trava_is_trip_owner(trip_id)
  OR public.trava_is_trip_member(trip_id)
)
WITH CHECK (
  public.trava_is_trip_owner(trip_id)
  OR public.trava_is_trip_member(trip_id)
);

DROP POLICY IF EXISTS trava_memory_albums_delete ON public.trava_trip_memory_albums;
CREATE POLICY trava_memory_albums_delete ON public.trava_trip_memory_albums
FOR DELETE TO authenticated
USING (public.trava_is_trip_owner(trip_id));

DROP POLICY IF EXISTS trava_memories_select ON public.trava_trip_memories;
CREATE POLICY trava_memories_select ON public.trava_trip_memories
FOR SELECT TO authenticated
USING (
  public.trava_is_trip_owner(trip_id)
  OR public.trava_is_trip_member(trip_id)
);

DROP POLICY IF EXISTS trava_memories_insert ON public.trava_trip_memories;
CREATE POLICY trava_memories_insert ON public.trava_trip_memories
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.trava_is_trip_owner(trip_id)
    OR public.trava_is_trip_member(trip_id)
  )
);

DROP POLICY IF EXISTS trava_memories_update ON public.trava_trip_memories;
CREATE POLICY trava_memories_update ON public.trava_trip_memories
FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.trava_is_trip_owner(trip_id)
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR public.trava_is_trip_owner(trip_id)
);

DROP POLICY IF EXISTS trava_memories_delete ON public.trava_trip_memories;
CREATE POLICY trava_memories_delete ON public.trava_trip_memories
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.trava_is_trip_owner(trip_id)
);

-- Private image bucket. Object paths are:
-- <trip_id>/<uploader_user_id>/<memory_id>.<ext>
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trip-passport', 'trip-passport', false, 12582912)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit;

DROP POLICY IF EXISTS trava_trip_passport_select ON storage.objects;
CREATE POLICY trava_trip_passport_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-passport'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.trava_is_trip_owner(((storage.foldername(name))[1])::uuid)
    OR public.trava_is_trip_member(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS trava_trip_passport_insert ON storage.objects;
CREATE POLICY trava_trip_passport_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-passport'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    public.trava_is_trip_owner(((storage.foldername(name))[1])::uuid)
    OR public.trava_is_trip_member(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS trava_trip_passport_update ON storage.objects;
CREATE POLICY trava_trip_passport_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'trip-passport'
  AND owner_id = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'trip-passport'
  AND owner_id = auth.uid()::text
);

DROP POLICY IF EXISTS trava_trip_passport_delete ON storage.objects;
CREATE POLICY trava_trip_passport_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'trip-passport'
  AND (
    owner_id = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      AND public.trava_is_trip_owner(((storage.foldername(name))[1])::uuid)
    )
  )
);
