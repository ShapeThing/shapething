// Keeps the app itself available offline. Wikidata and Wikipedia responses are cached by the app
// (src/sparql/fetchJson.ts).
// - The built files in /assets/ have a hash of their content in their name: a name always has the
//   same content, so the cached copy is used without asking the network (cache first).
// - Everything else (the page, the icons, the manifest) can change under the same name: the network
//   first, falling back to the last cached copy when offline.
const CACHE_NAME = "influence-app-v3";
// Every path of the app is the same page, so the last page loaded can stand in for any of them.
const APP_SHELL = "/__app-shell";

self.addEventListener("activate", (event) => {
  // Earlier versions of the app cached under other names ("cache", "influence-app-v2"); the hashed
  // assets of old builds would otherwise stay forever.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      ),
  );
});

const put = async (key, response) => {
  if (!response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(key, response);
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const isNavigation = request.mode === "navigate";
  const key = isNavigation ? APP_SHELL : request;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        await put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        await put(key, response.clone());
        return response;
      } catch (error) {
        const cached = await caches.match(key);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
