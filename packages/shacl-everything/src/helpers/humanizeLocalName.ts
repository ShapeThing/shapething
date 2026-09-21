// Splits a resolved local name into words - at camelCase boundaries (an uppercase run like an
// acronym stays together, e.g. "XMLParser" -> "XML Parser") and at letter/digit transitions in
// either direction (e.g. "postalCode2" -> "postal Code 2") - and rejoins them with a single space.
// Used only where a local name is displayed as a human-facing label (propertyLabel/valueNodeLabel's
// local-name-resolution fallback); localName() itself stays untouched since other callers (widget
// data-attributes, code identifiers, branch labels) need the raw, unsplit local name.
const WORD_BOUNDARY = /[A-Z]+(?![a-z])|[A-Z][a-z]*|[a-z]+|[0-9]+/g;

export function humanizeLocalName(name: string): string {
  const words = name.match(WORD_BOUNDARY);
  return words && words.length > 0 ? words.join(" ") : name;
}
