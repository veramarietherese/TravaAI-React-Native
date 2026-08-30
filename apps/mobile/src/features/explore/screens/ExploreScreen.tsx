import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { searchWorldPlaces, worldResultToDiscoverPlace, haversineMeters, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import { AddToItinerarySheet } from "../components/AddToItinerarySheet";
import type { DiscoverPlace, MapRoute } from "../components/DiscoverMap.types";
import { ExploreFeaturedPlace } from "../components/ExploreFeaturedPlace";
import { ExploreLocationSheet } from "../components/ExploreLocationSheet";
import { ExplorePlaceCard } from "../components/ExplorePlaceCard";
import { LocationPermissionCard } from "../components/LocationPermissionCard";
import { MarketplacePreviewSections } from "../components/MarketplacePreviewSections";
import { PlaceDetailsSheet } from "../components/PlaceDetailsSheet";
import { DISCOVERY_RADII, EXPLORE_CATEGORIES, type ExploreCategory } from "../data/explore-categories";
import { useExploreContext } from "../hooks/useExploreContext";
import { useExplorePlaces } from "../hooks/useExplorePlaces";
import { readSavedPlaces, stablePlaceKey, toggleSavedPlace } from "../utils/discover-storage";

export function ExploreScreen() {
  const router=useRouter();
  const params=useLocalSearchParams<{focusLat?:string;focusLon?:string;focusName?:string;focusSubtitle?:string;focusProviderId?:string;focusCategory?:string}>();
  const {width}=useWindowDimensions();
  const {profile,user}=useAuth();
  const scrollRef=useRef<ScrollView>(null);
  const mapY=useRef(0);
  const contextState=useExploreContext();
  const [category,setCategory]=useState<ExploreCategory>("All");
  const [radius,setRadius]=useState<number>(8_000);
  const nearby=useExplorePlaces({latitude:contextState.context.latitude,longitude:contextState.context.longitude},category,radius,30);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [route,setRoute]=useState<MapRoute|null>(null);
  const [query,setQuery]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [searchResults,setSearchResults]=useState<WorldPlaceResult[]>([]);
  const [searching,setSearching]=useState(false);
  const [locationSheet,setLocationSheet]=useState(false);
  const [permissionPrompt,setPermissionPrompt]=useState(false);
  const [savedPlaces,setSavedPlaces]=useState<DiscoverPlace[]>([]);
  const [savedOnly,setSavedOnly]=useState(false);
  const [detailOpen,setDetailOpen]=useState(false);
  const [addPlace,setAddPlace]=useState<DiscoverPlace|null>(null);
  const searchAbort=useRef<AbortController|null>(null);

  const avatarUrl=profile?.avatar_url||(typeof user?.user_metadata?.avatar_url==="string"?user.user_metadata.avatar_url:null);
  const contentPadding=width<390?14:width<720?18:24;
  const cardWidth=Math.min(235,Math.max(194,width-contentPadding*2-58));

  useEffect(()=>{void readSavedPlaces().then(setSavedPlaces);},[]);
  useEffect(()=>{if(nearby.places.length && (!selectedId||!nearby.places.some((p)=>p.id===selectedId)))setSelectedId(nearby.places[0]!.id);},[nearby.places,selectedId]);
  useEffect(()=>{setRoute(null);},[contextState.context.latitude,contextState.context.longitude,selectedId]);

  // AI -> Explore exact focus handoff. The place remains the same real entity across map/details/itinerary.
  useEffect(()=>{
    const lat=Number(params.focusLat),lon=Number(params.focusLon); const name=typeof params.focusName==="string"?params.focusName.trim():"";
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!name)return;
    const providerId=typeof params.focusProviderId==="string"&&params.focusProviderId?params.focusProviderId:`focus:${lat.toFixed(5)}:${lon.toFixed(5)}`;
    const focus:DiscoverPlace={id:`osm:${providerId}`,provider:"osm",providerId,name,subtitle:typeof params.focusSubtitle==="string"&&params.focusSubtitle?params.focusSubtitle:name,latitude:lat,longitude:lon,category:typeof params.focusCategory==="string"&&params.focusCategory?params.focusCategory:"Place",distanceMeters:haversineMeters(contextState.context.latitude,contextState.context.longitude,lat,lon),image:null};
    nearby.setPlaces((current)=>[focus,...current.filter((item)=>item.id!==focus.id)]);setSelectedId(focus.id);requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,mapY.current-80),animated:true}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[params.focusLat,params.focusLon,params.focusName,params.focusProviderId]);

  useEffect(()=>{
    searchAbort.current?.abort(); const text=query.trim(); if(text.length<2){setSearchResults([]);setSearching(false);return;}
    const controller=new AbortController();searchAbort.current=controller;const timer=setTimeout(()=>{setSearching(true);void searchWorldPlaces(text,{latitude:contextState.context.latitude,longitude:contextState.context.longitude},10,controller.signal).then(setSearchResults).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setSearching(false);});},220);return()=>{clearTimeout(timer);controller.abort();};
  },[query,contextState.context.latitude,contextState.context.longitude]);

  const allPlaces=nearby.places;
  const activePlaces=savedOnly?savedPlaces:allPlaces;
  const selected=useMemo(()=>activePlaces.find((place)=>place.id===selectedId)??activePlaces[0]??null,[activePlaces,selectedId]);
  const savedKeys=useMemo(()=>new Set(savedPlaces.map(stablePlaceKey)),[savedPlaces]);
  const displayPlaces=activePlaces;
  const currentCenter={latitude:contextState.context.latitude,longitude:contextState.context.longitude};
  const usePhysicalForRoute=contextState.deviceLocation? haversineMeters(contextState.deviceLocation.latitude,contextState.deviceLocation.longitude,currentCenter.latitude,currentCenter.longitude)<=100_000:false;
  const routeOrigin=usePhysicalForRoute&&contextState.deviceLocation?contextState.deviceLocation:currentCenter;
  const routeOriginLabel=usePhysicalForRoute?"your current location":`${contextState.context.label} exploration center`;

  const chooseSearch=(result:WorldPlaceResult)=>{const place=worldResultToDiscoverPlace(result,currentCenter);nearby.setPlaces((current)=>[place,...current.filter((item)=>item.id!==place.id)]);setSelectedId(place.id);setSearchOpen(false);requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,mapY.current-80),animated:true}));};
  const save=async(place:DiscoverPlace)=>{const result=await toggleSavedPlace(place);setSavedPlaces(result.places);};
  const requestLocation=()=>{setLocationSheet(false);if(contextState.promptDismissed){void contextState.useCurrentLocation();}else setPermissionPrompt(true);};
  const allowLocation=async()=>{await contextState.useCurrentLocation();setPermissionPrompt(false);};
  const openAll=()=>router.push(`/explore/all?section=picks&category=${encodeURIComponent(category)}&lat=${contextState.context.latitude}&lon=${contextState.context.longitude}&label=${encodeURIComponent(contextState.context.label)}&radius=${radius}` as Href);

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <LinearGradient colors={["#FBFCFF","#FFF9FD","#F9FBFF"]} style={StyleSheet.absoluteFill}/>
    <LocationPermissionCard visible={permissionPrompt} busy={contextState.locationStatus==="requesting"} onAllow={()=>void allowLocation()} onNotNow={()=>{setPermissionPrompt(false);void contextState.dismissPrompt();}}/>
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll,{paddingHorizontal:contentPadding}]}>
      <View style={styles.max}>
        <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.kicker}>TRAVA DISCOVER</Text><Text style={styles.title}>Find what’s worth doing next</Text><Pressable onPress={()=>setLocationSheet(true)} style={styles.exploring}><Text style={styles.exploringLabel}>Exploring in</Text><Text numberOfLines={1} style={styles.exploringValue}>{contextState.context.label}</Text><Ionicons name="chevron-down" size={14} color="#725AD7"/></Pressable></View><View style={styles.headerActions}><Pressable accessibilityLabel={savedOnly?"Show nearby places":"Show saved places"} onPress={()=>setSavedOnly((value)=>!value)} style={[styles.circle,savedOnly&&{backgroundColor:"#F1ECFF"}]}><Ionicons name={savedOnly?"heart":"heart-outline"} size={18} color={savedOnly?"#E06291":"#66567F"}/></Pressable><Pressable onPress={requestLocation} style={styles.circle}><Ionicons name="navigate-outline" size={19} color="#66567F"/></Pressable><Pressable onPress={()=>router.push("/(traveler)/(tabs)/profile" as Href)} style={styles.avatar}>{avatarUrl?<Image source={{uri:avatarUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/>:<Ionicons name="person-outline" size={19} color="#566177"/>}</Pressable></View></View>
        {contextState.locationStatus!=="unknown"&&contextState.locationStatus!=="granted"&&contextState.locationStatus!=="requesting"?<View style={styles.locationNotice}><Ionicons name="information-circle-outline" size={15} color="#7D68CE"/><Text style={styles.locationNoticeText}>Location is off or unavailable. Discover still works using your selected exploration area.</Text></View>:null}

        <View style={styles.searchArea}><View style={[styles.search,searchOpen&&styles.searchOn]}><Ionicons name="search-outline" size={20} color="#7E899D"/><TextInput value={query} onFocus={()=>setSearchOpen(true)} onChangeText={(value)=>{setQuery(value);setSearchOpen(true);}} placeholder="Search destinations, attractions, food, hotels, or transport…" placeholderTextColor="#939CAD" returnKeyType="search" style={styles.searchInput}/>{searching?<ActivityIndicator size="small" color="#8064E3"/>:query?<Pressable onPress={()=>{setQuery("");setSearchResults([]);}}><Ionicons name="close-circle" size={19} color="#A1A9B8"/></Pressable>:null}</View>{searchOpen&&query.trim().length>=2?<View style={styles.dropdown}>{!searching&&!searchResults.length?<Text style={styles.dropdownEmpty}>No matching real places found.</Text>:searchResults.map((item)=><Pressable key={item.id} onPress={()=>chooseSearch(item)} style={styles.result}><Ionicons name="location-outline" size={17} color="#8067DE"/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.resultName}>{item.name}</Text><Text numberOfLines={1} style={styles.resultSub}>{item.displayName}</Text></View><Ionicons name="arrow-forward" size={15} color="#9AA2B1"/></Pressable>)}</View>:null}</View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{EXPLORE_CATEGORIES.map((item)=><Pressable key={item.name} onPress={()=>{setCategory(item.name);setSelectedId(null);}} style={[styles.chip,item.name===category&&styles.chipOn]}><Ionicons name={item.icon} size={14} color={item.name===category?"#fff":"#5F6A7E"}/><Text style={[styles.chipText,item.name===category&&styles.chipTextOn]}>{item.name}</Text></Pressable>)}</ScrollView>
        <View style={styles.radiusRow}><Text style={styles.radiusTitle}>Explore radius</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusTrack}>{DISCOVERY_RADII.map((value)=><Pressable key={value} onPress={()=>setRadius(value)} style={[styles.radius,value===radius&&styles.radiusOn]}><Text style={[styles.radiusText,value===radius&&styles.radiusTextOn]}>{value/1000} km</Text></Pressable>)}</ScrollView>{nearby.refreshing?<ActivityIndicator size="small" color="#8064E3"/>:null}</View>

        <View onLayout={(event)=>{mapY.current=event.nativeEvent.layout.y;}}>
          {nearby.error&&!nearby.hasResults?<InlineState icon="cloud-offline-outline" title="We couldn’t load places right now." text="Your exploration area is safe. Retry the real place request when the connection is ready." action="Retry" onAction={nearby.retry}/>:!nearby.hasResults&&!nearby.loading&&!nearby.refining?<InlineState icon="search-outline" title="No nearby places found" text="Try another category or explore a wider area."/>:<ExploreFeaturedPlace places={activePlaces} selected={selected} center={currentCenter} userLocation={contextState.deviceLocation} routeOrigin={routeOrigin} routeOriginLabel={routeOriginLabel} route={route} onRoute={setRoute} onSelect={setSelectedId} onDetails={()=>setDetailOpen(true)} onSave={()=>selected&&void save(selected)} saved={selected?savedKeys.has(stablePlaceKey(selected)):false} loading={nearby.loading||(!nearby.hasResults&&nearby.refining)}/>} 
        </View>

        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{savedOnly?"Saved Places":"Nearby Places"}</Text><Text style={styles.sectionSub}>{savedOnly?"Places you saved from real discovery results.":`Real places around ${contextState.context.label}. Missing metadata is intentionally omitted.`}</Text></View>{!savedOnly?<Pressable onPress={openAll} style={styles.viewAll}><Text style={styles.viewAllText}>View all</Text><Ionicons name="chevron-forward" size={13} color="#755DD7"/></Pressable>:null}</View>
        {displayPlaces.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>{displayPlaces.slice(0,10).map((place)=><ExplorePlaceCard key={place.id} place={place} width={cardWidth} saved={savedKeys.has(stablePlaceKey(place))} onSelect={()=>{setSelectedId(place.id);requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,mapY.current-80),animated:true}));}} onSave={()=>void save(place)} onRoute={()=>{setSelectedId(place.id);requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:Math.max(0,mapY.current-80),animated:true}));}} onAdd={()=>setAddPlace(place)}/>)}</ScrollView>:savedOnly?<InlineState icon="heart-outline" title="No saved places yet" text="Save a real place and it will appear here."/>:(nearby.loading||nearby.refining)?<View style={styles.inlineLoading}><ActivityIndicator size="small" color="#8064E3"/><Text style={styles.inlineLoadingText}>Finding nearby places…</Text></View>:null}

        <MarketplacePreviewSections/>
      </View>
    </ScrollView>
    <ExploreLocationSheet visible={locationSheet} current={contextState.context} recent={contextState.recent} locationStatus={contextState.locationStatus} onClose={()=>setLocationSheet(false)} onSelect={(value)=>{void contextState.selectExploration(value);setSelectedId(null);setRoute(null);}} onUseCurrent={requestLocation}/>
    <PlaceDetailsSheet place={selected} visible={detailOpen} onClose={()=>setDetailOpen(false)} onAdd={()=>{setDetailOpen(false);if(selected)setAddPlace(selected);}}/>
    <AddToItinerarySheet place={addPlace} visible={Boolean(addPlace)} onClose={()=>setAddPlace(null)}/>
  </SafeAreaView>;
}

function InlineState({icon,title,text,action,onAction}:{icon:React.ComponentProps<typeof Ionicons>["name"];title:string;text:string;action?:string;onAction?():void}){return <View style={styles.state}><Ionicons name={icon} size={26} color="#8068DC"/><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{text}</Text>{action&&onAction?<Pressable onPress={onAction} style={styles.retry}><Text style={styles.retryText}>{action}</Text></Pressable>:null}</View>;}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#FBFCFF"},scroll:{paddingTop:10,paddingBottom:130},max:{width:"100%",maxWidth:1180,alignSelf:"center"},header:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:14,paddingTop:8,paddingBottom:14},headerCopy:{flex:1,minWidth:0},kicker:{color:"#8065E1",fontSize:7.5,fontWeight:"900",letterSpacing:.9},title:{marginTop:4,color:"#17203A",fontSize:27,lineHeight:33,fontWeight:"900",letterSpacing:-.7},exploring:{marginTop:10,alignSelf:"flex-start",maxWidth:"100%",minHeight:38,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:11,borderRadius:14,backgroundColor:"#F4F0FF"},exploringLabel:{color:"#8B829B",fontSize:8,fontWeight:"700"},exploringValue:{maxWidth:360,color:"#664FC7",fontSize:9.2,fontWeight:"900"},headerActions:{flexDirection:"row",gap:8},circle:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#fff",borderWidth:1,borderColor:"#E5E8EF"},avatar:{width:42,height:42,borderRadius:21,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#F3F5F8",borderWidth:1,borderColor:"#E5E8EF"},locationNotice:{marginBottom:10,minHeight:38,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,borderRadius:14,backgroundColor:"#F7F4FF"},locationNoticeText:{flex:1,color:"#756D86",fontSize:8.5,fontWeight:"700"},searchArea:{zIndex:80},search:{minHeight:53,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:14,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:"#E7E9EF",boxShadow:"0 9px 24px rgba(47,55,78,.07)"},searchOn:{borderColor:"#D5CAF5"},searchInput:{flex:1,minWidth:0,color:"#273049",fontSize:11,fontWeight:"600"},dropdown:{position:"absolute",left:0,right:0,top:60,maxHeight:390,padding:7,borderRadius:19,backgroundColor:"#fff",borderWidth:1,borderColor:"#E5E8EE",zIndex:100,boxShadow:"0 16px 38px rgba(40,48,70,.15)"},result:{minHeight:56,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:8,borderRadius:13},resultName:{color:"#283149",fontSize:10.2,fontWeight:"900"},resultSub:{marginTop:2,color:"#8992A3",fontSize:8,fontWeight:"600"},dropdownEmpty:{padding:14,color:"#8992A3",fontSize:9,fontWeight:"600"},chips:{gap:7,paddingTop:13,paddingBottom:10},chip:{minHeight:35,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:12,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:"#E4E7ED"},chipOn:{backgroundColor:"#937CE4",borderColor:"#937CE4"},chipText:{color:"#596477",fontSize:8.2,fontWeight:"900"},chipTextOn:{color:"#fff"},radiusRow:{minHeight:40,flexDirection:"row",alignItems:"center",gap:9,marginBottom:12},radiusTitle:{color:"#7D8799",fontSize:8,fontWeight:"800"},radiusTrack:{gap:6},radius:{minHeight:29,paddingHorizontal:10,alignItems:"center",justifyContent:"center",borderRadius:13,backgroundColor:"#F6F6F8"},radiusOn:{backgroundColor:"#ECE7FF"},radiusText:{color:"#7C8596",fontSize:7.8,fontWeight:"800"},radiusTextOn:{color:"#6F57D2"},sectionHead:{marginTop:24,marginBottom:9,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",gap:12},sectionTitle:{color:"#25304A",fontSize:13,fontWeight:"900"},sectionSub:{marginTop:2,color:"#8A93A4",fontSize:8,fontWeight:"600"},viewAll:{flexDirection:"row",alignItems:"center",gap:2},viewAllText:{color:"#755DD7",fontSize:8.2,fontWeight:"900"},track:{gap:10,paddingBottom:3},inlineLoading:{minHeight:90,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderRadius:18,backgroundColor:"#F8F7FC"},inlineLoadingText:{color:"#7E8798",fontSize:8.5,fontWeight:"700"},state:{minHeight:260,alignItems:"center",justifyContent:"center",padding:24,borderRadius:24,backgroundColor:"#fff",borderWidth:1,borderColor:"#E5E8EE"},stateTitle:{marginTop:9,color:"#2D364D",fontSize:12,fontWeight:"900"},stateText:{marginTop:5,maxWidth:420,color:"#8992A3",fontSize:8.8,lineHeight:13,fontWeight:"600",textAlign:"center"},retry:{marginTop:12,minHeight:36,paddingHorizontal:14,alignItems:"center",justifyContent:"center",borderRadius:13,backgroundColor:"#F2EEFF"},retryText:{color:"#7258D4",fontSize:8.5,fontWeight:"900"}});
