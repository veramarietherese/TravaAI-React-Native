export type TripWeather = { temperature: number | null; apparent: number | null; code: number | null; wind: number | null; label: string; emoji: string; tip: string };
const cache = new Map<string, { at: number; value: TripWeather }>();

export async function fetchTripWeather(latitude: number, longitude: number, place = "your destination"): Promise<TripWeather> {
  const key = `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const found = cache.get(key); if (found && Date.now()-found.at < 10*60*1000) return found.value;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url); if (!res.ok) throw new Error("weather");
    const json = await res.json() as { current?: { temperature_2m?: number; apparent_temperature?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number } };
    const c = json.current ?? {}; const code = Number.isFinite(c.weather_code) ? Number(c.weather_code) : null; const temp = Number.isFinite(c.temperature_2m) ? Number(c.temperature_2m) : null;
    const value = describeWeather(temp, code, Number(c.wind_speed_10m ?? 0), Number(c.precipitation ?? 0), place);
    cache.set(key,{at:Date.now(),value}); return value;
  } catch { return { temperature:null, apparent:null, code:null, wind:null, label:"Forecast unavailable", emoji:"🧳", tip:`Check the forecast again before leaving for ${place}; keep a compact layer and water in your day bag.` }; }
}

function describeWeather(temp:number|null, code:number|null, wind:number, rain:number, place:string):TripWeather {
  let label="Clear to partly cloudy", emoji="🌤️";
  if (code != null && [51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) { label="Rain possible"; emoji="🌧️"; }
  else if (code != null && [71,73,75,77,85,86].includes(code)) { label="Snowy conditions"; emoji="❄️"; }
  else if (code != null && [95,96,99].includes(code)) { label="Thunderstorms possible"; emoji="⛈️"; }
  else if (code != null && [0,1].includes(code)) { label="Mostly clear"; emoji="☀️"; }
  else if (code != null && [2,3,45,48].includes(code)) { label="Cloudy"; emoji="☁️"; }
  let tip = `Comfortable travel weather around ${place}. Keep water, sunscreen, and a light layer handy.`;
  if (rain > 0 || (code != null && code >= 51 && code <= 82)) tip = `Rain is possible around ${place}. Pack a compact umbrella, protect documents, and allow extra transit time.`;
  else if (temp != null && temp >= 30) tip = `It may feel hot in ${place}. Hydrate often, use SPF, and schedule long walks earlier or later in the day.`;
  else if (temp != null && temp <= 12) tip = `It may feel cool in ${place}. Bring a warm layer and keep weather-sensitive outdoor stops flexible.`;
  else if (wind >= 28) tip = `Winds may be noticeable in ${place}. Secure loose items and double-check ferry or outdoor activity conditions.`;
  return { temperature:temp, apparent:null, code, wind, label, emoji, tip };
}
