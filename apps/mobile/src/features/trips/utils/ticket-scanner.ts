import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export interface ScannedTicket {
  tripId: string;
  imageUri: string;
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  originName: string;
  destinationName: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  gate: string;
  terminal: string;
  seat: string;
  barcode: string;
  scannedAt: string;
}

const key = (tripId: string) => `trava:ticket-scan:${tripId}`;

export async function loadScannedTicket(tripId: string) {
  const raw = await AsyncStorage.getItem(key(tripId));
  if (!raw) return null;
  try { return JSON.parse(raw) as ScannedTicket; } catch { return null; }
}

export async function saveScannedTicket(ticket: ScannedTicket) {
  await AsyncStorage.setItem(key(ticket.tripId), JSON.stringify(ticket));
}

export async function pickTicket(source: "camera" | "library") {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Camera access is required to scan a ticket.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: false });
    return result.canceled ? null : result.assets[0] ?? null;
  }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo access is required to upload a ticket.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: false });
  return result.canceled ? null : result.assets[0] ?? null;
}

export async function compressTicketForWeb(asset: ImagePicker.ImagePickerAsset) {
  if (Platform.OS !== "web") return asset.uri;
  const doc = (globalThis as any).document;
  const createBitmap = (globalThis as any).createImageBitmap as undefined | ((blob: Blob) => Promise<any>);
  if (!doc || !createBitmap) return asset.uri;
  try {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const bitmap = await createBitmap(blob);
    const maxWidth = 1200;
    const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    const canvas = doc.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return asset.uri;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return asset.uri;
  }
}

export function mockParseTicket({ tripId, imageUri, fileName, fallbackFlightNumber }: { tripId: string; imageUri: string; fileName?: string | null; fallbackFlightNumber?: string | null }): ScannedTicket {
  const source = `${fileName ?? ""}`.toUpperCase();
  const flight = source.match(/\b[A-Z]{2,3}\s?\d{3,4}\b/)?.[0]?.replace(/\s/g, "") ?? fallbackFlightNumber ?? "PR2334";
  const airportCodes = source.match(/\b[A-Z]{3}\b/g) ?? [];
  const originCode = airportCodes[0] ?? "BXU";
  const destinationCode = airportCodes[1] ?? "CEB";
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  return {
    tripId,
    imageUri,
    flightNumber: flight,
    originCode,
    destinationCode,
    originName: originCode === "BXU" ? "Bancasi Airport" : `${originCode} Airport`,
    destinationName: destinationCode === "CEB" ? "Mactan–Cebu International Airport" : `${destinationCode} Airport`,
    departureTime: "5:17 PM",
    arrivalTime: "6:06 PM",
    date,
    gate: "—",
    terminal: "1",
    seat: "—",
    barcode: `${flight}-${date.replaceAll("-", "")}`,
    scannedAt: new Date().toISOString(),
  };
}
