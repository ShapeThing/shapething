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

const shapes = {
  Chef: { nodeShape: ex("ChefShape"), type: "http://example.org/Chef" },
  Recipe: { nodeShape: ex("RecipeShape"), type: "http://schema.org/Recipe" },
};
type ShapeName = keyof typeof shapes;

/**
 * A select with all chefs and recipes in the store, grouped by type.
 */
const usePicker = (defaultIri: string, version: number) => {
  const [options, setOptions] = useState<(Option & { shape: ShapeName })[]>([]);
  const [selected, setSelected] = useState(defaultIri);
  useEffect(() => {
    Promise.all(
      (Object.keys(shapes) as ShapeName[]).map(async (name) =>
        (await listResources(shapes[name].type)).map((option) => ({ ...option, shape: name })),
      ),
    ).then((lists) => setOptions(lists.flat()));
  }, [version]);

  const shape = options.find(({ iri }) => iri === selected)?.shape;

  const picker = (
    <select value={selected} onChange={(event) => setSelected(event.target.value)}>
      {(Object.keys(shapes) as ShapeName[]).map((name) => (
        <optgroup key={name} label={name}>
          {options
            .filter((option) => option.shape === name)
            .map(({ iri, name }) => (
              <option key={iri} value={iri}>
                {name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );

  return { selected, shape, picker };
};

function ResourceRenderer({
  mode,
  defaultIri,
  version,
}: {
  mode: "view" | "edit";
  defaultIri: string;
  version: number;
}) {
  const { selected, shape, picker } = usePicker(defaultIri, version);
  const [dataGraph, setDataGraph] = useState<Quad[]>();
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDataGraph(undefined);
    setStatus("");
    if (!shape) return;
    // All chefs, so the chef of a recipe can be shown and picked with its name.
    Promise.all([
      fetchDocument(DataFactory.namedNode(selected), { shape: shapes[shape].nodeShape }),
      shape === "Recipe" ? fetchChefs() : [],
    ]).then(([{ quads }, chefs]) => setDataGraph([...quads, ...chefs, ...vocabulary]));
  }, [selected, shape, version]);

  const onSubmit = async (result: SubmitResult) => {
    const resource = DataFactory.namedNode(selected);
    try {
      await saveDocument(resource, conciseBoundedDescription(result.dataGraph, resource));
      const { label } = getExampleStore();
      setStatus(label === "in memory" ? "Saved in memory." : `Saved to the folder ${label}.`);
    } catch (error) {
      console.error(error);
      setStatus(`Could not save: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className={`renderer-example${shape === "Chef" ? " chef-render" : ""}`}>
      <label className="renderer-example__picker">
        Resource {picker}
        <span role="status">{status}</span>
      </label>
      {shape && dataGraph ? (
        <ShaclRenderer
          key={`${selected} ${version}`}
          mode={mode}
          className={shape === "Recipe" ? "recipes-render" : undefined}
          shapesGraph={shapesGraph}
          dataGraph={dataGraph}
          viewModeLabelLayout={shape === "Chef" ? "inline" : undefined}
          focusNode={DataFactory.namedNode(selected)}
          nodeShapes={[shapes[shape].nodeShape]}
          enableShPathInLabelTitle={false}
          {...englishOnly}
          {...(mode === "edit"
            ? {
                enableWidgetSwitching: false,
                enableLogicalBranchSwitching: false,
                enableLinksToResources: false,
                onSubmit,
              }
            : {})}
        />
      ) : (
        <p>Fetching…</p>
      )}
    </section>
  );
}

export function ChefExample() {
  return (
    <ResourceRenderer
      mode="view"
      defaultIri={new URL("chefs/gordon-ramsay", baseUri).toString()}
      version={useStoreVersion()}
    />
  );
}

export function RecipeExample() {
  return (
    <ResourceRenderer
      mode="edit"
      defaultIri={new URL("recipes/beef-wellington", baseUri).toString()}
      version={useStoreVersion()}
    />
  );
}
