function encodePart(value?: string | null) {
  return encodeURIComponent((value || "").trim());
}

export function buildAccurateLocationImageUri(input: {
  place?: string | null;
  city?: string | null;
  country?: string | null;
  title?: string | null;
}) {
  const parts = [input.place, input.city, input.country, input.title]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);

  const query = parts.join(", ");
  if (!query) return null;

  // Deterministic travel/location image endpoint using Wikimedia search terms.
  // Front-end consumers can fall back to local placeholders if loading fails.
  return `https://commons.wikimedia.org/w/index.php?search=${encodePart(query)}&title=Special:MediaSearch&go=Go&type=image`;
}
