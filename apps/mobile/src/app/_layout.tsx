import { Stack } from "expo-router";
import { useEffect } from "react";

import { AppProviders } from "@/providers/AppProviders";

function dismissBootstrapLoader() {
  if (typeof document === "undefined") return;
  const loader = document.getElementById("trava-bootstrap-loader");
  if (!loader) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loader.classList.add("trava-bootstrap-loader--leaving");
      window.setTimeout(() => loader.remove(), 420);
    });
  });
}

export default function RootLayout() {
  useEffect(() => {
    dismissBootstrapLoader();
  }, []);

  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
