import type { NamedNode } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import { ShaclRenderer } from "@shapething/shacl-renderer";
import { Suspense, startTransition, use, useEffect, useRef, useState } from "react";
import {
  addPeople,
  addTag,
  deleteContact,
  draftContactGraph,
  mergeContacts,
  openAddressBook,
  readContact,
  readShapes,
  saveContact,
  saveMerged,
  saveNewContact,
  SHAPE_FILE,
  type AddressBook,
  type ContactShapes,
} from "./addressBook.ts";
import {
  listContacts,
  searchContacts,
  tagCounts,
  tagKey,
  withTags,
  type ContactListItem,
  type TagRule,
  type TagCount,
} from "./contacts.ts";
import { duplicatesIn, type DuplicateGroup } from "./duplicates.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { importSummary, planImport } from "./importPeople.ts";
import { parseVCards } from "./vcard.ts";

// The folder and the open person (their graph) are kept in the query string, to come back to.
const readParam = (name: string) => new URLSearchParams(location.search).get(name) ?? undefined;

function writeParams(params: { folder?: string; contact?: string }) {
  const search = new URLSearchParams();
  if (params.folder) search.set("folder", params.folder);
  if (params.contact) search.set("contact", params.contact);
  history.replaceState(null, "", `${location.pathname}${search.size ? `?${search}` : ""}`);
}

const supported = typeof globalThis.showDirectoryPicker === "function";

// vCard files, by extension or by type: not every system knows the type of a .vcf file.
const isVCardFile = (file: File) =>
  /\.(vcf|vcard)$/i.test(file.name) || /^text\/(x-)?vcard$/i.test(file.type);

// Reopens the folder of the last visit, when the browser still has permission for it.
const initialBook = (() => {
  const name = readParam("folder");
  return name && supported
    ? openAddressBook(name, { interactive: false }).catch(() => undefined)
    : Promise.resolve(undefined);
})();

// The folders opened before, read again every time the folder picker shows.
const listMounts = (): Promise<string[]> =>
  supported ? LocalStore.listMounts().catch(() => []) : Promise.resolve([]);

const Waiting = ({ children }: { children: string }) => <p className="waiting">{children}</p>;

export function App() {
  return (
    <Suspense fallback={<Waiting>Opening…</Waiting>}>
      <Shell />
    </Suspense>
  );
}

function Shell() {
  const [book, setBook] = useState<AddressBook | undefined>(use(initialBook));
  const [error, setError] = useState<string>();
  const [mountsPromise, setMountsPromise] = useState(listMounts);

  const open = async (name?: string) => {
    setError(undefined);
    const opened = await openAddressBook(name, { interactive: true }).catch((error: unknown) => {
      setError(String(error));
      return undefined;
    });
    if (!opened) return;
    writeParams({ folder: opened.name });
    setBook(opened);
  };

  const close = () => {
    writeParams({});
    setMountsPromise(listMounts());
    setBook(undefined);
  };

  if (!book) {
    return (
      // Its own boundary: Shell keeps its state while the picker waits for the folder list.
      <Suspense fallback={<Waiting>Opening…</Waiting>}>
        <FolderPicker mountsPromise={mountsPromise} onOpen={open} error={error} />
      </Suspense>
    );
  }
  return <Book key={book.name} book={book} onClose={close} />;
}

type FolderPickerProps = {
  mountsPromise: Promise<string[]>;
  onOpen: (name?: string) => void;
  error?: string;
};

function FolderPicker({ mountsPromise, onOpen, error }: FolderPickerProps) {
  const [mounts, setMounts] = useState(use(mountsPromise));
  const [removeError, setRemoveError] = useState<string>();

  // Only the connection is forgotten, the folder on disk stays as it is.
  const remove = async (name: string) => {
    setRemoveError(undefined);
    try {
      await LocalStore.removeMount(name);
      setMounts((mounts) => mounts.filter((mount) => mount !== name));
    } catch (error) {
      setRemoveError(String(error));
    }
  };

  return (
    <main className="cover">
      <h1 className="cover__title">Address book</h1>
      <p className="cover__lede">
        Your contacts, kept in a folder on this computer: one file per person, nothing sent
        anywhere. What a person holds is written in the folder's <code>{SHAPE_FILE}</code>, so you
        can change it.
      </p>
      {!supported ? (
        <p className="notice notice--error">
          This browser can't open folders on your computer. Open this page in Chrome or Edge.
        </p>
      ) : (
        <>
          <button type="button" className="button button--primary" onClick={() => onOpen()}>
            Open a folder
          </button>
          {mounts.length > 0 && (
            <section className="cover__recent" aria-labelledby="recent-title">
              <h2 id="recent-title" className="cover__subtitle">
                Opened before
              </h2>
              <ul className="ruled">
                {mounts.map((name) => (
                  <li key={name} className="ruled__row cover__folder">
                    <button type="button" className="cover__open" onClick={() => onOpen(name)}>
                      {name}
                    </button>
                    <button
                      type="button"
                      className="button button--quiet"
                      aria-label={`Forget ${name}`}
                      title="Removes it from this list. The folder itself is kept."
                      onClick={() => remove(name)}
                    >
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {error && <p className="notice notice--error">{error}</p>}
      {removeError && <p className="notice notice--error">{removeError}</p>}
    </main>
  );
}

// A list that could not be read shows its error in place, so the next search can still replace it.
// The tags are everyone's, also while a search shows only some people.
type ListResult = { contacts: ContactListItem[]; tags: TagCount[] } | { error: unknown };

const fetchList = (book: AddressBook, text: string): Promise<ListResult> =>
  Promise.all([
    text ? searchContacts(book.search, text) : undefined,
    listContacts(book.search),
  ]).then(
    ([found, everyone]) => ({ contacts: found ?? everyone, tags: tagCounts(everyone) }),
    (error: unknown) => ({ error }),
  );

// Who is being edited in the dialog: someone in the book, or a new person, saved on Save. Or people
// that are the same person, as one: the first, with everything the others have (see mergeContacts).
type Editing = { graph: NamedNode; isNew: boolean; name?: string; merge?: NamedNode[] };

// The groups someone said aren't the same person, by folder: kept in this browser only.
const notDuplicatesKey = (book: AddressBook) => `addressbook:not-duplicates:${book.name}`;

function readNotDuplicates(book: AddressBook): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(notDuplicatesKey(book)) ?? "[]");
    return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function writeNotDuplicates(book: AddressBook, keys: string[]) {
  try {
    localStorage.setItem(notDuplicatesKey(book), JSON.stringify(keys));
  } catch {
    // Not kept: the group shows again next time.
  }
}

function Book({ book, onClose }: { book: AddressBook; onClose: () => void }) {
  // Read once: the shape decides how every person is shown and edited.
  const [shapesPromise] = useState(() => readShapes(book));
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [listPromise, setListPromise] = useState(() => fetchList(book, ""));
  const searchTimeout = useRef<number>(undefined);
  const [openGraph, setOpenGraph] = useState(readParam("contact"));
  const [editing, setEditing] = useState<Editing>();
  // Bumped on every save, so the open person is read again.
  const [revision, setRevision] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ text: string; isError?: boolean }>();
  // Which tags the listed people have, and which they don't.
  const [tagFilter, setTagFilter] = useState<TagRule[]>([]);
  // Picking people to tag: who is picked, by graph. Kept while searching for more.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Map<string, ContactListItem>>(new Map());
  // The duplicates found, while their dialog is open.
  const [duplicates, setDuplicates] = useState<Promise<DuplicateGroup[]>>();
  const findDuplicates = () => setDuplicates(duplicatesIn(book.search));

  // The list shows what it had until the next one is there, see startTransition.
  const refreshList = (search: string) => {
    const promise = fetchList(book, search);
    startTransition(() => {
      setListPromise(promise);
      setQuery(search);
    });
  };

  const search = (value: string) => {
    setText(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = window.setTimeout(() => refreshList(value.trim()), 200);
  };

  const open = (graph?: string) => {
    writeParams({ folder: book.name, contact: graph });
    setOpenGraph(graph);
  };

  // Adds the people in vCard files, chosen with the button or dropped on the page.
  const importFiles = async (files: File[]) => {
    setImportMessage(undefined);
    const vCards = files.filter(isVCardFile);
    if (vCards.length === 0) {
      setImportMessage({
        text: "Only vCard files (.vcf) can be imported. Export your contacts as one from your phone.",
        isError: true,
      });
      return;
    }
    setImporting(true);
    try {
      const contacts = (await Promise.all(vCards.map((file) => file.text()))).flatMap(parseVCards);
      if (contacts.length === 0) {
        setImportMessage({ text: "There are no contacts in this file.", isError: true });
        return;
      }
      const inBook = await listContacts(book.search);
      const plan = planImport(
        contacts,
        inBook.map(({ label }) => label),
      );
      await addPeople(book, plan.people);
      setImportMessage({ text: importSummary(plan) });
      refreshList(text.trim());
    } catch (error) {
      setImportMessage({
        text: `The contacts could not be imported: ${String(error)}`,
        isError: true,
      });
      refreshList(text.trim());
    } finally {
      setImporting(false);
    }
  };

  // Gives the picked people the tag. Returns what to say about it.
  const tagPicked = async (tag: string) => {
    const tagged = await addTag(
      book,
      [...picked.values()].map(({ graph }) => graph),
      tag,
    );
    setRevision((revision) => revision + 1);
    refreshList(text.trim());
    const already = picked.size - tagged;
    return [
      tagged ? `Added “${tag}” to ${peopleCount(tagged)}.` : "",
      already ? `${peopleCount(already)} had it already.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const stopPicking = () => {
    setPicking(false);
    setPicked(new Map());
  };

  const [dragging, setDragging] = useState(false);
  const isFileDrag = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");

  return (
    <div
      className={dragging ? "book book--dropping" : "book"}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // Only when leaving the page, not when moving between the elements on it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setDragging(false);
        void importFiles([...event.dataTransfer.files]);
      }}
    >
      <header className="book__bar">
        <div className="book__folder">
          <span className="book__name" title="The folder this address book is kept in">
            {book.name}
          </span>
          <button type="button" className="button button--quiet" onClick={onClose}>
            Close folder
          </button>
        </div>
        <div className="book__tools">
          <label
            className={importing ? "button button--busy" : "button"}
            title="A vCard file (.vcf), as your phone's Contacts app exports it. You can also drop it on the page."
          >
            <input
              type="file"
              className="visually-hidden"
              accept=".vcf,.vcard,text/vcard,text/x-vcard"
              multiple
              disabled={importing}
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])];
                // Cleared, so choosing the same file again is a change too.
                event.currentTarget.value = "";
                void importFiles(files);
              }}
            />
            {importing ? "Importing…" : "Import contacts"}
          </label>
          <button
            type="button"
            className="button"
            title="People who are in the book twice, by name, email address or phone number"
            onClick={findDuplicates}
          >
            Find duplicates
          </button>
        </div>
      </header>

      <div className="finder">
        <search className="finder__search">
          <label className="finder__field">
            <span className="visually-hidden">Find someone</span>
            <svg className="finder__icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <input
              type="search"
              className="finder__input"
              placeholder="Find someone"
              autoComplete="off"
              spellCheck={false}
              value={text}
              onChange={(event) => search(event.currentTarget.value)}
            />
          </label>
        </search>
        <div className="finder__actions">
          <button
            type="button"
            className="button"
            aria-pressed={picking}
            onClick={() => (picking ? stopPicking() : setPicking(true))}
            title="Pick people from the list and give them all the same tag"
          >
            Tag people
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setEditing({ graph: draftContactGraph(book), isNew: true })}
          >
            Add person
          </button>
        </div>
      </div>

      {importMessage && (
        <p
          className={
            importMessage.isError ? "notice notice--error import-notice" : "notice import-notice"
          }
          role="status"
        >
          {importMessage.text}
        </p>
      )}

      <Suspense fallback={<Waiting>Reading the folder…</Waiting>}>
        <People
          listPromise={listPromise}
          query={query}
          tagFilter={tagFilter}
          onTagFilter={setTagFilter}
          picking={
            picking
              ? { picked, onPick: setPicked, onTag: tagPicked, onDone: stopPicking }
              : undefined
          }
          openGraph={openGraph}
          onToggle={(graph, isOpen) => {
            if (isOpen) open(graph);
            // Opening someone else closes this one: only forget the one that is open.
            else if (graph === openGraph) open();
          }}
          renderPerson={(person) => (
            <ErrorBoundary
              key={`${person.graph.value} ${revision}`}
              fallback={(error) => <p className="notice notice--error">{String(error)}</p>}
            >
              <Person
                book={book}
                shapesPromise={shapesPromise}
                graph={person.graph}
                onEdit={() => setEditing({ graph: person.graph, isNew: false, name: person.label })}
                onDeleted={() => {
                  open();
                  refreshList(text.trim());
                }}
              />
            </ErrorBoundary>
          )}
          onAdd={() => setEditing({ graph: draftContactGraph(book), isNew: true })}
        />
      </Suspense>

      <DuplicatesDialog
        book={book}
        duplicates={duplicates}
        onClose={() => setDuplicates(undefined)}
        onMerge={(group) => {
          setDuplicates(undefined);
          const [keep] = group.people;
          setEditing({
            graph: keep.graph,
            isNew: false,
            name: keep.names[0],
            merge: group.people.map(({ graph }) => graph),
          });
        }}
      />

      <EditDialog
        book={book}
        shapesPromise={shapesPromise}
        editing={editing}
        onClose={() => {
          // Merging is done from the duplicates: back to them.
          if (editing?.merge) findDuplicates();
          setEditing(undefined);
        }}
        onSaved={(graph) => {
          if (editing?.merge) findDuplicates();
          setEditing(undefined);
          setRevision((revision) => revision + 1);
          open(graph.value);
          refreshList(text.trim());
        }}
      />
    </div>
  );
}

// Grouped by the first letter of the name, as an address book is: A to Z, then the rest.
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const OTHER = "#";

const letterOf = (label: string) => {
  const letter = label.normalize("NFD").charAt(0).toUpperCase();
  return LETTERS.includes(letter) ? letter : OTHER;
};

const peopleCount = (count: number) => (count === 1 ? "1 person" : `${count} people`);

// What a click on a tag does: off, then only the people with it, then only the ones without it.
const NEXT_MODE = { off: "only", only: "not", not: "off" } as const;

const MODE_TEXT = {
  off: "",
  only: "showing only these",
  not: "leaving these out",
} as const;

// The tags in the list, each to show only the people with it or to leave them out.
function TagFilter({
  tags,
  rules,
  onChange,
}: {
  tags: TagCount[];
  rules: TagRule[];
  onChange: (rules: TagRule[]) => void;
}) {
  if (tags.length === 0) return null;
  const modeOf = (tag: string) =>
    rules.find((rule) => tagKey(rule.tag) === tagKey(tag))?.mode ?? "off";
  // A tag in the filter that nobody has any more stays, so it can be turned off.
  const shown = [
    ...tags,
    ...rules
      .filter(({ tag }) => !tags.some((count) => tagKey(count.tag) === tagKey(tag)))
      .map(({ tag }) => ({ tag, count: 0 })),
  ];
  const cycle = (tag: string) => {
    const next = NEXT_MODE[modeOf(tag)];
    const others = rules.filter((rule) => tagKey(rule.tag) !== tagKey(tag));
    // A tag keeps its place in the filter as it goes from only to not.
    const at = rules.findIndex((rule) => tagKey(rule.tag) === tagKey(tag));
    if (next === "off") onChange(others);
    else if (at === -1) onChange([...rules, { tag, mode: next }]);
    else onChange(rules.map((rule, index) => (index === at ? { tag, mode: next } : rule)));
  };

  return (
    <div className="tag-filter" role="group" aria-label="Filter by tag">
      {shown.map(({ tag, count }) => {
        const mode = modeOf(tag);
        return (
          <button
            key={tagKey(tag)}
            type="button"
            className="tag"
            data-mode={mode}
            title={
              mode === "off"
                ? "Show only the people with this tag"
                : mode === "only"
                  ? "Leave out the people with this tag"
                  : "Stop filtering by this tag"
            }
            onClick={() => cycle(tag)}
          >
            {mode === "not" && (
              <span className="tag__not" aria-hidden="true">
                not
              </span>
            )}
            <span className="tag__name">{tag}</span>
            <span className="tag__count" aria-label={`, ${peopleCount(count)}`}>
              {count}
            </span>
            {mode !== "off" && <span className="visually-hidden">, {MODE_TEXT[mode]}</span>}
          </button>
        );
      })}
      {rules.length > 0 ? (
        <button type="button" className="button button--quiet" onClick={() => onChange([])}>
          Show everyone
        </button>
      ) : (
        <span className="tag-filter__hint">
          Click a tag to show only those, twice to leave them out.
        </span>
      )}
    </div>
  );
}

const Tags = ({ tags }: { tags: string[] }) =>
  tags.length > 0 && (
    <span className="person__tags">
      {tags.map((tag) => (
        <span key={tagKey(tag)} className="tag tag--small">
          {tag}
        </span>
      ))}
    </span>
  );

type Picking = {
  picked: Map<string, ContactListItem>;
  onPick: (picked: Map<string, ContactListItem>) => void;
  // Tags the picked people, and says how that went.
  onTag: (tag: string) => Promise<string>;
  onDone: () => void;
};

// Below the list while picking: who is picked, and the tag to give them.
function Tagger({
  picking: { picked, onPick, onTag, onDone },
  shown,
  tags,
}: {
  picking: Picking;
  shown: ContactListItem[];
  tags: TagCount[];
}) {
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean }>();

  const allShownPicked = shown.length > 0 && shown.every(({ graph }) => picked.has(graph.value));
  const pickShown = (pick: boolean) => {
    const next = new Map(picked);
    for (const person of shown) {
      if (pick) next.set(person.graph.value, person);
      else next.delete(person.graph.value);
    }
    onPick(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Written as the book has it already, when it has it in another case.
    const value = tags.find((count) => tagKey(count.tag) === tagKey(tag))?.tag ?? tag.trim();
    if (!value || picked.size === 0) return;
    setBusy(true);
    setMessage(undefined);
    try {
      setMessage({ text: await onTag(value) });
      setTag("");
      // Tagged: the next tag is for other people.
      onPick(new Map());
    } catch (error) {
      setMessage({ text: `The tag could not be added: ${String(error)}`, isError: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tagger" aria-label="Tag the picked people">
      <div className="tagger__picked">
        <strong>
          {picked.size === 0 ? "Pick people above" : `${peopleCount(picked.size)} picked`}
        </strong>
        {shown.length > 0 && (
          <button
            type="button"
            className="button button--quiet"
            onClick={() => pickShown(!allShownPicked)}
          >
            {allShownPicked ? "Unpick the ones shown" : `Pick all ${shown.length} shown`}
          </button>
        )}
        {picked.size > 0 && !allShownPicked && (
          <button type="button" className="button button--quiet" onClick={() => onPick(new Map())}>
            Unpick all
          </button>
        )}
      </div>
      <form className="tagger__form" onSubmit={submit}>
        <label className="tagger__field">
          <span className="visually-hidden">Tag</span>
          <input
            className="tagger__input"
            list="tagger-tags"
            placeholder="A tag, such as family"
            autoComplete="off"
            value={tag}
            onChange={(event) => setTag(event.currentTarget.value)}
          />
        </label>
        <datalist id="tagger-tags">
          {tags.map(({ tag }) => (
            <option key={tagKey(tag)} value={tag} />
          ))}
        </datalist>
        <button
          type="submit"
          className={busy ? "button button--primary button--busy" : "button button--primary"}
          disabled={busy || picked.size === 0 || !tag.trim()}
        >
          {busy ? "Adding…" : "Add tag"}
        </button>
        <button type="button" className="button button--quiet" onClick={onDone}>
          Done
        </button>
      </form>
      {message && (
        <p
          className={
            message.isError ? "notice notice--error tagger__message" : "notice tagger__message"
          }
          role="status"
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

type PeopleProps = {
  listPromise: Promise<ListResult>;
  query: string;
  tagFilter: TagRule[];
  onTagFilter: (rules: TagRule[]) => void;
  picking?: Picking;
  openGraph?: string;
  onToggle: (graph: string, isOpen: boolean) => void;
  renderPerson: (person: ContactListItem) => React.ReactNode;
  onAdd: () => void;
};

function People({
  listPromise,
  query,
  tagFilter,
  onTagFilter,
  picking,
  openGraph,
  onToggle,
  renderPerson,
  onAdd,
}: PeopleProps) {
  const result = use(listPromise);
  // Where a shift-click picks from: the person picked or unpicked last.
  const lastPick = useRef<string>(undefined);
  if ("error" in result) {
    return (
      <p className="notice notice--error">The folder could not be read: {String(result.error)}</p>
    );
  }
  const contacts = withTags(result.contacts, tagFilter);
  const filters = <TagFilter tags={result.tags} rules={tagFilter} onChange={onTagFilter} />;
  const tagger = picking && <Tagger picking={picking} shown={contacts} tags={result.tags} />;

  // What the list is: everyone, or who matches the search and has the tags.
  const describe = (count: string) =>
    [
      count,
      query && `match${count === "1 person" || count === "No one" ? "es" : ""} “${query}”`,
      tagFilter.length > 0 &&
        tagFilter
          .map(({ tag, mode }) => `${mode === "only" ? "tagged" : "not tagged"} “${tag}”`)
          .join(" and "),
    ]
      .filter(Boolean)
      .join(" ");

  const pick = (person: ContactListItem, isPicked: boolean, range: boolean) => {
    if (!picking) return;
    const next = new Map(picking.picked);
    const from = contacts.findIndex(({ graph }) => graph.value === lastPick.current);
    const to = contacts.indexOf(person);
    const people =
      range && from !== -1 ? contacts.slice(Math.min(from, to), Math.max(from, to) + 1) : [person];
    for (const one of people) {
      if (isPicked) next.set(one.graph.value, one);
      else next.delete(one.graph.value);
    }
    lastPick.current = person.graph.value;
    picking.onPick(next);
  };

  if (contacts.length === 0) {
    if (query || tagFilter.length > 0) {
      return (
        <>
          {filters}
          <p className="status">{describe("No one")}.</p>
          {tagger}
        </>
      );
    }
    return (
      <div className="status">
        <p>No one in this address book yet.</p>
        <button type="button" className="button button--primary" onClick={onAdd}>
          Add the first person
        </button>
      </div>
    );
  }

  const groups = new Map<string, ContactListItem[]>();
  for (const contact of contacts) {
    const letter = letterOf(contact.label);
    groups.set(letter, [...(groups.get(letter) ?? []), contact]);
  }
  const letters = [...LETTERS, OTHER].filter((letter) => groups.has(letter));

  return (
    <>
      {filters}
      <p className="status" role="status">
        {describe(peopleCount(contacts.length))}
      </p>

      <nav className="thumb-index" aria-label="Jump to a letter">
        {[...LETTERS, OTHER].map((letter) =>
          groups.has(letter) ? (
            <a key={letter} className="thumb-index__tab" href={`#letter-${letter}`}>
              {letter}
            </a>
          ) : (
            <span key={letter} className="thumb-index__tab" aria-hidden="true">
              {letter}
            </span>
          ),
        )}
      </nav>

      <div className="people">
        {letters.map((letter) => (
          <section key={letter} id={`letter-${letter}`} className="letter" aria-label={letter}>
            <h2 className="letter__heading" aria-hidden="true">
              {letter}
            </h2>
            <ul className="ruled">
              {groups.get(letter)!.map((person) => {
                if (picking) {
                  return (
                    <li key={person.graph.value} className="ruled__row">
                      <label className="person person--pick">
                        <input
                          type="checkbox"
                          className="person__check"
                          checked={picking.picked.has(person.graph.value)}
                          // Picked on click, for the shift key: shift-click picks everyone between.
                          onChange={() => {}}
                          onClick={(event) =>
                            pick(person, event.currentTarget.checked, event.shiftKey)
                          }
                        />
                        <span className="person__name">{person.label}</span>
                        <Tags tags={person.tags} />
                      </label>
                    </li>
                  );
                }
                const isOpen = person.graph.value === openGraph;
                return (
                  <li key={person.graph.value} className="ruled__row">
                    <details
                      name="person"
                      className="person"
                      open={isOpen}
                      onToggle={(event) => onToggle(person.graph.value, event.currentTarget.open)}
                    >
                      <summary className="person__name">
                        {person.label}
                        <Tags tags={person.tags} />
                      </summary>
                      {isOpen && <div className="person__card">{renderPerson(person)}</div>}
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {tagger}
    </>
  );
}

type PersonProps = {
  book: AddressBook;
  shapesPromise: Promise<ContactShapes>;
  graph: NamedNode;
  onEdit: () => void;
  onDeleted: () => void;
};

// Reads the person when opened. Doesn't suspend itself: a component that suspends while mounting
// loses its state, and with it the promise it waits for.
function Person({ book, shapesPromise, graph, onEdit, onDeleted }: PersonProps) {
  const [contactPromise] = useState(() => readContact(book, graph));
  const [error, setError] = useState<string>();

  const remove = async () => {
    if (!confirm("Delete this person? Their file is removed from the folder.")) return;
    setError(undefined);
    try {
      await deleteContact(book, graph);
      onDeleted();
    } catch (error) {
      setError(String(error));
    }
  };

  return (
    <>
      <Suspense fallback={<Waiting>Reading…</Waiting>}>
        <PersonView shapesPromise={shapesPromise} contactPromise={contactPromise} />
      </Suspense>
      <div className="person__actions">
        <button type="button" className="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="button button--quiet button--danger" onClick={remove}>
          Delete
        </button>
      </div>
      {error && <p className="notice notice--error">{error}</p>}
    </>
  );
}

type PersonViewProps = {
  shapesPromise: Promise<ContactShapes>;
  contactPromise: ReturnType<typeof readContact>;
};

function PersonView({ shapesPromise, contactPromise }: PersonViewProps) {
  const shapes = use(shapesPromise);
  const contact = use(contactPromise);
  if (shapes.nodeShapes.length === 0) return <MissingShape />;
  if (contact.dataGraph.size === 0) {
    return <p className="notice">This person is no longer in the folder.</p>;
  }

  return (
    <ShaclRenderer
      mode="view"
      shapesGraph={shapes.shapesGraph}
      nodeShapes={shapes.nodeShapes}
      dataGraph={contact.dataGraph}
      focusNode={contact.focusNode}
      enableLogicalBranchSwitching={false}
      enableWidgetSwitching={false}
      enableInterfaceLanguageSwitcher={false}
      viewModeLabelLayout="columns"
    />
  );
}

const MissingShape = () => (
  <p className="notice notice--error">
    {SHAPE_FILE} has no shape with <code>sh:targetClass schema:Person</code>, so a person can't be
    shown. Add one to the file and open the folder again.
  </p>
);

type DuplicatesDialogProps = {
  book: AddressBook;
  // Open while there is one.
  duplicates?: Promise<DuplicateGroup[]>;
  onClose: () => void;
  onMerge: (group: DuplicateGroup) => void;
};

function DuplicatesDialog({ book, duplicates, onClose, onMerge }: DuplicatesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (duplicates && !dialog?.open) dialog?.showModal();
    if (!duplicates && dialog?.open) dialog.close();
  }, [duplicates]);

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="duplicates-title"
      onClose={(event) => event.target === dialogRef.current && duplicates && onClose()}
    >
      {duplicates && (
        <>
          <header className="sheet__header">
            <h2 id="duplicates-title" className="sheet__title">
              Duplicates
            </h2>
            <button type="button" className="button button--quiet" onClick={onClose}>
              Close
            </button>
          </header>
          <ErrorBoundary
            fallback={(error) => (
              <p className="notice notice--error">The folder could not be read: {String(error)}</p>
            )}
          >
            <Suspense fallback={<Waiting>Looking for duplicates…</Waiting>}>
              <DuplicateGroups book={book} duplicates={duplicates} onMerge={onMerge} />
            </Suspense>
          </ErrorBoundary>
        </>
      )}
    </dialog>
  );
}

function DuplicateGroups({
  book,
  duplicates,
  onMerge,
}: Omit<DuplicatesDialogProps, "onClose"> & { duplicates: Promise<DuplicateGroup[]> }) {
  const groups = use(duplicates);
  const [notDuplicates, setNotDuplicates] = useState(() => readNotDuplicates(book));
  const shown = groups.filter(({ key }) => !notDuplicates.includes(key));

  const dismiss = (group: DuplicateGroup) => {
    const keys = [...notDuplicates, group.key];
    setNotDuplicates(keys);
    writeNotDuplicates(book, keys);
  };

  const forgotten = groups.length - shown.length;
  const showAgain = forgotten > 0 && (
    <button
      type="button"
      className="button button--quiet"
      onClick={() => {
        setNotDuplicates([]);
        writeNotDuplicates(book, []);
      }}
    >
      Show the {forgotten === 1 ? "one" : forgotten} marked as not the same again
    </button>
  );

  if (shown.length === 0) {
    return (
      <div className="duplicates__empty">
        <p>No one is in the book twice.</p>
        {showAgain}
      </div>
    );
  }

  return (
    <>
      <p className="duplicates__lede">
        {shown.length === 1 ? "1 group" : `${shown.length} groups`} of people that may be the same
        person.
      </p>
      <ul className="duplicates">
        {shown.map((group) => (
          <li key={group.key} className="duplicate">
            <ul className="duplicate__reasons">
              {group.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <ul className="ruled">
              {group.people.map((person) => (
                <li key={person.graph.value} className="ruled__row duplicate__person">
                  <span className="duplicate__name">{person.names.join(" / ") || "No name"}</span>
                  <span className="duplicate__details">
                    {[...person.emails, ...person.telephones].join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="duplicate__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => onMerge(group)}
              >
                Merge…
              </button>
              <button type="button" className="button button--quiet" onClick={() => dismiss(group)}>
                Not the same person
              </button>
            </div>
          </li>
        ))}
      </ul>
      {showAgain}
    </>
  );
}

type EditDialogProps = {
  book: AddressBook;
  shapesPromise: Promise<ContactShapes>;
  editing?: Editing;
  onClose: () => void;
  onSaved: (graph: NamedNode) => void;
};

// The form is only there while the dialog is open: every opening starts from the folder as it is.
function EditDialog({ book, shapesPromise, editing, onClose, onSaved }: EditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // A <dialog> is only modal when opened with showModal(), which has no declarative form.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (editing && !dialog?.open) dialog?.showModal();
    if (!editing && dialog?.open) dialog.close();
  }, [editing]);

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="sheet-title"
      // The renderer's own dialogs are <dialog>s too, and their close events bubble up to here.
      onClose={(event) => event.target === dialogRef.current && editing && onClose()}
    >
      {editing && (
        <>
          <header className="sheet__header">
            <h2 id="sheet-title" className="sheet__title">
              {editing.merge
                ? `Merge ${editing.merge.length} people`
                : editing.isNew
                  ? "New person"
                  : `Edit ${editing.name ?? "person"}`}
            </h2>
            <button type="button" className="button button--quiet" onClick={onClose}>
              Cancel
            </button>
          </header>
          <ErrorBoundary
            key={editing.graph.value}
            fallback={(error) => <p className="notice notice--error">{String(error)}</p>}
          >
            <EditForm
              book={book}
              shapesPromise={shapesPromise}
              editing={editing}
              onSaved={onSaved}
            />
          </ErrorBoundary>
        </>
      )}
    </dialog>
  );
}

type EditFormProps = Omit<EditDialogProps, "editing" | "onClose"> & { editing: Editing };

function EditForm({ book, shapesPromise, editing, onSaved }: EditFormProps) {
  // Doesn't suspend itself, see Person.
  const [contactPromise] = useState(() =>
    editing.merge ? mergeContacts(book, editing.merge) : readContact(book, editing.graph),
  );
  return (
    <Suspense fallback={<Waiting>Reading…</Waiting>}>
      {editing.merge && (
        <p className="notice merge-notice">
          Everything the {editing.merge.length} of them have is in one form now. Where they had
          something different that a person can only have one of, such as their name, keep the right
          one and remove the other. Saving keeps this person and removes the others.
        </p>
      )}
      <EditFormFields
        book={book}
        graph={editing.graph}
        isNew={editing.isNew}
        merge={editing.merge}
        shapesPromise={shapesPromise}
        contactPromise={contactPromise}
        onSaved={onSaved}
      />
    </Suspense>
  );
}

type EditFormFieldsProps = PersonViewProps & {
  book: AddressBook;
  graph: NamedNode;
  isNew: boolean;
  merge?: NamedNode[];
  onSaved: (graph: NamedNode) => void;
};

function EditFormFields({
  book,
  graph,
  isNew,
  merge,
  shapesPromise,
  contactPromise,
  onSaved,
}: EditFormFieldsProps) {
  const shapes = use(shapesPromise);
  const contact = use(contactPromise);
  const [error, setError] = useState<string>();
  if (shapes.nodeShapes.length === 0) return <MissingShape />;

  return (
    <>
      <ShaclRenderer
        mode="edit"
        shapesGraph={shapes.shapesGraph}
        nodeShapes={shapes.nodeShapes}
        dataGraph={contact.dataGraph}
        focusNode={contact.focusNode}
        enableLogicalBranchSwitching={false}
        enableWidgetSwitching={false}
        enableInterfaceLanguageSwitcher={false}
        onSubmit={async (result) => {
          setError(undefined);
          try {
            const quads = result.dataGraph.getQuads();
            // A new person's file is named after them, see saveNewContact.
            if (isNew) onSaved(await saveNewContact(book, graph, quads));
            else if (merge) {
              await saveMerged(book, merge, quads);
              onSaved(graph);
            } else {
              await saveContact(book, graph, quads);
              onSaved(graph);
            }
          } catch (error) {
            setError(String(error));
          }
        }}
      />
      {error && <p className="notice notice--error">{error}</p>}
    </>
  );
}
