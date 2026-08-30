import { hydrateVerifiedPlaceImages } from "@/features/maps/utils/place-photo";
import { searchWorldPlaces, worldResultToDiscoverPlace } from "@/features/maps/utils/world-place-search";
import type { AiPlaceSpec, AiResolvedPlace } from "../types/ai.types";

const cache = new Map<string, AiResolvedPlace | null>();

export async function resolveAiPlaces(specs: AiPlaceSpec[], signal?: AbortSignal): Promise<AiResolvedPlace[]> {
  const resolved: AiResolvedPlace[] = [];
  for (const spec of specs.slice(0,5)) {
    if (signal?.aborted) break;
    const key = normalize([spec.name,spec.city,spec.country].filter(Boolean).join("|"));
    if (cache.has(key)) {
      const value=cache.get(key); if(value)resolved.push(value); continue;
    }
    try {
      const query=[spec.name,spec.city,spec.country].filter(Boolean).join(", ");
      const results=await searchWorldPlaces(query,null,6,signal);
      const best=results.map((item)=>({item,score:placeMatchScore(spec.name,item.name,item.displayName)})).sort((a,b)=>b.score-a.score)[0];
      if(!best||best.score<0.48){cache.set(key,null);continue;}
      let place=worldResultToDiscoverPlace(best.item,null);
      const hydrated=await hydrateVerifiedPlaceImages([place],signal).catch(()=>[place]);
      place=hydrated[0]??place;
      const value={place,reason:spec.reason};cache.set(key,value);resolved.push(value);
    } catch {
      if(!signal?.aborted)cache.set(key,null);
    }
  }
  return resolved;
}

function placeMatchScore(expected:string,name:string,display:string){const a=tokens(expected),b=tokens(`${name} ${display}`);if(!a.size)return 0;let hit=0;a.forEach((token)=>{if(b.has(token))hit+=1;});const exact=normalize(expected)===normalize(name)?0.5:0;return Math.min(1,exact+hit/a.size*.55);}
function tokens(value:string){return new Set(normalize(value).split(" ").filter((item)=>item.length>2));}
function normalize(value:string){return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();}
