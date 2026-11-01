import type { Quad } from "@rdfjs/types";
import { ShaclRenderer, type SubmitResult } from "@shapething/shacl-renderer";
import "@shapething/shacl-renderer/style.css";
import { DataFactory } from "n3";
import { useEffect, useState, type ComponentProps } from "react";
import { baseUri, getExampleStore, saveDocument } from "../examples/exampleStore";
import { ex, fetchDocument } from "../examples/fetchDocument";
import {
  conciseBoundedDescription,
  fetchChefs,
  listResources,
  shapesWithVocabulary as shapesGraph,
  useStoreVersion,
  vocabulary,
  type Option,
} from "../examples/recipesAndChefs";
import "../examples/recipes-and-chefs.css";

/**
 * The website is in English, so the renderer shows English only: no interface or content language switcher.
 * contentLanguages is authoritative, the Dutch values in the data stay as they are but are not offered.
 */
const englishOnly = {
  interfaceLanguage: "en-GB",
  interfaceLocales: { "nl-NL": null },
  enableInterfaceLanguageWithShapesLabelsOnly: false,
  contentLanguage: "en",
  contentLanguages: ["en"],
  enableContentLanguageCreation: false,
  enableFullLanguageRemoval: false,
} satisfies Partial<ComponentProps<typeof ShaclRenderer>>;

const usePicker = (type: string, defaultIri: string, version: number) => {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState(defaultIri);
  useEffect(() => {
    listResources(type).then(setOptions);
  }, [type, version]);

  const picker = (
    <select value={selected} onChange={(event) => setSelected(event.target.value)}>
      {options.map(({ iri, name }) => (
        <option key={iri} value={iri}>
          {name}
        </option>
      ))}
    </select>
  );

  return { selected, picker };
};

function ChefViewer({ version }: { version: number }) {
  const { selected, picker } = usePicker(
    "http://example.org/Chef",
    new URL("chefs/gordon-ramsay", baseUri).toString(),
    version,
  );
  const [dataGraph, setDataGraph] = useState<Quad[]>();

  useEffect(() => {
    setDataGraph(undefined);
    fetchDocument(DataFactory.namedNode(selected), { shape: ex("ChefShape") }).then(({ quads }) =>
      setDataGraph([...quads, ...vocabulary]),
    );
  }, [selected, version]);

  return (
    <section className="renderer-example chef-render">
      <label className="renderer-example__picker">Chef {picker}</label>
      {dataGraph ? (
        <ShaclRenderer
          key={`${selected} ${version}`}
          mode="view"
          shapesGraph={shapesGraph}
          dataGraph={dataGraph}
          viewModeLabelLayout="inline"
          focusNode={DataFactory.namedNode(selected)}
          nodeShapes={[ex("ChefShape")]}
          enableShPathInLabelTitle={false}
          {...englishOnly}
        />
      ) : (
        <p>Fetching…</p>
      )}
    </section>
  );
}

function RecipeEditor({ version }: { version: number }) {
  const { selected, picker } = usePicker(
    "http://schema.org/Recipe",
    new URL("recipes/beef-wellington", baseUri).toString(),
    version,
  );
  const [dataGraph, setDataGraph] = useState<Quad[]>();
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDataGraph(undefined);
    Promise.all([
      fetchDocument(DataFactory.namedNode(selected), { shape: ex("RecipeShape") }),
      fetchChefs(),
    ]).then(([{ quads }, chefs]) => setDataGraph([...quads, ...chefs, ...vocabulary]));
  }, [selected, version]);

  const onSubmit = async (result: SubmitResult) => {
    const recipe = DataFactory.namedNode(selected);
    try {
      await saveDocument(recipe, conciseBoundedDescription(result.dataGraph, recipe));
      const { label } = getExampleStore();
      setStatus(label === "in memory" ? "Saved in memory." : `Saved to the folder ${label}.`);
    } catch (error) {
      console.error(error);
      setStatus(`Could not save: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="renderer-example">
      <label className="renderer-example__picker">
        Recipe {picker}
        <span role="status">{status}</span>
      </label>
      {dataGraph ? (
        <ShaclRenderer
          key={`${selected} ${version}`}
          mode="edit"
          className="recipes-render"
          shapesGraph={shapesGraph}
          dataGraph={dataGraph}
          focusNode={DataFactory.namedNode(selected)}
          nodeShapes={[ex("RecipeShape")]}
          enableShPathInLabelTitle={false}
          {...englishOnly}
          enableWidgetSwitching={false}
          enableLogicalBranchSwitching={false}
          enableLinksToResources={false}
          onSubmit={onSubmit}
        />
      ) : (
        <p>Fetching…</p>
      )}
    </section>
  );
}

export function ChefExample() {
  return <ChefViewer version={useStoreVersion()} />;
}

export function RecipeExample() {
  return <RecipeEditor version={useStoreVersion()} />;
}
