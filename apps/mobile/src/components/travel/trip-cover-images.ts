export type TripCoverLike = {
  name?: string | null;
  destination?: string | null;
  coverImageUrl?: string | null;
};

const COVER_LIBRARY = [
  { keys: ["japan", "tokyo", "osaka", "kyoto"], uri: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["malaysia", "kuala lumpur"], uri: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["vietnam", "hanoi", "ho chi minh"], uri: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["philippines", "cebu", "palawan", "bohol"], uri: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["korea", "seoul"], uri: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["switzerland", "zurich", "lucerne", "alps"], uri: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["indonesia", "bali"], uri: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=82" },
  { keys: ["thailand", "bangkok"], uri: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=82" },
] as const;

const GENERIC_COVERS = [
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=82",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=82",
] as const;

export function tripCoverSource(trip: TripCoverLike, index = 0) {
  const existing = trip.coverImageUrl?.trim();
  if (existing) return { uri: existing };

  const haystack = `${trip.name ?? ""} ${trip.destination ?? ""}`.toLowerCase();
  const matched = COVER_LIBRARY.find((entry) =>
    entry.keys.some((key) => haystack.includes(key)),
  );

  return {
    uri: matched?.uri ?? GENERIC_COVERS[Math.abs(index) % GENERIC_COVERS.length],
  };
}
