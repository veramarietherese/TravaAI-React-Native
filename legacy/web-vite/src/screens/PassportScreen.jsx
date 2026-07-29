import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  Download,
  Heart,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Crown,
  MapPin,
  Plus,
  Share2,
  Sparkles,
  Sticker,
  Shuffle,
  Type,
  Move,
  Trash2,
  RotateCw,
  Upload,
  UsersRound,
  X,
} from "lucide-react";

import { supabase } from "../auth/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import passportCoverArtwork from "../assets/passport-cover-world-map.png";
import souvenirStickerSheet from "../assets/travel-souvenir-sticker-sheet.png";
import "./passport.css";

const STORAGE_BUCKET = "trip-passport";
const MAX_PHOTOS_PER_TRIP = 30;
const MAX_PHOTOS_PER_USER = 10;
const MAX_UPLOAD_MB = 12;
const TARGET_IMAGE_BYTES = 650 * 1024;
const MAX_IMAGE_EDGE = 1600;

const MAX_COLLAGE_PHOTOS = 5;
const COLLAGE_WIDTH = 1080;
const COLLAGE_HEIGHT = 1350;

const COLLAGE_POLAROID_LAYOUT = [
  { x: 8, y: 17, width: 32, height: 24, rotate: -2.5 },
  { x: 58, y: 12, width: 28, height: 27, rotate: 2 },
  { x: 5, y: 49, width: 29, height: 25, rotate: -4 },
  { x: 68, y: 48, width: 27, height: 28, rotate: 4 },
  { x: 35, y: 65, width: 31, height: 22, rotate: -2.5 },
];

const COLLAGE_THEMES = {
  cream: {
    label: "Cream",
    start: "#f7f5ef",
    end: "#fffdf8",
    preview: "linear-gradient(145deg, #f7f5ef, #fffdf8)",
  },
  blush: {
    label: "Blush",
    start: "#fff0f4",
    end: "#fffafd",
    preview: "linear-gradient(145deg, #fff0f4, #fffafd)",
  },
  sky: {
    label: "Sky",
    start: "#eef5ff",
    end: "#fbfdff",
    preview: "linear-gradient(145deg, #eef5ff, #fbfdff)",
  },
};

const COLLAGE_FONT_STACKS = {
  poppins: '"Poppins", sans-serif',
  script: '"Brush Script MT", "Segoe Script", "Apple Chancery", cursive',
};

const MAX_COLLAGE_STICKERS = 12;
const STICKER_SHEET_BACKGROUND = [247, 246, 238];
const STICKER_ASSET_CACHE = new Map();

// Each item is cropped from the exact supplied souvenir sticker sheet.
// Free and Premium only control availability; they do not change the artwork.
const COLLAGE_STICKER_CATALOG = [
  { id: "passport", label: "Passport", tier: "free", crop: [250, 285, 210, 235] },
  { id: "globe", label: "Globe", tier: "free", crop: [510, 255, 215, 220] },
  { id: "suitcase", label: "Suitcase", tier: "free", crop: [110, 520, 290, 260] },
  { id: "scallop", label: "Scallop", tier: "free", crop: [430, 480, 215, 210] },
  { id: "location", label: "Location", tier: "free", crop: [550, 1145, 175, 220] },
  { id: "seahorse", label: "Seahorse", tier: "premium", crop: [775, 300, 200, 275] },
  { id: "surfboard", label: "Surfboard", tier: "premium", crop: [665, 490, 170, 320] },
  { id: "shell", label: "Shell", tier: "premium", crop: [850, 580, 235, 190] },
  { id: "compass", label: "Compass", tier: "premium", crop: [140, 780, 235, 260] },
  { id: "folder", label: "Memories folder", tier: "premium", crop: [385, 700, 250, 220] },
  { id: "peace", label: "Peace hand", tier: "premium", crop: [655, 850, 165, 250] },
  { id: "umbrella", label: "Beach umbrella", tier: "premium", crop: [805, 780, 250, 280] },
  { id: "palm", label: "Palm tree", tier: "premium", crop: [415, 930, 230, 260] },
  { id: "backpack", label: "Backpack", tier: "premium", crop: [175, 1050, 260, 300] },
  { id: "laptop", label: "Travel laptop", tier: "premium", crop: [755, 1070, 270, 265] },
];

function createStickerLayer(sticker, assetUrl, overrides = {}) {
  return {
    id:
      crypto.randomUUID?.() ||
      `sticker-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    stickerId: sticker.id,
    label: sticker.label,
    tier: sticker.tier,
    assetUrl,
    x: 50,
    y: 50,
    size: 18,
    rotation: 0,
    ...overrides,
  };
}

async function buildStickerAsset(sticker) {
  if (STICKER_ASSET_CACHE.has(sticker.id)) {
    return STICKER_ASSET_CACHE.get(sticker.id);
  }

  const sheet = await loadImageFromUrl(souvenirStickerSheet);
  const [sourceX, sourceY, sourceWidth, sourceHeight] = sticker.crop;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The sticker asset could not be prepared.");

  context.drawImage(
    sheet,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);
  const pixels = imageData.data;
  const [backgroundRed, backgroundGreen, backgroundBlue] =
    STICKER_SHEET_BACKGROUND;

  for (let index = 0; index < pixels.length; index += 4) {
    const redDifference = pixels[index] - backgroundRed;
    const greenDifference = pixels[index + 1] - backgroundGreen;
    const blueDifference = pixels[index + 2] - backgroundBlue;
    const distance = Math.sqrt(
      redDifference ** 2 + greenDifference ** 2 + blueDifference ** 2,
    );

    if (distance < 24) {
      pixels[index + 3] = 0;
    } else if (distance < 48) {
      pixels[index + 3] = Math.round(
        ((distance - 24) / 24) * pixels[index + 3],
      );
    }
  }

  context.putImageData(imageData, 0, 0);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png", 1),
  );

  if (!blob) throw new Error("The sticker PNG could not be generated.");

  const assetUrl = URL.createObjectURL(blob);
  STICKER_ASSET_CACHE.set(sticker.id, assetUrl);
  return assetUrl;
}

function drawStickerLayer(context, image, layer) {
  const width = (layer.size / 100) * COLLAGE_WIDTH;
  const height = width * (image.height / image.width);
  const centerX = (layer.x / 100) * COLLAGE_WIDTH;
  const centerY = (layer.y / 100) * COLLAGE_HEIGHT;

  context.save();
  context.translate(centerX, centerY);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.shadowColor = "rgba(53, 42, 48, 0.16)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 7;
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createCollageTextLayer(overrides = {}) {
  return {
    id:
      crypto.randomUUID?.() ||
      `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text: "Add your text",
    font: "poppins",
    size: 58,
    color: "#171717",
    x: 50,
    y: 50,
    ...overrides,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wrapCanvasLines(context, text, maxWidth) {
  const paragraphs = String(text || "").split(/\n/);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      lines.push("");
      return;
    }

    let currentLine = words[0];

    words.slice(1).forEach((word) => {
      const candidate = `${currentLine} ${word}`;

      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });

    lines.push(currentLine);
  });

  return lines;
}

function drawCollageText(context, layer) {
  if (!layer.text.trim()) return;

  const fontFamily =
    COLLAGE_FONT_STACKS[layer.font] || COLLAGE_FONT_STACKS.poppins;
  const fontWeight = layer.font === "poppins" ? 700 : 400;
  const lineHeight = layer.size * (layer.font === "script" ? 1.08 : 1.18);

  context.save();
  context.fillStyle = layer.color;
  context.font = `${fontWeight} ${layer.size}px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = wrapCanvasLines(context, layer.text, 820);
  const centerX = (layer.x / 100) * COLLAGE_WIDTH;
  const centerY = (layer.y / 100) * COLLAGE_HEIGHT;
  const firstLineY = centerY - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    context.fillText(line, centerX, firstLineY + index * lineHeight);
  });

  context.restore();
}

function drawPolaroid(context, image, layout) {
  const x = (layout.x / 100) * COLLAGE_WIDTH;
  const y = (layout.y / 100) * COLLAGE_HEIGHT;
  const width = (layout.width / 100) * COLLAGE_WIDTH;
  const height = (layout.height / 100) * COLLAGE_HEIGHT;
  const padding = 16;
  const footerHeight = 48;

  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate((layout.rotate * Math.PI) / 180);

  context.shadowColor = "rgba(35, 38, 48, 0.18)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 12;
  context.fillStyle = "#fffefa";
  context.fillRect(-width / 2, -height / 2, width, height);

  context.shadowColor = "transparent";
  drawCover(
    context,
    image,
    -width / 2 + padding,
    -height / 2 + padding,
    width - padding * 2,
    height - padding - footerHeight,
  );

  context.fillStyle = "#9a9a96";
  context.font = '500 15px "Poppins", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    "TRAVA AI",
    0,
    height / 2 - footerHeight / 2 + 4,
  );

  context.restore();
}

const EMOJI_AVATARS = [
  "🧑🏻",
  "👩🏻",
  "👨🏽",
  "👩🏽",
  "🧔🏻",
  "🧕🏽",
  "👩🏾‍🦱",
  "👨🏻‍🦱",
  "👩🏼‍🦰",
  "🧑🏿",
  "🤓",
  "😎",
];

function moneylessDate(value) {
  if (!value) return "Date not set";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function safeName(value = "") {
  return String(value)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function emojiFor(seed = "traveler") {
  const score = String(seed)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);

  return EMOJI_AVATARS[score % EMOJI_AVATARS.length];
}

function PersonAvatar({ person, label, className = "" }) {
  const name =
    label ||
    person?.full_name ||
    person?.email ||
    "Traveler";

  return (
    <span className={className} title={name}>
      {person?.profile_picture_url ? (
        <img src={person.profile_picture_url} alt={name} />
      ) : (
        <span className="passport-emoji-avatar">{emojiFor(name)}</span>
      )}
    </span>
  );
}

async function fileToImage(file) {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be added to the passport.");
  }

  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`Each original image must be smaller than ${MAX_UPLOAD_MB} MB.`);
  }

  const sourceImage = await fileToImage(file);
  const ratio = Math.min(
    1,
    MAX_IMAGE_EDGE / Math.max(sourceImage.width, sourceImage.height),
  );

  const width = Math.max(1, Math.round(sourceImage.width * ratio));
  const height = Math.max(1, Math.round(sourceImage.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    alpha: false,
  });

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(sourceImage, 0, 0, width, height);

  let quality = 0.84;
  let blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );

  while (blob && blob.size > TARGET_IMAGE_BYTES && quality > 0.48) {
    quality -= 0.08;
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
  }

  if (!blob) {
    throw new Error("The selected image could not be compressed.");
  }

  return new File(
    [blob],
    `${safeName(file.name.replace(/\.[^.]+$/, "")) || "memory"}.webp`,
    {
      type: "image/webp",
      lastModified: Date.now(),
    },
  );
}

async function loadImageFromUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("A collage image could not be loaded.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function drawCover(context, image, x, y, width, height) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;

  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

export default function PassportScreen({ isPremium = false, onUpgrade }) {
  const { user } = useAuth();

  const [passportOpen, setPassportOpen] = useState(false);
  const [trips, setTrips] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [people, setPeople] = useState({});
  const [membersByTrip, setMembersByTrip] = useState({});
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAlbum, setLoadingAlbum] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [savingUpload, setSavingUpload] = useState(false);
  const [collageOpen, setCollageOpen] = useState(false);
  const [error, setError] = useState("");

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.trip_id === selectedTripId) || null,
    [trips, selectedTripId],
  );

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.trip_id === selectedTripId) || null,
    [albums, selectedTripId],
  );

  const selectedPhotos = useMemo(
    () => photos.filter((photo) => photo.trip_id === selectedTripId),
    [photos, selectedTripId],
  );

  const totalPhotos = photos.length;

  const loadPassport = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError("");

    try {
      const { data: tripRows, error: tripsError } = await supabase
        .from("trips")
        .select(
          "trip_id,user_id,trip_name,destination,start_date,end_date,cover_image_url,created_at",
        )
        .order("start_date", { ascending: false, nullsFirst: false });

      if (tripsError) throw tripsError;

      const normalizedTrips = tripRows || [];
      const tripIds = normalizedTrips.map((trip) => trip.trip_id);

      if (!tripIds.length) {
        setTrips([]);
        setAlbums([]);
        setPhotos([]);
        setPeople({});
        setMembersByTrip({});
        return;
      }

      const [albumResult, photoResult, memberResult] = await Promise.all([
        supabase
          .from("trip_albums")
          .select("*")
          .in("trip_id", tripIds),
        supabase
          .from("trip_album_photos")
          .select("*")
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("trip_members")
          .select("member_id,trip_id,user_id,status")
          .in("trip_id", tripIds),
      ]);

      if (albumResult.error) throw albumResult.error;
      if (photoResult.error) throw photoResult.error;
      if (memberResult.error) throw memberResult.error;

      const photoRows = photoResult.data || [];
      const memberRows = (memberResult.data || []).filter((membership) =>
        ["accepted", "joined"].includes(
          String(membership.status || "").toLowerCase(),
        ),
      );

      const userIds = [
        ...new Set([
          user.id,
          ...normalizedTrips.map((trip) => trip.user_id),
          ...photoRows.map((photo) => photo.uploaded_by),
          ...memberRows.map((membership) => membership.user_id),
        ]),
      ].filter(Boolean);

      let userMap = {};

      if (userIds.length) {
        const { data: userRows, error: usersError } = await supabase
          .from("users")
          .select("user_id,full_name,email,profile_picture_url")
          .in("user_id", userIds);

        if (usersError) throw usersError;

        userMap = Object.fromEntries(
          (userRows || []).map((person) => [person.user_id, person]),
        );
      }

      const signedPhotos = await Promise.all(
        photoRows.map(async (photo) => {
          const { data } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(photo.storage_path, 60 * 60);

          return {
            ...photo,
            signed_url: data?.signedUrl || null,
          };
        }),
      );

      const groupedMembers = {};

      normalizedTrips.forEach((trip) => {
        groupedMembers[trip.trip_id] = [
          {
            user_id: trip.user_id,
            person: userMap[trip.user_id] || null,
            role: "owner",
          },
          ...memberRows
            .filter((membership) => membership.trip_id === trip.trip_id)
            .filter((membership) => membership.user_id !== trip.user_id)
            .map((membership) => ({
              user_id: membership.user_id,
              person: userMap[membership.user_id] || null,
              role: "member",
            })),
        ];
      });

      setTrips(normalizedTrips);
      setAlbums(albumResult.data || []);
      setPhotos(signedPhotos);
      setPeople(userMap);
      setMembersByTrip(groupedMembers);
    } catch (loadError) {
      console.error("Passport load error:", loadError);
      setError(loadError.message || "The travel passport could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPassport();
  }, [loadPassport]);

  async function ensureAlbum(trip) {
    const existing = albums.find((album) => album.trip_id === trip.trip_id);

    if (existing) return existing;

    const { data, error: createError } = await supabase
      .from("trip_albums")
      .insert({
        trip_id: trip.trip_id,
        created_by: user.id,
        album_name:
          trip.trip_name ||
          `${trip.destination || "Trip"} Memories`,
      })
      .select()
      .single();

    if (createError) {
      if (createError.code === "23505") {
        const { data: existingAlbum, error: readError } = await supabase
          .from("trip_albums")
          .select("*")
          .eq("trip_id", trip.trip_id)
          .single();

        if (readError) throw readError;
        return existingAlbum;
      }

      throw createError;
    }

    setAlbums((current) => [...current, data]);
    return data;
  }

  async function submitUpload({ files, caption, locationName, takenAt }) {
    if (!selectedTrip || !files.length) return;

    setSavingUpload(true);
    setError("");

    try {
      const currentTripPhotos = photos.filter(
        (photo) => photo.trip_id === selectedTrip.trip_id,
      );
      const currentUserPhotos = currentTripPhotos.filter(
        (photo) => photo.uploaded_by === user.id,
      );

      if (
        currentTripPhotos.length + files.length >
        MAX_PHOTOS_PER_TRIP
      ) {
        throw new Error(
          `This trip can contain up to ${MAX_PHOTOS_PER_TRIP} memories.`,
        );
      }

      if (
        currentUserPhotos.length + files.length >
        MAX_PHOTOS_PER_USER
      ) {
        throw new Error(
          `Each contributor can add up to ${MAX_PHOTOS_PER_USER} memories per trip.`,
        );
      }

      const album = await ensureAlbum(selectedTrip);
      const newRows = [];

      for (const originalFile of files) {
        const compressedFile = await compressImage(originalFile);
        const photoId = crypto.randomUUID?.() ||
          `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const storagePath = `${selectedTrip.trip_id}/${user.id}/${photoId}.webp`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, compressedFile, {
            contentType: "image/webp",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: photoRow, error: insertError } = await supabase
          .from("trip_album_photos")
          .insert({
            photo_id: photoId,
            album_id: album.album_id,
            trip_id: selectedTrip.trip_id,
            uploaded_by: user.id,
            storage_path: storagePath,
            caption: caption.trim() || null,
            location_name: locationName.trim() || null,
            taken_at: takenAt || null,
          })
          .select()
          .single();

        if (insertError) {
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
          throw insertError;
        }

        const { data: signedData } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 60 * 60);

        newRows.push({
          ...photoRow,
          signed_url: signedData?.signedUrl || null,
        });
      }

      setPhotos((current) => [...newRows, ...current]);
      setUploadOpen(false);
    } catch (uploadError) {
      console.error("Passport upload error:", uploadError);
      setError(uploadError.message || "The memory could not be uploaded.");
    } finally {
      setSavingUpload(false);
    }
  }

  async function toggleFavorite(photo) {
    const nextValue = !photo.is_favorite;

    setPhotos((current) =>
      current.map((item) =>
        item.photo_id === photo.photo_id
          ? { ...item, is_favorite: nextValue }
          : item,
      ),
    );

    const { error: updateError } = await supabase
      .from("trip_album_photos")
      .update({ is_favorite: nextValue })
      .eq("photo_id", photo.photo_id);

    if (updateError) {
      setError(updateError.message);
      loadPassport();
    }
  }

  async function deletePhoto(photo) {
    const isOwner = selectedTrip?.user_id === user.id;
    const isUploader = photo.uploaded_by === user.id;

    if (!isOwner && !isUploader) return;

    const confirmed = window.confirm("Remove this memory from the shared album?");
    if (!confirmed) return;

    setPhotos((current) =>
      current.filter((item) => item.photo_id !== photo.photo_id),
    );

    const { error: deleteError } = await supabase
      .from("trip_album_photos")
      .delete()
      .eq("photo_id", photo.photo_id);

    if (deleteError) {
      setError(deleteError.message);
      loadPassport();
      return;
    }

    await supabase.storage.from(STORAGE_BUCKET).remove([photo.storage_path]);
  }


  if (selectedTrip) {
    return (
      <TripAlbumView
        trip={selectedTrip}
        album={selectedAlbum}
        photos={selectedPhotos}
        people={people}
        members={membersByTrip[selectedTrip.trip_id] || []}
        currentUserId={user.id}
        loading={loadingAlbum}
        error={error}
        onBack={() => setSelectedTripId(null)}
        onAdd={() => setUploadOpen(true)}
        onFavorite={toggleFavorite}
        onDelete={deletePhoto}
        onShare={() => setCollageOpen(true)}
        onDismissError={() => setError("")}
        uploadModal={
          uploadOpen ? (
            <MemoryUploadModal
              saving={savingUpload}
              onClose={() => setUploadOpen(false)}
              onSubmit={submitUpload}
            />
          ) : null
        }
        collageModal={
          collageOpen ? (
            <CollageEditorModal
              trip={selectedTrip}
              photos={selectedPhotos}
              isPremium={isPremium}
              onUpgrade={onUpgrade}
              onClose={() => setCollageOpen(false)}
              onError={(message) => setError(message)}
            />
          ) : null
        }
      />
    );
  }

  return (
    <div className="scroll-area passport-screen">
      <header className="passport-page-header">
        <div>
          <span>TRAVEL MEMORIES</span>
          <h1>Passport</h1>
        </div>

        <div className="passport-header-count">
          <strong>{totalPhotos}</strong>
          <span>memories</span>
        </div>
      </header>

      {error && (
        <div className="passport-error">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <section
        className={`passport-book-stage ${passportOpen ? "open" : ""}`}
      >
        <button
          type="button"
          className="passport-cover-button"
          onClick={() => setPassportOpen(true)}
          aria-label="Open travel passport"
        >
          <div className="passport-cover">
            <img
              className="passport-cover-artwork"
              src={passportCoverArtwork}
              alt="Pink world map with an airplane traveling across the globe"
            />
          </div>
        </button>

        <div className="passport-open-book">
          <button
            type="button"
            className="passport-close-book"
            onClick={() => setPassportOpen(false)}
          >
            <X size={18} />
          </button>

          <div className="passport-page passport-page-left">
            <div className="passport-page-heading">
              <span>TRAVA AI</span>
              <strong>MEMORIES PASSPORT</strong>
            </div>

            <div className="passport-folder-grid">
              {trips
                .filter((_, index) => index % 2 === 0)
                .map((trip) => (
                  <TripFolder
                    key={trip.trip_id}
                    trip={trip}
                    photos={photos.filter(
                      (photo) => photo.trip_id === trip.trip_id,
                    )}
                    members={membersByTrip[trip.trip_id] || []}
                    onOpen={() => setSelectedTripId(trip.trip_id)}
                  />
                ))}
            </div>
          </div>

          <div className="passport-book-spine" />

          <div className="passport-page passport-page-right">
            <div className="passport-page-stamp">TRAVEL MORE ✈</div>

            <div className="passport-folder-grid">
              {trips
                .filter((_, index) => index % 2 === 1)
                .map((trip) => (
                  <TripFolder
                    key={trip.trip_id}
                    trip={trip}
                    photos={photos.filter(
                      (photo) => photo.trip_id === trip.trip_id,
                    )}
                    members={membersByTrip[trip.trip_id] || []}
                    onOpen={() => setSelectedTripId(trip.trip_id)}
                  />
                ))}
            </div>
          </div>
        </div>
      </section>

      {!passportOpen && (
        <div className="passport-open-caption">
          <Sparkles size={18} />
          Tap the passport to open your shared trip albums
        </div>
      )}

      {passportOpen && !loading && trips.length === 0 && (
        <div className="passport-empty">
          <Camera size={35} />
          <strong>No trip albums yet</strong>
          <span>Create a trip first. Its shared passport album will appear here automatically.</span>
        </div>
      )}

      {loading && (
        <div className="passport-loading">
          <LoaderCircle className="spin" size={28} />
          Loading your passport...
        </div>
      )}
    </div>
  );
}

function TripFolder({ trip, photos, members, onOpen }) {
  const previewPhotos = photos.filter((photo) => photo.signed_url).slice(0, 3);

  return (
    <button type="button" className="passport-trip-folder" onClick={onOpen}>
      <div className="passport-folder-previews">
        {previewPhotos.map((photo, index) => (
          <img
            key={photo.photo_id}
            src={photo.signed_url}
            alt={photo.caption || trip.destination || "Trip memory"}
            style={{
              "--preview-index": index,
            }}
          />
        ))}

        {!previewPhotos.length && trip.cover_image_url && (
          <img
            src={trip.cover_image_url}
            alt={trip.destination || trip.trip_name}
            style={{
              "--preview-index": 0,
            }}
          />
        )}
      </div>

      <div className="passport-folder-front">
        <div className="passport-folder-stickers">
          <span>✈</span>
          <span>📍</span>
        </div>

        <strong>
          {trip.trip_name || `${trip.destination || "Trip"} Memories`}
        </strong>

        <small>{photos.length} memories</small>

        <div className="passport-folder-members">
          {members.slice(0, 3).map((membership) => (
            <PersonAvatar
              key={membership.user_id}
              person={membership.person}
              label={membership.person?.full_name || "Traveler"}
              className="passport-folder-avatar"
            />
          ))}

          {members.length > 3 && <span>+{members.length - 3}</span>}
        </div>
      </div>
    </button>
  );
}

function TripAlbumView({
  trip,
  photos,
  people,
  members,
  currentUserId,
  error,
  onBack,
  onAdd,
  onFavorite,
  onDelete,
  onShare,
  onDismissError,
  uploadModal,
  collageModal,
}) {
  return (
    <div className="scroll-area passport-album-view">
      <header className="passport-album-header">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>

        <div>
          <span>SHARED TRIP ALBUM</span>
          <h1>{trip.trip_name || trip.destination || "Trip Memories"}</h1>
          <p>
            {moneylessDate(trip.start_date)} · {photos.length}/{MAX_PHOTOS_PER_TRIP} memories
          </p>
        </div>

        <button type="button" onClick={onAdd}>
          <ImagePlus size={20} />
        </button>
      </header>

      <section className="passport-contributors-card">
        <div className="passport-contributor-stack">
          {members.slice(0, 5).map((membership) => (
            <PersonAvatar
              key={membership.user_id}
              person={membership.person}
              label={membership.person?.full_name || "Traveler"}
              className="passport-contributor-avatar"
            />
          ))}
        </div>

        <div>
          <strong>{members.length || 1} contributors</strong>
          <span>Everyone accepted on this trip can add memories.</span>
        </div>

        <button type="button" onClick={onShare} disabled={!photos.length}>
          <Share2 size={17} />
          Customize collage
        </button>
      </section>

      {error && (
        <div className="passport-error">
          <span>{error}</span>
          <button type="button" onClick={onDismissError}>
            <X size={16} />
          </button>
        </div>
      )}

      {photos.length ? (
        <section className="passport-memory-grid">
          {photos.map((photo) => {
            const uploader = people[photo.uploaded_by];
            const canDelete =
              trip.user_id === currentUserId ||
              photo.uploaded_by === currentUserId;

            return (
              <article key={photo.photo_id} className="passport-memory-card">
                <img
                  src={photo.signed_url}
                  alt={photo.caption || "Travel memory"}
                />

                <button
                  type="button"
                  className={photo.is_favorite ? "favorite" : ""}
                  onClick={() => onFavorite(photo)}
                >
                  <Heart
                    size={18}
                    fill={photo.is_favorite ? "currentColor" : "none"}
                  />
                </button>

                <div className="passport-memory-overlay">
                  <div className="passport-memory-uploader">
                    <PersonAvatar
                      person={uploader}
                      label={uploader?.full_name || "Traveler"}
                      className="passport-memory-avatar"
                    />

                    <div>
                      <strong>{uploader?.full_name || uploader?.email || "Traveler"}</strong>
                      <span>{photo.location_name || "Location not added"}</span>
                    </div>
                  </div>

                  {photo.caption && <p>{photo.caption}</p>}

                  {canDelete && (
                    <button
                      type="button"
                      className="passport-delete-memory"
                      onClick={() => onDelete(photo)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="passport-album-empty">
          <Camera size={40} />
          <h2>Start this trip’s shared story</h2>
          <p>Add compressed photos, captions, and locations. Accepted trip members will see the same album.</p>
          <button type="button" onClick={onAdd}>
            <Plus size={18} />
            Add the first memories
          </button>
        </section>
      )}

      <button type="button" className="passport-floating-add" onClick={onAdd}>
        <Plus size={24} />
      </button>

      {uploadModal}
      {collageModal}
    </div>
  );
}

function CollageEditorModal({ trip, photos, isPremium, onUpgrade, onClose, onError }) {
  const previewRef = useRef(null);
  const dragRef = useRef(null);

  const availablePhotos = useMemo(
    () => photos.filter((photo) => photo.signed_url),
    [photos],
  );

  const [selectedPhotoIds, setSelectedPhotoIds] = useState(() =>
    availablePhotos
      .slice(0, MAX_COLLAGE_PHOTOS)
      .map((photo) => photo.photo_id),
  );
  const [themeKey, setThemeKey] = useState("cream");
  const [textLayers, setTextLayers] = useState(() => [
    createCollageTextLayer({
      id: "title",
      text:
        trip.trip_name ||
        trip.destination ||
        "Monthly Recap",
      font: "poppins",
      size: 78,
      color: "#171717",
      x: 50,
      y: 44,
    }),
    createCollageTextLayer({
      id: "caption",
      text: `first, there will be some ${
        String(trip.destination || trip.trip_name || "travel").toLowerCase()
      } postcards,`,
      font: "script",
      size: 43,
      color: "#242424",
      x: 50,
      y: 91,
    }),
  ]);
  const [selectedTextId, setSelectedTextId] = useState("title");
  const [stickerAssets, setStickerAssets] = useState({});
  const [stickerLayers, setStickerLayers] = useState([]);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [preparedAsset, setPreparedAsset] = useState(null);
  const [status, setStatus] = useState("");

  const selectedPhotos = useMemo(
    () =>
      selectedPhotoIds
        .map((photoId) =>
          availablePhotos.find((photo) => photo.photo_id === photoId),
        )
        .filter(Boolean),
    [availablePhotos, selectedPhotoIds],
  );

  const selectedText =
    textLayers.find((layer) => layer.id === selectedTextId) || null;
  const selectedSticker =
    stickerLayers.find((layer) => layer.id === selectedStickerId) || null;

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      COLLAGE_STICKER_CATALOG.map(async (sticker) => [
        sticker.id,
        await buildStickerAsset(sticker),
      ]),
    )
      .then((entries) => {
        if (!cancelled) setStickerAssets(Object.fromEntries(entries));
      })
      .catch((assetError) => {
        if (!cancelled) {
          setStatus(
            assetError.message || "The sticker library could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function togglePhoto(photoId) {
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId)) {
        return current.filter((id) => id !== photoId);
      }

      if (current.length >= MAX_COLLAGE_PHOTOS) {
        setStatus(`Choose up to ${MAX_COLLAGE_PHOTOS} photos.`);
        return current;
      }

      setStatus("");
      return [...current, photoId];
    });
  }

  function shufflePhotos() {
    setSelectedPhotoIds((current) => {
      const next = [...current];

      for (let index = next.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [next[index], next[target]] = [next[target], next[index]];
      }

      return next;
    });
  }

  function updateTextLayer(layerId, patch) {
    setTextLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer,
      ),
    );
  }

  function addTextLayer() {
    const layer = createCollageTextLayer({
      text: "New text",
      font: "poppins",
      size: 54,
      x: 50,
      y: 55,
    });

    setTextLayers((current) => [...current, layer]);
    setSelectedTextId(layer.id);
  }

  function deleteSelectedText() {
    if (!selectedText) return;

    setTextLayers((current) =>
      current.filter((layer) => layer.id !== selectedText.id),
    );
    setSelectedTextId((currentId) => {
      const remaining = textLayers.filter(
        (layer) => layer.id !== currentId,
      );
      return remaining[0]?.id || null;
    });
  }

  function addSticker(sticker) {
    if (sticker.tier === "premium" && !isPremium) {
      setStatus(`${sticker.label} is a Premium sticker.`);
      if (typeof onUpgrade === "function") onUpgrade();
      return;
    }

    const assetUrl = stickerAssets[sticker.id];
    if (!assetUrl) {
      setStatus("This sticker is still preparing. Try again in a moment.");
      return;
    }

    if (stickerLayers.length >= MAX_COLLAGE_STICKERS) {
      setStatus(`Use up to ${MAX_COLLAGE_STICKERS} stickers per collage.`);
      return;
    }

    const layer = createStickerLayer(sticker, assetUrl, {
      x: 40 + Math.random() * 20,
      y: 38 + Math.random() * 24,
      rotation: Math.round(-9 + Math.random() * 18),
    });

    setStickerLayers((current) => [...current, layer]);
    setSelectedStickerId(layer.id);
    setSelectedTextId(null);
    setStatus("");
  }

  function updateStickerLayer(layerId, patch) {
    setStickerLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer,
      ),
    );
  }

  function deleteSelectedSticker() {
    if (!selectedSticker) return;
    setStickerLayers((current) =>
      current.filter((layer) => layer.id !== selectedSticker.id),
    );
    setSelectedStickerId(null);
  }

  function startDraggingSticker(event, layerId) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedStickerId(layerId);
    setSelectedTextId(null);
    dragRef.current = { type: "sticker", layerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function startDraggingText(event, layerId) {
    event.preventDefault();
    event.stopPropagation();

    setSelectedTextId(layerId);
    setSelectedStickerId(null);
    dragRef.current = {
      type: "text",
      layerId,
      pointerId: event.pointerId,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveDraggedText(event) {
    if (!dragRef.current || !previewRef.current) return;

    const bounds = previewRef.current.getBoundingClientRect();
    const x = clamp(
      ((event.clientX - bounds.left) / bounds.width) * 100,
      8,
      92,
    );
    const y = clamp(
      ((event.clientY - bounds.top) / bounds.height) * 100,
      7,
      94,
    );

    if (dragRef.current.type === "sticker") {
      updateStickerLayer(dragRef.current.layerId, { x, y });
    } else {
      updateTextLayer(dragRef.current.layerId, { x, y });
    }
  }

  function stopDraggingText() {
    dragRef.current = null;
  }

  async function createCollageFile() {
    if (!selectedPhotos.length) {
      throw new Error("Select at least one photo for the collage.");
    }

    await document.fonts?.ready;

    const images = await Promise.all(
      selectedPhotos.map((photo) =>
        loadImageFromUrl(photo.signed_url),
      ),
    );

    const canvas = document.createElement("canvas");
    canvas.width = COLLAGE_WIDTH;
    canvas.height = COLLAGE_HEIGHT;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser could not prepare the collage canvas.");
    }

    const theme = COLLAGE_THEMES[themeKey] || COLLAGE_THEMES.cream;
    const background = context.createLinearGradient(
      0,
      0,
      COLLAGE_WIDTH,
      COLLAGE_HEIGHT,
    );
    background.addColorStop(0, theme.start);
    background.addColorStop(1, theme.end);
    context.fillStyle = background;
    context.fillRect(0, 0, COLLAGE_WIDTH, COLLAGE_HEIGHT);

    context.fillStyle = "rgba(255, 255, 255, 0.22)";
    context.beginPath();
    context.arc(880, 160, 230, 0, Math.PI * 2);
    context.fill();

    images.forEach((image, index) => {
      const layout = COLLAGE_POLAROID_LAYOUT[index];

      if (layout) {
        drawPolaroid(context, image, layout);
      }
    });

    const preparedStickerImages = await Promise.all(
      stickerLayers.map(async (layer) => ({
        layer,
        image: await loadImageFromUrl(layer.assetUrl),
      })),
    );

    preparedStickerImages.forEach(({ layer, image }) =>
      drawStickerLayer(context, image, layer),
    );

    textLayers.forEach((layer) => drawCollageText(context, layer));

    context.save();
    context.fillStyle = "rgba(72, 77, 91, 0.56)";
    context.font = '500 18px "Poppins", sans-serif';
    context.textAlign = "right";
    context.fillText("made with TRAVA AI", 1025, 1310);
    context.restore();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png", 0.96),
    );

    if (!blob) {
      throw new Error("The collage PNG could not be generated.");
    }

    const filename = `${
      safeName(trip.trip_name || trip.destination || "trip") ||
      "trip"
    }-trava-social-collage.png`;

    return {
      blob,
      file: new File([blob], filename, {
        type: "image/png",
      }),
      filename,
    };
  }

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setPreparing(true);

      try {
        const asset = await createCollageFile();

        if (!cancelled) {
          setPreparedAsset(asset);
        }
      } catch (prepareError) {
        if (!cancelled) {
          setPreparedAsset(null);
          setStatus(
            prepareError.message ||
              "The collage preview could not be prepared.",
          );
        }
      } finally {
        if (!cancelled) {
          setPreparing(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedPhotos, textLayers, stickerLayers, themeKey]);

  async function exportCollage(mode) {
    if (!preparedAsset) {
      setStatus("Please wait for the collage to finish preparing.");
      return;
    }

    setExporting(true);
    setStatus("");

    try {
      const { blob, file, filename } = preparedAsset;

      if (mode === "download") {
        downloadBlob(blob, filename);
        setStatus("PNG downloaded.");
        return;
      }

      const canShareFiles =
        typeof navigator.share === "function" &&
        (!navigator.canShare ||
          navigator.canShare({
            files: [file],
          }));

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title:
            trip.trip_name ||
            trip.destination ||
            "My TRAVA AI collage",
          text: "A travel memory collage made with TRAVA AI.",
        });

        setStatus("Collage sent to the share sheet.");
      } else {
        downloadBlob(blob, filename);
        setStatus(
          "This browser cannot send image files directly to apps. The PNG was downloaded so you can attach it in Facebook or Messenger.",
        );
      }
    } catch (exportError) {
      if (exportError?.name !== "AbortError") {
        const message =
          exportError.message || "The collage could not be exported.";
        setStatus(message);
        onError?.(message);
      }
    } finally {
      setExporting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="collage-editor-backdrop"
      onMouseDown={onClose}
    >
      <section
        className="collage-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collage-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="collage-editor-header">
          <div>
            <span>SOCIAL COLLAGE STUDIO</span>
            <h2 id="collage-editor-title">
              Customize your polaroid recap
            </h2>
            <p>
              Choose photos, edit text, and drag text directly on the
              preview.
            </p>
          </div>

          <button
            type="button"
            className="collage-editor-close"
            onClick={onClose}
            aria-label="Close collage editor"
          >
            <X size={20} />
          </button>
        </header>

        <div className="collage-editor-body">
          <section className="collage-preview-panel">
            <div
              ref={previewRef}
              className="collage-preview"
              style={{
                background:
                  COLLAGE_THEMES[themeKey]?.preview ||
                  COLLAGE_THEMES.cream.preview,
              }}
              onPointerMove={moveDraggedText}
              onPointerUp={stopDraggingText}
              onPointerCancel={stopDraggingText}
            >
              {selectedPhotos.map((photo, index) => {
                const layout = COLLAGE_POLAROID_LAYOUT[index];

                return (
                  <figure
                    key={photo.photo_id}
                    className="collage-preview-polaroid"
                    style={{
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                      width: `${layout.width}%`,
                      height: `${layout.height}%`,
                      transform: `rotate(${layout.rotate}deg)`,
                    }}
                  >
                    <img
                      src={photo.signed_url}
                      alt={photo.caption || "Selected travel memory"}
                      draggable="false"
                    />
                    <figcaption>TRAVA AI</figcaption>
                  </figure>
                );
              })}

              {stickerLayers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={[
                    "collage-draggable-sticker",
                    selectedStickerId === layer.id ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: `${layer.x}%`,
                    top: `${layer.y}%`,
                    width: `${layer.size}%`,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                  }}
                  onPointerDown={(event) =>
                    startDraggingSticker(event, layer.id)
                  }
                  aria-label={`Move ${layer.label} sticker`}
                >
                  <img src={layer.assetUrl} alt="" draggable="false" />
                </button>
              ))}

              <svg
                className="collage-preview-text-svg"
                viewBox={`0 0 ${COLLAGE_WIDTH} ${COLLAGE_HEIGHT}`}
                preserveAspectRatio="none"
                aria-label="Draggable collage text"
              >
                {textLayers.map((layer) => (
                  <foreignObject
                    key={layer.id}
                    x={(layer.x / 100) * COLLAGE_WIDTH - 410}
                    y={(layer.y / 100) * COLLAGE_HEIGHT - 150}
                    width="820"
                    height="300"
                    className={[
                      "collage-draggable-text",
                      selectedTextId === layer.id ? "selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerDown={(event) =>
                      startDraggingText(event, layer.id)
                    }
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        color: layer.color,
                        fontFamily:
                          COLLAGE_FONT_STACKS[layer.font] ||
                          COLLAGE_FONT_STACKS.poppins,
                        fontSize: `${layer.size}px`,
                        fontWeight:
                          layer.font === "poppins" ? 700 : 400,
                      }}
                    >
                      {layer.text || "Text"}
                    </div>
                  </foreignObject>
                ))}
              </svg>

              {!selectedPhotos.length && (
                <div className="collage-preview-empty">
                  <ImagePlus size={36} />
                  <strong>Select at least one photo</strong>
                </div>
              )}
            </div>

            <div className="collage-drag-hint">
              <Move size={15} />
              Drag text or stickers directly on the canvas to reposition them.
            </div>
          </section>

          <aside className="collage-editor-controls">
            <section className="collage-control-section">
              <div className="collage-control-heading">
                <div>
                  <strong>Background</strong>
                  <span>Choose the social-card color.</span>
                </div>
              </div>

              <div className="collage-theme-options">
                {Object.entries(COLLAGE_THEMES).map(
                  ([key, theme]) => (
                    <button
                      key={key}
                      type="button"
                      className={themeKey === key ? "active" : ""}
                      onClick={() => setThemeKey(key)}
                    >
                      <span
                        style={{
                          background: theme.preview,
                        }}
                      />
                      {theme.label}
                    </button>
                  ),
                )}
              </div>
            </section>

            <section className="collage-control-section">
              <div className="collage-control-heading">
                <div>
                  <strong>Photos</strong>
                  <span>
                    {selectedPhotoIds.length}/{MAX_COLLAGE_PHOTOS} selected
                  </span>
                </div>

                <button
                  type="button"
                  className="collage-small-action"
                  onClick={shufflePhotos}
                  disabled={selectedPhotoIds.length < 2}
                >
                  <Shuffle size={15} />
                  Shuffle
                </button>
              </div>

              <div className="collage-photo-picker">
                {availablePhotos.map((photo) => {
                  const isSelected = selectedPhotoIds.includes(
                    photo.photo_id,
                  );

                  return (
                    <button
                      key={photo.photo_id}
                      type="button"
                      className={isSelected ? "selected" : ""}
                      onClick={() => togglePhoto(photo.photo_id)}
                      aria-pressed={isSelected}
                    >
                      <img
                        src={photo.signed_url}
                        alt={photo.caption || "Travel memory"}
                      />
                      {isSelected && (
                        <span>
                          {selectedPhotoIds.indexOf(photo.photo_id) + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="collage-control-section collage-sticker-section">
              <div className="collage-control-heading">
                <div>
                  <strong>Stickers</strong>
                  <span>Tap to add, then drag it around the collage.</span>
                </div>

                {!isPremium && (
                  <button
                    type="button"
                    className="collage-small-action premium"
                    onClick={() => {
                      if (typeof onUpgrade === "function") onUpgrade();
                      else setStatus(
                        "Connect the onUpgrade prop to your existing Premium checkout.",
                      );
                    }}
                  >
                    <Crown size={15} />
                    Premium
                  </button>
                )}
              </div>

              <div className="collage-sticker-library">
                {COLLAGE_STICKER_CATALOG.map((sticker) => {
                  const locked = sticker.tier === "premium" && !isPremium;
                  const assetUrl = stickerAssets[sticker.id];

                  return (
                    <button
                      key={sticker.id}
                      type="button"
                      className={locked ? "locked" : ""}
                      onClick={() => addSticker(sticker)}
                      disabled={!assetUrl}
                      title={
                        locked
                          ? `${sticker.label} — Premium`
                          : `Add ${sticker.label}`
                      }
                    >
                      {assetUrl ? (
                        <img src={assetUrl} alt={sticker.label} />
                      ) : (
                        <LoaderCircle className="spin" size={20} />
                      )}
                      <span>{sticker.label}</span>
                      {locked && (
                        <i aria-label="Premium sticker">
                          <LockKeyhole size={12} />
                        </i>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedSticker && (
                <div className="collage-sticker-controls">
                  <div className="collage-selected-sticker-name">
                    <Sticker size={15} />
                    <strong>{selectedSticker.label}</strong>
                  </div>

                  <label>
                    Size
                    <div className="collage-size-control">
                      <input
                        type="range"
                        min="8"
                        max="38"
                        value={selectedSticker.size}
                        onChange={(event) =>
                          updateStickerLayer(selectedSticker.id, {
                            size: Number(event.target.value),
                          })
                        }
                      />
                      <span>{selectedSticker.size}%</span>
                    </div>
                  </label>

                  <label>
                    Rotation
                    <div className="collage-size-control">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={selectedSticker.rotation}
                        onChange={(event) =>
                          updateStickerLayer(selectedSticker.id, {
                            rotation: Number(event.target.value),
                          })
                        }
                      />
                      <span>{selectedSticker.rotation}°</span>
                    </div>
                  </label>

                  <div className="collage-sticker-actions">
                    <button
                      type="button"
                      onClick={() =>
                        updateStickerLayer(selectedSticker.id, {
                          rotation: 0,
                        })
                      }
                    >
                      <RotateCw size={14} />
                      Reset angle
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={deleteSelectedSticker}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="collage-control-section">
              <div className="collage-control-heading">
                <div>
                  <strong>Text</strong>
                  <span>Select text on the preview or add another.</span>
                </div>

                <button
                  type="button"
                  className="collage-small-action"
                  onClick={addTextLayer}
                >
                  <Plus size={15} />
                  Add text
                </button>
              </div>

              <div className="collage-text-layer-list">
                {textLayers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    className={
                      selectedTextId === layer.id ? "active" : ""
                    }
                    onClick={() => setSelectedTextId(layer.id)}
                  >
                    <Type size={14} />
                    <span>{layer.text || "Untitled text"}</span>
                  </button>
                ))}
              </div>

              {selectedText && (
                <div className="collage-text-controls">
                  <label>
                    Text
                    <textarea
                      value={selectedText.text}
                      onChange={(event) =>
                        updateTextLayer(selectedText.id, {
                          text: event.target.value,
                        })
                      }
                      placeholder="Write something about this trip"
                    />
                  </label>

                  <div className="collage-font-picker">
                    <span>Font</span>

                    <div>
                      <button
                        type="button"
                        className={
                          selectedText.font === "poppins"
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          updateTextLayer(selectedText.id, {
                            font: "poppins",
                          })
                        }
                      >
                        Poppins
                      </button>

                      <button
                        type="button"
                        className={[
                          "script",
                          selectedText.font === "script"
                            ? "active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() =>
                          updateTextLayer(selectedText.id, {
                            font: "script",
                          })
                        }
                      >
                        Script
                      </button>
                    </div>
                  </div>

                  <label>
                    Size
                    <div className="collage-size-control">
                      <input
                        type="range"
                        min="28"
                        max="110"
                        value={selectedText.size}
                        onChange={(event) =>
                          updateTextLayer(selectedText.id, {
                            size: Number(event.target.value),
                          })
                        }
                      />
                      <span>{selectedText.size}px</span>
                    </div>
                  </label>

                  <label className="collage-color-control">
                    Text color
                    <input
                      type="color"
                      value={selectedText.color}
                      onChange={(event) =>
                        updateTextLayer(selectedText.id, {
                          color: event.target.value,
                        })
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="collage-delete-text"
                    onClick={deleteSelectedText}
                  >
                    <Trash2 size={15} />
                    Delete selected text
                  </button>
                </div>
              )}
            </section>
          </aside>
        </div>

        <footer className="collage-editor-footer">
          <div>
            {status && <span>{status}</span>}
            {!status && preparing && (
              <span>Preparing the latest collage preview…</span>
            )}
            {!status && !preparing && (
              <span>
                Facebook and Messenger appear through your device’s
                share sheet when file sharing is supported.
              </span>
            )}
          </div>

          <div>
            <button
              type="button"
              className="collage-download-button"
              onClick={() => exportCollage("download")}
              disabled={exporting || preparing || !preparedAsset}
            >
              {exporting || preparing ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Download size={17} />
              )}
              Download PNG
            </button>

            <button
              type="button"
              className="collage-share-button"
              onClick={() => exportCollage("share")}
              disabled={exporting || preparing || !preparedAsset}
            >
              {exporting || preparing ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Share2 size={17} />
              )}
              Share to apps
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function MemoryUploadModal({ saving, onClose, onSubmit }) {
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [takenAt, setTakenAt] = useState("");

  function submit(event) {
    event.preventDefault();
    onSubmit({
      files,
      caption,
      locationName,
      takenAt: takenAt || null,
    });
  }

  return (
    <div className="passport-modal-backdrop" onMouseDown={onClose}>
      <form
        className="passport-upload-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>NEW MEMORIES</span>
            <h2>Add to the shared album</h2>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <label className="passport-file-picker">
          <Upload size={27} />
          <strong>Choose photos</strong>
          <span>
            Up to {MAX_PHOTOS_PER_USER} per contributor, automatically compressed.
          </span>

          <input
            required
            multiple
            type="file"
            accept="image/*"
            onChange={(event) =>
              setFiles(Array.from(event.target.files || []))
            }
          />
        </label>

        {files.length > 0 && (
          <div className="passport-selected-files">
            {files.map((file) => (
              <span key={`${file.name}-${file.lastModified}`}>
                <Check size={14} />
                {file.name}
              </span>
            ))}
          </div>
        )}

        <label>
          Caption
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="What made this moment special?"
          />
        </label>

        <label>
          Location
          <div className="passport-input-icon">
            <MapPin size={17} />
            <input
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="Shibuya, Tokyo"
            />
          </div>
        </label>

        <label>
          Date taken
          <input
            type="datetime-local"
            value={takenAt}
            onChange={(event) => setTakenAt(event.target.value)}
          />
        </label>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>

          <button type="submit" disabled={!files.length || saving}>
            {saving ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ImagePlus size={18} />
            )}
            {saving ? "Uploading..." : "Add memories"}
          </button>
        </footer>
      </form>
    </div>
  );
}