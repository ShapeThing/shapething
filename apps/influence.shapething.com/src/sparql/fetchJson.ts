/**
 * Fetching and caching of JSON data (Wikidata query results, the Wikipedia API).
 *
 * - Across visits, responses are kept in the Cache API: a cached answer is returned at once and,
 *   when it is older than REVALIDATE_AFTER, refreshed in the background for the next time
 *   (stale-while-revalidate). This also keeps the app working offline for what was seen before.
 * - The Wikidata query service allows only a few parallel queries per client and answers 429
 *   beyond that, so queries go through a small queue and a 429 is retried once.
 *
 * Within a visit, TanStack Query (see data/queries.ts) keeps the results in memory.
 */

const CACHE_NAME = "influence-data-v2";
const PREVIOUS_CACHE_NAMES = ["influence-data-v1"];
const CACHED_AT_HEADER = "x-cached-at";
const REVALIDATE_AFTER = 24 * 60 * 60 * 1000;
const MAX_PARALLEL_QUERIES = 4;

let runningQueries = 0;
const queryQueue: Array<() => void> = [];

const withQuerySlot = async <T>(task: () => Promise<T>): Promise<T> => {
  if (runningQueries >= MAX_PARALLEL_QUERIES) {
    await new Promise<void>((resolve) => queryQueue.push(resolve));
  }
  runningQueries++;
  try {
    return await task();
  } finally {
    runningQueries--;
    queryQueue.shift()?.();
  }
};

let cachePromise: Promise<Cache | null> | undefined;

const openCache = (): Promise<Cache | null> => {
  cachePromise ??= (async () => {
    try {
      if (!("caches" in globalThis)) return null;
      // The previous version of the app cached differently shaped results.
      await Promise.all(PREVIOUS_CACHE_NAMES.map((name) => caches.delete(name)));
      return await caches.open(CACHE_NAME);
    } catch {
      // For example in private browsing or an insecure context.
      return null;
    }
  })();
  return cachePromise;
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchFromNetwork = async (
  url: string,
  init: RequestInit,
  isQuery: boolean,
  cacheKey: string,
): Promise<unknown> => {
  const request = () => fetch(url, init);
  let response = await (isQuery ? withQuerySlot(request) : request());

  if (response.status === 429) {
    const waitSeconds = Math.min(
      Number.parseInt(response.headers.get("retry-after") ?? "", 10) || 2,
      10,
    );
    await wait(waitSeconds * 1000);
    response = await (isQuery ? withQuerySlot(request) : request());
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`Data request failed (${response.status}): ${body}`);
  }

  const json: unknown = await response.json();

  const cache = await openCache();
  cache
    ?.put(
      cacheKey,
      new Response(JSON.stringify(json), {
        headers: { "content-type": "application/json", [CACHED_AT_HEADER]: Date.now().toString() },
      }),
    )
    .catch(() => {});

  return json;
};

/**
 * Fetches JSON, answered from the Cache API when it can be. `isQuery` marks a request to the
 * Wikidata query service, which is rate limited (see the top of this file). The answer is cached
 * under `cacheKey`, the URL unless given: a POST names what it asks for there.
 */
export const fetchJson = async (
  url: string,
  init: RequestInit = {},
  isQuery = false,
  cacheKey = url,
): Promise<unknown> => {
  const cache = await openCache();
  const cached = await cache?.match(cacheKey).catch(() => undefined);

  if (cached) {
    const age = Date.now() - Number.parseInt(cached.headers.get(CACHED_AT_HEADER) ?? "0", 10);
    if (age > REVALIDATE_AFTER) fetchFromNetwork(url, init, isQuery, cacheKey).catch(() => {});
    return cached.json();
  }

  return fetchFromNetwork(url, init, isQuery, cacheKey);
};
