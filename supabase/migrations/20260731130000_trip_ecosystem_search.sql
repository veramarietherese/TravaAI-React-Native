-- Authenticated traveler discovery for trip collaboration.
-- Returns only the minimum fields required for an in-app people picker.

CREATE OR REPLACE FUNCTION public.trava_search_travelers(
  p_query text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    profile.id,
    profile.full_name,
    profile.email,
    profile.avatar_url
  FROM public.profiles profile
  WHERE auth.uid() IS NOT NULL
    AND profile.id <> auth.uid()
    AND (profile.role IS NULL OR profile.role = 'traveler'::public.user_role)
    AND length(trim(coalesce(p_query, ''))) >= 2
    AND (
      profile.full_name ILIKE '%' || trim(p_query) || '%'
      OR profile.email ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY
    CASE WHEN profile.full_name ILIKE trim(p_query) || '%' THEN 0 ELSE 1 END,
    profile.full_name
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 20);
$$;
REVOKE ALL ON FUNCTION public.trava_search_travelers(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trava_search_travelers(text, integer) TO authenticated;
