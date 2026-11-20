// Fetches and git requests to hosts without CORS headers go through this proxy, see apps/cors.shapething.com.
export const CORS_PROXY_URL: string =
  import.meta.env.VITE_CORS_PROXY_URL ?? "https://cors.shapething.com/?url=";
