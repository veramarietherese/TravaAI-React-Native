import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AgencyBrandMark } from "./AgencyBrandMark";
import { listTrips } from "@/features/trips/api/trips.api";
import { searchWorldPlaces } from "@/features/maps/utils/world-place-search";
import { resolveFreePlaceImage } from "@/features/maps/utils/place-photo";
import { addDiscoverPlaceToItinerary } from "@/features/explore/utils/add-place-to-itinerary";
import type { HomeListing, HomeTourPackage } from "../types/home.types";
import { formatMoney } from "../utils/home-normalizers";

interface TravelCommerceModalsProps {
  listing: HomeListing | null;
  favorite: boolean;
  rating: number;
  comment: string;
  feedbackStatus: string | null;
  submittingFeedback: boolean;
  relatedTours?: HomeTourPackage[];
  onClose(): void;
  onToggleFavorite(): void;
  onRatingChange(value: number): void;
  onCommentChange(value: string): void;
  onSubmitFeedback(): void;
  onContinue(): void;
  onOpenTour?(tour: HomeTourPackage): void;
}

type PackageTab = "Overview" | "Itinerary" | "Inclusions" | "Reviews";
type AgencyTab = "Overview" | "Packages" | "About" | "Reviews";

export function TravelCommerceModals(props: TravelCommerceModalsProps) {
  if (!props.listing) return null;
  return props.listing.type === "tour"
    ? <TourModal {...props} listing={props.listing} />
    : <AgencyModal {...props} listing={props.listing} />;
}

function Shell({ children, onClose }: { children: ReactNode; onClose(): void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={s.panel}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HeroButton({ icon, onPress, label }: { icon: ComponentProps<typeof Ionicons>["name"]; onPress(): void; label: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.heroButton, pressed && s.pressed]}>
      <Ionicons name={icon} size={20} color="#34425A" />
    </Pressable>
  );
}

function TourModal(props: TravelCommerceModalsProps & { listing: Extract<HomeListing, { type: "tour" }> }) {
  const tour = props.listing.item;
  const [tab, setTab] = useState<PackageTab>("Overview");
  const [addingPackage, setAddingPackage] = useState(false);
  const [addedPackage, setAddedPackage] = useState(false);
  const days = Math.max(1, tour.durationDays || 1);
  const nights = Math.max(0, tour.durationNights || days - 1);

  async function addPackageToItinerary() {
    if (addingPackage || addedPackage) return;
    setAddingPackage(true);
    try {
      const trips = (await listTrips()).filter((trip) => trip.status !== "completed");
      const trip = trips[0];
      if (!trip) {
        props.onContinue();
        return;
      }

      const destinationQuery = tour.destination || tour.country || tour.title;
      const places = await searchWorldPlaces(destinationQuery, null, 1);
      const found = places[0];
      if (!found) {
        props.onContinue();
        return;
      }

      const imageUrl = await resolveFreePlaceImage(found);
      await addDiscoverPlaceToItinerary({
        trip,
        place: {
          id: `package-${String(tour.id)}`,
          name: tour.title,
          subtitle: tour.description || found.displayName,
          latitude: found.latitude,
          longitude: found.longitude,
          imageUrl,
          rating: 0,
          distance: "Tour package",
          category: tour.category || "Sightseeing",
          city: found.city,
          country: found.country,
        },
        dayNumber: 1,
        startTime: "09:00",
      });
      setAddedPackage(true);
    } finally {
      setAddingPackage(false);
    }
  }

  const preview = useMemo(
    () => Array.from({ length: Math.min(3, days) }, (_, index) => ({
      day: index + 1,
      city: index === 0 ? (tour.destination || tour.country || "Arrival") : index === 1 ? (tour.destination || "Explore") : "Highlights",
      subtitle: index === 0 ? "Arrival & orientation" : index === 1 ? "Temples & local experiences" : "Food & shopping",
    })),
    [days, tour.country, tour.destination],
  );

  return (
    <Shell onClose={props.onClose}>
      <View style={s.hero}>
        {tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <LinearGradient colors={["#DDEBFA", "#F6EAF3"]} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={["rgba(9,15,26,.04)", "rgba(9,15,26,.66)"]} style={StyleSheet.absoluteFill} />
        <View style={s.heroActions}>
          <HeroButton icon="arrow-back" onPress={props.onClose} label="Close package" />
          <View style={s.heroActionRow}>
            <HeroButton icon={props.favorite ? "heart" : "heart-outline"} onPress={props.onToggleFavorite} label="Save package" />
            <HeroButton icon="share-outline" onPress={() => void Share.share({ message: `${tour.title} — ${tour.destination || tour.country || "TRAVA package"}` })} label="Share package" />
          </View>
        </View>
        <View style={s.heroText}>
          <View style={s.featurePill}><Text style={s.featurePillText}>Featured Package</Text></View>
          <Text style={s.heroTitle}>{tour.title}</Text>
          <View style={s.heroMeta}>
            <Text style={s.heroMetaText}>◉ {days} Days, {nights} Nights</Text>
            <Text style={s.heroMetaText}>⌖ {tour.destination || tour.country || "Destination"}</Text>
          </View>
        </View>
      </View>

      <View style={s.tabs}>
        {(["Overview", "Itinerary", "Inclusions", "Reviews"] as PackageTab[]).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[s.tab, tab === item && s.tabOn]}>
            <Text style={[s.tabText, tab === item && s.tabTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {tab === "Overview" ? (
          <>
            <SectionTitle>About this package</SectionTitle>
            <Text style={s.paragraph}>{tour.description || `Experience ${tour.destination || tour.country || "your destination"} through a curated TRAVA partner package with flexible planning and direct agency chat.`}</Text>

            <SectionTitle>Highlights</SectionTitle>
            <View style={s.highlights}>
              <Highlight icon="flower-outline" label="Signature Experience" tint="#FFF0F6" color="#D87CA2" />
              <Highlight icon="business-outline" label="Cultural Tours" tint="#F0F0FF" color="#8173D8" />
              <Highlight icon="restaurant-outline" label="Local Cuisine" tint="#FFF3E7" color="#D69157" />
              <Highlight icon="images-outline" label="Scenic Views" tint="#EAF7FF" color="#5E9BD0" />
            </View>

            <View style={s.sectionHeadingRow}><SectionTitle>Itinerary Preview</SectionTitle><Text style={s.viewLink}>View full itinerary</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.itineraryRow}>
              {preview.map((item) => (
                <View key={item.day} style={s.itineraryCard}>
                  <View style={s.itineraryThumb}>{tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}</View>
                  <View style={s.itineraryCopy}>
                    <Text style={s.dayLabel}>Day {item.day}</Text>
                    <Text numberOfLines={1} style={s.itineraryCity}>{item.city}</Text>
                    <Text numberOfLines={1} style={s.itinerarySub}>{item.subtitle}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <SectionTitle>Package Details</SectionTitle>
            <View style={s.detailGrid}>
              <Detail icon="people-outline" label="Group Size" value="Agency confirms" />
              <Detail icon="bed-outline" label="Accommodation" value="See inclusions" />
              <Detail icon="bus-outline" label="Transport" value="Package dependent" />
              <Detail icon="restaurant-outline" label="Meals" value="Agency confirms" />
              <Detail icon="sunny-outline" label="Best Season" value="Destination dependent" />
              <Detail icon="speedometer-outline" label="Difficulty" value="Flexible" />
            </View>
          </>
        ) : null}

        {tab === "Itinerary" ? (
          <>
            <SectionTitle>Itinerary</SectionTitle>
            {preview.map((item) => (
              <View key={item.day} style={s.timelineRow}>
                <View style={s.timelineDot}><Text style={s.timelineDotText}>{item.day}</Text></View>
                <View><Text style={s.timelineTitle}>{item.city}</Text><Text style={s.timelineText}>{item.subtitle}</Text></View>
              </View>
            ))}
            <Text style={s.note}>Final daily timing and exact inclusions are confirmed by the travel agency.</Text>
          </>
        ) : null}

        {tab === "Inclusions" ? (
          <>
            <SectionTitle>Typical package inclusions</SectionTitle>
            {["Accommodation details", "Ground transport", "Published activities", "Agency support", "Optional meal inclusions"].map((item) => (
              <View key={item} style={s.includeRow}><Ionicons name="checkmark-circle" size={19} color="#6A92D7" /><Text style={s.includeText}>{item}</Text></View>
            ))}
          </>
        ) : null}

        {tab === "Reviews" ? <ReviewPanel {...props} /> : null}
      </ScrollView>

      <View style={s.bottomBar}>
        <View style={s.priceBlock}>
          <Text style={s.from}>From</Text>
          <Text style={s.price}>{formatMoney(tour.price, tour.currencyCode)} <Text style={s.perPerson}>/ person</Text></Text>
          <Text style={s.tax}>Agency confirms taxes and final fees</Text>
        </View>
        <Pressable onPress={props.onContinue} style={s.contactButton}><Ionicons name="chatbubble-ellipses-outline" size={18} color="#34425A" /><Text style={s.contactText}>Contact Agency</Text></Pressable>
        <Pressable disabled={addingPackage || addedPackage} onPress={() => void addPackageToItinerary()} style={[s.addButton, (addingPackage || addedPackage) && s.addButtonDone]}>
          <LinearGradient colors={addedPackage ? ["#78A7D8", "#8FBCCF"] : ["#6376ED", "#895FF0"]} style={s.addGradient}>
            {addingPackage ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={addedPackage ? "checkmark-circle" : "add-circle-outline"} size={19} color="#FFFFFF" />}
            <Text style={s.addText}>{addingPackage ? "Adding..." : addedPackage ? "Added" : "Add to itinerary"}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Shell>
  );
}

function AgencyModal(props: TravelCommerceModalsProps & { listing: Extract<HomeListing, { type: "agency" }> }) {
  const agency = props.listing.item;
  const [tab, setTab] = useState<AgencyTab>("Overview");
  const related = (props.relatedTours ?? []).filter((tour) => String(tour.agencyId) === String(agency.id));

  return (
    <Shell onClose={props.onClose}>
      <View style={s.hero}>
        {agency.coverImageUrl ? <Image source={{ uri: agency.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <LinearGradient colors={["#DDEAF7", "#F3EAF1"]} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={["rgba(9,15,26,.02)", "rgba(9,15,26,.68)"]} style={StyleSheet.absoluteFill} />
        <View style={s.heroActions}>
          <HeroButton icon="arrow-back" onPress={props.onClose} label="Close agency" />
          <View style={s.heroActionRow}>
            <HeroButton icon={props.favorite ? "heart" : "heart-outline"} onPress={props.onToggleFavorite} label="Save agency" />
            <HeroButton icon="share-outline" onPress={() => void Share.share({ message: `${agency.name} — TRAVA travel partner` })} label="Share agency" />
          </View>
        </View>
        <View style={s.agencyHeroIdentity}>
          <AgencyBrandMark name={agency.name} logoUrl={agency.logoUrl} size={68} />
          <View style={s.agencyHeroCopy}>
            <View style={s.featurePill}><Text style={s.featurePillText}>Verified TRAVA Partner</Text></View>
            <Text style={s.heroTitle}>{agency.name}</Text>
            <Text numberOfLines={1} style={s.agencyHeroSub}>{agency.subtitle || "Professional travel planning and direct client support"}</Text>
          </View>
        </View>
      </View>

      <View style={s.tabs}>
        {(["Overview", "Packages", "About", "Reviews"] as AgencyTab[]).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[s.tab, tab === item && s.tabOn]}>
            <Text style={[s.tabText, tab === item && s.tabTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {tab === "Overview" ? (
          <>
            <SectionTitle>About this agency</SectionTitle>
            <Text style={s.paragraph}>{agency.description || "Connect with this TRAVA travel partner for package questions, trip customization, schedules, and availability."}</Text>
            <SectionTitle>Specialties</SectionTitle>
            <View style={s.highlights}>
              {(agency.specialties.length ? agency.specialties : ["Curated Tours", "Direct Chat", "Custom Itineraries", "Travel Support"]).slice(0, 4).map((item, index) => (
                <Highlight key={item} icon={index === 0 ? "compass-outline" : index === 1 ? "chatbubble-ellipses-outline" : index === 2 ? "map-outline" : "headset-outline"} label={item} tint={index % 2 ? "#F0F0FF" : "#EAF7FF"} color={index % 2 ? "#8173D8" : "#5E9BD0"} />
              ))}
            </View>
            <SectionTitle>Agency Details</SectionTitle>
            <View style={s.detailGrid}>
              <Detail icon="star-outline" label="Rating" value={agency.rating > 0 ? agency.rating.toFixed(1) : "New"} />
              <Detail icon="shield-checkmark-outline" label="TRAVA Status" value="Verified partner" />
              <Detail icon="chatbubble-outline" label="Contact" value="Direct in-app chat" />
              <Detail icon="briefcase-outline" label="Packages" value={`${related.length} published`} />
            </View>
          </>
        ) : null}

        {tab === "Packages" ? (
          <>
            <SectionTitle>Published packages</SectionTitle>
            {related.length ? related.map((tour) => (
              <Pressable key={String(tour.id)} onPress={() => props.onOpenTour?.(tour)} style={s.packageRow}>
                <View style={s.packageThumb}>{tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}</View>
                <View style={s.packageCopy}><Text numberOfLines={1} style={s.packageName}>{tour.title}</Text><Text style={s.packageMeta}>{tour.durationDays} days · {formatMoney(tour.price, tour.currencyCode)}</Text></View>
                <Ionicons name="chevron-forward" size={19} color="#6F7D91" />
              </Pressable>
            )) : <Text style={s.note}>No published packages are currently available from this agency.</Text>}
          </>
        ) : null}

        {tab === "About" ? (
          <>
            <SectionTitle>Professional profile</SectionTitle>
            <Text style={s.paragraph}>{agency.description || agency.subtitle || "TRAVA travel partner."}</Text>
            <Text style={s.note}>Use TRAVA chat for package questions and keep sensitive account credentials or OTPs private.</Text>
          </>
        ) : null}

        {tab === "Reviews" ? <ReviewPanel {...props} /> : null}
      </ScrollView>

      <View style={s.bottomBar}>
        <View style={s.priceBlock}><Text style={s.from}>TRAVA Partner</Text><Text style={s.price}>{agency.rating > 0 ? `${agency.rating.toFixed(1)} rating` : "New agency"}</Text><Text style={s.tax}>Direct inquiry through TRAVA</Text></View>
        <Pressable onPress={() => setTab("Packages")} style={s.contactButton}><Ionicons name="briefcase-outline" size={18} color="#34425A" /><Text style={s.contactText}>View Packages</Text></Pressable>
        <Pressable onPress={props.onContinue} style={s.addButton}><LinearGradient colors={["#6376ED", "#895FF0"]} style={s.addGradient}><Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFFFFF" /><Text style={s.addText}>Contact Agency</Text></LinearGradient></Pressable>
      </View>
    </Shell>
  );
}

function ReviewPanel(props: TravelCommerceModalsProps) {
  return (
    <>
      <SectionTitle>Communication review</SectionTitle>
      <Text style={s.paragraph}>Rate the agency’s communication in TRAVA. Package completion reviews should only be submitted after the trip is completed.</Text>
      <View style={s.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => props.onRatingChange(star)} style={s.starButton}>
            <Ionicons name={star <= props.rating ? "star" : "star-outline"} size={24} color="#E3A23A" />
          </Pressable>
        ))}
      </View>
      <TextInput multiline value={props.comment} onChangeText={props.onCommentChange} placeholder="Optional feedback" placeholderTextColor="#9AA5B6" style={s.comment} />
      {props.feedbackStatus ? <Text style={s.feedback}>{props.feedbackStatus}</Text> : null}
      <Pressable disabled={props.submittingFeedback} onPress={props.onSubmitFeedback} style={s.reviewSubmit}>
        {props.submittingFeedback ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.reviewSubmitText}>Submit communication rating</Text>}
      </Pressable>
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function Highlight({ icon, label, tint, color }: { icon: ComponentProps<typeof Ionicons>["name"]; label: string; tint: string; color: string }) {
  return (
    <View style={s.highlight}>
      <View style={[s.highlightIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={18} color={color} /></View>
      <Text numberOfLines={2} style={s.highlightText}>{label}</Text>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return (
    <View style={s.detail}>
      <Ionicons name={icon} size={18} color="#6F7C91" />
      <View><Text style={s.detailLabel}>{label}</Text><Text numberOfLines={1} style={s.detailValue}>{value}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, padding: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(16,23,35,.48)" },
  panel: { width: "100%", maxWidth: 820, maxHeight: "94%", overflow: "hidden", borderRadius: 24, backgroundColor: "#FFFFFF", boxShadow: "0 28px 80px rgba(10,18,32,.26)" },
  hero: { height: 260, position: "relative", overflow: "hidden", backgroundColor: "#E9EDF3" },
  heroActions: { position: "absolute", left: 16, right: 16, top: 16, flexDirection: "row", justifyContent: "space-between" },
  heroActionRow: { flexDirection: "row", gap: 7 },
  heroButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.92)" },
  heroText: { position: "absolute", left: 24, right: 24, bottom: 22 },
  featurePill: { alignSelf: "flex-start", minHeight: 23, paddingHorizontal: 9, borderRadius: 12, justifyContent: "center", backgroundColor: "rgba(255,255,255,.88)" },
  featurePillText: { color: "#67758B", fontSize: 8, fontWeight: "800" },
  heroTitle: { marginTop: 7, color: "#FFFFFF", fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.6 },
  heroMeta: { marginTop: 7, flexDirection: "row", flexWrap: "wrap", gap: 13 },
  heroMetaText: { color: "rgba(255,255,255,.92)", fontSize: 10, fontWeight: "700" },
  agencyHeroIdentity: { position: "absolute", left: 24, right: 24, bottom: 20, flexDirection: "row", alignItems: "flex-end", gap: 14 },
  agencyHeroCopy: { flex: 1 },
  agencyHeroSub: { marginTop: 5, color: "rgba(255,255,255,.90)", fontSize: 10, fontWeight: "600" },
  tabs: { minHeight: 54, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E8ECF1", backgroundColor: "#FFFFFF" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabOn: { borderBottomColor: "#745FEA" },
  tabText: { color: "#7A8699", fontSize: 10, fontWeight: "700" },
  tabTextOn: { color: "#6653DB", fontWeight: "900" },
  content: { padding: 24, paddingBottom: 28 },
  sectionTitle: { marginTop: 16, marginBottom: 11, color: "#17213A", fontSize: 13, fontWeight: "900" },
  paragraph: { color: "#667287", fontSize: 10, lineHeight: 16, fontWeight: "500" },
  highlights: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  highlight: { width: 132, minHeight: 72, padding: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8ECF1" },
  highlightIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  highlightText: { flex: 1, color: "#344158", fontSize: 8.5, lineHeight: 12, fontWeight: "800" },
  sectionHeadingRow: { marginTop: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewLink: { color: "#6D5DE0", fontSize: 8.5, fontWeight: "800" },
  itineraryRow: { gap: 10 },
  itineraryCard: { width: 190, minHeight: 74, padding: 7, borderRadius: 15, flexDirection: "row", gap: 8, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#E8ECF1" },
  itineraryThumb: { width: 62, height: 58, overflow: "hidden", borderRadius: 10, backgroundColor: "#E7EDF4" },
  itineraryCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  dayLabel: { color: "#747F91", fontSize: 7.5, fontWeight: "800" },
  itineraryCity: { marginTop: 3, color: "#263247", fontSize: 10, fontWeight: "900" },
  itinerarySub: { marginTop: 2, color: "#8791A1", fontSize: 7.5, fontWeight: "600" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  detail: { width: "30%", minWidth: 150, flexDirection: "row", alignItems: "center", gap: 9 },
  detailLabel: { color: "#69758A", fontSize: 7.5, fontWeight: "700" },
  detailValue: { marginTop: 2, color: "#2D394E", fontSize: 8.5, fontWeight: "800" },
  timelineRow: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: "#EDF0F4" },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF0FF" },
  timelineDotText: { color: "#6A5DDA", fontSize: 10, fontWeight: "900" },
  timelineTitle: { color: "#2D394E", fontSize: 11, fontWeight: "900" },
  timelineText: { marginTop: 3, color: "#7E899B", fontSize: 9, fontWeight: "600" },
  includeRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: "#EDF0F4" },
  includeText: { color: "#4E5A70", fontSize: 10, fontWeight: "700" },
  note: { marginTop: 14, padding: 12, borderRadius: 14, color: "#778398", fontSize: 9, lineHeight: 14, fontWeight: "600", backgroundColor: "#F6F8FB" },
  packageRow: { minHeight: 76, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#EBEEF2" },
  packageThumb: { width: 70, height: 58, borderRadius: 11, overflow: "hidden", backgroundColor: "#EDF1F5" },
  packageCopy: { flex: 1 },
  packageName: { color: "#28354A", fontSize: 11, fontWeight: "900" },
  packageMeta: { marginTop: 4, color: "#7E899A", fontSize: 8.5, fontWeight: "600" },
  stars: { flexDirection: "row", gap: 4, marginVertical: 12 },
  starButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  comment: { minHeight: 92, padding: 12, borderRadius: 14, color: "#2D394E", textAlignVertical: "top", backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#E4E8EE" },
  feedback: { marginTop: 8, color: "#63708A", fontSize: 9, fontWeight: "700" },
  reviewSubmit: { marginTop: 12, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#6D5DE0" },
  reviewSubmitText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  bottomBar: { minHeight: 86, paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#E6EAF0", backgroundColor: "#FFFFFF" },
  priceBlock: { flex: 1 },
  from: { color: "#7C8798", fontSize: 8, fontWeight: "700" },
  price: { marginTop: 2, color: "#17213A", fontSize: 18, fontWeight: "900" },
  perPerson: { fontSize: 8, fontWeight: "700" },
  tax: { marginTop: 2, color: "#969FAC", fontSize: 7, fontWeight: "600" },
  contactButton: { minWidth: 148, height: 48, paddingHorizontal: 15, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#DDE2E9", backgroundColor: "#FFFFFF" },
  contactText: { color: "#34425A", fontSize: 9.5, fontWeight: "900" },
  addButton: { borderRadius: 13, overflow: "hidden" },
  addButtonDone: { opacity: 0.88 },
  addGradient: { minWidth: 160, height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  addText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" },
  pressed: { opacity: 0.75 },
});
