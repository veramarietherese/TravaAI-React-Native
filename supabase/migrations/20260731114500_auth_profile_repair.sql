-- Repair/initialize the authenticated user's TRAVA profile, including legacy users.
-- This removes a login failure mode where Supabase Auth succeeds but no public profile exists.

CREATE OR REPLACE FUNCTION public.ensure_my_profile(
  p_role public.user_role,
  p_full_name text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  auth_user auth.users;
  result public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO auth_user FROM auth.users WHERE id = auth.uid();
  IF auth_user.id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user record not found';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, updated_at
  )
  VALUES (
    auth_user.id,
    auth_user.email,
    coalesce(
      nullif(trim(p_full_name), ''),
      nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
      'New User'
    ),
    nullif(auth_user.raw_user_meta_data ->> 'avatar_url', ''),
    p_role,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.profiles.full_name = 'New User' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    avatar_url = coalesce(public.profiles.avatar_url, EXCLUDED.avatar_url),
    role = coalesce(public.profiles.role, EXCLUDED.role),
    updated_at = now()
  RETURNING * INTO result;

  IF result.role <> p_role THEN
    RAISE EXCEPTION 'This account belongs to the % portal', result.role;
  END IF;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_my_profile(public.user_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile(public.user_role, text) TO authenticated;
