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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.modalCard}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CircleButton({ label, onPress, children }: { label: string; onPress(): void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.circleButton}>
      {children}
    </Pressable>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange(value: number): void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${star} star communication rating`}
          key={star}
          onPress={() => onChange(star)}
          style={styles.starButton}
        >
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.agencyContent}>
        <View style={styles.agencyHeader}>
          <View style={styles.logoShell}>
            {agency.logoUrl ? (
              <Image source={{ uri: agency.logoUrl }} contentFit="cover" style={styles.logoImage} />
            ) : (
              <LinearGradient colors={["#DFF4FF", "#FDEAF4"]} style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>{agency.name.slice(0, 1).toUpperCase()}</Text>
              </LinearGradient>
            )}
          </View>

          <View style={styles.agencyHeaderCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.agencyName}>{agency.name}</Text>
              <View style={styles.verified}><Text style={styles.verifiedText}>✓</Text></View>
            </View>
            {agency.subtitle ? <Text style={styles.agencySubtitle}>{agency.subtitle}</Text> : null}
            <View style={styles.ratingInline}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>{agency.rating ? agency.rating.toFixed(1) : "New"}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <CircleButton label="Close agency details" onPress={props.onClose}><Text style={styles.closeGlyph}>×</Text></CircleButton>
            <CircleButton label={props.favorite ? "Remove agency from favorites" : "Save agency"} onPress={props.onToggleFavorite}>
              <Text style={[styles.heartGlyph, props.favorite && styles.heartActive]}>{props.favorite ? "♥" : "♡"}</Text>
            </CircleButton>
          </View>
        </View>

        {agency.specialties.length ? (
          <View style={styles.tags}>
            {agency.specialties.slice(0, 5).map((tag) => (
              <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
          </View>
        ) : null}

        {agency.description ? <Text style={styles.description}>{agency.description}</Text> : null}

        <LinearGradient
          colors={["rgba(240,247,255,0.96)", "rgba(255,245,250,0.96)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.metricsCard}
        >
          <View style={styles.metric}><Text style={styles.metricValue}>{agency.rating ? agency.rating.toFixed(1) : "—"}</Text><Text style={styles.metricLabel}>Rating</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricValue}>{agency.specialties.length || "—"}</Text><Text style={styles.metricLabel}>Specialties</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricValue}>{related.length || "—"}</Text><Text style={styles.metricLabel}>Packages</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricValue}>Chat</Text><Text style={styles.metricLabel}>Support</Text></View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Why travel with us?</Text>
        <View style={styles.benefitList}>
          <View style={styles.benefitRow}><View style={[styles.benefitIcon, styles.blueSoft]}><Text style={styles.benefitGlyph}>⌖</Text></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Curated travel expertise</Text><Text style={styles.benefitText}>Explore the agency's published specialties and packages.</Text></View></View>
          <View style={styles.benefitRow}><View style={[styles.benefitIcon, styles.peachSoft]}><Text style={styles.benefitGlyph}>▣</Text></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Direct planning support</Text><Text style={styles.benefitText}>Ask questions directly through TRAVA messaging.</Text></View></View>
          <View style={styles.benefitRow}><View style={[styles.benefitIcon, styles.lavenderSoft]}><Text style={styles.benefitGlyph}>◇</Text></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>Package details in one place</Text><Text style={styles.benefitText}>Compare published trip information before you inquire.</Text></View></View>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.sectionTitle}>Communication rating</Text>
          <Text style={styles.reviewHint}>You can rate how well this agency communicates even before availing a package.</Text>
          <StarPicker value={props.rating} onChange={props.onRatingChange} />
          <TextInput
            multiline
            maxLength={500}
            value={props.comment}
            onChangeText={props.onCommentChange}
            placeholder="Optional communication feedback"
            placeholderTextColor="#98A3B7"
            style={styles.commentInput}
          />
          {props.feedbackStatus ? <Text style={styles.feedbackStatus}>{props.feedbackStatus}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={props.submittingFeedback}
            onPress={props.onSubmitFeedback}
            style={[styles.submitRatingButton, props.submittingFeedback && styles.disabled]}
          >
            {props.submittingFeedback ? <ActivityIndicator color="#5E63DC" /> : <Text style={styles.submitRatingText}>Submit communication rating</Text>}
          </Pressable>
        </View>

        <View style={styles.lockedReviewCard}>
          <View style={styles.lockCircle}><Text style={styles.lockGlyph}>▣</Text></View>
          <View style={styles.lockCopy}>
            <Text style={styles.lockTitle}>Package review</Text>
            <Text style={styles.lockText}>Available after you have availed and completed a package.</Text>
          </View>
        </View>

        {showPackages ? (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Packages from {agency.name}</Text>
              <Pressable accessibilityRole="button" onPress={() => setShowPackages(false)}><Text style={styles.textLink}>Hide</Text></Pressable>
            </View>
            {related.length ? related.map((tour) => (
              <Pressable
                accessibilityRole="button"
                key={String(tour.id)}
                onPress={() => props.onOpenTour?.(tour)}
                style={({ pressed }) => [styles.relatedTour, pressed && styles.pressedRow]}
              >
                {tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={styles.relatedImage} /> : <View style={[styles.relatedImage, styles.relatedImageFallback]} />}
                <View style={styles.relatedTourCopy}>
                  <Text numberOfLines={1} style={styles.relatedTourTitle}>{tour.title}</Text>
                  <Text style={styles.relatedTourMeta}>{tour.durationDays} days · {formatMoney(tour.price, tour.currencyCode)}</Text>
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            )) : (
              <Text style={styles.emptyPackages}>No published packages from this agency are in the current home feed.</Text>
            )}
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={props.onContinue} style={styles.primaryAction}>
          <LinearGradient colors={["#6A7FF1", "#9C83EE", "#F09BC2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
            <View style={styles.chatIcon}><Text style={styles.chatDots}>•••</Text></View>
            <View><Text style={styles.primaryTitle}>Inquire now</Text><Text style={styles.primarySubtitle}>Message {agency.name}</Text></View>
          </LinearGradient>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => setShowPackages((value) => !value)} style={styles.secondaryAction}>
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

  const destination = [tour.destination, tour.country].filter(Boolean).join(" · ") || "Destination details from agency";
  const highlights = useMemo(() => {
    const items: string[] = [];
    if (tour.description?.trim()) items.push(tour.description.trim());
    if (tour.destination) items.push(`Explore ${tour.destination} through this curated package.`);
    if (tour.category) items.push(`${tour.category} travel experience.`);
    return items.slice(0, 4);
  }, [tour.category, tour.description, tour.destination]);

  return (
    <ModalShell onClose={props.onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tourContent}>
        <View style={styles.tourHero}>
          {tour.imageUrl ? (
            <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <LinearGradient colors={["#DCEBFF", "#FCE6F0"]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={["rgba(18,28,54,0.02)", "rgba(18,28,54,0.40)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.tourHeroActions}>
            <CircleButton label="Close package details" onPress={props.onClose}><Text style={styles.closeGlyph}>×</Text></CircleButton>
            <CircleButton label={props.favorite ? "Remove saved package" : "Save package"} onPress={props.onToggleFavorite}>
              <Text style={[styles.heartGlyph, props.favorite && styles.heartActive]}>{props.favorite ? "♥" : "♡"}</Text>
            </CircleButton>
          </View>
          {props.favorite ? <View style={styles.savedBadge}><Text style={styles.savedBadgeText}>♥ Saved Package</Text></View> : null}
        </View>

        <View style={styles.tourBody}>
          <View style={styles.tourTitleRow}>
            <View style={styles.tourTitleCopy}>
              <Text style={styles.tourTitle}>{tour.title}</Text>
              <Text style={styles.tourDestination}>{destination}</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>{formatMoney(tour.price, tour.currencyCode)}</Text>
              <Text style={styles.priceCaption}>package price</Text>
            </View>
          </View>

          <View style={styles.factPills}>
            <View style={styles.factPill}><Text style={styles.factLabel}>Duration</Text><Text style={styles.factValue}>{tour.durationDays} days · {tour.durationNights} nights</Text></View>
            <View style={styles.factPill}><Text style={styles.factLabel}>Destination</Text><Text numberOfLines={1} style={styles.factValue}>{tour.destination || tour.country || "See agency"}</Text></View>
            <View style={styles.factPill}><Text style={styles.factLabel}>Category</Text><Text numberOfLines={1} style={styles.factValue}>{tour.category || "Travel package"}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Highlights</Text>
          <View style={styles.highlightList}>
            {highlights.length ? highlights.map((highlight, index) => (
              <View key={`${String(tour.id)}-highlight-${index}`} style={styles.highlightRow}>
                <View style={styles.checkCircle}><Text style={styles.checkGlyph}>✓</Text></View>
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            )) : (
              <Text style={styles.fallbackDetails}>Detailed highlights are provided by the agency when you inquire.</Text>
            )}
          </View>

          <View style={styles.availabilityCard}>
            <View style={styles.availabilityIcon}><Text style={styles.availabilityGlyph}>▦</Text></View>
            <View style={styles.availabilityCopy}>
              <Text style={styles.availabilityTitle}>Available dates</Text>
              <Text style={styles.availabilityText}>Departure dates and live seat availability are confirmed directly by the agency.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={props.onContinue} style={styles.askButton}><Text style={styles.askButtonText}>Ask</Text></Pressable>
          </View>

          <View style={styles.itineraryPreview}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Mini itinerary preview</Text>
              <Text style={styles.previewMeta}>{tour.durationDays} days</Text>
            </View>
            <Text style={styles.itineraryText}>The complete day-by-day itinerary can be shared by the agency in your TRAVA conversation.</Text>
          </View>

          {expanded ? (
            <View style={styles.fullDetailsCard}>
              <Text style={styles.fullDetailsTitle}>Full package details</Text>
              {tour.description ? <Text style={styles.fullDetailsText}>{tour.description}</Text> : null}
              <View style={styles.fullDetailsLine}><Text style={styles.fullDetailsLabel}>Destination</Text><Text style={styles.fullDetailsValue}>{destination}</Text></View>
              <View style={styles.fullDetailsLine}><Text style={styles.fullDetailsLabel}>Duration</Text><Text style={styles.fullDetailsValue}>{tour.durationDays} days / {tour.durationNights} nights</Text></View>
              <View style={styles.fullDetailsLine}><Text style={styles.fullDetailsLabel}>Category</Text><Text style={styles.fullDetailsValue}>{tour.category || "Travel package"}</Text></View>
              <Text style={styles.fullDetailsNote}>Exact inclusions, cancellation terms, room rules, and departure availability should be confirmed with the agency.</Text>
            </View>
          ) : null}

          <Pressable accessibilityRole="button" onPress={props.onContinue} style={styles.primaryAction}>
            <LinearGradient colors={["#6A7FF1", "#9C83EE", "#F09BC2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGradient}>
              <View style={styles.chatIcon}><Text style={styles.chatDots}>•••</Text></View>
              <View><Text style={styles.primaryTitle}>Inquire via chat</Text><Text style={styles.primarySubtitle}>Share this package with the travel agency</Text></View>
            </LinearGradient>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>{expanded ? "Hide full details" : "View full package"}</Text>
          </Pressable>
        </View>
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
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 20,
    backgroundColor: "rgba(20,28,48,0.56)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 610,
    maxHeight: "94%",
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 24px 60px rgba(21, 34, 66, 0.24)",
  },
  agencyContent: { padding: 22, paddingBottom: 24 },
  agencyHeader: { flexDirection: "row", alignItems: "center", gap: 13 },
  logoShell: { width: 84, height: 84, borderRadius: 42, padding: 5, backgroundColor: "#FFFFFF", boxShadow: "0 10px 28px rgba(71,91,132,0.13)" },
  logoImage: { width: "100%", height: "100%", borderRadius: 37 },
  logoFallback: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 37 },
  logoFallbackText: { color: "#4456C5", fontSize: 27, fontWeight: "900" },
  agencyHeaderCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  agencyName: { flexShrink: 1, color: "#15213C", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.5 },
  verified: { width: 17, height: 17, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#4F8FFF" },
  verifiedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  agencySubtitle: { marginTop: 3, color: "#62718D", fontSize: 12, lineHeight: 16, fontWeight: "600" },
  ratingInline: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  ratingStar: { color: "#F5A623", fontSize: 15 },
  ratingValue: { color: "#5D6A84", fontSize: 11, fontWeight: "800" },
  headerActions: { gap: 8 },
  circleButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "#EBEEF5", boxShadow: "0 6px 18px rgba(66,82,115,0.09)" },
  closeGlyph: { color: "#26344F", fontSize: 24, lineHeight: 25, fontWeight: "500" },
  heartGlyph: { color: "#66738C", fontSize: 23, lineHeight: 24 },
  heartActive: { color: "#F45B8C" },
  tags: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F1EEFF" },
  tagText: { color: "#6352D7", fontSize: 9, fontWeight: "800" },
  description: { marginTop: 16, color: "#53627E", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  metricsCard: { marginTop: 18, flexDirection: "row", alignItems: "stretch", paddingVertical: 15, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(216,226,244,0.85)" },
  metric: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  metricValue: { color: "#18233F", fontSize: 15, fontWeight: "900" },
  metricLabel: { marginTop: 3, color: "#78849B", fontSize: 8, fontWeight: "700", textAlign: "center" },
  metricDivider: { width: 1, backgroundColor: "rgba(213,221,236,0.85)" },
  sectionTitle: { color: "#18233F", fontSize: 15, lineHeight: 20, fontWeight: "900" },
  benefitList: { marginTop: 10, gap: 11 },
  benefitRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  benefitIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  blueSoft: { backgroundColor: "#E7F2FF" },
  peachSoft: { backgroundColor: "#FFF0E7" },
  lavenderSoft: { backgroundColor: "#F0EBFF" },
  benefitGlyph: { color: "#5968DD", fontSize: 17, fontWeight: "900" },
  benefitCopy: { flex: 1, minWidth: 0 },
  benefitTitle: { color: "#273550", fontSize: 11, fontWeight: "900" },
  benefitText: { marginTop: 2, color: "#748198", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  reviewSection: { marginTop: 19, paddingTop: 17, borderTopWidth: 1, borderTopColor: "#ECF0F5" },
  reviewHint: { marginTop: 4, color: "#7A879B", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  starRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 3 },
  starButton: { padding: 2 },
  star: { color: "#CBD1DC", fontSize: 28 },
  starActive: { color: "#6555E8" },
  commentInput: { marginTop: 10, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#E4E9F1", borderRadius: 14, color: "#24314C", backgroundColor: "#FAFBFD", fontSize: 11, textAlignVertical: "top" },
  feedbackStatus: { marginTop: 8, color: "#5D63CF", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  submitRatingButton: { marginTop: 9, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EEF1FF" },
  submitRatingText: { color: "#5864D8", fontSize: 10, fontWeight: "900" },
  disabled: { opacity: 0.52 },
  lockedReviewCard: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: "#ECEFF4", backgroundColor: "#FAFBFC" },
  lockCircle: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#F2F4F8" },
  lockGlyph: { color: "#A4ADBD", fontSize: 16 },
  lockCopy: { flex: 1 },
  lockTitle: { color: "#647087", fontSize: 11, fontWeight: "900" },
  lockText: { marginTop: 2, color: "#9099A8", fontSize: 9, lineHeight: 13, fontWeight: "600" },
  relatedSection: { marginTop: 16, gap: 8 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  textLink: { color: "#6570E5", fontSize: 10, fontWeight: "900" },
  relatedTour: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderWidth: 1, borderColor: "#E8ECF3", borderRadius: 16, backgroundColor: "#FFFFFF" },
  pressedRow: { opacity: 0.92 },
  relatedImage: { width: 62, height: 54, borderRadius: 12 },
  relatedImageFallback: { backgroundColor: "#E8F1FC" },
  relatedTourCopy: { flex: 1, minWidth: 0 },
  relatedTourTitle: { color: "#21304B", fontSize: 11, fontWeight: "900" },
  relatedTourMeta: { marginTop: 3, color: "#7B8799", fontSize: 9, fontWeight: "600" },
  rowChevron: { color: "#6875D8", fontSize: 24 },
  emptyPackages: { color: "#8A94A6", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  primaryAction: { marginTop: 18, borderRadius: 17, overflow: "hidden" },
  primaryGradient: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 14, borderRadius: 17 },
  chatIcon: { width: 30, height: 26, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)", borderRadius: 10 },
  chatDots: { marginTop: -5, color: "#FFFFFF", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  primaryTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  primarySubtitle: { marginTop: 1, color: "rgba(255,255,255,0.88)", fontSize: 9, fontWeight: "600" },
  secondaryAction: { marginTop: 10, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1.2, borderColor: "#C9C4FF", backgroundColor: "#FFFFFF" },
  secondaryActionText: { color: "#635BDB", fontSize: 12, fontWeight: "900" },

  tourContent: { paddingBottom: 0 },
  tourHero: { height: 220, overflow: "hidden", backgroundColor: "#DCEBFF" },
  tourHeroActions: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  savedBadge: { position: "absolute", left: 16, bottom: 14, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.92)" },
  savedBadgeText: { color: "#F05D89", fontSize: 9, fontWeight: "900" },
  tourBody: { padding: 20, paddingBottom: 22 },
  tourTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tourTitleCopy: { flex: 1, minWidth: 0 },
  tourTitle: { color: "#15213D", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.5 },
  tourDestination: { marginTop: 5, color: "#6E7A91", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  priceBlock: { alignItems: "flex-end" },
  price: { color: "#6555E8", fontSize: 20, fontWeight: "900" },
  priceCaption: { marginTop: 2, color: "#8290A5", fontSize: 8, fontWeight: "600" },
  factPills: { marginTop: 15, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  factPill: { minWidth: 120, flexGrow: 1, padding: 10, borderRadius: 14, backgroundColor: "#F7F9FD", borderWidth: 1, borderColor: "#EDF0F5" },
  factLabel: { color: "#8A95A6", fontSize: 8, fontWeight: "700" },
  factValue: { marginTop: 3, color: "#33415C", fontSize: 10, fontWeight: "900" },
  highlightList: { marginTop: 8, gap: 8 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  checkCircle: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#EEF1FF" },
  checkGlyph: { color: "#6268E2", fontSize: 10, fontWeight: "900" },
  highlightText: { flex: 1, color: "#59667F", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  fallbackDetails: { color: "#8290A3", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  availabilityCard: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 17, backgroundColor: "#F8F9FF", borderWidth: 1, borderColor: "#ECEFFA" },
  availabilityIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EEF1FF" },
  availabilityGlyph: { color: "#6268E2", fontSize: 17, fontWeight: "900" },
  availabilityCopy: { flex: 1 },
  availabilityTitle: { color: "#273550", fontSize: 11, fontWeight: "900" },
  availabilityText: { marginTop: 2, color: "#7B879B", fontSize: 9, lineHeight: 13, fontWeight: "600" },
  askButton: { minWidth: 52, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#EEEAFE" },
  askButtonText: { color: "#6454DA", fontSize: 9, fontWeight: "900" },
  itineraryPreview: { marginTop: 16, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: "#EDF0F5", backgroundColor: "#FFFFFF" },
  previewMeta: { color: "#777FDE", fontSize: 9, fontWeight: "900" },
  itineraryText: { marginTop: 6, color: "#758198", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  fullDetailsCard: { marginTop: 15, padding: 14, borderRadius: 18, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#E9EDF3" },
  fullDetailsTitle: { color: "#26344F", fontSize: 13, fontWeight: "900" },
  fullDetailsText: { marginTop: 6, color: "#68758A", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  fullDetailsLine: { marginTop: 9, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  fullDetailsLabel: { color: "#8B95A5", fontSize: 9, fontWeight: "700" },
  fullDetailsValue: { flex: 1, textAlign: "right", color: "#3B4963", fontSize: 9, fontWeight: "800" },
  fullDetailsNote: { marginTop: 12, color: "#939CAC", fontSize: 9, lineHeight: 14, fontWeight: "600" },
});
