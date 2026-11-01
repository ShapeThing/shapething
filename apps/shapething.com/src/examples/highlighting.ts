import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// One style in the colors of the site for all code in the examples: SPARQL, TypeScript and Turtle.
export const highlighting = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [tags.keyword, tags.definitionKeyword, tags.modifier],
      color: "var(--purple)",
      fontWeight: "600",
    },
    { tag: [tags.variableName, tags.special(tags.variableName)], color: "var(--blue-light)" },
    { tag: [tags.typeName, tags.className], color: "var(--blue-dark)", fontWeight: "600" },
    { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: "var(--purple-dark)" },
    { tag: [tags.atom, tags.url, tags.link], color: "#0b7a75" },
    { tag: [tags.string, tags.special(tags.string)], color: "#1a7f37" },
    { tag: [tags.number, tags.bool], color: "#b35900" },
    { tag: tags.comment, color: "#6b7280", fontStyle: "italic" },
    { tag: [tags.operator, tags.punctuation, tags.bracket], color: "#4b5563" },
  ]),
);
