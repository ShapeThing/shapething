// Adding people from elsewhere, such as a vCard file (see vcard.ts): who gets added, the triples
// they're written as (see contact-shape.ttl for the properties), and what to say about it.

import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";

const factory = new DataFactory();
const schema = (name: string) => factory.namedNode(`https://schema.org/${name}`);
const xsd = (name: string) => factory.namedNode(`http://www.w3.org/2001/XMLSchema#${name}`);
const RDF_TYPE = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

export type ImportedAddress = {
  postOfficeBox?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  region?: string;
  country?: string;
};

// A contact as it comes in. Everything is optional: a contact file may hold anything or nothing.
export type ImportedContact = {
  name?: string;
  honorificPrefix?: string;
  givenName?: string;
  additionalName?: string;
  familyName?: string;
  honorificSuffix?: string;
  nicknames?: string[];
  emails?: string[];
  telephones?: string[];
  faxNumbers?: string[];
  urls?: string[];
  addresses?: ImportedAddress[];
  organizations?: string[];
  jobTitles?: string[];
  // An xsd:date, 1985-04-12.
  birthDate?: string;
  notes?: string[];
  tags?: string[];
};

// A person to add: a contact with a name, everything trimmed and without doubles or empties.
export type NewPerson = ImportedContact & { name: string };

export type ImportPlan = {
  people: NewPerson[];
  // Someone with the same name is already in the book, or earlier in the same import.
  existing: string[];
  // Without a name: the contact shape requires one.
  unnamed: number;
};

const cleanText = (value: string | undefined) => value?.trim() || undefined;

const cleanList = (values: string[] | undefined) => [
  ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
];

const cleanAddress = (address: ImportedAddress): ImportedAddress | undefined => {
  const cleaned = Object.fromEntries(
    Object.entries(address)
      .map(([key, value]) => [key, cleanText(value)])
      .filter(([, value]) => value),
  ) as ImportedAddress;
  return Object.keys(cleaned).length ? cleaned : undefined;
};

const nameKey = (name: string) => name.normalize("NFC").toLocaleLowerCase();

function cleanContact(contact: ImportedContact, name: string): NewPerson {
  return {
    name,
    honorificPrefix: cleanText(contact.honorificPrefix),
    givenName: cleanText(contact.givenName),
    additionalName: cleanText(contact.additionalName),
    familyName: cleanText(contact.familyName),
    honorificSuffix: cleanText(contact.honorificSuffix),
    nicknames: cleanList(contact.nicknames),
    emails: cleanList(contact.emails),
    telephones: cleanList(contact.telephones),
    faxNumbers: cleanList(contact.faxNumbers),
    urls: cleanList(contact.urls),
    addresses: (contact.addresses ?? []).flatMap((address) => cleanAddress(address) ?? []),
    organizations: cleanList(contact.organizations),
    jobTitles: cleanList(contact.jobTitles),
    birthDate: contact.birthDate,
    notes: cleanList(contact.notes),
    tags: cleanList(contact.tags),
  };
}

/**
 * Who to add from the contacts. A contact whose name is already in the book is left out, so
 * importing twice doesn't double anyone; one without a name is left out too, as a name is required.
 */
export function planImport(contacts: ImportedContact[], namesInBook: string[]): ImportPlan {
  const known = new Set(namesInBook.map(nameKey));
  const plan: ImportPlan = { people: [], existing: [], unnamed: 0 };

  for (const contact of contacts) {
    const name = cleanText(contact.name);
    if (!name) {
      plan.unnamed++;
      continue;
    }
    if (known.has(nameKey(name))) {
      plan.existing.push(name);
      continue;
    }
    known.add(nameKey(name));
    plan.people.push(cleanContact(contact, name));
  }
  return plan;
}

/**
 * The triples a person is written as, `subject` being their IRI: a schema:Person with the
 * properties of contact-shape.ttl. An address and an organization are blank nodes of their own.
 */
export function personQuads(subject: NamedNode, person: NewPerson): Quad[] {
  const quads: Quad[] = [factory.quad(subject, RDF_TYPE, schema("Person"))];
  const text = (node: Quad_Subject, property: string, value: string | undefined) => {
    if (value) quads.push(factory.quad(node, schema(property), factory.literal(value)));
  };

  text(subject, "name", person.name);
  text(subject, "honorificPrefix", person.honorificPrefix);
  text(subject, "givenName", person.givenName);
  text(subject, "additionalName", person.additionalName);
  text(subject, "familyName", person.familyName);
  text(subject, "honorificSuffix", person.honorificSuffix);
  for (const nickname of person.nicknames ?? []) text(subject, "alternateName", nickname);
  for (const email of person.emails ?? []) text(subject, "email", email);
  for (const telephone of person.telephones ?? []) text(subject, "telephone", telephone);
  for (const fax of person.faxNumbers ?? []) text(subject, "faxNumber", fax);
  for (const url of person.urls ?? []) {
    quads.push(factory.quad(subject, schema("url"), factory.namedNode(url)));
  }

  for (const address of person.addresses ?? []) {
    const node = factory.blankNode();
    quads.push(factory.quad(subject, schema("address"), node));
    text(node, "streetAddress", address.street);
    text(node, "postOfficeBoxNumber", address.postOfficeBox);
    text(node, "postalCode", address.postalCode);
    text(node, "addressLocality", address.locality);
    text(node, "addressRegion", address.region);
    text(node, "addressCountry", address.country);
  }

  for (const organization of person.organizations ?? []) {
    const node = factory.blankNode();
    quads.push(factory.quad(subject, schema("worksFor"), node));
    text(node, "name", organization);
  }
  for (const jobTitle of person.jobTitles ?? []) text(subject, "jobTitle", jobTitle);

  if (person.birthDate) {
    quads.push(
      factory.quad(subject, schema("birthDate"), factory.literal(person.birthDate, xsd("date"))),
    );
  }
  for (const note of person.notes ?? []) text(subject, "description", note);
  for (const tag of person.tags ?? []) text(subject, "keywords", tag);
  return quads;
}

const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);

// What an import did, in a sentence or two.
export function importSummary({ people: added, existing, unnamed }: ImportPlan): string {
  const parts = [added.length ? `Added ${people(added.length)}.` : "No one was added."];
  if (existing.length) {
    parts.push(
      existing.length === 1
        ? `${existing[0]} is already in the book.`
        : `${existing.length} were already in the book.`,
    );
  }
  if (unnamed) {
    parts.push(`${people(unnamed)} without a name ${unnamed === 1 ? "was" : "were"} skipped.`);
  }
  return parts.join(" ");
}
