import React, { useMemo } from "react";

type Props = {
  text: string;
  prefixes?: Record<string, string>;
  /** Scopes generated anchor ids so multiple TurtleCode instances on one page don't collide. */
  idPrefix?: string;
};

const ABSOLUTE_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

const linkStyle: React.CSSProperties = { textDecoration: "underline", cursor: "pointer" };

const STYLE_BY_GROUP: Record<string, React.CSSProperties> = {
  comment: { color: "#6e7781", fontStyle: "italic" },
  string: { color: "#116329" },
  iri: { color: "#0550ae" },
  directive: { color: "#8250df", fontWeight: 600 },
  prefixedName: { color: "#953800" },
  keyword: { color: "#cf222e", fontWeight: 600 },
  number: { color: "#0b7285" },
  punctuation: { color: "#6e7781" },
};

const TOKEN_PATTERN = new RegExp(
  [
    "(?<comment>#[^\\n]*)",
    "(?<string>\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')",
    "(?<iri><[^>\\s]*>)",
    "(?<directive>@(?:prefix|base)\\b|\\b(?:PREFIX|BASE)\\b)",
    "(?<prefixedName>[A-Za-z][\\w-]*:[A-Za-z_][\\w.-]*|:[A-Za-z_][\\w.-]*)",
    "(?<keyword>\\btrue\\b|\\bfalse\\b|\\ba\\b)",
    "(?<number>[+-]?\\d+\\.\\d+|[+-]?\\.\\d+|[+-]?\\d+)",
    "(?<punctuation>\\^\\^|[[\\](){};,.])",
  ].join("|"),
  "gi",
);

const hrefForToken = (
  groupName: string | undefined,
  token: string,
  prefixes: Record<string, string> | undefined,
): string | undefined => {
  if (groupName === "iri") {
    const iri = token.slice(1, -1);
    return ABSOLUTE_SCHEME_PATTERN.test(iri) ? iri : undefined;
  }

  if (groupName === "prefixedName" && prefixes) {
    const colonIndex = token.indexOf(":");
    const prefix = token.slice(0, colonIndex);
    const namespace = prefixes[prefix];
    return namespace !== undefined ? namespace + token.slice(colonIndex + 1) : undefined;
  }

  return undefined;
};

type TokenInfo = { groupName: string | undefined; token: string; index: number };

const tokenize = (text: string): TokenInfo[] => {
  const tokens: TokenInfo[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(text))) {
    const groupName = Object.keys(match.groups ?? {}).find(
      (name) => match!.groups![name] !== undefined,
    );
    tokens.push({ groupName, token: match[0], index: match.index });
  }
  return tokens;
};

// A relative IRI (no scheme, e.g. "#philosopherShape") has no external href, but the same
// token text elsewhere in this document identifies the same node - track that instead.
const relativeIriKey = (groupName: string | undefined, token: string): string | undefined => {
  if (groupName !== "iri") return undefined;
  const iri = token.slice(1, -1);
  return ABSOLUTE_SCHEME_PATTERN.test(iri) ? undefined : iri;
};

// Maps each relative-IRI key to the token index where it's first used as a subject, i.e. it
// sits at bracket depth 0 right after a statement-terminating "." (or at the very start).
const findDefinitions = (tokens: TokenInfo[]): Map<string, number> => {
  const definitions = new Map<string, number>();
  let depth = 0;
  let previousSignificant: TokenInfo | undefined;

  tokens.forEach((tokenInfo, tokenIndex) => {
    const { groupName, token } = tokenInfo;
    if (groupName === "comment") return;

    const isSubjectPosition =
      depth === 0 &&
      (previousSignificant === undefined ||
        (previousSignificant.groupName === "punctuation" && previousSignificant.token === "."));

    const key = relativeIriKey(groupName, token);
    if (isSubjectPosition && key !== undefined && !definitions.has(key)) {
      definitions.set(key, tokenIndex);
    }

    if (groupName === "punctuation") {
      if (token === "[") depth += 1;
      if (token === "]") depth -= 1;
    }

    previousSignificant = tokenInfo;
  });

  return definitions;
};

const flashElement = (el: HTMLElement) => {
  const previousBackground = el.style.backgroundColor;
  el.style.backgroundColor = "rgba(255, 212, 0, 0.5)";
  setTimeout(() => {
    el.style.backgroundColor = previousBackground;
  }, 1000);
};

export const TurtleCode = ({ text, prefixes, idPrefix = "turtle" }: Props) => {
  const tokens = useMemo(() => tokenize(text), [text]);
  const definitions = useMemo(() => findDefinitions(tokens), [tokens]);

  const anchorId = (key: string) => `${idPrefix}-def-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  tokens.forEach((tokenInfo, tokenIndex) => {
    const { groupName, token, index } = tokenInfo;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    const style = groupName ? STYLE_BY_GROUP[groupName] : undefined;
    const relativeKey = relativeIriKey(groupName, token);
    const definitionIndex = relativeKey !== undefined ? definitions.get(relativeKey) : undefined;

    if (relativeKey !== undefined && definitionIndex === tokenIndex) {
      // This token is the definition site itself - anchor it, but it isn't a link.
      nodes.push(
        <span key={tokenIndex} id={anchorId(relativeKey)} style={style}>
          {token}
        </span>,
      );
    } else if (relativeKey !== undefined && definitionIndex !== undefined) {
      const id = anchorId(relativeKey);
      nodes.push(
        <a
          key={tokenIndex}
          href={`#${id}`}
          title="Scroll to definition"
          style={{ ...style, ...linkStyle }}
          onClick={(event) => {
            event.preventDefault();
            const el = document.getElementById(id);
            if (!el) return;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            flashElement(el);
          }}
        >
          {token}
        </a>,
      );
    } else {
      const href = hrefForToken(groupName, token, prefixes);
      nodes.push(
        href !== undefined ? (
          <a
            key={tokenIndex}
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{ ...style, ...linkStyle }}
          >
            {token}
          </a>
        ) : (
          <span key={tokenIndex} style={style}>
            {token}
          </span>
        ),
      );
    }

    lastIndex = index + token.length;
  });

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <>{nodes}</>;
};
