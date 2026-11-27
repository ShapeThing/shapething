// Reads the contacts in a vCard file (.vcf), as phones and mail programs export them: versions
// 2.1 (what Android's Contacts app writes), 3.0 (RFC 2426) and 4.0 (RFC 6350). Read are the
// properties the contact shape has a place for (see contact-shape.ttl); photos, the home / work
// types of addresses and numbers, an organization's units and birthdays without a year are left
// out.

import type { ImportedContact } from "./importPeople.ts";

type Property = {
  name: string;
  params: Map<string, string[]>;
  value: string;
};

// Splits on a separator outside "double quotes": parameter values may hold ; and :.
function splitOutsideQuotes(text: string, separator: string, limit = Infinity): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') quoted = !quoted;
    if (character === separator && !quoted && parts.length < limit - 1) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts;
}

const isQuotedPrintable = (line: string) =>
  /QUOTED-PRINTABLE/i.test(splitOutsideQuotes(line, ":", 2)[0]);

/**
 * The logical lines of the file. A line starting with a space or tab continues the one before
 * (folding, all versions). In version 2.1 a quoted-printable value that ends on = continues on the
 * next line too, without the indent (a soft line break).
 */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const last = lines.length - 1;
    if (last >= 0 && isQuotedPrintable(lines[last]) && lines[last].endsWith("=")) {
      lines[last] = lines[last].slice(0, -1) + line.replace(/^[ \t]/, "");
    } else if (last >= 0 && /^[ \t]/.test(line)) {
      lines[last] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseProperty(line: string): Property | undefined {
  const [head, value] = splitOutsideQuotes(line, ":", 2);
  if (value === undefined) return undefined;
  const [nameWithGroup, ...rawParams] = splitOutsideQuotes(head, ";");
  // A group prefix, item1.EMAIL, says which properties belong together; not needed here.
  const name = nameWithGroup.split(".").pop()!.toUpperCase();
  const params = new Map<string, string[]>();
  for (const param of rawParams) {
    const [key, paramValue] = splitOutsideQuotes(param, "=", 2);
    // Version 2.1 allows a bare value, such as TEL;CELL or EMAIL;QUOTED-PRINTABLE.
    const [name, values] =
      paramValue === undefined
        ? [/^(?:QUOTED-PRINTABLE|BASE64|8BIT|7BIT)$/i.test(key) ? "ENCODING" : "TYPE", key]
        : [key, paramValue];
    const unquoted = splitOutsideQuotes(values, ",").map((value) => value.replace(/^"|"$/g, ""));
    params.set(name.toUpperCase(), [
      ...(params.get(name.toUpperCase()) ?? []),
      // Version 4.0 quotes a list of types: TYPE="fax,work". A type never holds a comma itself.
      ...(name.toUpperCase() === "TYPE" ? unquoted.flatMap((value) => value.split(",")) : unquoted),
    ]);
  }
  return { name, params, value };
}

// =C3=A9 is é in UTF-8: the bytes are collected and decoded in the property's charset.
function decodeQuotedPrintable(value: string, charset: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    const hex = value.slice(index + 1, index + 3);
    if (value[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(...new TextEncoder().encode(value[index]));
    }
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
}

const unescapeText = (value: string) =>
  value.replace(/\\([\\,;nN])/g, (_, character: string) =>
    character === "n" || character === "N" ? "\n" : character,
  );

// The parts of a structured value (N, ADR, ORG), split on their unescaped ; separators. A part
// may itself list several values, split on unescaped commas: those are joined with `join`.
const components = (value: string, join: string) =>
  value.split(/(?<!\\);/).map((part) =>
    part
      .split(/(?<!\\),/)
      .map((item) => unescapeText(item).trim())
      .filter(Boolean)
      .join(join),
  );

function decodedValue({ params, value }: Property): string {
  const encoding = params.get("ENCODING")?.[0]?.toUpperCase();
  if (encoding === "QUOTED-PRINTABLE") {
    return decodeQuotedPrintable(value, params.get("CHARSET")?.[0] ?? "utf-8");
  }
  return value;
}

const text = (property: Property) => unescapeText(decodedValue(property)).trim();

const hasType = (property: Property, type: string) =>
  (property.params.get("TYPE") ?? []).some((value) => value.toLowerCase() === type);

/**
 * BDAY as an xsd:date: 1985-04-12, 19850412 or 1985-04-12T00:00:00Z. Undefined for a birthday
 * without a year (--04-12, or Apple's 1604 with X-APPLE-OMIT-YEAR), which the contact shape has no
 * place for, and for one written as text.
 */
function birthDate(property: Property): string | undefined {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})(?:T.*)?$/.exec(decodedValue(property).trim());
  if (!match) return undefined;
  const [, year, month, day] = match;
  if (property.params.get("X-APPLE-OMIT-YEAR")?.[0] === year) return undefined;
  const isValid =
    Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31;
  return isValid ? `${year}-${month}-${day}` : undefined;
}

/** A web address, with https:// added to one written without, such as www.example.org. */
function webAddress(value: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return URL.canParse(value) ? value : undefined;
  const withScheme = `https://${value}`;
  return /^[\w-]+(\.[\w-]+)+(\/|$)/.test(value) && URL.canParse(withScheme)
    ? withScheme
    : undefined;
}

type Card = Required<
  Pick<
    ImportedContact,
    | "nicknames"
    | "emails"
    | "telephones"
    | "faxNumbers"
    | "urls"
    | "addresses"
    | "organizations"
    | "jobTitles"
    | "notes"
    | "tags"
  >
> &
  ImportedContact & { formattedName?: string };

const newCard = (): Card => ({
  nicknames: [],
  emails: [],
  telephones: [],
  faxNumbers: [],
  urls: [],
  addresses: [],
  organizations: [],
  jobTitles: [],
  notes: [],
  tags: [],
});

function readProperty(card: Card, property: Property) {
  switch (property.name) {
    case "FN":
      card.formattedName ??= text(property);
      break;
    case "N": {
      if (card.familyName || card.givenName) break;
      // Family;Given;Additional;Prefixes;Suffixes
      const [family, given, additional, prefixes, suffixes] = components(
        decodedValue(property),
        " ",
      );
      card.familyName = family || undefined;
      card.givenName = given || undefined;
      card.additionalName = additional || undefined;
      card.honorificPrefix = prefixes || undefined;
      card.honorificSuffix = suffixes || undefined;
      break;
    }
    case "NICKNAME":
      // A list: Jim,Jimmie.
      card.nicknames.push(
        ...decodedValue(property)
          .split(/(?<!\\),/)
          .map(unescapeText),
      );
      break;
    case "EMAIL":
      card.emails.push(text(property));
      break;
    case "TEL": {
      // Version 4.0 may write a number as a tel: URI.
      const number = text(property).replace(/^tel:/i, "");
      (hasType(property, "fax") ? card.faxNumbers : card.telephones).push(number);
      break;
    }
    case "URL": {
      const url = webAddress(text(property));
      if (url) card.urls.push(url);
      break;
    }
    case "ADR": {
      // PO box;Extended address;Street;Locality;Region;Postal code;Country
      const [postOfficeBox, extended, street, locality, region, postalCode, country] = components(
        decodedValue(property),
        ", ",
      );
      card.addresses.push({
        postOfficeBox,
        street: [street, extended].filter(Boolean).join(", "),
        locality,
        region,
        postalCode,
        country,
      });
      break;
    }
    case "ORG": {
      // Organization;Unit;... Only the organization is kept.
      const [organization] = components(decodedValue(property), ", ");
      if (organization) card.organizations.push(organization);
      break;
    }
    case "TITLE":
      card.jobTitles.push(text(property));
      break;
    case "BDAY":
      card.birthDate ??= birthDate(property);
      break;
    case "NOTE":
      card.notes.push(text(property));
      break;
    case "CATEGORIES":
      // A list: family,book club.
      card.tags.push(
        ...decodedValue(property)
          .split(/(?<!\\),/)
          .map(unescapeText),
      );
      break;
  }
}

// The name as shown: FN, or else made from N's parts.
const displayName = (card: Card) =>
  card.formattedName ||
  [card.honorificPrefix, card.givenName, card.additionalName, card.familyName, card.honorificSuffix]
    .filter(Boolean)
    .join(" ");

/** Every card in the file, in order. Cards inside a card (a 2.1 AGENT) are left out. */
export function parseVCards(text: string): ImportedContact[] {
  const contacts: ImportedContact[] = [];
  let depth = 0;
  let card: Card | undefined;

  for (const line of unfold(text.replace(/^﻿/, ""))) {
    const property = parseProperty(line);
    if (!property) continue;
    const value = property.value.trim().toUpperCase();

    if (property.name === "BEGIN" && value === "VCARD") {
      depth++;
      if (depth === 1) card = newCard();
      continue;
    }
    if (property.name === "END" && value === "VCARD") {
      depth--;
      if (depth === 0 && card) {
        const name = displayName(card) || undefined;
        delete card.formattedName;
        contacts.push({ ...card, name });
        card = undefined;
      }
      continue;
    }
    if (depth === 1 && card) readProperty(card, property);
  }
  return contacts;
}
