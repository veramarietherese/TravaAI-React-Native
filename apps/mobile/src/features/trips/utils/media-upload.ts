// TypeScript fallback for platform-specific resolution.
// Metro selects media-upload.native.ts on iOS/Android and media-upload.web.ts on web.
export * from "./media-upload.native";
