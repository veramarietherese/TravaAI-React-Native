-- TRAVA AI React Native authentication foundation.
-- This migration intentionally leaves legacy public.users and travel_agencies tables untouched.

DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM ('traveler', 'agency');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT 'New User',
  avatar_url text,
  role public.user_role,
  phone text,
  bio text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  verification_deferred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT 'New User';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_deferred boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requested_role public.user_role;
BEGIN
  requested_role := CASE lower(coalesce(NEW.raw_user_meta_data ->> 'role', ''))
    WHEN 'traveler' THEN 'traveler'::public.user_role
    WHEN 'agency' THEN 'agency'::public.user_role
    ELSE NULL
  END;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(nullif(NEW.raw_user_meta_data ->> 'full_name', ''), 'New User'),
    nullif(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    requested_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.profiles.full_name = 'New User' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    avatar_url = coalesce(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_trava_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_trava_profile
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- Backfill profiles for existing email/password and Google users.
INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
SELECT
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), 'New User'),
  nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
  CASE lower(coalesce(u.raw_user_meta_data ->> 'role', ''))
    WHEN 'traveler' THEN 'traveler'::public.user_role
    WHEN 'agency' THEN 'agency'::public.user_role
    ELSE NULL
  END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_my_role(p_role public.user_role)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET role = p_role, updated_at = now()
  WHERE id = auth.uid()
    AND (role IS NULL OR role = p_role)
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Role has already been selected and cannot be changed from the client';
  END IF;

  RETURN result;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END
$$;

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE INSERT, DELETE ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, phone, bio, onboarding_completed, verification_deferred, updated_at)
  ON TABLE public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_role(public.user_role) TO authenticated;
