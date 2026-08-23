-- Server-only persistent cache for live flight provider responses.
-- The mobile client has no direct access; the API service role reads and writes it.
CREATE TABLE IF NOT EXISTS public.trava_flight_status_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trava_flight_status_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS trava_flight_status_cache_expires_idx
  ON public.trava_flight_status_cache(expires_at);
REVOKE ALL ON public.trava_flight_status_cache FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.trava_prune_flight_status_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.trava_flight_status_cache WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.trava_prune_flight_status_cache() FROM PUBLIC;
