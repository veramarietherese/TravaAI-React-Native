export interface WeatherPrep {
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
  high: number;
  low: number;
  timezone: string;
  checkedAt: string;
}

const memoryCache = new Map<string, { value: WeatherPrep; expires: number }>();

export async function fetchWeatherPreparation(latitude: number, longitude: number): Promise<WeatherPrep> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    hourly: "precipitation_probability",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "3",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Weather preparation is temporarily unavailable.");
  const data = await response.json() as {
    timezone?: string;
    current?: { temperature_2m?: number; apparent_temperature?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number };
    hourly?: { precipitation_probability?: number[] };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] };
  };
  const value: WeatherPrep = {
    temperature: Number(data.current?.temperature_2m ?? 0),
    apparentTemperature: Number(data.current?.apparent_temperature ?? data.current?.temperature_2m ?? 0),
    precipitationProbability: Number(data.daily?.precipitation_probability_max?.[0] ?? Math.max(0, ...(data.hourly?.precipitation_probability ?? [0]).slice(0, 24))),
    windSpeed: Number(data.current?.wind_speed_10m ?? 0),
    weatherCode: Number(data.current?.weather_code ?? 0),
    high: Number(data.daily?.temperature_2m_max?.[0] ?? data.current?.temperature_2m ?? 0),
    low: Number(data.daily?.temperature_2m_min?.[0] ?? data.current?.temperature_2m ?? 0),
    timezone: data.timezone ?? "local",
    checkedAt: new Date().toISOString(),
  };
  memoryCache.set(key, { value, expires: Date.now() + 15 * 60_000 });
  return value;
}
