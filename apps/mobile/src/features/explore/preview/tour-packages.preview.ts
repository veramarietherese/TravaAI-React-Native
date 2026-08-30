export type TourPackagePreview = {
  id: string;
  title: string;
  destination: string;
  duration: string;
  samplePrice: string;
  inclusions: string[];
  imageUrl: string;
  status: "preview";
};

/** Temporary marketplace preview fixture. Not live inventory and not bookable. */
export const TOUR_PACKAGE_PREVIEWS: TourPackagePreview[] = [
  { id: "preview-cebu-heritage", title: "Cebu City Heritage Tour", destination: "Cebu City", duration: "Half day", samplePrice: "Sample ₱1,500", inclusions: ["Guide", "Heritage stops", "Local snack"], imageUrl: "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=1000&q=80", status: "preview" },
  { id: "preview-mactan-day", title: "Mactan Island Day Tour", destination: "Lapu-Lapu City", duration: "Full day", samplePrice: "Sample ₱2,200", inclusions: ["Transfers", "Island stops", "Lunch"], imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80", status: "preview" },
  { id: "preview-badian", title: "Badian Canyoneering", destination: "Badian, Cebu", duration: "7–8 hours", samplePrice: "Sample ₱2,700", inclusions: ["Guide", "Safety gear", "Transfers"], imageUrl: "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1000&q=80", status: "preview" },
  { id: "preview-moalboal", title: "Moalboal Island Hopping", destination: "Moalboal, Cebu", duration: "Half day", samplePrice: "Sample ₱2,400", inclusions: ["Boat", "Guide", "Snorkel gear"], imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=80", status: "preview" },
];
