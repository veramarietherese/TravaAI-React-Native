import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TripSummary } from "@trava/shared";

import { listTrips } from "@/features/trips/api/trips.api";
import { sendAiMessage } from "../api/ai.api";
import { resolveAiPlaces } from "../utils/ai-place-resolver";
import type { AiChatMessage, AiPreferences } from "../types/ai.types";

const MAX_STORED=30;

export function useAiConversation(userId:string|undefined,preferences:AiPreferences){
  const cacheKey=`trava:ai:conversation:v4:${userId||"guest"}`;
  const [messages,setMessages]=useState<AiChatMessage[]>([]);const [sending,setSending]=useState(false);const [error,setError]=useState<string|null>(null);const [lastFailed,setLastFailed]=useState<string|null>(null);const [trips,setTrips]=useState<TripSummary[]>([]);const controller=useRef<AbortController|null>(null);
  useEffect(()=>{let live=true;void AsyncStorage.getItem(cacheKey).then((raw)=>{if(!live||!raw)return;try{const parsed=JSON.parse(raw) as AiChatMessage[];if(Array.isArray(parsed))setMessages(parsed.filter(validMessage).slice(-MAX_STORED));}catch{}});void listTrips().then((items)=>{if(live)setTrips(items.filter((trip)=>trip.status!=="completed").slice(0,5));}).catch(()=>{});return()=>{live=false;controller.current?.abort();};},[cacheKey]);
  const persist=useCallback((next:AiChatMessage[])=>{void AsyncStorage.setItem(cacheKey,JSON.stringify(next.slice(-MAX_STORED)));},[cacheKey]);
  const newChat=useCallback(()=>{controller.current?.abort();setMessages([]);setSending(false);setError(null);setLastFailed(null);void AsyncStorage.removeItem(cacheKey);},[cacheKey]);
  const send=useCallback(async(raw:string)=>{
    const text=raw.trim();if(!text||sending)return false;controller.current?.abort();const request=new AbortController();controller.current=request;setError(null);setLastFailed(null);
    const userMessage:AiChatMessage={id:id("u"),role:"user",text,createdAt:Date.now()};
    const previous=messages.slice(-18);const optimistic=[...messages,userMessage].slice(-MAX_STORED);setMessages(optimistic);persist(optimistic);setSending(true);
    try{
      const response=await sendAiMessage({message:text,history:previous.map((item)=>({role:item.role,text:item.text})).slice(-10),preferences,tripContext:trips.map((trip)=>({id:trip.id,name:trip.name,destination:trip.destination,startDate:trip.startDate,endDate:trip.endDate,status:trip.status,currencyCode:trip.currencyCode})),signal:request.signal});
      if(request.signal.aborted)return false;
      const assistant:AiChatMessage={id:id("a"),role:"assistant",text:response.message,sections:response.sections,recommendations:response.recommendations,quickReplies:response.quickReplies,intent:response.intent,places:[],createdAt:Date.now()};
      setMessages((current)=>{const next=[...current,assistant].slice(-MAX_STORED);persist(next);return next;});setSending(false);
      if(response.places?.length){void resolveAiPlaces(response.places,request.signal).then((places)=>{if(request.signal.aborted)return;setMessages((current)=>{const next=current.map((item)=>item.id===assistant.id?{...item,places}:item);persist(next);return next;});}).catch(()=>{});}
      return true;
    }catch(cause){if(request.signal.aborted)return false;setSending(false);setError(humanError(cause));setLastFailed(text);return false;}
  },[messages,persist,preferences,sending,trips]);
  const retry=useCallback(()=>lastFailed?send(lastFailed):Promise.resolve(false),[lastFailed,send]);
  return{messages,sending,error,lastFailed,trips,send,retry,newChat,setError};
}
function id(prefix:string){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
function validMessage(value:unknown):value is AiChatMessage{if(!value||typeof value!=="object")return false;const item=value as Partial<AiChatMessage>;return (item.role==="user"||item.role==="assistant")&&typeof item.text==="string"&&typeof item.id==="string";}
function humanError(error:unknown){const code=error&&typeof error==="object"&&"code" in error?String((error as {code?:unknown}).code||""):"";if(code==="AI_NOT_CONFIGURED")return "The travel assistant isn’t configured on this server yet.";if(code==="AI_TIMEOUT")return "The travel assistant took too long to answer. Try again.";return "I couldn’t reach the travel assistant just now. Try again in a moment.";}
