const PREFIX_LINE_PATTERN = /^[ \t]*(?:@prefix|@base|PREFIX|BASE)\b.*\n?/gim;
const PREFIX_DECL_PATTERN = /(?:@prefix|PREFIX)\s+([A-Za-z][\w-]*)?:\s*<([^>]*)>/gi;

export const splitPrefixes = (text: string): { prefixText: string; bodyText: string } => {
  const prefixLines: string[] = [];
  const bodyText = text.replace(PREFIX_LINE_PATTERN, (line) => {
    prefixLines.push(line.replace(/\n$/, ""));
    return "";
  });
  return { prefixText: prefixLines.join("\n"), bodyText: bodyText.trim() };
};

// Maps a declared prefix (empty string for the default `:` prefix) to its namespace IRI,
// so prefixed names elsewhere in the document can be expanded into full, linkable IRIs.
export const parsePrefixMap = (prefixText: string): Record<string, string> => {
  const map: Record<string, string> = {};
  PREFIX_DECL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PREFIX_DECL_PATTERN.exec(prefixText))) {
    map[match[1] ?? ""] = match[2];
  }
  return map;
};

// The same prefix can be pulled from multiple places (the document's own @prefix block,
// plus PREFIX lines embedded in federated query text elsewhere in the body) and in either
// Turtle or SPARQL syntax. Render every declaration the same way, once each, sorted by name,
// so the collapsible list doesn't show mixed styles or duplicates.
export const formatPrefixDeclarations = (prefixMap: Record<string, string>): string =>
  Object.entries(prefixMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, namespace]) => `@prefix ${prefix}: <${namespace}> .`)
    .join("\n");
