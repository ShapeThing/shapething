import { javascript } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { sparql } from "@codemirror/legacy-modes/mode/sparql";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import type { Term } from "@rdfjs/types";
import { generateDts } from "@shapething/typed-sparql/generate";
import { Parser } from "@traqula/parser-sparql-1-2";
import { basicSetup, minimalSetup } from "codemirror";
import { baseUri, getExampleStore, onStoreChange } from "./exampleStore";
import { highlighting } from "./highlighting";
import initialQuery from "./recipes.rq?raw";

const parser = new Parser();
const engine = new QueryEngine();

// Only the interface is interesting here, the generated file also has imports and a default export.
const toInterface = (query: string) => {
  const dts = generateDts(query, {}, parser);
  if (!dts)
    return "// No type could be generated.\n// Only SELECT queries without * and without syntax errors get a type.";
  return dts.match(/interface QueryResult \{[\s\S]*?\n\}/)?.[0] ?? dts;
};

// IRIs from the example data are shown relative to the base, so the table stays readable.
const termToString = (term: Term) =>
  term.termType === "NamedNode" ? term.value.replace(baseUri.toString(), "") : term.value;

const cell = (tagName: "th" | "td", text: string) => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

let lastRun = 0;

/**
 * Executes the query against the example store and renders the bindings as a table.
 */
const renderResults = async (
  query: string,
  resultsElement: HTMLElement,
  labelElement: HTMLElement,
) => {
  const run = ++lastRun;
  const { source, label } = getExampleStore();
  labelElement.textContent = `results (${label})`;

  try {
    const result = await engine.query(query, { sources: [source], unionDefaultGraph: true });
    if (result.resultType !== "bindings") throw new Error("Only SELECT queries are shown here.");
    const { variables } = await result.metadata();
    const bindings = await (await result.execute()).toArray();
    if (run !== lastRun) return;

    const names = variables.map((variable) => variable.value);
    const table = document.createElement("table");
    table.append(document.createElement("thead"), document.createElement("tbody"));
    table.tHead!.insertRow().append(...names.map((name) => cell("th", name)));
    for (const binding of bindings) {
      table.tBodies[0].insertRow().append(
        ...names.map((name) => {
          const term = binding.get(name);
          return cell("td", term ? termToString(term) : "");
        }),
      );
    }

    const empty = document.createElement("p");
    empty.textContent = "No results.";
    resultsElement.replaceChildren(bindings.length ? table : empty);
  } catch (error) {
    if (run !== lastRun) return;
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = error instanceof Error ? error.message : String(error);
    resultsElement.replaceChildren(message);
  }
};

/**
 * A SPARQL editor, next to it a read only view of the type TypedSparql generates for the query and the results of the query.
 */
export const mountTypedSparqlEditor = (
  queryElement: HTMLElement,
  typeElement: HTMLElement,
  resultsElement: HTMLElement,
  resultsLabelElement: HTMLElement,
) => {
  const typeView = new EditorView({
    parent: typeElement,
    state: EditorState.create({
      doc: toInterface(initialQuery),
      extensions: [
        minimalSetup,
        highlighting,
        javascript({ typescript: true }),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    }),
  });

  let timeout: ReturnType<typeof setTimeout>;
  const updateType = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const query = update.state.doc.toString();
      typeView.dispatch({
        changes: { from: 0, to: typeView.state.doc.length, insert: toInterface(query) },
      });
      renderResults(query, resultsElement, resultsLabelElement);
    }, 200);
  });

  const queryView = new EditorView({
    parent: queryElement,
    state: EditorState.create({
      doc: initialQuery,
      extensions: [basicSetup, highlighting, StreamLanguage.define(sparql), updateType],
    }),
  });

  renderResults(initialQuery, resultsElement, resultsLabelElement);
  onStoreChange(() =>
    renderResults(queryView.state.doc.toString(), resultsElement, resultsLabelElement),
  );
};
