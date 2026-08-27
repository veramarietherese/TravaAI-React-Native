import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TripSummary } from "@trava/shared";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { listTrips } from "@/features/trips/api/trips.api";
import {
  MAX_TRIP_MEMORIES,
  MAX_USER_MEMORIES,
  deletePassportMemory,
  loadPassportData,
  setMemoryFavorite,
  shareMemoryRecap,
  uploadPassportMemories,
  type MemoryUploadAsset,
  type PassportAlbum,
  type PassportMemory,
} from "../api/passport.api";

const PASSPORT_COVER = require("../../../../assets/images/profile/passport.png");

type Mode = "personal" | "collaborative";

export function PassportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<Mode>("personal");
  const [passportOpen, setPassportOpen] = useState(false);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [albums, setAlbums] = useState<PassportAlbum[]>([]);
  const [memories, setMemories] = useState<PassportMemory[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const displayName = profile?.full_name || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) || user?.email?.split("@")[0] || "Traveler";

  async function refresh(silent = false) {
    if (!user?.id) return;
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const nextTrips = await listTrips();
      const data = await loadPassportData(nextTrips.map((trip) => String(trip.id)));
      setTrips(nextTrips);
      setAlbums(data.albums);
      setMemories(data.memories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Memory Passport could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void refresh(); }, [user?.id]);

  const visibleTrips = useMemo(() => trips.filter((trip) => mode === "collaborative" ? Math.max(1, trip.memberCount || 1) > 1 : Math.max(1, trip.memberCount || 1) <= 1), [mode, trips]);
  const selectedTrip = useMemo(() => trips.find((trip) => String(trip.id) === selectedTripId) ?? null, [selectedTripId, trips]);
  const selectedMemories = useMemo(() => memories.filter((memory) => memory.tripId === selectedTripId), [memories, selectedTripId]);
  const isWide = width >= 760;

  async function toggleFavorite(memory: PassportMemory) {
    const next = !memory.isFavorite;
    setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, isFavorite: next } : item));
    try {
      await setMemoryFavorite(memory.id, next);
    } catch (updateError) {
      setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, isFavorite: !next } : item));
      Alert.alert("Could not update memory", updateError instanceof Error ? updateError.message : "Please try again.");
    }
  }

  async function removeMemory(memory: PassportMemory) {
    if (!selectedTrip) return;
    const canDelete = memory.uploadedBy === user?.id || selectedTrip.ownerId === user?.id;
    if (!canDelete) return;
    Alert.alert("Remove memory?", "This removes the photo from the shared trip album for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void (async () => {
        const previous = memories;
        setMemories((current) => current.filter((item) => item.id !== memory.id));
        try { await deletePassportMemory(memory); }
        catch (deleteError) { setMemories(previous); Alert.alert("Could not remove memory", deleteError instanceof Error ? deleteError.message : "Please try again."); }
      })() },
    ]);
  }

  async function shareRecap() {
    if (!selectedTrip || !selectedMemories.length || sharing) return;
    setSharing(true);
    try {
      await shareMemoryRecap({ tripName: selectedTrip.name, destination: selectedTrip.destination, memories: selectedMemories });
    } catch (shareError) {
      Alert.alert("Could not share recap", shareError instanceof Error ? shareError.message : "Please try again.");
    } finally {
      setSharing(false);
    }
  }

  if (selectedTrip) {
    return (
      <AlbumView
        trip={selectedTrip}
        memories={selectedMemories}
        currentUserId={user?.id || ""}
        sharing={sharing}
        onBack={() => setSelectedTripId(null)}
        onAdd={() => setUploadOpen(true)}
        onFavorite={(memory) => void toggleFavorite(memory)}
        onDelete={(memory) => void removeMemory(memory)}
        onOpenMemory={(memory) => router.push(`/passport/memory/${encodeURIComponent(memory.id)}` as Href)}
        onShare={() => void shareRecap()}
        onRefresh={() => void refresh(true)}
        refreshing={refreshing}
        uploadModal={
          <UploadMemoryModal
            visible={uploadOpen}
            trip={selectedTrip}
            currentUserId={user?.id || ""}
            uploaderName={displayName}
            currentMemories={selectedMemories}
            onClose={() => setUploadOpen(false)}
            onUploaded={(created) => { setMemories((current) => [...created, ...current]); setUploadOpen(false); }}
          />
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#FFF8FC", "#FAFBFF", "#F4F8FF"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.max}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.circleButton} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={20} color="#27314A" /></Pressable>
            <View style={styles.headerCopy}><Text style={styles.eyebrow}>TRAVEL MEMORIES</Text><Text style={styles.title}>Memory Passport</Text><Text style={styles.subtitle}>{memories.length} memor{memories.length === 1 ? "y" : "ies"} across your trips</Text></View>
            <Pressable onPress={() => void refresh(true)} style={styles.circleButton} accessibilityLabel="Refresh passport">{refreshing ? <ActivityIndicator size="small" color="#8268DC" /> : <Ionicons name="refresh-outline" size={19} color="#8268DC" />}</Pressable>
          </View>

          <View style={styles.modeTabs}>
            <ModeButton label="Personal" active={mode === "personal"} onPress={() => setMode("personal")} />
            <ModeButton label="Collaborative" active={mode === "collaborative"} onPress={() => setMode("collaborative")} />
          </View>

          {error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={19} color="#B66B62" /><View style={styles.errorCopy}><Text style={styles.errorTitle}>Memory Passport needs attention</Text><Text style={styles.errorText}>{error}</Text></View><Pressable onPress={() => void refresh()}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}

          {loading ? <View style={styles.loading}><ActivityIndicator color="#886FE0" /><Text style={styles.loadingText}>Loading your travel memories…</Text></View> : (
            <View style={styles.bookStage}>
              {!passportOpen ? (
                <Pressable onPress={() => setPassportOpen(true)} style={({ pressed }) => [styles.coverButton, pressed && styles.pressed]}>
                  <LinearGradient colors={["#FFF0F5", "#EEF4FF"]} style={styles.coverGlow}>
                    <View style={styles.coverBook}><Image source={PASSPORT_COVER} contentFit="contain" style={styles.coverImage} /></View>
                  </LinearGradient>
                  <View style={styles.coverCaption}><Ionicons name="sparkles" size={16} color="#876CE1" /><Text style={styles.coverCaptionText}>Tap the passport to open your {mode} trip albums</Text></View>
                </Pressable>
              ) : (
                <View style={[styles.openBook, !isWide && styles.openBookMobile]}>
                  <Pressable onPress={() => setPassportOpen(false)} style={styles.closeBook}><Ionicons name="close" size={18} color="#657087" /></Pressable>
                  <BookPage title="TRAVA AI" subtitle="MEMORIES PASSPORT" trips={visibleTrips.filter((_, index) => !isWide || index % 2 === 0)} memories={memories} albums={albums} onOpen={setSelectedTripId} />
                  {isWide ? <View style={styles.spine} /> : null}
                  {isWide ? <BookPage title="TRAVEL MORE ✈" subtitle={mode === "collaborative" ? "SHARED STORIES" : "YOUR STORIES"} trips={visibleTrips.filter((_, index) => index % 2 === 1)} memories={memories} albums={albums} onOpen={setSelectedTripId} /> : null}
                </View>
              )}
            </View>
          )}

          {!loading && passportOpen && !visibleTrips.length ? <View style={styles.empty}><Ionicons name="images-outline" size={34} color="#8B74DD" /><Text style={styles.emptyTitle}>No {mode} trip albums yet</Text><Text style={styles.emptyText}>{mode === "collaborative" ? "Invite or join travelers on a trip and its shared memory album will appear here." : "Create a personal trip and its passport folder will appear automatically."}</Text><Pressable onPress={() => router.push("/trip/create" as Href)} style={styles.createTrip}><Ionicons name="add" size={17} color="#FFFFFF" /><Text style={styles.createTripText}>Create a trip</Text></Pressable></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonOn]}><Text style={[styles.modeText, active && styles.modeTextOn]}>{label}</Text></Pressable>;
}

function BookPage({ title, subtitle, trips, memories, albums, onOpen }: { title: string; subtitle: string; trips: TripSummary[]; memories: PassportMemory[]; albums: PassportAlbum[]; onOpen(id: string): void }) {
  return <View style={styles.page}><View style={styles.pageHead}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSub}>{subtitle}</Text></View><View style={styles.folderGrid}>{trips.map((trip) => <TripFolder key={String(trip.id)} trip={trip} album={albums.find((album) => album.tripId === String(trip.id))} memories={memories.filter((memory) => memory.tripId === String(trip.id))} onOpen={() => onOpen(String(trip.id))} />)}</View></View>;
}

function TripFolder({ trip, memories, album, onOpen }: { trip: TripSummary; memories: PassportMemory[]; album?: PassportAlbum; onOpen(): void }) {
  const previews = memories.filter((memory) => memory.imageUrl).slice(0, 3);
  return <Pressable onPress={onOpen} style={({ pressed }) => [styles.folder, pressed && styles.pressed]}><View style={styles.previewStack}>{previews.map((memory, index) => <Image key={memory.id} source={{ uri: memory.imageUrl || "" }} contentFit="cover" style={[styles.preview, { transform: [{ rotate: `${index === 0 ? -6 : index === 1 ? 4 : -1}deg` }], left: 6 + index * 23 }]} />)}{!previews.length && trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={[styles.preview, { left: 18, transform: [{ rotate: "-4deg" }] }]} /> : null}</View><LinearGradient colors={["#FFFFFF", "#FFF9FC"]} style={styles.folderFront}><View style={styles.folderTop}><Text style={styles.folderPlane}>✈</Text><Text style={styles.folderPin}>📍</Text></View><Text numberOfLines={2} style={styles.folderTitle}>{album?.albumName || trip.name || `${trip.destination} Memories`}</Text><Text style={styles.folderCount}>{memories.length} memor{memories.length === 1 ? "y" : "ies"}</Text><View style={styles.memberRow}><View style={styles.miniAvatar}><Ionicons name="person" size={10} color="#FFFFFF" /></View>{Math.max(1, trip.memberCount || 1) > 1 ? <><View style={[styles.miniAvatar, styles.miniAvatarTwo]}><Ionicons name="person" size={10} color="#FFFFFF" /></View><Text style={styles.memberCount}>+{Math.max(0, (trip.memberCount || 1) - 2)}</Text></> : <Text style={styles.memberCount}>Personal</Text>}</View></LinearGradient></Pressable>;
}

function AlbumView({ trip, memories, currentUserId, sharing, onBack, onAdd, onFavorite, onDelete, onOpenMemory, onShare, onRefresh, refreshing, uploadModal }: { trip: TripSummary; memories: PassportMemory[]; currentUserId: string; sharing: boolean; onBack(): void; onAdd(): void; onFavorite(memory: PassportMemory): void; onDelete(memory: PassportMemory): void; onOpenMemory(memory: PassportMemory): void; onShare(): void; onRefresh(): void; refreshing: boolean; uploadModal: React.ReactNode }) {
  return <SafeAreaView style={styles.safe} edges={["top"]}><StatusBar style="dark" /><LinearGradient colors={["#FFF9FC", "#F7FAFF"]} style={StyleSheet.absoluteFillObject} /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.albumContent}><View style={styles.max}><View style={styles.albumHeader}><Pressable onPress={onBack} style={styles.circleButton}><Ionicons name="arrow-back" size={20} color="#27314A" /></Pressable><View style={styles.albumHeadCopy}><Text style={styles.eyebrow}>{Math.max(1, trip.memberCount || 1) > 1 ? "SHARED TRIP ALBUM" : "PERSONAL TRIP ALBUM"}</Text><Text numberOfLines={1} style={styles.albumTitle}>{trip.name}</Text><Text style={styles.albumSubtitle}>{trip.destination} · {memories.length}/{MAX_TRIP_MEMORIES} memories</Text></View><Pressable onPress={onAdd} style={styles.addCircle}><Ionicons name="images-outline" size={19} color="#FFFFFF" /></Pressable></View>

  <LinearGradient colors={["#F4EEFF", "#EEF6FF", "#FFF2F7"]} style={styles.contributors}><View style={styles.contributorStack}><View style={styles.contributorAvatar}><Ionicons name="person" size={17} color="#FFFFFF" /></View>{Math.max(1, trip.memberCount || 1) > 1 ? <View style={[styles.contributorAvatar, styles.contributorTwo]}><Ionicons name="person" size={17} color="#FFFFFF" /></View> : null}</View><View style={styles.contributorCopy}><Text style={styles.contributorTitle}>{Math.max(1, trip.memberCount || 1)} contributor{Math.max(1, trip.memberCount || 1) === 1 ? "" : "s"}</Text><Text style={styles.contributorText}>{Math.max(1, trip.memberCount || 1) > 1 ? "Accepted trip members see and contribute to the same album." : "This album belongs to your personal trip."}</Text></View><Pressable disabled={!memories.length || sharing} onPress={onShare} style={[styles.shareButton, (!memories.length || sharing) && { opacity: .5 }]}>{sharing ? <ActivityIndicator size="small" color="#765CDD" /> : <Ionicons name="share-outline" size={16} color="#765CDD" />}<Text style={styles.shareText}>Share recap</Text></Pressable></LinearGradient>

  <View style={styles.albumToolbar}><Text style={styles.memoryHeading}>MEMORIES</Text><Pressable onPress={onRefresh} style={styles.refreshSmall}>{refreshing ? <ActivityIndicator size="small" color="#8268DC" /> : <Ionicons name="refresh-outline" size={16} color="#8268DC" />}<Text style={styles.refreshText}>Refresh</Text></Pressable></View>

  {memories.length ? <View style={styles.memoryGrid}>{memories.map((memory) => { const canDelete = memory.uploadedBy === currentUserId || trip.ownerId === currentUserId; return <Pressable key={memory.id} onPress={() => onOpenMemory(memory)} style={({ pressed }) => [styles.memoryCard, pressed && styles.pressed]}><View style={styles.memoryImage}>{memory.imageUrl ? <Image source={{ uri: memory.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={styles.memoryFallback}><Ionicons name="image-outline" size={28} color="#8C78D8" /></View>}<Pressable onPress={(event) => { event.stopPropagation?.(); onFavorite(memory); }} style={styles.favorite}><Ionicons name={memory.isFavorite ? "heart" : "heart-outline"} size={18} color={memory.isFavorite ? "#EF6794" : "#FFFFFF"} /></Pressable>{canDelete ? <Pressable onPress={(event) => { event.stopPropagation?.(); onDelete(memory); }} style={styles.delete}><Ionicons name="trash-outline" size={15} color="#FFFFFF" /></Pressable> : null}</View><View style={styles.memoryCopy}><Text numberOfLines={2} style={styles.memoryCaption}>{memory.caption || "Travel memory"}</Text><View style={styles.memoryMeta}><Ionicons name="location-outline" size={12} color="#8A94A7" /><Text numberOfLines={1} style={styles.memoryMetaText}>{memory.locationName || trip.destination}</Text></View><Text style={styles.memoryUploader}>by {memory.uploaderName || "Traveler"}</Text></View></Pressable>; })}</View> : <View style={styles.albumEmpty}><Ionicons name="camera-outline" size={38} color="#8A72DA" /><Text style={styles.albumEmptyTitle}>Start this trip's story</Text><Text style={styles.albumEmptyText}>Add photos, captions, locations and dates. Collaborative trip members will see the same shared memories.</Text><Pressable onPress={onAdd} style={styles.firstMemory}><Ionicons name="add" size={17} color="#FFFFFF" /><Text style={styles.firstMemoryText}>Add the first memories</Text></Pressable></View>}
  </View></ScrollView><Pressable onPress={onAdd} style={styles.floatingAdd}><Ionicons name="add" size={27} color="#FFFFFF" /></Pressable>{uploadModal}</SafeAreaView>;
}

function UploadMemoryModal({ visible, trip, currentUserId, uploaderName, currentMemories, onClose, onUploaded }: { visible: boolean; trip: TripSummary; currentUserId: string; uploaderName: string; currentMemories: PassportMemory[]; onClose(): void; onUploaded(memories: PassportMemory[]): void }) {
  const [assets, setAssets] = useState<MemoryUploadAsset[]>([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!visible) { setAssets([]); setCaption(""); setLocation(""); setTakenAt(""); } }, [visible]);

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Photos permission needed", "Allow TRAVA to access your photos so you can add trip memories."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: Math.max(1, MAX_USER_MEMORIES), quality: .88 });
    if (!result.canceled) setAssets(result.assets.map((asset) => ({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType })));
  }

  async function submit() {
    if (!assets.length || saving) return;
    const userAlready = currentMemories.filter((memory) => memory.uploadedBy === currentUserId).length;
    if (currentMemories.length + assets.length > MAX_TRIP_MEMORIES) { Alert.alert("Trip memory limit", `A trip can contain up to ${MAX_TRIP_MEMORIES} memories.`); return; }
    if (userAlready + assets.length > MAX_USER_MEMORIES) { Alert.alert("Contributor limit", `You can contribute up to ${MAX_USER_MEMORIES} memories to this trip.`); return; }
    setSaving(true);
    try {
      const created = await uploadPassportMemories({ tripId: String(trip.id), tripName: trip.name, userId: currentUserId, uploaderName, assets, caption, locationName: location, takenAt: takenAt.trim() || null });
      onUploaded(created);
    } catch (uploadError) {
      Alert.alert("Could not add memories", uploadError instanceof Error ? uploadError.message : "Please try again.");
    } finally { setSaving(false); }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.uploadCard}><View style={styles.uploadHead}><View><Text style={styles.eyebrow}>NEW MEMORIES</Text><Text style={styles.uploadTitle}>Add to {trip.name}</Text></View><Pressable onPress={onClose} style={styles.modalClose}><Ionicons name="close" size={20} color="#59657A" /></Pressable></View><Pressable onPress={() => void pick()} style={styles.picker}><LinearGradient colors={["#F4C8DA", "#D6D2F6", "#B9D8F7"]} style={styles.pickerIcon}><Ionicons name="images-outline" size={24} color="#FFFFFF" /></LinearGradient><View style={styles.pickerCopy}><Text style={styles.pickerTitle}>{assets.length ? `${assets.length} photo${assets.length === 1 ? "" : "s"} selected` : "Choose photos"}</Text><Text style={styles.pickerText}>Up to {MAX_USER_MEMORIES} per contributor · {MAX_TRIP_MEMORIES} per trip</Text></View><Ionicons name="chevron-forward" size={18} color="#97A0B0" /></Pressable><Text style={styles.fieldLabel}>CAPTION</Text><TextInput value={caption} onChangeText={setCaption} placeholder="What made this moment special?" placeholderTextColor="#A2AABA" multiline style={[styles.field, styles.captionField]} /><Text style={styles.fieldLabel}>LOCATION</Text><View style={styles.fieldRow}><Ionicons name="location-outline" size={18} color="#7B879D" /><TextInput value={location} onChangeText={setLocation} placeholder="Shibuya, Tokyo" placeholderTextColor="#A2AABA" style={styles.fieldInput} /></View><Text style={styles.fieldLabel}>DATE TAKEN</Text><View style={styles.fieldRow}><Ionicons name="calendar-outline" size={18} color="#7B879D" /><TextInput value={takenAt} onChangeText={setTakenAt} placeholder="2026-09-18T14:30:00+08:00" placeholderTextColor="#A2AABA" style={styles.fieldInput} /></View><View style={styles.uploadActions}><Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!assets.length || saving} onPress={() => void submit()} style={[styles.uploadPress, (!assets.length || saving) && { opacity: .5 }]}><LinearGradient colors={["#A28BE4", "#8DBAF3", "#EDAFCC"]} style={styles.uploadButton}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" /><Text style={styles.uploadButtonText}>Add memories</Text></>}</LinearGradient></Pressable></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FBFAFF"},content:{paddingHorizontal:18,paddingTop:10,paddingBottom:90},max:{width:"100%",maxWidth:1040,alignSelf:"center"},header:{flexDirection:"row",alignItems:"center",gap:12},circleButton:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.94)",borderWidth:1,borderColor:"#E7E8EF"},headerCopy:{flex:1,minWidth:0},eyebrow:{color:"#D275A1",fontSize:8.3,fontWeight:"900",letterSpacing:.8},title:{marginTop:2,color:"#1C2540",fontSize:28,lineHeight:33,fontWeight:"900",letterSpacing:-.75},subtitle:{marginTop:3,color:"#7B859A",fontSize:9,fontWeight:"600"},modeTabs:{marginTop:16,minHeight:44,flexDirection:"row",padding:4,borderRadius:22,backgroundColor:"rgba(236,231,249,.72)"},modeButton:{flex:1,alignItems:"center",justifyContent:"center",borderRadius:18},modeButtonOn:{backgroundColor:"#FFFFFF",boxShadow:"0 7px 17px rgba(80,69,124,.08)"},modeText:{color:"#7E879A",fontSize:9,fontWeight:"800"},modeTextOn:{color:"#755BCE",fontWeight:"900"},error:{marginTop:13,flexDirection:"row",alignItems:"flex-start",gap:9,padding:12,borderRadius:17,backgroundColor:"#FFF6F3",borderWidth:1,borderColor:"#F1D7D1"},errorCopy:{flex:1},errorTitle:{color:"#8C5B53",fontSize:9.5,fontWeight:"900"},errorText:{marginTop:3,color:"#9A706A",fontSize:8.5,lineHeight:13,fontWeight:"600"},retry:{color:"#8C5B53",fontSize:8.5,fontWeight:"900"},loading:{minHeight:430,alignItems:"center",justifyContent:"center",gap:9},loadingText:{color:"#7E879A",fontSize:9.5,fontWeight:"700"},bookStage:{marginTop:16},coverButton:{alignItems:"center"},coverGlow:{width:"100%",maxWidth:720,minHeight:420,alignItems:"center",justifyContent:"center",borderRadius:28,borderWidth:1,borderColor:"#E9E4F0"},coverBook:{width:220,height:300,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:"#FFE7EF",boxShadow:"0 18px 32px rgba(78,63,95,.17)",transform:[{rotate:"-1deg"}]},coverImage:{width:190,height:260},coverCaption:{marginTop:10,flexDirection:"row",alignItems:"center",gap:6},coverCaptionText:{color:"#778097",fontSize:8.5,fontWeight:"700"},openBook:{position:"relative",minHeight:500,flexDirection:"row",overflow:"hidden",borderRadius:28,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E5E0EB",boxShadow:"0 17px 34px rgba(62,55,84,.10)"},openBookMobile:{flexDirection:"column"},closeBook:{position:"absolute",right:12,top:12,zIndex:20,width:35,height:35,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E9E7EE"},page:{flex:1,minHeight:500,padding:22,backgroundColor:"#FFF9FC"},pageHead:{paddingTop:4,paddingBottom:15},pageTitle:{color:"#D16E9A",fontSize:18,fontWeight:"900"},pageSub:{marginTop:2,color:"#9E94A1",fontSize:6.5,fontWeight:"900",letterSpacing:1.2},spine:{width:3,backgroundColor:"#DFDCE3",boxShadow:"0 0 14px rgba(50,49,58,.12)"},folderGrid:{flexDirection:"row",flexWrap:"wrap",gap:14,alignItems:"flex-start"},folder:{width:150,minHeight:145,paddingTop:38},previewStack:{position:"absolute",left:8,right:8,top:0,height:75},preview:{position:"absolute",top:0,width:70,height:62,borderRadius:8,borderWidth:3,borderColor:"#FFFFFF"},folderFront:{minHeight:112,padding:12,borderRadius:14,borderWidth:1,borderColor:"#E7E2EA",boxShadow:"0 10px 19px rgba(66,58,80,.07)"},folderTop:{flexDirection:"row",justifyContent:"space-between"},folderPlane:{fontSize:11},folderPin:{fontSize:10},folderTitle:{marginTop:8,color:"#263047",fontSize:9.5,lineHeight:13,fontWeight:"900"},folderCount:{marginTop:4,color:"#8A92A3",fontSize:7.3,fontWeight:"700"},memberRow:{marginTop:8,flexDirection:"row",alignItems:"center"},miniAvatar:{width:20,height:20,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#B49DDF",borderWidth:2,borderColor:"#FFFFFF"},miniAvatarTwo:{marginLeft:-6,backgroundColor:"#9FC5EB"},memberCount:{marginLeft:5,color:"#9299A8",fontSize:6.8,fontWeight:"800"},empty:{marginTop:18,minHeight:220,alignItems:"center",justifyContent:"center",paddingHorizontal:24,borderRadius:24,backgroundColor:"rgba(255,255,255,.78)"},emptyTitle:{marginTop:9,color:"#2B344A",fontSize:13,fontWeight:"900"},emptyText:{marginTop:5,maxWidth:430,color:"#828B9D",fontSize:9,lineHeight:14,textAlign:"center",fontWeight:"600"},createTrip:{marginTop:13,minHeight:40,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:14,borderRadius:15,backgroundColor:"#A18BE0"},createTripText:{color:"#FFFFFF",fontSize:8.5,fontWeight:"900"},pressed:{opacity:.74,transform:[{scale:.99}]},albumContent:{paddingHorizontal:18,paddingTop:10,paddingBottom:120},albumHeader:{flexDirection:"row",alignItems:"center",gap:11},albumHeadCopy:{flex:1,minWidth:0},albumTitle:{marginTop:2,color:"#1F2943",fontSize:22,lineHeight:27,fontWeight:"900"},albumSubtitle:{marginTop:3,color:"#818A9C",fontSize:8.5,fontWeight:"600"},addCircle:{width:43,height:43,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#A48CE4",boxShadow:"0 8px 18px rgba(114,94,183,.18)"},contributors:{marginTop:15,minHeight:86,flexDirection:"row",alignItems:"center",gap:10,padding:13,borderRadius:22},contributorStack:{width:58,flexDirection:"row"},contributorAvatar:{width:37,height:37,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#B49DE3",borderWidth:2,borderColor:"#FFFFFF"},contributorTwo:{marginLeft:-12,backgroundColor:"#9DC7EE"},contributorCopy:{flex:1,minWidth:0},contributorTitle:{color:"#28324A",fontSize:10.5,fontWeight:"900"},contributorText:{marginTop:3,color:"#7E889C",fontSize:8,lineHeight:12,fontWeight:"600"},shareButton:{minHeight:37,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:11,borderRadius:15,backgroundColor:"rgba(255,255,255,.88)"},shareText:{color:"#765CDD",fontSize:7.8,fontWeight:"900"},albumToolbar:{marginTop:20,marginBottom:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},memoryHeading:{color:"#8065D8",fontSize:9,fontWeight:"900",letterSpacing:.8},refreshSmall:{flexDirection:"row",alignItems:"center",gap:4},refreshText:{color:"#8065D8",fontSize:7.8,fontWeight:"800"},memoryGrid:{flexDirection:"row",flexWrap:"wrap",gap:12},memoryCard:{width:"31.8%",minWidth:230,overflow:"hidden",borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E8E8EF"},memoryImage:{height:210,backgroundColor:"#EAEFF5"},memoryFallback:{flex:1,alignItems:"center",justifyContent:"center"},favorite:{position:"absolute",right:9,top:9,width:32,height:32,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(40,45,59,.42)"},delete:{position:"absolute",left:9,top:9,width:32,height:32,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(40,45,59,.42)"},memoryCopy:{padding:11},memoryCaption:{color:"#263048",fontSize:9.5,lineHeight:13,fontWeight:"900"},memoryMeta:{marginTop:6,flexDirection:"row",alignItems:"center",gap:4},memoryMetaText:{flex:1,color:"#8A94A7",fontSize:7.5,fontWeight:"600"},memoryUploader:{marginTop:5,color:"#B06C93",fontSize:7,fontWeight:"800"},albumEmpty:{minHeight:330,alignItems:"center",justifyContent:"center",paddingHorizontal:30},albumEmptyTitle:{marginTop:10,color:"#28324A",fontSize:14,fontWeight:"900"},albumEmptyText:{marginTop:5,maxWidth:420,color:"#818B9E",fontSize:9,lineHeight:14,textAlign:"center",fontWeight:"600"},firstMemory:{marginTop:14,minHeight:41,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:14,borderRadius:15,backgroundColor:"#A08AE1"},firstMemoryText:{color:"#FFFFFF",fontSize:8.5,fontWeight:"900"},floatingAdd:{position:"absolute",right:22,bottom:25,width:56,height:56,borderRadius:28,alignItems:"center",justifyContent:"center",backgroundColor:"#A08AE2",boxShadow:"0 12px 24px rgba(105,82,177,.25)"},modalBackdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:18,backgroundColor:"rgba(26,29,43,.35)"},uploadCard:{width:"100%",maxWidth:520,padding:17,borderRadius:25,backgroundColor:"#FFFFFF"},uploadHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},uploadTitle:{marginTop:2,color:"#253049",fontSize:17,fontWeight:"900"},modalClose:{width:35,height:35,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"#F4F5F8"},picker:{marginTop:15,minHeight:78,flexDirection:"row",alignItems:"center",gap:10,padding:10,borderRadius:18,backgroundColor:"#FAF9FD",borderWidth:1,borderColor:"#E9E6EF"},pickerIcon:{width:54,height:54,borderRadius:18,alignItems:"center",justifyContent:"center"},pickerCopy:{flex:1,minWidth:0},pickerTitle:{color:"#2B354D",fontSize:10,fontWeight:"900"},pickerText:{marginTop:3,color:"#8992A3",fontSize:7.5,lineHeight:11,fontWeight:"600"},fieldLabel:{marginTop:13,marginBottom:6,color:"#6F788A",fontSize:7.5,fontWeight:"900",letterSpacing:.6},field:{minHeight:44,paddingHorizontal:11,paddingVertical:9,borderRadius:15,backgroundColor:"#F6F7F9",color:"#2B354D",fontSize:9.5,fontWeight:"600"},captionField:{minHeight:78,textAlignVertical:"top"},fieldRow:{minHeight:45,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,borderRadius:15,backgroundColor:"#F6F7F9"},fieldInput:{flex:1,color:"#2B354D",fontSize:9.5,fontWeight:"600"},uploadActions:{marginTop:17,flexDirection:"row",gap:8},cancel:{minWidth:92,minHeight:42,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:"#F3F4F6"},cancelText:{color:"#626D80",fontSize:8.5,fontWeight:"900"},uploadPress:{flex:1},uploadButton:{minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderRadius:15},uploadButtonText:{color:"#FFFFFF",fontSize:8.5,fontWeight:"900"}
});
