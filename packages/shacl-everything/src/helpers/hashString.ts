// cyrb53 (bryc) - fast, dependency-free, deterministic string hash. Not
// cryptographic; only used to turn an arbitrary string (e.g. a SPARQL
// property path like `<http://...>/^<...>`, full of characters CSS
// selectors/identifiers can't use unescaped) into a short, stable, always
// CSS-safe token.
export function hashString(value: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  // Prefixed so the result is always a valid CSS identifier (a bare digit
  // can't start one) even though callers only rely on it for [data-id=...].
  return `h${hash.toString(36)}`;
}
