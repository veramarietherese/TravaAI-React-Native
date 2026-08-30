export type Coordinates = { latitude: number; longitude: number };
export type TravelMode = "driving" | "walking" | "cycling";

export interface PlaceImage {
  url: string;
  thumbnailUrl?: string | null;
  source: "wikimedia" | "provider";
  sourceEntityId?: string | null;
  author?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  attributionText?: string | null;
  sourceUrl?: string | null;
  verifiedEntityMatch: boolean;
}

export interface DiscoverPlace {
  id: string;
  provider?: "osm";
  providerId?: string;
  osmType?: "node" | "way" | "relation" | null;
  osmId?: number | null;
  name: string;
  subtitle: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  category: string;
  city?: string | null;
  country?: string | null;
  distanceMeters?: number | null;
  openingHours?: string | null;
  website?: string | null;
  phone?: string | null;
  sourceUrl?: string | null;
  imageRefs?: {
    wikimediaCommons?: string;
    wikidata?: string;
    wikipedia?: string;
  } | null;
  image?: PlaceImage | null;
  /** Legacy optional fields retained for source compatibility; production Discover does not fabricate them. */
  imageUrl?: string | null;
  rating?: number | null;
  distance?: string | null;
}

export interface MapRoute {
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Coordinates[];
}

export interface DiscoverMapProps {
  places: DiscoverPlace[];
  selectedId?: string | null;
  center: Coordinates;
  userLocation?: Coordinates | null;
  route?: MapRoute | null;
  onSelect(id: string): void;
  onMapPress?(coordinate: Coordinates): void;
  height?: number;
}
