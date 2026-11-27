// Finding people who are in the book twice: the same name, email address or phone number.

import type { Literal, NamedNode, Source } from "@rdfjs/types";
import { select } from "@shapething/shacl-renderer";
import duplicatesQuery from "./queries/duplicates.rq";

export type DuplicateRow = {
  graph: NamedNode;
  contact: NamedNode;
  name?: Literal;
  email?: Literal;
  telephone?: Literal;
};

export type DuplicatePerson = {
  graph: NamedNode;
  contact: NamedNode;
  names: string[];
  emails: string[];
  telephones: string[];
};

export type DuplicateGroup = {
  // Who they are, the one with the most to say first: the others are merged into them.
  people: DuplicatePerson[];
  // What they have in common, as said to the user.
  reasons: string[];
  // The same for the same people, to remember a group that isn't one.
  key: string;
};

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

// A name whatever its case, accents and order: "Doe, John" and "john dóe" are the same name.
export const nameKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .sort()
    .join(" ");

export const emailKey = (email: string) =>
  email
    .trim()
    .replace(/^mailto:/i, "")
    .toLowerCase();

/**
 * A phone number by its last nine digits, so +31 6 12345678, 0031612345678 and 06-12345678 are the
 * same number. Too short to tell anything by: none.
 */
export const telephoneKey = (telephone: string) => {
  const digits = telephone.replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-9) : undefined;
};

const add = (list: string[], value: string | undefined) => {
  if (value && !list.includes(value)) list.push(value);
};

const richness = (person: DuplicatePerson) => person.emails.length + person.telephones.length;

/** The groups of people that share a name, an email address or a phone number. */
export function findDuplicates(rows: DuplicateRow[]): DuplicateGroup[] {
  const people = new Map<string, DuplicatePerson>();
  for (const { graph, contact, name, email, telephone } of rows) {
    const id = `${graph.value} ${contact.value}`;
    let person = people.get(id);
    if (!person) {
      person = { graph, contact, names: [], emails: [], telephones: [] };
      people.set(id, person);
    }
    add(person.names, name?.value.trim());
    add(person.emails, email?.value.trim());
    add(person.telephones, telephone?.value.trim());
  }

  // Who has what: each key with the people that have it, and how to say it.
  const byKey = new Map<string, { ids: Set<string>; reason: string }>();
  const index = (key: string | undefined, id: string, reason: string) => {
    if (!key) return;
    const entry = byKey.get(key) ?? { ids: new Set(), reason };
    entry.ids.add(id);
    byKey.set(key, entry);
  };
  for (const [id, person] of people) {
    for (const name of person.names) index(`name ${nameKey(name)}`, id, `The same name, ${name}`);
    for (const email of person.emails) {
      index(`email ${emailKey(email)}`, id, `The same email address, ${email}`);
    }
    for (const telephone of person.telephones) {
      const key = telephoneKey(telephone);
      index(key && `telephone ${key}`, id, `The same phone number, ${telephone}`);
    }
  }

  // Joined: when A and B share an address and B and C a number, the three are one group.
  const parent = new Map<string, string>();
  const root = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) return id;
    const top = root(up);
    parent.set(id, top);
    return top;
  };
  const shared = [...byKey.values()].filter(({ ids }) => ids.size > 1);
  for (const { ids } of shared) {
    const [first, ...rest] = [...ids];
    for (const id of rest) parent.set(root(id), root(first));
  }

  const groups = new Map<string, { ids: Set<string>; reasons: string[] }>();
  for (const { ids, reason } of shared) {
    const top = root([...ids][0]);
    const group = groups.get(top) ?? { ids: new Set(), reasons: [] };
    for (const id of ids) group.ids.add(id);
    add(group.reasons, reason);
    groups.set(top, group);
  }

  return [...groups.values()]
    .map(({ ids, reasons }) => {
      const members = [...ids]
        .map((id) => people.get(id)!)
        .sort(
          (a, b) =>
            richness(b) - richness(a) || collator.compare(a.names[0] ?? "", b.names[0] ?? ""),
        );
      return {
        people: members,
        reasons,
        key: members
          .map(({ graph }) => graph.value)
          .sort()
          .join(" "),
      };
    })
    .sort((a, b) => collator.compare(a.people[0].names[0] ?? "", b.people[0].names[0] ?? ""));
}

// The people in the book that may be in it twice. `store` is the book's TextStore.
export async function duplicatesIn(store: Source): Promise<DuplicateGroup[]> {
  return findDuplicates(await select(duplicatesQuery, store));
}
