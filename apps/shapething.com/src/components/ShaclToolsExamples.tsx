import { write } from "@jeswr/pretty-turtle";
import type { NamedNode, Quad } from "@rdfjs/types";
import { generate, rdfToJs, shaclToType } from "@shapething/shacl-renderer/tools";
import { DataFactory } from "n3";
import { useEffect, useMemo, useState } from "react";
import { baseUri, getExampleStore, saveDocument } from "../examples/exampleStore";
import { ex, fetchDocument } from "../examples/fetchDocument";
import {
  conciseBoundedDescription,
  fetchChefs,
  listResources,
  shapesWithVocabulary,
  toStore,
  turtlePrefixes,
  useStoreVersion,
  vocabulary,
  type Option,
} from "../examples/recipesAndChefs";
import { CodeBlock } from "./CodeBlock";

const shapesGraph = toStore(shapesWithVocabulary);
const shapes = {
  Chef: { nodeShape: ex("ChefShape"), type: "http://example.org/Chef", folder: "chefs" },
  Recipe: { nodeShape: ex("RecipeShape"), type: "http://schema.org/Recipe", folder: "recipes" },
};
type ShapeName = keyof typeof shapes;

/**
 * Generates a chef or a recipe from its shape, which can then be added to the store.
 */
export function GenerateExample() {
  const [shape, setShape] = useState<ShapeName>("Recipe");
  const [generated, setGenerated] = useState<{
    resource: NamedNode;
    quads: Quad[];
    turtle: string;
  }>();
  const [status, setStatus] = useState("");

  const generateResource = async () => {
    setStatus("");
    const { nodeShape, folder } = shapes[shape];
    const resource = DataFactory.namedNode(
      new URL(`${folder}/generated-${Date.now().toString(36)}`, baseUri).toString(),
    );
    // Existing chefs, so that a generated recipe gets one of them as its chef.
    const dataGraph = toStore([...(shape === "Recipe" ? await fetchChefs() : []), ...vocabulary]);
    await generate({ shapesGraph, dataGraph, focusNode: resource, nodeShapes: [nodeShape] });
    const quads = conciseBoundedDescription(dataGraph, resource);
    const turtle = await write(quads, { prefixes: turtlePrefixes, baseIri: baseUri.toString() });
    setGenerated({ resource, quads, turtle });
  };

  useEffect(() => {
    generateResource();
  }, [shape]);

  const addToStore = async () => {
    if (!generated) return;
    await saveDocument(generated.resource, generated.quads);
    const { label } = getExampleStore();
    setStatus(
      `Added ${generated.resource.value.replace(baseUri.toString(), "")} ${label === "in memory" ? "in memory" : `to the folder ${label}`}.`,
    );
  };

  return (
    <section className="tools-example">
      <div className="tools-example__bar">
        <label>
          Shape{" "}
          <select value={shape} onChange={(event) => setShape(event.target.value as ShapeName)}>
            {Object.keys(shapes).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={generateResource}>
          Generate another
        </button>
        <button type="button" onClick={addToStore} disabled={!generated}>
          Add to the store
        </button>
        <span role="status">{status}</span>
      </div>
      <CodeBlock
        language="turtle"
        label={`generate({ nodeShapes: [ex:${shape}Shape] })`}
        code={generated?.turtle ?? "# Generating…"}
      />
    </section>
  );
}

/**
 * The TypeScript type of a shape next to a resource from the store, read into a plain object of that type.
 */
export function TypesExample() {
  const version = useStoreVersion();
  const [options, setOptions] = useState<(Option & { shape: ShapeName })[]>([]);
  const [selected, setSelected] = useState(new URL("recipes/beef-wellington", baseUri).toString());
  const [object, setObject] = useState("");

  const types = useMemo(
    () =>
      shaclToType({
        shapesGraph,
        nodeShapes: Object.values(shapes).map(({ nodeShape }) => nodeShape),
      }),
    [],
  );
  const shape = options.find(({ iri }) => iri === selected)?.shape ?? "Recipe";

  useEffect(() => {
    Promise.all(
      (Object.keys(shapes) as ShapeName[]).map(async (name) =>
        (await listResources(shapes[name].type)).map((option) => ({ ...option, shape: name })),
      ),
    ).then((lists) => setOptions(lists.flat()));
  }, [version]);

  useEffect(() => {
    const { nodeShape } = shapes[shape];
    const focusNode = DataFactory.namedNode(selected);
    setObject("");
    fetchDocument(focusNode, { shape: nodeShape })
      .then(({ quads }) =>
        rdfToJs({
          shapesGraph,
          dataGraph: toStore([...quads, ...vocabulary]),
          focusNode,
          nodeShapes: [nodeShape],
          languages: ["en"],
        }),
      )
      .then((result) => setObject(JSON.stringify(result, null, 2)));
  }, [selected, shape, version]);

  return (
    <section className="tools-example">
      <div className="tools-example__bar">
        <label>
          Resource{" "}
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
        </label>
      </div>
      <div className="tools-example__panes">
        <CodeBlock
          language="typescript"
          label={`shaclToType(): ${shape}Shape`}
          code={types.get(`${shape}Shape`) ?? ""}
        />
        <CodeBlock
          language="json"
          label={`rdfToJs({ languages: ['en'] }): ${shape}Shape`}
          code={object || "// Fetching…"}
        />
      </div>
    </section>
  );
}
