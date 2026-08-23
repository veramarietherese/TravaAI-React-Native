-- TRAVA AI local-first React Native trip workspaces.
-- IMPORTANT: the legacy web application already owns public.trips and public.trip_members.
-- This migration intentionally uses isolated table/function names so it cannot alter or break
-- the existing Vercel application's database contract.

CREATE TABLE IF NOT EXISTS public.trava_trip_workspaces (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft','upcoming','ongoing','completed')),
  workspace jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trava_trip_workspaces_owner_updated_idx
  ON public.trava_trip_workspaces(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.trava_trip_workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trava_trip_workspaces(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX IF NOT EXISTS trava_trip_workspace_invites_recipient_idx
  ON public.trava_trip_workspace_invitations(lower(recipient), status);
CREATE INDEX IF NOT EXISTS trava_trip_workspace_invites_trip_idx
  ON public.trava_trip_workspace_invitations(trip_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.trava_trip_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trava_trip_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor','viewer')),
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','removed')),
  invitation_id uuid REFERENCES public.trava_trip_workspace_invitations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS trava_trip_workspace_members_invitation_idx
  ON public.trava_trip_workspace_members(invitation_id);
CREATE OR REPLACE FUNCTION public.trava_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trava_trip_workspaces_touch_updated_at ON public.trava_trip_workspaces;
CREATE TRIGGER trava_trip_workspaces_touch_updated_at
BEFORE UPDATE ON public.trava_trip_workspaces
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();
DROP TRIGGER IF EXISTS trava_trip_workspace_invites_touch_updated_at ON public.trava_trip_workspace_invitations;
CREATE TRIGGER trava_trip_workspace_invites_touch_updated_at
BEFORE UPDATE ON public.trava_trip_workspace_invitations
FOR EACH ROW EXECUTE FUNCTION public.trava_touch_updated_at();
ALTER TABLE public.trava_trip_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trava_trip_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trava_trip_workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.trava_is_trip_owner(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trava_trip_workspaces
    WHERE id = p_trip_id AND owner_id = auth.uid()
  );
$$;
CREATE OR REPLACE FUNCTION public.trava_is_trip_member(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trava_trip_workspace_members
    WHERE trip_id = p_trip_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  );
$$;
CREATE OR REPLACE FUNCTION public.trava_is_trip_editor(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trava_trip_workspace_members
    WHERE trip_id = p_trip_id
      AND user_id = auth.uid()
      AND status = 'accepted'
      AND role IN ('owner','editor')
  );
$$;
CREATE OR REPLACE FUNCTION public.trava_current_identity_matches(p_recipient text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, auth
AS $$
  SELECT (
      coalesce(auth.jwt() ->> 'email', '') <> ''
      AND lower(coalesce(p_recipient, '')) = lower(auth.jwt() ->> 'email')
    ) OR (
      coalesce(auth.jwt() ->> 'phone', '') <> ''
      AND regexp_replace(coalesce(p_recipient, ''), '[^0-9+]', '', 'g')
          = regexp_replace(auth.jwt() ->> 'phone', '[^0-9+]', '', 'g')
    );
$$;
REVOKE ALL ON FUNCTION public.trava_is_trip_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trava_is_trip_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trava_is_trip_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trava_current_identity_matches(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trava_is_trip_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trava_is_trip_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trava_is_trip_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trava_current_identity_matches(text) TO authenticated;
DROP POLICY IF EXISTS trava_workspaces_select_accessible ON public.trava_trip_workspaces;
CREATE POLICY trava_workspaces_select_accessible ON public.trava_trip_workspaces
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.trava_is_trip_member(id)
  OR EXISTS (
    SELECT 1
    FROM public.trava_trip_workspace_invitations invitation
    WHERE invitation.trip_id = id
      AND public.trava_current_identity_matches(invitation.recipient)
      AND invitation.status = 'pending'
  )
);
DROP POLICY IF EXISTS trava_workspaces_insert_owner ON public.trava_trip_workspaces;
CREATE POLICY trava_workspaces_insert_owner ON public.trava_trip_workspaces
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS trava_workspaces_update_owner_or_editor ON public.trava_trip_workspaces;
CREATE POLICY trava_workspaces_update_owner_or_editor ON public.trava_trip_workspaces
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.trava_is_trip_editor(id))
WITH CHECK (owner_id = auth.uid() OR public.trava_is_trip_editor(id));
DROP POLICY IF EXISTS trava_workspaces_delete_owner ON public.trava_trip_workspaces;
CREATE POLICY trava_workspaces_delete_owner ON public.trava_trip_workspaces
FOR DELETE TO authenticated
USING (owner_id = auth.uid());
DROP POLICY IF EXISTS trava_workspace_members_select ON public.trava_trip_workspace_members;
CREATE POLICY trava_workspace_members_select ON public.trava_trip_workspace_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.trava_is_trip_owner(trip_id)
  OR public.trava_is_trip_member(trip_id)
);
DROP POLICY IF EXISTS trava_workspace_members_manage_owner ON public.trava_trip_workspace_members;
CREATE POLICY trava_workspace_members_manage_owner ON public.trava_trip_workspace_members
FOR ALL TO authenticated
USING (public.trava_is_trip_owner(trip_id))
WITH CHECK (public.trava_is_trip_owner(trip_id));
DROP POLICY IF EXISTS trava_workspace_invites_select ON public.trava_trip_workspace_invitations;
CREATE POLICY trava_workspace_invites_select ON public.trava_trip_workspace_invitations
FOR SELECT TO authenticated
USING (
  inviter_id = auth.uid()
  OR public.trava_current_identity_matches(recipient)
  OR public.trava_is_trip_owner(trip_id)
);
DROP POLICY IF EXISTS trava_workspace_invites_insert_owner ON public.trava_trip_workspace_invitations;
CREATE POLICY trava_workspace_invites_insert_owner ON public.trava_trip_workspace_invitations
FOR INSERT TO authenticated
WITH CHECK (inviter_id = auth.uid() AND public.trava_is_trip_owner(trip_id));
DROP POLICY IF EXISTS trava_workspace_invites_update ON public.trava_trip_workspace_invitations;
CREATE POLICY trava_workspace_invites_update ON public.trava_trip_workspace_invitations
FOR UPDATE TO authenticated
USING (
  public.trava_current_identity_matches(recipient)
  OR public.trava_is_trip_owner(trip_id)
)
WITH CHECK (
  public.trava_current_identity_matches(recipient)
  OR public.trava_is_trip_owner(trip_id)
);
CREATE OR REPLACE FUNCTION public.trava_respond_to_trip_invitation(
  p_invitation_id uuid,
  p_status text
)
RETURNS public.trava_trip_workspace_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invitation public.trava_trip_workspace_invitations;
BEGIN
  IF p_status NOT IN ('accepted','dismissed') THEN
    RAISE EXCEPTION 'Invalid invitation response';
  END IF;

  SELECT * INTO invitation
  FROM public.trava_trip_workspace_invitations
  WHERE id = p_invitation_id
    AND public.trava_current_identity_matches(recipient)
    AND status = 'pending'
  FOR UPDATE;

  IF invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or not available';
  END IF;

  UPDATE public.trava_trip_workspace_invitations
  SET status = p_status,
      responded_at = now(),
      updated_at = now()
  WHERE id = p_invitation_id
  RETURNING * INTO invitation;

  IF p_status = 'accepted' THEN
    INSERT INTO public.trava_trip_workspace_members (
      trip_id, user_id, role, status, invitation_id
    )
    VALUES (
      invitation.trip_id, auth.uid(), 'editor', 'accepted', invitation.id
    )
    ON CONFLICT (trip_id, user_id) DO UPDATE SET
      status = 'accepted',
      invitation_id = invitation.id;
  END IF;

  RETURN invitation;
END;
$$;
REVOKE ALL ON FUNCTION public.trava_respond_to_trip_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trava_respond_to_trip_invitation(uuid, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.trava_remove_trip_collaborator(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invitation public.trava_trip_workspace_invitations;
  invited_user_id uuid;
BEGIN
  SELECT * INTO invitation
  FROM public.trava_trip_workspace_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF invitation.id IS NULL OR NOT public.trava_is_trip_owner(invitation.trip_id) THEN
    RAISE EXCEPTION 'Invitation not found or permission denied';
  END IF;

  SELECT id INTO invited_user_id
  FROM auth.users
  WHERE (
    email IS NOT NULL
    AND lower(email) = lower(invitation.recipient)
  ) OR (
    phone IS NOT NULL
    AND regexp_replace(phone, '[^0-9+]', '', 'g')
        = regexp_replace(invitation.recipient, '[^0-9+]', '', 'g')
  )
  LIMIT 1;

  IF invited_user_id IS NOT NULL THEN
    DELETE FROM public.trava_trip_workspace_members
    WHERE trip_id = invitation.trip_id AND user_id = invited_user_id;
  ELSE
    DELETE FROM public.trava_trip_workspace_members
    WHERE trip_id = invitation.trip_id AND invitation_id = invitation.id;
  END IF;

  UPDATE public.trava_trip_workspace_invitations
  SET status = 'dismissed',
      responded_at = now(),
      updated_at = now()
  WHERE id = invitation.id;
END;
$$;
REVOKE ALL ON FUNCTION public.trava_remove_trip_collaborator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trava_remove_trip_collaborator(uuid) TO authenticated;
REVOKE ALL ON TABLE public.trava_trip_workspaces FROM anon;
REVOKE ALL ON TABLE public.trava_trip_workspace_members FROM anon;
REVOKE ALL ON TABLE public.trava_trip_workspace_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trava_trip_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trava_trip_workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trava_trip_workspace_invitations TO authenticated;
-- Private trip-document bucket. Local storage remains the first write target;
-- authenticated sync uploads only after a local record has been persisted.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trip-documents', 'trip-documents', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 52428800;
DROP POLICY IF EXISTS trava_trip_documents_select ON storage.objects;
CREATE POLICY trava_trip_documents_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'trip-documents'
  AND (
    owner_id = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
      AND (
        public.trava_is_trip_owner(((storage.foldername(name))[1])::uuid)
        OR public.trava_is_trip_member(((storage.foldername(name))[1])::uuid)
      )
    )
  )
);
DROP POLICY IF EXISTS trava_trip_documents_insert ON storage.objects;
CREATE POLICY trava_trip_documents_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trip-documents' AND owner_id = auth.uid()::text);
DROP POLICY IF EXISTS trava_trip_documents_update ON storage.objects;
CREATE POLICY trava_trip_documents_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'trip-documents' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'trip-documents' AND owner_id = auth.uid()::text);
DROP POLICY IF EXISTS trava_trip_documents_delete ON storage.objects;
CREATE POLICY trava_trip_documents_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'trip-documents' AND owner_id = auth.uid()::text);
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trava_trip_workspaces;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trava_trip_workspace_invitations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
