import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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

function ModalShell({ children, onClose }: { children: ReactNode; onClose(): void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.modalCard}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CircleButton({ label, onPress, children }: { label: string; onPress(): void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange(value: number): void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} accessibilityRole="button" accessibilityLabel={`${star} star communication rating`} onPress={() => onChange(star)} style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}>
          <Text style={[styles.star, star <= value && styles.starActive]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AgencyModal(props: TravelCommerceModalsProps & { listing: Extract<HomeListing, { type: "agency" }> }) {
  const agency = props.listing.item;
  const [showPackages, setShowPackages] = useState(false);
  const related = (props.relatedTours ?? []).filter((tour) => String(tour.agencyId) === String(agency.id));

  useEffect(() => setShowPackages(false), [agency.id]);

  return (
    <ModalShell onClose={props.onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.agencyHero}>
          {agency.coverImageUrl ? (
            <Image source={{ uri: agency.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <LinearGradient colors={["#E9F4FF", "#F8EEFF", "#FFF1F5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={["rgba(255,255,255,0.02)", "rgba(255,255,255,0.72)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroActions}>
            <CircleButton label="Close agency details" onPress={props.onClose}><Ionicons name="close" size={23} color="#17233E" /></CircleButton>
            <CircleButton label={props.favorite ? "Remove agency from favorites" : "Save agency"} onPress={props.onToggleFavorite}><Ionicons name={props.favorite ? "heart" : "heart-outline"} size={21} color={props.favorite ? "#F45D91" : "#596882"} /></CircleButton>
          </View>
          <View style={styles.agencyIdentity}>
            <View style={styles.largeLogo}>
              {agency.logoUrl ? <Image source={{ uri: agency.logoUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={styles.largeLogoText}>{agency.name.slice(0, 1).toUpperCase()}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.agencyName}>{agency.name}</Text>
              <View style={styles.verified}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View>
            </View>
            <Text style={styles.agencySubtitle}>{agency.subtitle || "Verified TRAVA travel partner"}</Text>
            <View style={styles.ratingLine}><Text style={styles.ratingStar}>★</Text><Text style={styles.ratingValue}>{agency.rating ? agency.rating.toFixed(1) : "New"}</Text><Text style={styles.mutedText}> communication rating</Text></View>
          </View>
        </View>

        {agency.specialties.length ? <View style={styles.tags}>{agency.specialties.slice(0, 5).map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View> : null}
        {agency.description ? <Text style={styles.description}>{agency.description}</Text> : null}

        <LinearGradient colors={["#F3F8FF", "#F7F4FF"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.metricsCard}>
          <View style={styles.metric}><Ionicons name="star-outline" size={20} color="#3978CF" /><Text style={styles.metricValue}>{agency.rating > 0 ? agency.rating.toFixed(1) : "New"}</Text><Text style={styles.metricLabel}>Rating</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Ionicons name="pricetags-outline" size={20} color="#3978CF" /><Text style={styles.metricValue}>{agency.specialties.length}</Text><Text style={styles.metricLabel}>Specialties</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Ionicons name="briefcase-outline" size={20} color="#3978CF" /><Text style={styles.metricValue}>{related.length}</Text><Text style={styles.metricLabel}>Live Packages</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Ionicons name="chatbubble-ellipses-outline" size={20} color="#3978CF" /><Text style={styles.metricValue}>TRAVA</Text><Text style={styles.metricLabel}>Direct Chat</Text></View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Why travel with us?</Text>
        <View style={styles.benefitList}>
          <View style={styles.benefitRow}><View style={[styles.benefitIcon, styles.blueSoft]}><Ionicons name="map-outline" size={18} color="#5A74D9" /></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Handpicked experiences</Text><Text style={styles.benefitText}>Curated trips, local expertise and published agency packages.</Text></View></View>
          <View style={styles.benefitRow}><View style={[styles.benefitIcon, styles.peachSoft]}><Ionicons name="briefcase-outline" size={18} color="#C26D39" /></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Hassle-free planning</Text><Text style={styles.benefitText}>Ask questions, compare dates and clarify inclusions directly in TRAVA chat.</Text></View></View>
          <View style={styles.benefitRow}><View style={[styles.benefitIcon, styles.lavenderSoft]}><Ionicons name="pricetag-outline" size={18} color="#7464DB" /></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Clear package details</Text><Text style={styles.benefitText}>Review the published package details before starting an inquiry.</Text></View></View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Communication rating</Text>
        <Text style={styles.reviewHint}>You can rate communication even before availing a package. Package reviews stay locked until a completed booking is verified.</Text>
        <View style={styles.ratingGrid}>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingCardTitle}>Rate communication</Text>
            <StarPicker value={props.rating} onChange={props.onRatingChange} />
            <TextInput multiline maxLength={500} value={props.comment} onChangeText={props.onCommentChange} placeholder="Optional feedback" placeholderTextColor="#9AA4B7" style={styles.commentInput} />
            {props.feedbackStatus ? <Text style={styles.feedbackStatus}>{props.feedbackStatus}</Text> : null}
            <Pressable accessibilityRole="button" disabled={props.submittingFeedback} onPress={props.onSubmitFeedback} style={({ pressed }) => [styles.submitRatingButton, pressed && styles.pressed, props.submittingFeedback && styles.disabled]}>
              {props.submittingFeedback ? <ActivityIndicator color="#5E63DC" /> : <Text style={styles.submitRatingText}>Submit communication rating</Text>}
            </Pressable>
          </View>
          <View style={styles.lockedReviewCard}>
            <Ionicons name="lock-closed-outline" size={23} color="#A5ADBA" />
            <Text style={styles.lockTitle}>Package review</Text>
            <Text style={styles.lockText}>Available after you have availed and completed a package.</Text>
          </View>
        </View>

        {showPackages ? (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Packages from {agency.name}</Text><Pressable onPress={() => setShowPackages(false)}><Text style={styles.textLink}>Hide</Text></Pressable></View>
            {related.length ? related.map((tour) => (
              <Pressable key={String(tour.id)} accessibilityRole="button" onPress={() => props.onOpenTour?.(tour)} style={({ pressed }) => [styles.relatedTour, pressed && styles.pressed]}>
                {tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={styles.relatedImage} /> : <View style={[styles.relatedImage, styles.relatedImageFallback]} />}
                <View style={styles.relatedTourCopy}><Text numberOfLines={1} style={styles.relatedTourTitle}>{tour.title}</Text><Text style={styles.relatedTourMeta}>{tour.durationDays} days • {formatMoney(tour.price, tour.currencyCode)}</Text></View>
                <Ionicons name="chevron-forward" size={18} color="#7566D9" />
              </Pressable>
            )) : <Text style={styles.emptyPackages}>No packages from this agency are currently in the home feed.</Text>}
          </View>
        ) : null}

        <View style={styles.infoNote}><Ionicons name="information-circle-outline" size={18} color="#5D72E4" /><Text style={styles.infoNoteText}>TRAVA chat never includes send-funds or request-funds actions. Never share OTPs or passwords, and avoid off-platform transfers.</Text></View>

        <Pressable accessibilityRole="button" onPress={props.onContinue} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
          <LinearGradient colors={["#63D8FF", "#50B9FF", "#5D8BF2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" />
            <View><Text style={styles.primaryTitle}>Inquire now</Text><Text style={styles.primarySubtitle}>Message {agency.name}</Text></View>
          </LinearGradient>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => setShowPackages((value) => !value)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
          <Ionicons name="briefcase-outline" size={18} color="#3976C9" />
          <Text style={styles.secondaryActionText}>{showPackages ? "Hide packages" : "View packages"}</Text>
        </Pressable>
      </ScrollView>
    </ModalShell>
  );
}

function TourModal(props: TravelCommerceModalsProps & { listing: Extract<HomeListing, { type: "tour" }> }) {
  const tour = props.listing.item;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [tour.id]);

  const destination = [tour.destination, tour.country].filter(Boolean).join(" • ") || "Destination details from agency";
  const highlights = useMemo(() => {
    const items: string[] = [];
    if (tour.description?.trim()) items.push(tour.description.trim());
    if (tour.destination) items.push(`Explore ${tour.destination} through a curated itinerary.`);
    if (tour.category) items.push(`${tour.category} travel experience.`);
    items.push("Package inclusions and availability are confirmed with the agency in chat.");
    return items.slice(0, 4);
  }, [tour.category, tour.description, tour.destination]);

  return (
    <ModalShell onClose={props.onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.tourHero}>
          {tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <LinearGradient colors={["#DCEBFF", "#FCE6F0"]} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={["rgba(18,28,54,0.02)", "rgba(18,28,54,0.18)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroActions}>
            <CircleButton label="Close package details" onPress={props.onClose}><Ionicons name="close" size={23} color="#17233E" /></CircleButton>
            <CircleButton label={props.favorite ? "Remove saved package" : "Save package"} onPress={props.onToggleFavorite}><Ionicons name={props.favorite ? "heart" : "heart-outline"} size={21} color={props.favorite ? "#F45D91" : "#596882"} /></CircleButton>
          </View>
          {props.favorite ? <View style={styles.savedBadge}><Ionicons name="heart" size={14} color="#F05D8F" /><Text style={styles.savedBadgeText}>Saved Package</Text></View> : null}
        </View>

        <View style={styles.packageHeader}>
          <View style={styles.packageTitleCopy}><Text style={styles.packageTitle}>{tour.title}</Text><View style={styles.metaPills}><View style={styles.metaPill}><Ionicons name="calendar-outline" size={14} color="#695DDE" /><Text style={styles.metaPillText}>{tour.durationDays} Days • {tour.durationNights} Nights</Text></View><View style={styles.metaPill}><Ionicons name="location-outline" size={14} color="#695DDE" /><Text numberOfLines={1} style={styles.metaPillText}>{destination}</Text></View></View></View>
          <View><Text style={styles.packagePrice}>{formatMoney(tour.price, tour.currencyCode)}</Text><Text style={styles.perPerson}>per person</Text></View>
        </View>

        <View style={styles.inclusionGrid}>
          {[{ icon: "business-outline" as const, label: "Hotels", value: "Agency details" }, { icon: "bus-outline" as const, label: "Transport", value: "See inclusions" }, { icon: "restaurant-outline" as const, label: "Meals", value: "See package" }, { icon: "person-outline" as const, label: "Guide", value: "Agency support" }].map((item) => (
            <View key={item.label} style={styles.inclusionCard}><Ionicons name={item.icon} size={18} color="#6B5EE6" /><Text style={styles.inclusionTitle}>{item.label}</Text><Text numberOfLines={1} style={styles.inclusionText}>{item.value}</Text></View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Highlights</Text>
        <View style={styles.highlightList}>{highlights.map((item, index) => <View key={`${index}-${item}`} style={styles.highlightRow}><Ionicons name="checkmark-circle-outline" size={17} color="#665BF0" /><Text style={styles.highlightText}>{item}</Text></View>)}</View>

        <View style={styles.divider} />
        <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Mini Itinerary <Text style={styles.sectionMuted}>(Preview)</Text></Text><Pressable onPress={() => setExpanded((value) => !value)}><Text style={styles.textLink}>{expanded ? "Show less" : "View full itinerary"} ›</Text></Pressable></View>
        <View style={styles.timeline}>
          {["Arrival and welcome", "Destination highlights", "Cultural experiences", "Flexible exploration"].slice(0, expanded ? 4 : 3).map((item, index) => <View key={item} style={styles.timelineRow}><View style={styles.timelineRail}><View style={styles.timelineDot} />{index < (expanded ? 3 : 2) ? <View style={styles.timelineLine} /> : null}</View><Text style={styles.dayLabel}>Day {index + 1}</Text><Text style={styles.timelineText}>{item}</Text></View>)}
        </View>

        <View style={styles.shareHint}><Ionicons name="chatbubbles-outline" size={21} color="#6659E5" /><View style={styles.shareHintCopy}><Text style={styles.shareHintTitle}>Share this package directly into TRAVA chat</Text><Text style={styles.shareHintText}>The package card is attached automatically when you inquire.</Text></View></View>

        <Pressable accessibilityRole="button" onPress={props.onContinue} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
          <LinearGradient colors={["#63D8FF", "#50B9FF", "#5D8BF2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}><View pointerEvents="none" style={styles.blueButtonHighlight}/><Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFFFFF" /><View><Text style={styles.primaryTitle}>Inquire via chat</Text><Text style={styles.primarySubtitle}>Chat with the travel agency</Text></View></LinearGradient>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Ionicons name={expanded ? "chevron-up" : "document-text-outline"} size={18} color="#3976C9" /><Text style={styles.secondaryActionText}>{expanded ? "Collapse full package" : "View full package"}</Text><Ionicons name={expanded ? "chevron-up" : "chevron-forward"} size={16} color="#3976C9" /></Pressable>
      </ScrollView>
    </ModalShell>
  );
}

export function TravelCommerceModals(props: TravelCommerceModalsProps) {
  if (!props.listing) return null;
  if (props.listing.type === "agency") return <AgencyModal {...props} listing={props.listing} />;
  return <TourModal {...props} listing={props.listing} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 22, backgroundColor: "rgba(18,26,45,0.55)" },
  modalCard: { width: "100%", maxWidth: 590, maxHeight: "94%", overflow: "hidden", borderRadius: 31, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", boxShadow: "0 26px 70px rgba(22,32,58,0.24)" },
  content: { paddingBottom: 18 },
  circleButton: { width: 45, height: 45, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "rgba(235,237,244,0.94)", boxShadow: "0 8px 20px rgba(35,45,70,0.10)" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  heroActions: { position: "absolute", left: 14, right: 14, top: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 4 },
  agencyHero: { height: 190, overflow: "hidden", backgroundColor: "#EEF3FF" },
  agencyIdentity: { position: "absolute", left: 22, bottom: 16 },
  largeLogo: { width: 100, height: 100, borderRadius: 50, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 5, borderColor: "rgba(255,255,255,0.96)", boxShadow: "0 12px 28px rgba(43,55,84,0.16)" },
  largeLogoText: { color: "#6758DB", fontSize: 38, fontWeight: "900" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 22, paddingTop: 18 },
  titleCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  agencyName: { flexShrink: 1, color: "#12203D", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.7 },
  verified: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#4B8BFF" },
  agencySubtitle: { marginTop: 4, color: "#6E7B92", fontSize: 11, lineHeight: 15, fontWeight: "600" },
  ratingLine: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  ratingStar: { color: "#F2A216", fontSize: 15 },
  ratingValue: { color: "#17233D", fontSize: 12, fontWeight: "900" },
  mutedText: { color: "#8290A5", fontSize: 10, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 22, paddingTop: 12 },
  tag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F1EDFF" },
  tagText: { color: "#684FDD", fontSize: 10, fontWeight: "800" },
  description: { paddingHorizontal: 22, paddingTop: 16, color: "#53627C", fontSize: 11.5, lineHeight: 17, fontWeight: "600" },
  metricsCard: { marginHorizontal: 22, marginTop: 18, minHeight: 100, flexDirection: "row", alignItems: "center", borderRadius: 20, borderWidth: 1, borderColor: "#E7EAF5", overflow: "hidden" },
  metric: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  metricValue: { marginTop: 5, color: "#17233D", fontSize: 16, fontWeight: "900" },
  metricLabel: { marginTop: 2, color: "#718099", fontSize: 8.5, fontWeight: "700", textAlign: "center" },
  metricDivider: { width: 1, height: 58, backgroundColor: "rgba(217,222,235,0.72)" },
  sectionTitle: { marginHorizontal: 22, color: "#14213C", fontSize: 14, lineHeight: 19, fontWeight: "900" },
  benefitList: { marginHorizontal: 22, marginTop: 11, gap: 11 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  blueSoft: { backgroundColor: "#EAF2FF" },
  peachSoft: { backgroundColor: "#FFF0E7" },
  lavenderSoft: { backgroundColor: "#F0ECFF" },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: "#22304B", fontSize: 11, fontWeight: "900" },
  benefitText: { marginTop: 2, color: "#76839A", fontSize: 9.5, lineHeight: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#ECEEF4", marginHorizontal: 22, marginVertical: 18 },
  reviewHint: { marginHorizontal: 22, marginTop: 4, color: "#7A879B", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  ratingGrid: { marginHorizontal: 22, marginTop: 10, flexDirection: "row", gap: 10 },
  ratingCard: { flex: 1, minWidth: 0, padding: 14, borderRadius: 19, borderWidth: 1, borderColor: "#E5E8F2", backgroundColor: "#FCFCFF" },
  ratingCardTitle: { color: "#21304A", fontSize: 10.5, fontWeight: "900" },
  starRow: { flexDirection: "row", marginTop: 8 },
  starButton: { paddingRight: 4, paddingVertical: 2 },
  star: { color: "#D7DCE8", fontSize: 24, lineHeight: 27 },
  starActive: { color: "#665AF0" },
  commentInput: { minHeight: 56, marginTop: 9, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: "#E6E8EF", color: "#26334F", backgroundColor: "#FFFFFF", fontSize: 10, textAlignVertical: "top" },
  feedbackStatus: { marginTop: 7, color: "#51745F", fontSize: 9, lineHeight: 12, fontWeight: "700" },
  submitRatingButton: { minHeight: 38, marginTop: 9, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EEF0FF" },
  submitRatingText: { color: "#5C61DB", fontSize: 9.5, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  lockedReviewCard: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 19, borderWidth: 1, borderColor: "#E8EAF0", backgroundColor: "#FAFAFC" },
  lockTitle: { marginTop: 8, color: "#657187", fontSize: 10.5, fontWeight: "900" },
  lockText: { marginTop: 5, color: "#8C96A8", fontSize: 9, lineHeight: 13, textAlign: "center", fontWeight: "600" },
  relatedSection: { marginHorizontal: 22, marginTop: 18 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  textLink: { color: "#6656DE", fontSize: 9.5, fontWeight: "900" },
  relatedTour: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: "#E8EAF1", backgroundColor: "#FFFFFF" },
  relatedImage: { width: 58, height: 54, borderRadius: 12, backgroundColor: "#EAEFF7" },
  relatedImageFallback: { backgroundColor: "#EDF1FA" },
  relatedTourCopy: { flex: 1, minWidth: 0 },
  relatedTourTitle: { color: "#1D2B47", fontSize: 10.5, fontWeight: "900" },
  relatedTourMeta: { marginTop: 3, color: "#7A879B", fontSize: 9, fontWeight: "600" },
  emptyPackages: { marginTop: 9, color: "#7E899A", fontSize: 9.5, lineHeight: 14 },
  infoNote: { marginHorizontal: 22, marginTop: 18, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, borderRadius: 14, backgroundColor: "#F0F5FF" },
  infoNoteText: { flex: 1, color: "#5E6E8E", fontSize: 9.5, lineHeight: 13.5, fontWeight: "600" },
  primaryAction: { marginHorizontal: 22, marginTop: 18, borderRadius: 31, overflow: "visible" },
  primaryGradient: { minHeight: 62, overflow:"hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 31, borderWidth:1.5, borderColor:"rgba(255,255,255,.90)", boxShadow:"0 12px 28px rgba(70,153,245,.24)" }, blueButtonHighlight:{position:"absolute",left:12,right:12,top:5,height:18,borderRadius:14,backgroundColor:"rgba(255,255,255,.26)"},
  primaryTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  primarySubtitle: { marginTop: 1, color: "rgba(255,255,255,0.88)", fontSize: 9.5, fontWeight: "600" },
  secondaryAction: { marginHorizontal: 22, minHeight: 52, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, borderWidth: 1.2, borderColor: "#74BDF3", backgroundColor: "#FFFFFF" },
  secondaryActionText: { color: "#3976C9", fontSize: 11, fontWeight: "900" },
  tourHero: { height: 230, overflow: "hidden", backgroundColor: "#E9EEF8" },
  savedBadge: { position: "absolute", left: 16, bottom: 14, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.94)" },
  savedBadgeText: { color: "#E95289", fontSize: 9.5, fontWeight: "900" },
  packageHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 22, paddingTop: 18 },
  packageTitleCopy: { flex: 1, minWidth: 0 },
  packageTitle: { color: "#11203E", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.7 },
  metaPills: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  metaPill: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#FAFAFF", borderWidth: 1, borderColor: "#ECEBF6" },
  metaPillText: { color: "#5F6D86", fontSize: 9.5, fontWeight: "700" },
  packagePrice: { color: "#6A50E2", fontSize: 20, lineHeight: 24, fontWeight: "900", textAlign: "right" },
  perPerson: { marginTop: 2, color: "#7C879A", fontSize: 9, textAlign: "right", fontWeight: "600" },
  inclusionGrid: { flexDirection: "row", gap: 8, marginTop: 15, paddingHorizontal: 22 },
  inclusionCard: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 10, paddingHorizontal: 5, borderRadius: 13, backgroundColor: "#FAFAFF", borderWidth: 1, borderColor: "#EDEDF5" },
  inclusionTitle: { marginTop: 5, color: "#1F2C48", fontSize: 9, fontWeight: "900" },
  inclusionText: { marginTop: 1, color: "#7A8699", fontSize: 7.5, fontWeight: "600" },
  highlightList: { marginHorizontal: 22, marginTop: 10, gap: 9 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  highlightText: { flex: 1, color: "#52617B", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  sectionMuted: { color: "#7D8799", fontWeight: "600" },
  timeline: { marginHorizontal: 22, marginTop: 10 },
  timelineRow: { minHeight: 36, flexDirection: "row", alignItems: "flex-start" },
  timelineRail: { width: 22, alignItems: "center" },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#665BF0", marginTop: 4 },
  timelineLine: { width: 2, flex: 1, minHeight: 26, backgroundColor: "#D9D4FF", marginTop: 2 },
  dayLabel: { width: 52, color: "#52617B", fontSize: 9.5, fontWeight: "800" },
  timelineText: { flex: 1, color: "#52617B", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  shareHint: { marginHorizontal: 22, marginTop: 17, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 15, backgroundColor: "#FFF5F8" },
  shareHintCopy: { flex: 1 },
  shareHintTitle: { color: "#485873", fontSize: 9.5, fontWeight: "800" },
  shareHintText: { marginTop: 2, color: "#8791A3", fontSize: 8.5, lineHeight: 12, fontWeight: "600" },
});
