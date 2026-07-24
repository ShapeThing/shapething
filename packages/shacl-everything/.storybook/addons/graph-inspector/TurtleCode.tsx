import React from "react";

type Props = {
  text: string;
};

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
    '(?<string>"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')',
    "(?<iri><[^>\\s]*>)",
    "(?<directive>@(?:prefix|base)\\b|\\b(?:PREFIX|BASE)\\b)",
    "(?<prefixedName>[A-Za-z][\\w-]*:[A-Za-z_][\\w.-]*|:[A-Za-z_][\\w.-]*)",
    "(?<keyword>\\btrue\\b|\\bfalse\\b|\\ba\\b)",
    "(?<number>[+-]?\\d+\\.\\d+|[+-]?\\.\\d+|[+-]?\\d+)",
    "(?<punctuation>\\^\\^|[[\\](){};,.])",
  ].join("|"),
  "gi",
);

export const TurtleCode = ({ text }: Props) => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_PATTERN.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    const groupName = Object.keys(match.groups ?? {}).find((name) => match!.groups![name] !== undefined);

    nodes.push(
      <span key={key++} style={groupName ? STYLE_BY_GROUP[groupName] : undefined}>
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <>{nodes}</>;
};
