import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type { AiPreferences } from "../types/ai.types";

const KEY="trava:ai:preferences:v4";
const EMPTY:AiPreferences={destination:"",days:"",travelers:"",style:""};

export function useAiPreferences(){
  const [preferences,setPreferences]=useState<AiPreferences>(EMPTY);const [expanded,setExpanded]=useState(false);const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{let live=true;void AsyncStorage.getItem(KEY).then((raw)=>{if(!live)return;try{const value=raw?JSON.parse(raw) as Partial<AiPreferences>:{};setPreferences({...EMPTY,...value});}catch{}setHydrated(true);});return()=>{live=false;};},[]);
  const update=useCallback(<K extends keyof AiPreferences>(key:K,value:AiPreferences[K])=>{setPreferences((current)=>{const next={...current,[key]:value};void AsyncStorage.setItem(KEY,JSON.stringify(next));return next;});},[]);
  const clear=useCallback(()=>{setPreferences(EMPTY);void AsyncStorage.setItem(KEY,JSON.stringify(EMPTY));},[]);
  return{preferences,expanded,setExpanded,update,clear,hydrated};
}
