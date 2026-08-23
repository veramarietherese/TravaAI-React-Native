-- TRAVA AI interactive globe and route statistics.
-- This migration stores routes per authenticated traveler and derives all country data server-side.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.travel_country_catalog (
  code text PRIMARY KEY CHECK (char_length(code) = 2 AND code = upper(code)),
  name text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180)
);

INSERT INTO public.travel_country_catalog (code, name, latitude, longitude)
VALUES
  ('AE', 'United Arab Emirates', 24.0, 54.0),
  ('AF', 'Afghanistan', 33.0, 65.0),
  ('AG', 'Antigua and Barbuda', 17.05, -61.8),
  ('AI', 'Anguilla', 18.25, -63.1667),
  ('AL', 'Albania', 41.0, 20.0),
  ('AM', 'Armenia', 40.0, 45.0),
  ('AO', 'Angola', -12.5, 18.5),
  ('AQ', 'Antarctica', -82.0, 0.0),
  ('AR', 'Argentina', -34.0, -64.0),
  ('AS', 'American Samoa', -14.3333, -170.0),
  ('AT', 'Austria', 47.3333, 13.3333),
  ('AU', 'Australia', -27.0, 133.0),
  ('AW', 'Aruba', 12.5, -69.9667),
  ('AZ', 'Azerbaijan', 40.5, 47.5),
  ('BA', 'Bosnia and Herzegovina', 44.0, 18.0),
  ('BB', 'Barbados', 13.1667, -59.5333),
  ('BD', 'Bangladesh', 24.0, 90.0),
  ('BE', 'Belgium', 50.8333, 4.0),
  ('BF', 'Burkina Faso', 13.0, -2.0),
  ('BG', 'Bulgaria', 43.0, 25.0),
  ('BH', 'Bahrain', 26.0, 50.55),
  ('BI', 'Burundi', -3.5, 30.0),
  ('BJ', 'Benin', 9.5, 2.25),
  ('BM', 'Bermuda', 32.3333, -64.75),
  ('BN', 'Brunei', 4.5, 114.6667),
  ('BO', 'Bolivia', -17.0, -65.0),
  ('BR', 'Brazil', -10.0, -55.0),
  ('BS', 'The Bahamas', 24.25, -76.0),
  ('BT', 'Bhutan', 27.5, 90.5),
  ('BW', 'Botswana', -22.0, 24.0),
  ('BY', 'Belarus', 53.0, 28.0),
  ('BZ', 'Belize', 17.25, -88.75),
  ('CA', 'Canada', 60.0, -95.0),
  ('CC', 'Cocos (Keeling) Islands', -12.5, 96.8333),
  ('CD', 'Democratic Republic of the Congo', 0.0, 25.0),
  ('CF', 'Central African Republic', 7.0, 21.0),
  ('CG', 'Republic of the Congo', -1.0, 15.0),
  ('CH', 'Switzerland', 47.0, 8.0),
  ('CI', 'Ivory Coast', 8.0, -5.0),
  ('CK', 'Cook Islands', -21.2333, -159.7667),
  ('CL', 'Chile', -30.0, -71.0),
  ('CM', 'Cameroon', 6.0, 12.0),
  ('CN', 'China', 35.0, 105.0),
  ('CO', 'Colombia', 4.0, -72.0),
  ('CR', 'Costa Rica', 10.0, -84.0),
  ('CU', 'Cuba', 21.5, -80.0),
  ('CV', 'Cape Verde', 16.0, -24.0),
  ('CX', 'Christmas Island', -10.5, 105.6667),
  ('CY', 'Cyprus', 35.0, 33.0),
  ('CZ', 'Czech Republic', 49.75, 15.5),
  ('DE', 'Germany', 51.0, 9.0),
  ('DJ', 'Djibouti', 11.5, 43.0),
  ('DK', 'Denmark', 56.0, 10.0),
  ('DM', 'Dominica', 15.4167, -61.3333),
  ('DO', 'Dominican Republic', 19.0, -70.6667),
  ('DZ', 'Algeria', 28.0, 3.0),
  ('EC', 'Ecuador', -2.0, -77.5),
  ('EE', 'Estonia', 59.0, 26.0),
  ('EG', 'Egypt', 27.0, 30.0),
  ('EH', 'Western Sahara', 24.5, -13.0),
  ('ER', 'Eritrea', 15.0, 39.0),
  ('ES', 'Spain', 40.0, -4.0),
  ('ET', 'Ethiopia', 8.0, 38.0),
  ('FI', 'Finland', 64.0, 26.0),
  ('FJ', 'Fiji', -18.0, 175.0),
  ('FK', 'Falkland Islands', -51.75, -59.0),
  ('FM', 'Federated States of Micronesia', 6.9167, 158.25),
  ('FO', 'Faroe Islands', 62.0, -7.0),
  ('FR', 'France', 46.0, 2.0),
  ('GA', 'Gabon', -1.0, 11.75),
  ('GB', 'United Kingdom', 54.0, -2.0),
  ('GD', 'Grenada', 12.1167, -61.6667),
  ('GE', 'Georgia', 42.0, 43.5),
  ('GF', 'French Guiana', 4.0, -53.0),
  ('GG', 'Guernsey', 49.4667, -2.5833),
  ('GH', 'Ghana', 8.0, -2.0),
  ('GI', 'Gibraltar', 36.1333, -5.35),
  ('GL', 'Greenland', 72.0, -40.0),
  ('GM', 'The Gambia', 13.4667, -16.5667),
  ('GN', 'Guinea', 11.0, -10.0),
  ('GP', 'Guadeloupe', 16.25, -61.5833),
  ('GQ', 'Equatorial Guinea', 2.0, 10.0),
  ('GR', 'Greece', 39.0, 22.0),
  ('GS', 'South Georgia', -54.5, -37.0),
  ('GT', 'Guatemala', 15.5, -90.25),
  ('GU', 'Guam', 13.4667, 144.7833),
  ('GW', 'Guinea-Bissau', 12.0, -15.0),
  ('GY', 'Guyana', 5.0, -59.0),
  ('HK', 'Hong Kong', 22.25, 114.1667),
  ('HM', 'Heard Island and McDonald Islands', -53.1, 72.5167),
  ('HN', 'Honduras', 15.0, -86.5),
  ('HR', 'Croatia', 45.1667, 15.5),
  ('HT', 'Haiti', 19.0, -72.4167),
  ('HU', 'Hungary', 47.0, 20.0),
  ('ID', 'Indonesia', -5.0, 120.0),
  ('IE', 'Ireland', 53.0, -8.0),
  ('IL', 'Israel', 31.5, 34.75),
  ('IM', 'Isle of Man', 54.25, -4.5),
  ('IN', 'India', 20.0, 77.0),
  ('IO', 'British Indian Ocean Territory', -6.0, 71.5),
  ('IQ', 'Iraq', 33.0, 44.0),
  ('IR', 'Iran', 32.0, 53.0),
  ('IS', 'Iceland', 65.0, -18.0),
  ('IT', 'Italy', 42.8333, 12.8333),
  ('JE', 'Jersey', 49.25, -2.1667),
  ('JM', 'Jamaica', 18.25, -77.5),
  ('JO', 'Jordan', 31.0, 36.0),
  ('JP', 'Japan', 36.0, 138.0),
  ('KE', 'Kenya', 1.0, 38.0),
  ('KG', 'Kyrgyzstan', 41.0, 75.0),
  ('KH', 'Cambodia', 13.0, 105.0),
  ('KI', 'Kiribati', 1.4167, 173.0),
  ('KM', 'Comoros', -12.1667, 44.25),
  ('KN', 'Saint Kitts and Nevis', 17.3333, -62.75),
  ('KP', 'North Korea', 40.0, 127.0),
  ('KR', 'South Korea', 37.0, 127.5),
  ('KW', 'Kuwait', 29.5, 45.75),
  ('KY', 'Cayman Islands', 19.5, -80.5),
  ('KZ', 'Kazakhstan', 48.0, 68.0),
  ('LA', 'Laos', 18.0, 105.0),
  ('LB', 'Lebanon', 33.8333, 35.8333),
  ('LC', 'Saint Lucia', 13.8833, -60.9667),
  ('LI', 'Liechtenstein', 47.2667, 9.5333),
  ('LK', 'Sri Lanka', 7.0, 81.0),
  ('LR', 'Liberia', 6.5, -9.5),
  ('LS', 'Lesotho', -29.5, 28.5),
  ('LT', 'Lithuania', 56.0, 24.0),
  ('LU', 'Luxembourg', 49.75, 6.1667),
  ('LV', 'Latvia', 57.0, 25.0),
  ('LY', 'Libya', 25.0, 17.0),
  ('MA', 'Morocco', 32.0, -5.0),
  ('MC', 'Monaco', 43.7333, 7.4),
  ('MD', 'Moldova', 47.0, 29.0),
  ('MG', 'Madagascar', -20.0, 47.0),
  ('MH', 'Marshall Islands', 9.0, 168.0),
  ('MK', 'Republic of Macedonia', 41.8333, 22.0),
  ('ML', 'Mali', 17.0, -4.0),
  ('MN', 'Mongolia', 46.0, 105.0),
  ('MO', 'Macau', 22.1667, 113.55),
  ('MP', 'Northern Mariana Islands', 15.2, 145.75),
  ('MQ', 'Martinique', 14.6667, -61.0),
  ('MR', 'Mauritania', 20.0, -12.0),
  ('MS', 'Montserrat', 16.75, -62.2),
  ('MT', 'Malta', 35.8333, 14.5833),
  ('MU', 'Mauritius', -20.2833, 57.55),
  ('MV', 'Maldives', 3.25, 73.0),
  ('MW', 'Malawi', -13.5, 34.0),
  ('MX', 'Mexico', 23.0, -102.0),
  ('MY', 'Malaysia', 2.5, 112.5),
  ('MZ', 'Mozambique', -18.25, 35.0),
  ('NA', 'Namibia', -22.0, 17.0),
  ('NC', 'New Caledonia', -21.5, 165.5),
  ('NE', 'Niger', 16.0, 8.0),
  ('NF', 'Norfolk Island', -29.0333, 167.95),
  ('NG', 'Nigeria', 10.0, 8.0),
  ('NI', 'Nicaragua', 13.0, -85.0),
  ('NL', 'Netherlands', 52.5, 5.75),
  ('NO', 'Norway', 62.0, 10.0),
  ('NP', 'Nepal', 28.0, 84.0),
  ('NR', 'Nauru', -0.5333, 166.9167),
  ('NU', 'Niue', -19.0333, -169.8667),
  ('NZ', 'New Zealand', -41.0, 174.0),
  ('OM', 'Oman', 21.0, 57.0),
  ('PA', 'Panama', 9.0, -80.0),
  ('PE', 'Peru', -10.0, -76.0),
  ('PF', 'French Polynesia', -15.0, -140.0),
  ('PG', 'Papua New Guinea', -6.0, 147.0),
  ('PH', 'Philippines', 13.0, 122.0),
  ('PK', 'Pakistan', 30.0, 70.0),
  ('PL', 'Poland', 52.0, 20.0),
  ('PM', 'Saint Pierre and Miquelon', 46.8333, -56.3333),
  ('PN', 'Pitcairn Islands', -25.0667, -130.1),
  ('PR', 'Puerto Rico', 18.25, -66.5),
  ('PS', 'Palestine', 31.9522, 35.2332),
  ('PT', 'Portugal', 39.5, -8.0),
  ('PW', 'Palau', 7.5, 134.5),
  ('PY', 'Paraguay', -23.0, -58.0),
  ('QA', 'Qatar', 25.5, 51.25),
  ('RE', 'Réunion', -21.15, 55.5),
  ('RO', 'Romania', 46.0, 25.0),
  ('RS', 'Serbia', 44.1305, 16.4284),
  ('RU', 'Russia', 60.0, 100.0),
  ('RW', 'Rwanda', -2.0, 30.0),
  ('SA', 'Saudi Arabia', 25.0, 45.0),
  ('SB', 'Solomon Islands', -8.0, 159.0),
  ('SC', 'Seychelles', -4.5833, 55.6667),
  ('SD', 'Sudan', 15.0, 30.0),
  ('SE', 'Sweden', 62.0, 15.0),
  ('SG', 'Singapore', 1.3667, 103.8),
  ('SH', 'Saint Helena', -15.95, -5.7),
  ('SI', 'Slovenia', 46.1167, 14.8167),
  ('SJ', 'Svalbard and Jan Mayen', 78.0, 20.0),
  ('SK', 'Slovakia', 48.6667, 19.5),
  ('SL', 'Sierra Leone', 8.5, -11.5),
  ('SM', 'San Marino', 43.7667, 12.4167),
  ('SN', 'Senegal', 14.0, -14.0),
  ('SO', 'Somalia', 10.0, 49.0),
  ('SR', 'Suriname', 4.0, -56.0),
  ('SS', 'South Sudan', 7.0, 30.0),
  ('ST', 'São Tomé and Príncipe', 1.0, 7.0),
  ('SV', 'El Salvador', 13.8333, -88.9167),
  ('SY', 'Syria', 35.0, 38.0),
  ('SZ', 'Swaziland', -26.5, 31.5),
  ('TD', 'Chad', 15.0, 19.0),
  ('TF', 'French Southern and Antarctic Lands', -49.25, 69.167),
  ('TG', 'Togo', 8.0, 1.1667),
  ('TH', 'Thailand', 15.0, 100.0),
  ('TJ', 'Tajikistan', 39.0, 71.0),
  ('TK', 'Tokelau', -9.0, -172.0),
  ('TL', 'East Timor', -8.8333, 125.9167),
  ('TM', 'Turkmenistan', 40.0, 60.0),
  ('TN', 'Tunisia', 34.0, 9.0),
  ('TO', 'Tonga', -20.0, -175.0),
  ('TR', 'Turkey', 39.0, 35.0),
  ('TT', 'Trinidad and Tobago', 11.0, -61.0),
  ('TV', 'Tuvalu', -8.0, 178.0),
  ('TW', 'Taiwan', 23.5, 121.0),
  ('TZ', 'Tanzania', -6.0, 35.0),
  ('UA', 'Ukraine', 49.0, 32.0),
  ('UG', 'Uganda', 1.0, 32.0),
  ('US', 'United States', 38.0, -97.0),
  ('UY', 'Uruguay', -33.0, -56.0),
  ('UZ', 'Uzbekistan', 41.0, 64.0),
  ('VA', 'Vatican City', 41.9029, 12.4534),
  ('VC', 'Saint Vincent and the Grenadines', 13.25, -61.2),
  ('VE', 'Venezuela', 8.0, -66.0),
  ('VN', 'Vietnam', 16.1667, 107.8333),
  ('VU', 'Vanuatu', -16.0, 167.0),
  ('WF', 'Wallis and Futuna', -13.3, -176.2),
  ('WS', 'Samoa', -13.5833, -172.3333),
  ('XK', 'Kosovo', 42.6026, 20.903),
  ('YE', 'Yemen', 15.0, 48.0),
  ('YT', 'Mayotte', -12.8333, 45.1667),
  ('ZA', 'South Africa', -29.0, 24.0),
  ('ZM', 'Zambia', -15.0, 30.0),
  ('ZW', 'Zimbabwe', -20.0, 30.0)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

CREATE TABLE IF NOT EXISTS public.travel_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_code text NOT NULL REFERENCES public.travel_country_catalog(code),
  origin_name text NOT NULL,
  origin_lat double precision NOT NULL CHECK (origin_lat BETWEEN -90 AND 90),
  origin_lng double precision NOT NULL CHECK (origin_lng BETWEEN -180 AND 180),
  destination_code text NOT NULL REFERENCES public.travel_country_catalog(code),
  destination_name text NOT NULL,
  destination_lat double precision NOT NULL CHECK (destination_lat BETWEEN -90 AND 90),
  destination_lng double precision NOT NULL CHECK (destination_lng BETWEEN -180 AND 180),
  distance_km numeric(12,2) NOT NULL CHECK (distance_km >= 0),
  traveled_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT travel_routes_different_countries CHECK (origin_code <> destination_code)
);

CREATE INDEX IF NOT EXISTS travel_routes_user_date_idx
  ON public.travel_routes (user_id, traveled_at, created_at);

CREATE OR REPLACE FUNCTION public.travel_haversine_km(
  origin_latitude double precision,
  origin_longitude double precision,
  destination_latitude double precision,
  destination_longitude double precision
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT round((
    6371.0088 * 2 * asin(
      least(
        1::double precision,
        sqrt(
          power(sin(radians(destination_latitude - origin_latitude) / 2), 2) +
          cos(radians(origin_latitude)) * cos(radians(destination_latitude)) *
          power(sin(radians(destination_longitude - origin_longitude) / 2), 2)
        )
      )
    )
  )::numeric, 2);
$$;

CREATE OR REPLACE FUNCTION public.hydrate_travel_route()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origin_country public.travel_country_catalog%ROWTYPE;
  destination_country public.travel_country_catalog%ROWTYPE;
BEGIN
  NEW.origin_code := upper(trim(NEW.origin_code));
  NEW.destination_code := upper(trim(NEW.destination_code));

  IF NEW.origin_code = NEW.destination_code THEN
    RAISE EXCEPTION 'Origin and destination must be different countries';
  END IF;

  SELECT * INTO origin_country
  FROM public.travel_country_catalog
  WHERE code = NEW.origin_code;

  SELECT * INTO destination_country
  FROM public.travel_country_catalog
  WHERE code = NEW.destination_code;

  IF origin_country.code IS NULL OR destination_country.code IS NULL THEN
    RAISE EXCEPTION 'Unknown origin or destination country';
  END IF;

  NEW.origin_name := origin_country.name;
  NEW.origin_lat := origin_country.latitude;
  NEW.origin_lng := origin_country.longitude;
  NEW.destination_name := destination_country.name;
  NEW.destination_lat := destination_country.latitude;
  NEW.destination_lng := destination_country.longitude;
  NEW.distance_km := public.travel_haversine_km(
    origin_country.latitude,
    origin_country.longitude,
    destination_country.latitude,
    destination_country.longitude
  );
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hydrate_travel_route_before_write ON public.travel_routes;
CREATE TRIGGER hydrate_travel_route_before_write
BEFORE INSERT OR UPDATE
ON public.travel_routes
FOR EACH ROW EXECUTE FUNCTION public.hydrate_travel_route();

ALTER TABLE public.travel_country_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS travel_country_catalog_read ON public.travel_country_catalog;
CREATE POLICY travel_country_catalog_read
ON public.travel_country_catalog
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS travel_routes_select_own ON public.travel_routes;
CREATE POLICY travel_routes_select_own
ON public.travel_routes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS travel_routes_insert_own ON public.travel_routes;
CREATE POLICY travel_routes_insert_own
ON public.travel_routes
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS travel_routes_delete_own ON public.travel_routes;
CREATE POLICY travel_routes_delete_own
ON public.travel_routes
FOR DELETE TO authenticated
USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.travel_country_catalog FROM anon;
REVOKE ALL ON TABLE public.travel_routes FROM anon;
REVOKE ALL ON TABLE public.travel_country_catalog FROM authenticated;
REVOKE ALL ON TABLE public.travel_routes FROM authenticated;
GRANT SELECT ON TABLE public.travel_country_catalog TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.travel_routes TO authenticated;

NOTIFY pgrst, 'reload schema';
