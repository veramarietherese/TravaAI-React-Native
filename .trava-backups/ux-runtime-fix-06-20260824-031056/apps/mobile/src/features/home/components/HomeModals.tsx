import { Image } from "expo-image";
import type { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
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

import type {
  HomeListing,
  HomeNotification,
  HomeTripSummary,
} from "../types/home.types";
import { formatMoney } from "../utils/home-normalizers";

interface ModalShellProps {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
}

function ModalShell({ visible, onClose, children }: ModalShellProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.modalCard}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface NotificationsModalProps {
  visible: boolean;
  notifications: HomeNotification[];
  onClose(): void;
  onOpenTrip(tripId: string | number): void;
}

export function NotificationsModal({
  visible,
  notifications,
  onClose,
  onOpenTrip,
}: NotificationsModalProps) {
  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.eyebrow}>UPDATES</Text>
          <Text style={styles.modalTitle}>Notifications</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.notificationList} contentContainerStyle={styles.notificationContent}>
        {notifications.length ? (
          notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View style={styles.notificationIcon}><Text style={styles.notificationIconText}>✦</Text></View>
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
              </View>
              {notification.tripId !== null ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenTrip(notification.tripId as string | number)}
                  style={styles.inlineAction}
                >
                  <Text style={styles.inlineActionText}>Open</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <View style={styles.emptyModalState}>
            <Text style={styles.emptyModalIcon}>✓</Text>
            <Text style={styles.emptyModalTitle}>You’re all caught up</Text>
            <Text style={styles.emptyModalCopy}>New trip updates will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </ModalShell>
  );
}

interface InviteFriendModalProps {
  visible: boolean;
  trip: HomeTripSummary | null;
  email: string;
  status: string | null;
  submitting: boolean;
  onEmailChange(value: string): void;
  onSubmit(): void;
  onClose(): void;
}

export function InviteFriendModal({
  visible,
  trip,
  email,
  status,
  submitting,
  onEmailChange,
  onSubmit,
  onClose,
}: InviteFriendModalProps) {
  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>TRIP INVITATION</Text>
          <Text style={styles.modalTitle}>Invite a friend</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close invitation" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <Text style={styles.bodyCopy}>
        {trip
          ? `Add a traveler to ${trip.name}. They must already have a TRAVA AI account.`
          : "Create an upcoming trip before inviting another traveler."}
      </Text>

      <Text style={styles.inputLabel}>Friend’s TRAVA AI email</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={Boolean(trip) && !submitting}
        keyboardType="email-address"
        onChangeText={onEmailChange}
        placeholder="friend@example.com"
        placeholderTextColor="#9AA4B7"
        style={styles.input}
        value={email}
      />

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.modalFooter}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!trip || !email.trim() || submitting}
          onPress={onSubmit}
          style={[styles.primaryButton, (!trip || !email.trim() || submitting) && styles.disabledButton]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send invite</Text>}
        </Pressable>
      </View>
    </ModalShell>
  );
}

interface ListingDetailsModalProps {
  listing: HomeListing | null;
  favorite: boolean;
  rating: number;
  comment: string;
  feedbackStatus: string | null;
  submittingFeedback: boolean;
  onClose(): void;
  onToggleFavorite(): void;
  onRatingChange(value: number): void;
  onCommentChange(value: string): void;
  onSubmitFeedback(): void;
  onContinue(): void;
}

export function ListingDetailsModal({
  listing,
  favorite,
  rating,
  comment,
  feedbackStatus,
  submittingFeedback,
  onClose,
  onToggleFavorite,
  onRatingChange,
  onCommentChange,
  onSubmitFeedback,
  onContinue,
}: ListingDetailsModalProps) {
  if (!listing) return null;

  const isTour = listing.type === "tour";
  const title = isTour ? listing.item.title : listing.item.name;
  const heroImage = isTour ? listing.item.imageUrl : listing.item.coverImageUrl ?? listing.item.logoUrl;
  const subtitle = isTour
    ? [listing.item.destination, listing.item.country].filter(Boolean).join(", ")
    : listing.item.subtitle;

  return (
    <ModalShell visible onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsContent}>
        <View style={styles.detailsHero}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} contentFit="cover" style={StyleSheet.absoluteFill} transition={180} />
          ) : (
            <LinearGradient
              colors={["#17264A", "#6559CA", "#DD7CA7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient colors={["rgba(6,11,25,0.1)", "rgba(6,11,25,0.78)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.detailsHeroActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={onClose} style={styles.heroButton}>
              <Text style={styles.heroButtonText}>×</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Toggle favorite" onPress={onToggleFavorite} style={styles.heroButton}>
              <Text style={[styles.heroHeart, favorite && styles.heroHeartActive]}>{favorite ? "♥" : "♡"}</Text>
            </Pressable>
          </View>
          <View style={styles.detailsHeroCopy}>
            <Text style={styles.detailsEyebrow}>{isTour ? "TOUR PACKAGE" : "TRAVEL AGENCY"}</Text>
            <Text style={styles.detailsTitle}>{title}</Text>
            {subtitle ? <Text style={styles.detailsSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        {isTour ? (
          <View style={styles.factGrid}>
            <View style={styles.fact}><Text style={styles.factValue}>{listing.item.durationDays} days</Text><Text style={styles.factLabel}>{listing.item.durationNights} nights</Text></View>
            <View style={styles.fact}><Text style={styles.factValue}>{listing.item.country || "Destination"}</Text><Text style={styles.factLabel}>{listing.item.category || "Tour"}</Text></View>
            <View style={styles.fact}><Text style={styles.factValue}>{formatMoney(listing.item.price, listing.item.currencyCode)}</Text><Text style={styles.factLabel}>Package price</Text></View>
          </View>
        ) : (
          <View style={styles.factGrid}>
            <View style={styles.fact}><Text style={styles.factValue}>{listing.item.rating ? listing.item.rating.toFixed(1) : "New"}</Text><Text style={styles.factLabel}>Agency rating</Text></View>
            <View style={styles.fact}><Text style={styles.factValue}>{listing.item.specialties.length}</Text><Text style={styles.factLabel}>Specialties</Text></View>
          </View>
        )}

        {listing.item.description ? <Text style={styles.description}>{listing.item.description}</Text> : null}

        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackTitle}>Rate this listing</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable accessibilityRole="button" accessibilityLabel={`${value} stars`} key={value} onPress={() => onRatingChange(value)} style={styles.starButton}>
                <Text style={[styles.star, value <= rating && styles.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            maxLength={500}
            multiline
            onChangeText={onCommentChange}
            placeholder="Share an optional comment"
            placeholderTextColor="#98A2B5"
            style={styles.commentInput}
            textAlignVertical="top"
            value={comment}
          />
          {feedbackStatus ? <Text style={styles.status}>{feedbackStatus}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={submittingFeedback}
            onPress={onSubmitFeedback}
            style={[styles.feedbackButton, submittingFeedback && styles.disabledButton]}
          >
            {submittingFeedback ? <ActivityIndicator color="#6A51DD" /> : <Text style={styles.feedbackButtonText}>Submit feedback</Text>}
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={onContinue} style={styles.primaryWideButton}>
          <Text style={styles.primaryWideButtonText}>{isTour ? "Explore related trips" : "Explore this agency"}</Text>
        </Pressable>
      </ScrollView>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 28,
    backgroundColor: "rgba(18,27,49,0.52)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "92%",
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#11182C",
    shadowOpacity: 0.26,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, padding: 20, paddingBottom: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#7558F0", fontSize: 10, lineHeight: 13, letterSpacing: 1.3, fontWeight: "900" },
  modalTitle: { marginTop: 3, color: "#17233E", fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5 },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#F3F4FA" },
  closeGlyph: { color: "#4A5872", fontSize: 25, lineHeight: 27, fontWeight: "600" },
  notificationList: { maxHeight: 430 },
  notificationContent: { paddingHorizontal: 18, paddingBottom: 20, gap: 10 },
  notificationItem: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 16, backgroundColor: "#F7F6FF" },
  notificationIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EAE6FF" },
  notificationIconText: { color: "#7558F0", fontSize: 19, fontWeight: "900" },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTitle: { color: "#25324E", fontSize: 13, fontWeight: "900" },
  notificationMessage: { marginTop: 3, color: "#758198", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  inlineAction: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#FFFFFF" },
  inlineActionText: { color: "#684CDC", fontSize: 10, fontWeight: "900" },
  emptyModalState: { minHeight: 180, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyModalIcon: { color: "#19A974", fontSize: 30, fontWeight: "900" },
  emptyModalTitle: { marginTop: 8, color: "#25324E", fontSize: 16, fontWeight: "900" },
  emptyModalCopy: { marginTop: 4, color: "#758198", fontSize: 12, fontWeight: "600" },
  bodyCopy: { paddingHorizontal: 20, color: "#68758E", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  inputLabel: { marginTop: 18, paddingHorizontal: 20, color: "#25324E", fontSize: 12, fontWeight: "800" },
  input: { marginTop: 7, marginHorizontal: 20, minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 13, color: "#1A2743", backgroundColor: "#FFFFFF", fontSize: 14 },
  status: { marginTop: 10, paddingHorizontal: 20, color: "#6952D7", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 20 },
  secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 13, backgroundColor: "#F3F4FA" },
  secondaryButtonText: { color: "#44516B", fontSize: 12, fontWeight: "800" },
  primaryButton: { minWidth: 126, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 13, backgroundColor: "#111B34" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  disabledButton: { opacity: 0.48 },
  detailsContent: { paddingBottom: 20 },
  detailsHero: { height: 235, overflow: "hidden", backgroundColor: "#17264A" },
  detailsHeroActions: { position: "absolute", top: 13, left: 13, right: 13, flexDirection: "row", justifyContent: "space-between" },
  heroButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)" },
  heroButtonText: { color: "#33415E", fontSize: 25, lineHeight: 28, fontWeight: "700" },
  heroHeart: { color: "#53617B", fontSize: 24, lineHeight: 27, fontWeight: "700" },
  heroHeartActive: { color: "#FF4E91" },
  detailsHeroCopy: { position: "absolute", left: 20, right: 20, bottom: 18 },
  detailsEyebrow: { color: "#E9E7FF", fontSize: 10, letterSpacing: 1.3, fontWeight: "900" },
  detailsTitle: { marginTop: 4, color: "#FFFFFF", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 },
  detailsSubtitle: { marginTop: 4, color: "#F0F2FA", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, padding: 16 },
  fact: { flex: 1, minWidth: 112, minHeight: 76, justifyContent: "center", padding: 12, borderRadius: 15, backgroundColor: "#F7F8FF" },
  factValue: { color: "#1A2743", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  factLabel: { marginTop: 3, color: "#7B879D", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  description: { paddingHorizontal: 18, color: "#5F6D86", fontSize: 13, lineHeight: 20, fontWeight: "600" },
  feedbackBox: { margin: 16, padding: 15, borderRadius: 18, backgroundColor: "#F8F7FF" },
  feedbackTitle: { color: "#25324E", fontSize: 14, fontWeight: "900" },
  ratingRow: { marginTop: 8, flexDirection: "row", gap: 4 },
  starButton: { padding: 3 },
  star: { color: "#D5DAE5", fontSize: 24, lineHeight: 27 },
  starActive: { color: "#F5B62E" },
  commentInput: { minHeight: 84, marginTop: 10, padding: 11, borderWidth: 1, borderColor: "#E0E4EF", borderRadius: 12, color: "#1A2743", backgroundColor: "#FFFFFF", fontSize: 12, lineHeight: 17 },
  feedbackButton: { minHeight: 42, marginTop: 11, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D8CEFF", borderRadius: 12, backgroundColor: "#FFFFFF" },
  feedbackButtonText: { color: "#6A51DD", fontSize: 12, fontWeight: "900" },
  primaryWideButton: { minHeight: 49, marginHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#111B34" },
  primaryWideButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
