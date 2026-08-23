export interface DiscoverPlace {
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  rating: number;
  distance: string;
  category: string;
  city?: string | null;
  country?: string | null;
}
export interface DiscoverMapProps {
  places: DiscoverPlace[];
  selectedId?: string | null;
  center?: { latitude: number; longitude: number } | null;
  onSelect(id: string): void;
  onMapPress?(coordinate: { latitude: number; longitude: number }): void;
}
