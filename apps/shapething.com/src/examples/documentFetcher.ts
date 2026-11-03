import { StreamLanguage } from "@codemirror/language";
import { sparql } from "@codemirror/legacy-modes/mode/sparql";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { write } from "@jeswr/pretty-turtle";
import type { NamedNode } from "@rdfjs/types";
import { minimalSetup } from "codemirror";
import { DataFactory, Parser, Store } from "n3";
import { baseUri, onStoreChange } from "./exampleStore";
import { fetchDocument, queryBindings } from "./fetchDocument";
import { highlighting } from "./highlighting";

const prefixes = {
  schema: "http://schema.org/",
  ex: "http://example.org/",
  unit: "http://qudt.org/vocab/unit/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

const readOnlyView = (parent: HTMLElement, language: Extension, doc = "") =>
  new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        minimalSetup,
        highlighting,
        language,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    }),
  });

const setDoc = (view: EditorView, doc: string) =>
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });

type Elements = {
  select: HTMLSelectElement;
  document: HTMLElement;
  documentLabel: HTMLElement;
  queries: HTMLElement;
  queriesLabel: HTMLElement;
  shape?: HTMLElement;
};

type Options = {
  /** Fetch with this shape, the Turtle is shown next to the document. */
  shape?: { turtle: string; iri: string };
  /** Only list resources of this type. */
  type?: string;
};

/**
 * A dropdown of resources, picking one fetches it with the ResourceFetcher and shows the result as Turtle.
 */
export const mountDocumentFetcher = (elements: Elements, { shape, type }: Options = {}) => {
  const shapes = shape ? new Store(new Parser().parse(shape.turtle)) : undefined;
  if (shape && elements.shape)
    readOnlyView(elements.shape, StreamLanguage.define(turtle), shape.turtle.trim());

  const documentView = readOnlyView(
    elements.document,
    StreamLanguage.define(turtle),
    "# Pick a resource.",
  );
  const queriesView = readOnlyView(elements.queries, StreamLanguage.define(sparql));
  let selected: NamedNode | undefined;
  let lastFetch = 0;

  const showDocument = async (resource: NamedNode) => {
    const run = ++lastFetch;
    selected = resource;
    elements.select.value = resource.value;
    elements.documentLabel.textContent = `${resource.value.replace(baseUri.toString(), "")} (fetching…)`;

    const queries: string[] = [];

    try {
      const { quads, steps } = await fetchDocument(resource, {
        ...(shape && shapes ? { shape: DataFactory.namedNode(shape.iri), shapes } : {}),
        onQuery: (query, step, queried) =>
          queries.push(
            queried.equals(resource)
              ? `# Step ${step}\n${query}`
              : `# Step ${step} of the nested fetch of ${queried.value.replace(baseUri.toString(), "")}\n${query}`,
          ),
      });
      if (run !== lastFetch) return;
      const turtle = await write(quads, { prefixes, baseIri: baseUri.toString() });
      elements.documentLabel.textContent = `${resource.value.replace(baseUri.toString(), "")} (${quads.length} triples)`;
      elements.queriesLabel.textContent = `${queries.length} queries in ${steps} steps`;
      setDoc(documentView, turtle);
      setDoc(queriesView, queries.join("\n\n"));
    } catch (error) {
      if (run !== lastFetch) return;
      console.error(error);
      elements.documentLabel.textContent = resource.value.replace(baseUri.toString(), "");
      setDoc(
        documentView,
        `# Could not fetch the resource:\n# ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const renderList = async () => {
    const bindings = await queryBindings(`PREFIX schema: <http://schema.org/>
SELECT ?resource ?type ?name WHERE {
  ?resource a ?type ;
    schema:name ?name .${type ? `\n  VALUES ?type { <${type}> }` : ""}
  FILTER(LANG(?name) = "en")
}
ORDER BY DESC(?type) ?name`);

    // One group per type, such as the recipes and the chefs.
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const binding of bindings) {
      const typeName = binding
        .get("type")!
        .value.replace(prefixes.schema, "")
        .replace(prefixes.ex, "");
      if (!groups.has(typeName)) {
        const group = document.createElement("optgroup");
        group.label = typeName;
        groups.set(typeName, group);
      }
      const option = document.createElement("option");
      option.value = binding.get("resource")!.value;
      option.textContent = binding.get("name")!.value;
      groups.get(typeName)!.append(option);
    }

    elements.select.replaceChildren(...groups.values());
    if (selected) elements.select.value = selected.value;
    return bindings.map((binding) => binding.get("resource") as NamedNode);
  };

  elements.select.addEventListener("change", () =>
    showDocument(DataFactory.namedNode(elements.select.value)),
  );

  onStoreChange(async () => {
    await renderList();
    if (selected) showDocument(selected);
  });
  // Shows the first resource straight away, the dropdown only says what else there is.
  renderList().then(([first]) => {
    if (first && !selected) showDocument(first);
  });
};
