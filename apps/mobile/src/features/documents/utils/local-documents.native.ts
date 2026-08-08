import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { LocalTripDocument } from "@trava/shared";

const MAX_LOCAL_DOCUMENT_BYTES=25*1024*1024;
const metaKey=(tripId:string,userId:string)=>`trava:local-documents:${userId}:${tripId}`;
const folder=(tripId:string,userId:string)=>`${FileSystem.documentDirectory}trava/${userId}/${tripId}/`;
export async function listLocalDocuments(tripId:string,userId:string):Promise<LocalTripDocument[]>{const raw=await AsyncStorage.getItem(metaKey(tripId,userId));if(!raw)return[];try{const value=JSON.parse(raw);return Array.isArray(value)?value:[]}catch{return[]}}
async function save(tripId:string,userId:string,items:LocalTripDocument[]){await AsyncStorage.setItem(metaKey(tripId,userId),JSON.stringify(items));return items}
export async function pickAndStoreDocument(tripId:string,userId:string,category:LocalTripDocument["category"]){const result=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true,multiple:false});if(result.canceled||!result.assets[0])return null;const asset=result.assets[0];if((asset.size??0)>MAX_LOCAL_DOCUMENT_BYTES)throw new Error("Choose a document smaller than 25 MB.");const dir=folder(tripId,userId);await FileSystem.makeDirectoryAsync(dir,{intermediates:true});const safe=(asset.name||"document").replace(/[^a-zA-Z0-9._-]/g,"_");const destination=`${dir}${Crypto.randomUUID()}-${safe}`;await FileSystem.copyAsync({from:asset.uri,to:destination});const doc:LocalTripDocument={id:Crypto.randomUUID(),name:asset.name||safe,mimeType:asset.mimeType||"application/octet-stream",size:asset.size??null,localUri:destination,category,createdAt:new Date().toISOString()};const items=await listLocalDocuments(tripId,userId);await save(tripId,userId,[doc,...items]);return doc}
export async function deleteLocalDocument(tripId:string,userId:string,id:string){const items=await listLocalDocuments(tripId,userId);const target=items.find(i=>i.id===id);if(target)await FileSystem.deleteAsync(target.localUri,{idempotent:true});return save(tripId,userId,items.filter(i=>i.id!==id))}
export async function openLocalDocument(document:LocalTripDocument){if(await Sharing.isAvailableAsync()){await Sharing.shareAsync(document.localUri,{mimeType:document.mimeType,dialogTitle:document.name});return}throw new Error("Sharing is unavailable on this device.")}
