import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, type MapPressEvent, type Region } from "react-native-maps";

import type { Coordinates, DiscoverMapProps } from "./DiscoverMap.types";
export type { DiscoverPlace, PlaceImage, MapRoute, Coordinates, TravelMode } from "./DiscoverMap.types";

export function DiscoverMap(props: DiscoverMapProps) {
  const [fullScreen, setFullScreen] = useState(false);
  return <>
    <MapShell {...props} fullScreen={false} onFullScreen={() => setFullScreen(true)} />
    <Modal visible={fullScreen} animationType="slide" onRequestClose={() => setFullScreen(false)}>
      <View style={styles.fullBackdrop}><MapShell {...props} fullScreen onFullScreen={() => setFullScreen(false)} /></View>
    </Modal>
  </>;
}

function MapShell({ fullScreen, onFullScreen, ...props }: DiscoverMapProps & { fullScreen: boolean; onFullScreen(): void }) {
  const mapRef = useRef<MapView | null>(null);
  const selected = useMemo(() => props.places.find((place) => place.id === props.selectedId) ?? null, [props.places, props.selectedId]);
  const region = useMemo<Region>(() => ({ latitude: props.center.latitude, longitude: props.center.longitude, latitudeDelta: .08, longitudeDelta: .08 }), [props.center.latitude, props.center.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.route?.coordinates && props.route.coordinates.length > 1) {
      map.fitToCoordinates(props.route.coordinates, { edgePadding: { top: 90, right: 70, bottom: 120, left: 70 }, animated: true });
      return;
    }
    const target = selected ?? props.center;
    map.animateToRegion({ latitude: target.latitude, longitude: target.longitude, latitudeDelta: selected ? .035 : .08, longitudeDelta: selected ? .035 : .08 }, 320);
  }, [props.route, props.center.latitude, props.center.longitude, selected?.id]);

  const zoom = async (factor: number) => {
    const map = mapRef.current;
    if (!map) return;
    const camera = await map.getCamera();
    const currentZoom = camera.zoom ?? 13;
    map.animateCamera({ ...camera, zoom: Math.max(2, Math.min(20, currentZoom + factor)) }, { duration: 220 });
  };

  const recenter = () => {
    const target: Coordinates = props.userLocation ?? (selected ? { latitude: selected.latitude, longitude: selected.longitude } : props.center);
    mapRef.current?.animateToRegion({ latitude: target.latitude, longitude: target.longitude, latitudeDelta: .025, longitudeDelta: .025 }, 300);
  };

  const onPress = (event: MapPressEvent) => props.onMapPress?.(event.nativeEvent.coordinate);

  return <View style={[styles.wrap, fullScreen && styles.full, { height: fullScreen ? undefined : props.height ?? 390 }]}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={region} showsCompass showsScale={false} showsTraffic={false} showsBuildings onPress={onPress}>
      {props.places.map((place) => <Marker key={place.id} identifier={place.id} coordinate={{ latitude: place.latitude, longitude: place.longitude }} title={place.name} description={place.subtitle} pinColor={place.id === props.selectedId ? "#7C62E5" : "#F06491"} onPress={() => props.onSelect(place.id)} />)}
      {props.userLocation ? <Marker coordinate={props.userLocation} title="Your location" pinColor="#4B86F8" /> : null}
      {props.route?.coordinates?.length ? <Polyline coordinates={props.route.coordinates} strokeColor="#7663E6" strokeWidth={5} /> : null}
    </MapView>
    <View style={styles.controls}>
      <Control icon={fullScreen ? "contract-outline" : "expand-outline"} label={fullScreen ? "Minimize map" : "Full screen map"} onPress={onFullScreen} />
      <Control icon="add" label="Zoom in" onPress={() => void zoom(1)} />
      <Control icon="remove" label="Zoom out" onPress={() => void zoom(-1)} />
      <Control icon="locate-outline" label="Recenter" onPress={recenter} />
    </View>
  </View>;
}

function Control({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress(): void }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }: { pressed: boolean }) => [styles.control, pressed && { opacity: .68 }]}><Ionicons name={icon} size={19} color="#46516A" /></Pressable>;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", borderRadius: 24, borderWidth: 1, borderColor: "#DDE4EA", backgroundColor: "#EAF2F5" },
  fullBackdrop: { flex: 1, backgroundColor: "#EAF2F5" },
  full: { flex: 1, height: undefined, borderRadius: 0, borderWidth: 0 },
  controls: { position: "absolute", right: 12, top: 12, gap: 7 },
  control: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "#E3E8EE", shadowColor: "#26364C", shadowOpacity: .14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
