import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { createTravelGlobeHtml } from "../utils/travel-globe-engine";
import type { TravelGlobeSurfaceProps } from "./TravelGlobeSurface.types";

function serialize(message: unknown): string {
  return JSON.stringify(message).replace(/</g, "\\u003c");
}

export function TravelGlobeSurface({
  routes,
  command,
  accessibilityLabel = "Interactive travel globe",
  onReady,
  onError,
}: TravelGlobeSurfaceProps) {
  const webViewRef = useRef<WebView | null>(null);
  const readyRef = useRef(false);
  const html = useMemo(() => createTravelGlobeHtml(), []);

  const send = useCallback((message: unknown) => {
    const payload = serialize(message);
    webViewRef.current?.injectJavaScript(
      `window.TRAVA_GLOBE && window.TRAVA_GLOBE.receive(${payload}); true;`,
    );
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    send({ type: "state", routes });
  }, [routes, send]);

  useEffect(() => {
    if (!readyRef.current || !command) return;
    send(command);
  }, [command, send]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as { type?: string };
        if (message.type !== "ready") return;
        readyRef.current = true;
        send({ type: "state", routes });
        onReady?.();
      } catch {
        // Ignore messages that are not part of the TRAVA globe bridge.
      }
    },
    [onReady, routes, send],
  );

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.root}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onMessage={handleMessage}
        onError={(event) =>
          onError?.(event.nativeEvent.description || "The interactive globe could not load.")
        }
        onHttpError={(event) =>
          onError?.(`The interactive globe returned HTTP ${event.nativeEvent.statusCode}.`)
        }
        style={styles.webView}
        containerStyle={styles.webViewContainer}
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback={false}
        mediaPlaybackRequiresUserAction
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: "transparent" },
  webViewContainer: { flex: 1, backgroundColor: "transparent" },
  webView: { flex: 1, backgroundColor: "transparent" },
});
