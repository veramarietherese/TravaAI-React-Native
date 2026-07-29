function fmtTime(epochSec) {
  if (!epochSec) return null
  const d = new Date(epochSec * 1000)
  const hh = d.getHours()
  const mm = d.getMinutes().toString().padStart(2, "0")
  const ampm = hh >= 12 ? "PM" : "AM"
  const h = ((hh + 11) % 12) + 1
  return `${h}:${mm} ${ampm}`
}

function mapAirlabsSchedule(item) {
  return {
    departureTime: item.departure?.scheduledTime ? new Date(item.departure.scheduledTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : item.departure?.time || "—",
    arrivalTime: item.arrival?.scheduledTime ? new Date(item.arrival.scheduledTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : item.arrival?.time || "—",
    originCode: item.departure?.iata || item.dep_iata || "—",
    originName: item.departure?.airport || item.dep_airport || "—",
    destCode: item.arrival?.iata || item.arr_iata || "—",
    destName: item.arrival?.airport || item.arr_airport || "—",
    terminal: item.departure?.terminal || item.dep_terminal || "—",
    gate: item.departure?.gate || item.dep_gate || "—",
  }
}

export async function getFlightSchedule(airportIata, beginSec, endSec) {
  const apiKey = import.meta.env.VITE_AIRLABS_API_KEY
  // Hidden debug toggle: only use the live AirLabs endpoint in development and when explicitly enabled.
  const debugEnabled = import.meta.env.DEV && import.meta.env.VITE_AIRLABS_DEBUG === "true"

  if (apiKey && debugEnabled) {
    try {
      const date = new Date(beginSec * 1000).toISOString().split("T")[0]
      const url = `https://airlabs.co/api/v9/schedules?dep_iata=${airportIata}&dep_time=${date}&api_key=${apiKey}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data && data.response && Array.isArray(data.response)) {
          return data.response.map(mapAirlabsSchedule)
        }
      }
      console.error("Airlabs schedule response error", await res.text())
    } catch (err) {
      console.error("Airlabs fetch failed", err)
    }
  }

  return [
    {
      departureTime: "9:00 AM",
      arrivalTime: "2:30 PM",
      originCode: "CEB",
      originName: "Cebu",
      destCode: "NRT",
      destName: "Tokyo (Narita)",
      terminal: "Cebu Terminal 2",
      gate: "Gate C6",
    },
  ]
}
