import type { Literal, NamedNode } from "@rdfjs/types";
import { factory } from "../rdf/namespaces.ts";
import { fetchJson } from "../sparql/fetchJson.ts";
import { isEntityId } from "./entities.ts";

type PagesResponse<Page> = {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Record<string, Page>;
  };
};

const api = (language: string, parameters: Record<string, string>) =>
  `https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    ...parameters,
  })}`;

/**
 * Older URLs and bookmarks have English Wikipedia titles (such as "Søren_Kierkegaard") instead of
 * Wikidata identifiers. This resolves them through the Wikipedia API, which also follows renamed
 * and redirected pages. Titles that are not found are left out.
 */
export const resolveTitleIds = async (identifiers: readonly string[]): Promise<string[]> => {
  const titles = identifiers.filter((identifier) => !isEntityId(identifier));
  if (!titles.length) return [...identifiers];

  const json = (await fetchJson(
    api("en", { prop: "pageprops", ppprop: "wikibase_item", titles: titles.join("|") }),
  )) as PagesResponse<{ title: string; pageprops?: { wikibase_item?: string } }>;

  // Each requested title, through normalization and redirects, to its final page title.
  const follow = (title: string) => {
    let followed = title;
    for (const step of [json.query?.normalized, json.query?.redirects]) {
      const hit = step?.find((item) => item.from === followed);
      if (hit) followed = hit.to;
    }
    return followed;
  };
  const pages = Object.values(json.query?.pages ?? {});

  return identifiers.flatMap((identifier) => {
    if (isEntityId(identifier)) return [identifier];
    const title = follow(identifier.replace(/_/g, " "));
    const id = pages.find((page) => page.title === title)?.pageprops?.wikibase_item;
    return id && isEntityId(id) ? [id] : [];
  });
};

/**
 * The introduction of a Wikipedia article as plain text, its paragraphs separated by an empty
 * line. Undefined when the article has none.
 */
export const getWikipediaAbstract = async (article: NamedNode): Promise<Literal | undefined> => {
  const url = new URL(article.value);
  const language = url.hostname.split(".")[0];
  if (!url.hostname.endsWith(".wikipedia.org") || !url.pathname.startsWith("/wiki/"))
    return undefined;
  const title = decodeURIComponent(url.pathname.slice("/wiki/".length));

  const json = (await fetchJson(
    api(language, { prop: "extracts", exintro: "1", explaintext: "1", titles: title }),
  )) as PagesResponse<{ extract?: string }>;

  const [page] = Object.values(json.query?.pages ?? {});
  const paragraphs = (page?.extract ?? "")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length ? factory.literal(paragraphs.join("\n\n"), language) : undefined;
};
