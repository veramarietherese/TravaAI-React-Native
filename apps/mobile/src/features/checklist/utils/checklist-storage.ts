import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { LocalChecklistItem } from "@trava/shared";

const key = (tripId: string, userId: string) => `trava:local-checklist:${userId}:${tripId}`;

export async function loadChecklist(tripId: string, userId: string): Promise<LocalChecklistItem[]> {
  const raw = await AsyncStorage.getItem(key(tripId, userId));
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
async function save(tripId: string, userId: string, items: LocalChecklistItem[]) { await AsyncStorage.setItem(key(tripId, userId), JSON.stringify(items)); return items; }
export async function addChecklistItem(tripId: string, userId: string, title: string, category: LocalChecklistItem["category"]) { const items = await loadChecklist(tripId,userId); const now=new Date().toISOString(); return save(tripId,userId,[...items,{id:Crypto.randomUUID(),title,category,completed:false,createdAt:now,updatedAt:now}]); }
export async function toggleChecklistItem(tripId:string,userId:string,id:string){const items=await loadChecklist(tripId,userId);return save(tripId,userId,items.map((item)=>item.id===id?{...item,completed:!item.completed,updatedAt:new Date().toISOString()}:item));}
export async function renameChecklistItem(tripId:string,userId:string,id:string,title:string){const items=await loadChecklist(tripId,userId);return save(tripId,userId,items.map((item)=>item.id===id?{...item,title,updatedAt:new Date().toISOString()}:item));}
export async function deleteChecklistItem(tripId:string,userId:string,id:string){const items=await loadChecklist(tripId,userId);return save(tripId,userId,items.filter((item)=>item.id!==id));}
