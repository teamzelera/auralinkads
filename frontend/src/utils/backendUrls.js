/**
 * backendUrls.js
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for backend URL resolution.
 * Avoids hardcoded ports or assumptions about VITE_API_BASE structure.
 */

/**
 * Returns the bare backend origin (no trailing slash, no /api).
 * Works by safely stripping the /api or /api/ suffix from VITE_API_BASE.
 * Example: "https://auralink-c4yi.onrender.com/api" → "https://auralink-c4yi.onrender.com"
 */
export const getBackendBase = () => {
  const apiBase = import.meta.env.VITE_API_BASE || "";
  // Strip trailing /api or /api/ regardless of versioning — keeps it safe for /api/v2 too
  return apiBase.replace(/\/api\/?.*$/, "");
};

/**
 * Returns the WebSocket base URL.
 * Prefers VITE_WS_BASE env var, falls back to deriving from the current page protocol/host.
 * In production, VITE_WS_BASE should be set to "wss://auralink-c4yi.onrender.com"
 */
export const getWsBase = () => {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
};

/**
 * Resolves a potentially relative media URL to an absolute backend URL.
 * If the URL is already absolute (starts with http), it is returned unchanged.
 * Otherwise, the backend base is prepended.
 * Example: "/media/transfers/video.mp4" → "https://auralink-c4yi.onrender.com/media/transfers/video.mp4"
 */
export const resolveMediaUrl = (relativeUrl) => {
  if (!relativeUrl) return "";
  if (relativeUrl.startsWith("http")) return relativeUrl;
  return `${getBackendBase()}${relativeUrl}`;
};
