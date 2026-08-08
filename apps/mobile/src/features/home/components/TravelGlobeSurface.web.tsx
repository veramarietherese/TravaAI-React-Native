import { createElement, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { createTravelGlobeHtml } from "../utils/travel-globe-engine";
import type { TravelGlobeSurfaceProps } from "./TravelGlobeSurface.types";

type GlobeFrame = {
  contentWindow?: {
    postMessage(message: unknown, targetOrigin: string): void;
  } | null;
};

export function TravelGlobeSurface({
  routes,
  command,
  accessibilityLabel = "Interactive travel globe",
  onReady,
  onError,
}: TravelGlobeSurfaceProps) {
  const frameRef = useRef<GlobeFrame | null>(null);
  const readyRef = useRef(false);
  const html = useMemo(() => createTravelGlobeHtml(), []);

  const send = useCallback((message: unknown) => {
    frameRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== "ready") return;
      readyRef.current = true;
      send({ type: "state", routes });
      onReady?.();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onReady, routes, send]);

  useEffect(() => {
    if (!readyRef.current) return;
    send({ type: "state", routes });
  }, [routes, send]);

  useEffect(() => {
    if (!readyRef.current || !command) return;
    send(command);
  }, [command, send]);

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.root}>
      {createElement("iframe", {
        ref: frameRef as never,
        title: accessibilityLabel,
        srcDoc: html,
        sandbox: "allow-scripts",
        onError: () => onError?.("The interactive globe could not load."),
        style: {
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: "transparent",
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: "transparent" },
});
