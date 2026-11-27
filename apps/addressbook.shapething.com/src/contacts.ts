import type { Literal, NamedNode, Source } from "@rdfjs/types";
import { select } from "@shapething/shacl-renderer";
import { DataFactory } from "rdf-data-factory";
import contactsQuery from "./queries/contacts.rq";
import searchQuery from "./queries/search.rq";

const factory = new DataFactory();

export type ContactRow = { graph: NamedNode; contact: NamedNode; name?: Literal; tag?: Literal };

export type ContactListItem = {
  // The contact's graph: its file in the folder.
  graph: NamedNode;
  contact: NamedNode;
  // Its schema:name, or its IRI's last part when it has none.
  label: string;
  // Its tags (schema:keywords), by name.
  tags: string[];
};

const lastPart = (iri: string) =>
  decodeURIComponent(iri.split(/[/#]/).filter(Boolean).pop() ?? iri);

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

// Tags are the same tag whatever their case: "Family" is "family".
export const tagKey = (tag: string) => tag.trim().normalize("NFC").toLocaleLowerCase();

export const hasTag = (item: ContactListItem, tag: string) =>
  item.tags.some((own) => tagKey(own) === tagKey(tag));

/**
 * One item per contact, by name, with its tags. A contact comes back in a row per name, tag and
 * text matching a search: its first name is kept.
 */
export function toListItems(rows: ContactRow[]): ContactListItem[] {
  const items = new Map<string, ContactListItem>();
  for (const { graph, contact, name, tag } of rows) {
    const key = `${graph.value} ${contact.value}`;
    let item = items.get(key);
    if (!item) {
      item = { graph, contact, label: name?.value || lastPart(contact.value), tags: [] };
      items.set(key, item);
    }
    if (tag?.value.trim() && !hasTag(item, tag.value)) item.tags.push(tag.value.trim());
  }
  for (const item of items.values()) item.tags.sort(collator.compare);
  return [...items.values()].sort(
    (a, b) => collator.compare(a.label, b.label) || a.graph.value.localeCompare(b.graph.value),
  );
}

export type TagCount = { tag: string; count: number };

/** Every tag in the list, by name, with how many people have it. */
export function tagCounts(items: ContactListItem[]): TagCount[] {
  const counts = new Map<string, TagCount>();
  for (const item of items) {
    for (const tag of item.tags) {
      const count = counts.get(tagKey(tag)) ?? { tag, count: 0 };
      count.count++;
      counts.set(tagKey(tag), count);
    }
  }
  return [...counts.values()].sort((a, b) => collator.compare(a.tag, b.tag));
}

// A tag in the filter: only the people with it are shown, or only the people without it.
export type TagRule = { tag: string; mode: "only" | "not" };

// The people who follow every one of the rules.
export const withTags = (items: ContactListItem[], rules: TagRule[]) =>
  items.filter((item) => rules.every(({ tag, mode }) => hasTag(item, tag) === (mode === "only")));

// Every contact in the folder.
export async function listContacts(store: Source): Promise<ContactListItem[]> {
  return toListItems(await select(contactsQuery, store));
}

// The contacts with text that matches `text`. `store` answers the search, a TextStore.
export async function searchContacts(store: Source, text: string): Promise<ContactListItem[]> {
  return toListItems(await select(searchQuery, store, { search: factory.literal(text) }));
}
