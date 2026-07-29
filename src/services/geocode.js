export async function searchPlaces(query) {
    if (!query || query.trim().length < 3) return []
  
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`,
    )
  
    if (!response.ok) return []
  
    const data = await response.json()
  
    return data.features.map((feature) => {
      const props = feature.properties || {}
      const [lng, lat] = feature.geometry.coordinates
  
      return {
        id: `${props.osm_type || "place"}-${props.osm_id || crypto.randomUUID()}`,
        name: props.name || props.city || props.country || "Unnamed place",
        displayName: [props.name, props.city, props.state, props.country]
          .filter(Boolean)
          .join(", "),
        city: props.city || props.state || props.country || "",
        country: props.country || "",
        lat,
        lng,
      }
    })
  }
  
  export async function geocodePlace(query) {
    const results = await searchPlaces(query)
    return results[0] || null
  }