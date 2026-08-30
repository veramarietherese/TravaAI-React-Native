export type TravelAgencyPreview = {
  id: string;
  name: string;
  location: string;
  description: string;
  specialties: string[];
  imageUrl: string;
  status: "preview";
};

/** Temporary marketplace preview fixture. These are illustrative profiles, not verified Trava partners. */
export const TRAVEL_AGENCY_PREVIEWS: TravelAgencyPreview[] = [
  { id: "preview-agency-city", name: "City & Culture Studio", location: "Marketplace preview", description: "How a city-focused travel advisor could appear in Trava.", specialties: ["City breaks", "Culture", "Food"], imageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=80", status: "preview" },
  { id: "preview-agency-islands", name: "Island Route Co.", location: "Marketplace preview", description: "Preview of an island and outdoor specialist profile.", specialties: ["Islands", "Outdoor", "Transfers"], imageUrl: "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1000&q=80", status: "preview" },
  { id: "preview-agency-family", name: "Family Journey Desk", location: "Marketplace preview", description: "Preview of a family-oriented planning provider.", specialties: ["Families", "Private tours", "Pacing"], imageUrl: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1000&q=80", status: "preview" },
];
