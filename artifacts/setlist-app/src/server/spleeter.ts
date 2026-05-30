export type SpleeterIntegrationStatus = {
  provider: "music-separator-spleeter";
  configured: boolean;
  serviceUrl: string | null;
  uploadUrl: string | null;
  fileFieldName: string;
  stemsFieldName: string;
  publicApiKeyConfigured: boolean;
  supportedStems: Array<"vocals" | "drums" | "bass" | "guitar" | "other">;
  audioPolicy: "client-direct-no-backend-storage";
  notes: string[];
};

const SUPPORTED_STEMS: SpleeterIntegrationStatus["supportedStems"] = [
  "vocals",
  "drums",
  "bass",
  "guitar",
  "other",
];

export function getSpleeterIntegrationStatus(): SpleeterIntegrationStatus {
  const serviceUrl = normalizeServiceUrl(
    process.env.NEXT_PUBLIC_MUSIC_SEPARATOR_API_URL ??
      process.env.NEXT_PUBLIC_SPLEETER_SERVICE_URL ??
      process.env.SPLEETER_SERVICE_URL,
  );
  const fileFieldName =
    process.env.NEXT_PUBLIC_MUSIC_SEPARATOR_FILE_FIELD?.trim() || "file";
  const stemsFieldName =
    process.env.NEXT_PUBLIC_MUSIC_SEPARATOR_STEMS_FIELD?.trim() || "stems";

  return {
    provider: "music-separator-spleeter",
    configured: Boolean(serviceUrl),
    serviceUrl,
    uploadUrl: serviceUrl ? `${serviceUrl}/separations` : null,
    fileFieldName,
    stemsFieldName,
    publicApiKeyConfigured: Boolean(
      process.env.NEXT_PUBLIC_MUSIC_SEPARATOR_API_KEY?.trim(),
    ),
    supportedStems: SUPPORTED_STEMS,
    audioPolicy: "client-direct-no-backend-storage",
    notes: [
      "Spleeter runs in the local Music Separator API, not in Deezer.",
      "Audio is sent directly from the browser to the Music Separator API; enable CORS there for this SetlistOS origin.",
      "The SetlistOS backend should persist only lyrics, sync data, stems metadata, and source metadata.",
    ],
  };
}

function normalizeServiceUrl(rawUrl: string | undefined) {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) {
    return null;
  }

  try {
    const url = new URL(trimmedUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
