import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import { rdf, sh } from "@shapething/shacl-renderer";
import { TextStore } from "@shapething/textstore";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import contactShape from "./contact-shape.ttl?raw";
import { tagKey } from "./contacts.ts";
import { fileNameFor, freeFileName } from "./fileName.ts";
import { personQuads, type NewPerson } from "./importPeople.ts";

const factory = new DataFactory();

export const SCHEMA = "https://schema.org/";
export const PERSON = factory.namedNode(`${SCHEMA}Person`);
// A person's tags, see contact-shape.ttl.
const KEYWORDS = factory.namedNode(`${SCHEMA}keywords`);

// The shape every contact is shown and edited through. Written into the folder when it has none
// yet, and never after that: from then on the file belongs to the folder's owner.
export const SHAPE_FILE = "contact-shape.ttl";
// Where new contacts go, one file each.
const CONTACTS_FOLDER = "contacts";

export type AddressBook = {
  name: string;
  // The folder: each Turtle file is a graph, named after its path appended to the base IRI.
  store: LocalStore;
  // The same folder, with fuzzy text search over its literals. All queries go through this one.
  search: TextStore;
};

// Until the folder's .config sets a base IRI, its graphs are named <file:///{folder}/{path}>: a
// name that only finds the file again. Relative IRIs in the files resolve against it.
const folderBase = (folder: string) => `file:///${encodeURIComponent(folder)}/`;

/**
 * Mounts a folder that was opened before (by name) or asks for a new one, and gives it the
 * contact shape when it has none. Reading and writing a folder needs permission, given again on
 * every visit unless the browser remembers it: with `interactive` it is asked for, which only
 * works right after a click.
 */
export async function openAddressBook(
  name: string | undefined,
  { interactive }: { interactive: boolean },
): Promise<AddressBook | undefined> {
  const store = new LocalStore({ baseUri: new URL("file:///") });
  await store.mount(name);
  const handle = store.getDirectoryHandle();
  if (!handle) return undefined;

  const mode = { mode: "readwrite" } as const;
  const permission = interactive
    ? await handle.requestPermission(mode)
    : await handle.queryPermission(mode);
  if (permission !== "granted") return undefined;

  await addContactShape(handle);
  // Names the graphs after this folder. Setting the base IRI also makes the store forget the files
  // it listed while mounting, before the shape file was there.
  store.setBaseUri(new URL(folderBase(handle.name)));
  // The .config could not be read while mounting when permission was only given just now.
  await store.loadConfig();
  return { name: handle.name, store, search: new TextStore({ store }) };
}

// Written as text, so the explanation at the top of the file stays in it.
async function addContactShape(handle: FileSystemDirectoryHandle) {
  try {
    await handle.getFileHandle(SHAPE_FILE);
    return;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }
  const file = await handle.getFileHandle(SHAPE_FILE, { create: true });
  const writable = await file.createWritable();
  await writable.write(contactShape);
  await writable.close();
}

// The graph of a file in the folder, by its path without .ttl: contacts/x is <{base}contacts/x>.
const graphOf = ({ store }: AddressBook, path: string) =>
  factory.namedNode(store.getBaseUri().toString() + encodeURI(path));

export const shapeGraph = (book: AddressBook) => graphOf(book, SHAPE_FILE.replace(/\.ttl$/, ""));

/**
 * Who a new person is while they're being added: their name, and so their file, is only known when
 * the form is saved (see saveNewContact). Never written: unique, so it reads as no one.
 */
export const draftContactGraph = (book: AddressBook) =>
  graphOf(book, `${CONTACTS_FOLDER}/draft-${crypto.randomUUID()}`);

async function isContactFile(book: AddressBook, fileName: string) {
  try {
    const contacts = await book.store.getDirectoryHandle()!.getDirectoryHandle(CONTACTS_FOLDER);
    await contacts.getFileHandle(`${fileName}.ttl`);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return false;
    throw error;
  }
}

// The graph, and so the file, of a new person: named after them, contacts/ada-lovelace.ttl.
async function contactGraphFor(book: AddressBook, name: string) {
  const fileName = await freeFileName(fileNameFor(name), (fileName) =>
    isContactFile(book, fileName),
  );
  return graphOf(book, `${CONTACTS_FOLDER}/${fileName}`);
}

// The IRI `from` becomes `to` everywhere in the quads, and so do IRIs of fragments of it (#...).
const renameIri = (quads: Quad[], from: NamedNode, to: NamedNode): Quad[] => {
  const rename = <T extends Quad["subject"] | Quad["object"]>(term: T): T => {
    if (term.termType !== "NamedNode") return term;
    if (term.value === from.value) return to as T;
    if (term.value.startsWith(`${from.value}#`)) {
      return factory.namedNode(to.value + term.value.slice(from.value.length)) as T;
    }
    return term;
  };
  return quads.map((quad) =>
    factory.quad(rename(quad.subject), quad.predicate, rename(quad.object)),
  );
};

// The triples of one graph, in the default graph: how the renderer reads and writes them.
async function readGraph({ store }: AddressBook, graph: NamedNode): Promise<RdfStore> {
  const result = RdfStore.createDefault();
  // The stream is async iterable, the RDF/JS Stream type just does not say so.
  for await (const quad of store.match(null, null, null, graph) as unknown as AsyncIterable<Quad>) {
    result.addQuad(factory.quad(quad.subject, quad.predicate, quad.object));
  }
  return result;
}

export type ContactShapes = {
  shapesGraph: RdfStore;
  // The node shapes that target schema:Person, the ones a contact is shown and edited through.
  nodeShapes: Quad_Subject[];
};

/**
 * The contact shape as it is in the folder. Read once per opened folder: the store keeps what it
 * has parsed, so a change made to the file outside the address book shows after reopening it.
 */
export async function readShapes(book: AddressBook): Promise<ContactShapes> {
  const shapesGraph = await readGraph(book, shapeGraph(book));
  const nodeShapes = shapesGraph
    .getQuads(null, sh("targetClass"), PERSON)
    .map((quad) => quad.subject);
  return { shapesGraph, nodeShapes };
}

export type ContactData = {
  dataGraph: RdfStore;
  // The schema:Person in the graph, or the graph's own IRI for a new contact.
  focusNode: NamedNode;
};

export async function readContact(book: AddressBook, graph: NamedNode): Promise<ContactData> {
  const dataGraph = await readGraph(book, graph);
  const person = dataGraph
    .getQuads(null, rdf("type"), PERSON)
    .find((quad) => quad.subject.termType === "NamedNode")?.subject as NamedNode | undefined;
  return { dataGraph, focusNode: person ?? graph };
}

// The literals changed, so the search index is built again. Not waited for: a search waits for it
// itself, and fails with its error when the index can't be built.
const reindex = (book: AddressBook) => void book.search.reindex().catch(() => undefined);

/**
 * Writes the contact's graph, as a whole: blank nodes can't be matched for deletion between two
 * parses of the file. Creates the file of a new contact.
 */
export async function saveContact(book: AddressBook, graph: NamedNode, quads: Quad[]) {
  await book.store.replaceGraph(graph, quads, { schema: SCHEMA });
  reindex(book);
}

/**
 * Writes a new person, entered in the form as `draft`, to a file named after their schema:name.
 * Returns their graph.
 */
export async function saveNewContact(book: AddressBook, draft: NamedNode, quads: Quad[]) {
  const name = quads.find(
    (quad) =>
      quad.subject.equals(draft) &&
      quad.predicate.value === `${SCHEMA}name` &&
      quad.object.termType === "Literal",
  )?.object.value;
  const graph = await contactGraphFor(book, name ?? "");
  await saveContact(book, graph, renameIri(quads, draft, graph));
  return graph;
}

/**
 * Adds people, each in a file of their own named after them, with the properties of the contact
 * shape (see personQuads). The search index is built again once, after the last one.
 */
export async function addPeople(book: AddressBook, people: NewPerson[]) {
  try {
    for (const person of people) {
      const graph = await contactGraphFor(book, person.name);
      await book.store.replaceGraph(graph, personQuads(graph, person), { schema: SCHEMA });
    }
  } finally {
    // Also after a failure part way: who was written is found.
    reindex(book);
  }
}

/**
 * Gives every one of the people (their graphs) the tag, as a schema:keywords of the schema:Person
 * in their file. Someone who has it already, in any case, is left as they are. Returns how many
 * people got it.
 */
export async function addTag(book: AddressBook, graphs: NamedNode[], tag: string) {
  const value = tag.trim();
  const key = tagKey(value);
  let tagged = 0;
  try {
    for (const graph of graphs) {
      const { dataGraph, focusNode } = await readContact(book, graph);
      const has = dataGraph
        .getQuads(focusNode, KEYWORDS)
        .some(({ object }) => object.termType === "Literal" && tagKey(object.value) === key);
      if (has || dataGraph.size === 0) continue;
      const quads = [
        ...dataGraph.getQuads(),
        factory.quad(focusNode, KEYWORDS, factory.literal(value)),
      ];
      await book.store.replaceGraph(graph, quads, { schema: SCHEMA });
      tagged++;
    }
  } finally {
    // Also after a failure part way: who was tagged is found.
    if (tagged) reindex(book);
  }
  return tagged;
}

// Blank nodes from another file, renamed so they can't be taken for those of this one.
const renameBlankNodes = (quads: Quad[], prefix: string): Quad[] => {
  const rename = <T extends Quad["subject"] | Quad["object"]>(term: T): T =>
    term.termType === "BlankNode" ? (factory.blankNode(`${prefix}_${term.value}`) as T) : term;
  return quads.map((quad) =>
    factory.quad(rename(quad.subject), quad.predicate, rename(quad.object)),
  );
};

const termId = (term: Quad["object"]) =>
  term.termType === "Literal"
    ? `"${term.value}"@${term.language}^^${term.datatype.value}`
    : `${term.termType} ${term.value}`;

/**
 * The quads without the blank nodes of `subject` that say the same as one before them: two
 * people's identical address, merged, is one address. Blank nodes with blank nodes in them are
 * kept, as they can't be told apart this simply.
 */
export function withoutDoubleBlankNodes(quads: Quad[], subject: NamedNode): Quad[] {
  const about = (node: Quad["object"]) => quads.filter((quad) => quad.subject.equals(node));
  const seen = new Set<string>();
  const dropped = new Set<string>();
  for (const quad of quads) {
    if (!quad.subject.equals(subject) || quad.object.termType !== "BlankNode") continue;
    const own = about(quad.object);
    if (own.some(({ object }) => object.termType === "BlankNode")) continue;
    const signature = [
      quad.predicate.value,
      ...own.map(({ predicate, object }) => `${predicate.value} ${termId(object)}`).sort(),
    ].join("\n");
    if (seen.has(signature)) dropped.add(quad.object.value);
    seen.add(signature);
  }
  return quads.filter(
    ({ subject, object }) =>
      !(subject.termType === "BlankNode" && dropped.has(subject.value)) &&
      !(object.termType === "BlankNode" && dropped.has(object.value)),
  );
}

/**
 * The people (their graphs) as one: everything each of them has, said of the first. Not written:
 * it is shown in the form, where the user picks between what they had differently (two names),
 * and saved from there (see saveMerged).
 */
export async function mergeContacts(
  book: AddressBook,
  [keep, ...others]: NamedNode[],
): Promise<ContactData> {
  const kept = await readContact(book, keep);
  const quads = kept.dataGraph.getQuads();
  for (const [index, graph] of others.entries()) {
    const other = await readContact(book, graph);
    quads.push(
      ...renameBlankNodes(
        renameIri(other.dataGraph.getQuads(), other.focusNode, kept.focusNode),
        `merged${index}`,
      ),
    );
  }
  const dataGraph = RdfStore.createDefault();
  for (const quad of withoutDoubleBlankNodes(quads, kept.focusNode)) dataGraph.addQuad(quad);
  return { dataGraph, focusNode: kept.focusNode };
}

/** Writes the merged person to the file of the first, and deletes the files of the others. */
export async function saveMerged(book: AddressBook, [keep, ...others]: NamedNode[], quads: Quad[]) {
  await saveContact(book, keep, quads);
  for (const graph of others) await deleteContact(book, graph);
}

// Deletes the contact's file.
export async function deleteContact(book: AddressBook, graph: NamedNode) {
  await new Promise<void>((resolve, reject) => {
    const deletion = book.store.deleteGraph(graph);
    deletion.on("end", resolve);
    deletion.on("error", reject);
  });
  reindex(book);
}
