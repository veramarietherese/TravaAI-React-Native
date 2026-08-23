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
}

export interface DiscoverMapProps {
  places: DiscoverPlace[];
  selectedId?: string | null;
  onSelect(id: string): void;
}
