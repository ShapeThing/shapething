// Templates a target URL into a CORS proxy prefix (see Environment.corsProxyUrl), so a request
// blocked by the origin's CORS policy can be retried through a proxy service instead of failing
// outright - e.g. "https://corsproxy.io/?url=" + encodeURIComponent("https://example.org/data.ttl").
export const withCorsProxy = (url: string, corsProxyUrl: string): string =>
  `${corsProxyUrl}${encodeURIComponent(url)}`;
