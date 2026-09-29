import { useMemo, useRef, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RdfStore } from "rdf-stores";
import ShaclRenderer from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment } from "@/environment.ts";
import { defaultPreprocessors, type Preprocessor } from "@/preprocess/index.ts";
import { getReactivity, makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { rdf, rdfs, shui } from "@/helpers/namespaces.ts";
import "./the-shape-is-the-app.css";

// <#shape> is the collection's data model and <#data> one artwork in it - the right-hand side's
// own args. The left-hand side renders that same file as data, with meta/shape.ttl as its shapes:
// its focus node is <#shape>, and its node shape (meta/shape.ttl's <#nodeShape>) is resolved from
// targeting, since <#shape> is an sh:NodeShape.
const appArgs = argsByTestFile("the-shape-is-the-app.ttl", import.meta.url);
const metaShapesGraph = argsByTestFile("../meta/shape.ttl", import.meta.url).shapesGraph;
const artworkShape = appArgs.nodeShapes[0];

/**
 * ShaclRenderer copies any graph handed to it (see resolveRdfSources.ts's copyStore) and edits
 * that copy in place, so the caller's own store never sees an edit. Appended after the default
 * preprocessors, this makes the renderer's own working dataGraph reactive itself (runPreprocessors
 * keeps it as-is instead of wrapping it again) and hands it out - the left-hand side's working
 * store is then the right-hand side's shapesGraph, which re-preprocesses in place on every write
 * to it (see EnvironmentContextProvider.tsx) rather than remounting.
 */
function exposeDataGraph(onResolve: (dataGraph: RdfStore) => void): Preprocessor {
  return (environment) => {
    const resolved = environment.dataGraph as RdfStore;
    // Already reactive when re-preprocessing around a kept dataGraph (runPreprocessors' keepDataGraph).
    const dataGraph = getReactivity(resolved) ? resolved : makeReactive(resolved);
    onResolve(dataGraph);
    return { ...environment, dataGraph };
  };
}

/**
 * Copies every editor declared in the resolved scoresGraph (`?editor a shui:Editor`, plus its
 * rdfs:label and rdfs:isDefinedBy) into the dataGraph, so meta/shape.ttl's `sh:class shui:Editor`
 * finds them as instances and validates - along with each defining ontology's rdfs:label, which
 * meta/shape.ttl's <#editor> shows as the editor's classification. Only those declarations - not
 * the whole scoresGraph, whose widget-scoring.ttl node shapes would otherwise end up in the
 * right-hand side's shapesGraph via exposeDataGraph.
 */
const addEditorsToDataGraph: Preprocessor = (environment) => {
  const scoresGraph = environment.scoresGraph as RdfStore;
  const dataGraph = environment.dataGraph as RdfStore;
  for (const { subject: editor } of scoresGraph.getQuads(null, rdf("type"), shui("Editor"))) {
    const definedBy = scoresGraph.getQuads(editor, rdfs("isDefinedBy"));
    for (const quad of [
      ...scoresGraph.getQuads(editor, rdf("type"), shui("Editor")),
      ...scoresGraph.getQuads(editor, rdfs("label")),
      ...definedBy,
      ...definedBy.flatMap(({ object }) => scoresGraph.getQuads(object, rdfs("label"))),
    ]) {
      dataGraph.addQuad(quad);
    }
  }
  return environment;
};

function TheShapeIsTheApp() {
  const [shapesGraph, setShapesGraph] = useState<RdfStore>();

  const liveDataRef = useRef<RdfStore>(undefined);

  const shapePreprocessors = useMemo(
    () => [...defaultPreprocessors, addEditorsToDataGraph, exposeDataGraph(setShapesGraph)],
    [],
  );

  const appPreprocessors = useMemo(
    () => [
      ...defaultPreprocessors,
      exposeDataGraph((data) => {
        liveDataRef.current = data;
      }),
    ],
    [],
  );

  return (
    <div className="shape-is-the-app">
      <section className="shape-is-the-app__pane left" aria-label="The shape">
        <header className="shape-is-the-app__header">
          <h2>An example that shows a shape-driven app</h2>
          <p>
            A SHACL shape, edited with a SHACL renderer. Open a property with its pencil, change a
            constraint and press Update to see the effect on the app.
          </p>
        </header>
        <div className="shape-is-the-app__content">
          <ShaclRenderer
            {...testingEnvironment}
            enableTitle={true}
            interfaceLocales={{
              "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
            }}
            shapesGraph={metaShapesGraph}
            dataGraph={appArgs.dataGraph}
            enableLogicalBranchSwitching={false}
            enableWidgetSwitching={false}
            focusNode={artworkShape}
            enableInterfaceLanguageWithShapesLabelsOnly={false}
            mode="edit"
            // meta/shape.ttl's owl:imports sh: - w3.org serves no CORS headers.
            corsProxyUrl="https://cors.shapething.com/?url="
            preprocessors={shapePreprocessors}
          />
        </div>
      </section>

      <section className="shape-is-the-app__pane right" aria-label="The app">
        <div className="shape-is-the-app__content">
          {shapesGraph && (
            <ShaclRenderer
              {...testingEnvironment}
              enableTitle={true}
              enableLogicalBranchSwitching={false}
              enableWidgetSwitching={false}
              {...appArgs}
              interfaceLocales={{
                "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
              }}
              shapesGraph={shapesGraph}
              dataGraph={appArgs.dataGraph}
              enableInterfaceLanguageWithShapesLabelsOnly={false}
              preprocessors={appPreprocessors}
            />
          )}
        </div>
      </section>
    </div>
  );
}

type Story = StoryObj<typeof TheShapeIsTheApp>;

export default {
  title: "Showcases/The shape is the app",
  component: TheShapeIsTheApp,
  parameters: { maxWidth: false },
};

// A museum collection's data model (the-shape-is-the-app.ttl's <#shape>) on the left, rendered as
// a form by meta/shape.ttl - SHACL describing SHACL. On the right, the collection itself, rendered
// by nothing but that data model: every constraint edited on the left immediately changes the
// form on the right.
export const theShapeIsTheApp: Story = {
  name: "The shape is the app",
};

const findPane = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement).findByRole("region", { name }, { timeout: 15000 });

// Opens one of <#shape>'s property shapes in the left-hand side's edit-in-place modal, on `tab`.
async function openPropertyShape(canvasElement: HTMLElement, label: string, tab: string) {
  const shape = within(await findPane(canvasElement, "The shape"));
  // Fluent wraps the interpolated label in Unicode isolation marks (U+2068/U+2069).
  await userEvent.click(
    await shape.findByLabelText(
      new RegExp(`^Edit \u2068?${label}\u2069?$`),
      {},
      { timeout: 15000 },
    ),
  );
  const modal = within(await within(document.body).findByRole("dialog", {}, { timeout: 15000 }));
  await userEvent.click(await modal.findByText(tab));
  return modal;
}

// The tour from the story above, played out: each step edits one constraint of the shape on the
// left, and the app on the right follows.
export const guidedTour: Story = {
  name: "The shape is the app (guided tour)",
  play: async ({ canvasElement, step }) => {
    const appPane = await findPane(canvasElement, "The app");
    const app = within(appPane);
    const materials = ["oil on canvas", "oil on panel", "oil on cardboard"];

    // Every shape edit below re-preprocesses the app in place: it never falls back to "Loading"
    // again, and an edit made in the app itself survives each of them.
    expect(await app.findByDisplayValue("SK-A-2344", {}, { timeout: 15000 })).toBeVisible();
    let reloaded = false;
    const loadingObserver = new MutationObserver(() => {
      if (appPane.querySelector(".st-environment-context-provider__loading")) reloaded = true;
    });
    loadingObserver.observe(appPane, { childList: true, subtree: true });
    const inventoryNumber = app.getByDisplayValue("SK-A-2344");
    await userEvent.clear(inventoryNumber);
    await userEvent.type(inventoryNumber, "SK-A-2344-bis");
    await userEvent.tab();

    await step(
      "Material turns into a dropdown once the shape lists its allowed values",
      async () => {
        expect(await app.findByDisplayValue("oil on canvas", {}, { timeout: 15000 })).toBeVisible();

        const modal = await openPropertyShape(canvasElement, "Material", "Value constraints");
        for (const material of materials) {
          // The empty textbox "Add item" appends - the modal has other empty ones above it (e.g.
          // Description), and the list's earlier items may be re-rendered as new elements.
          const before = new Set(modal.getAllByRole("textbox"));
          await userEvent.click(modal.getAllByRole("button", { name: "Add item" })[0]);
          const added = modal
            .getAllByRole("textbox")
            .filter((input) => !before.has(input) && !(input as HTMLInputElement).value)
            .at(-1)!;
          await userEvent.type(added, material);
          await userEvent.tab();
        }
        await userEvent.click(modal.getByRole("button", { name: "Update" }));

        // No longer a text input holding the value, but a dropdown showing it.
        await waitFor(() => expect(app.queryByDisplayValue("oil on canvas")).toBeNull(), {
          timeout: 15000,
        });
        expect(await app.findByText("oil on canvas", {}, { timeout: 15000 })).toBeVisible();
      },
    );

    await step("Last restored becomes a required date", async () => {
      // Title is the only required field so far.
      expect(app.getAllByLabelText("Required")).toHaveLength(1);

      const modal = await openPropertyShape(canvasElement, "Last restored", "Property constraints");
      await userEvent.click(modal.getByText("Text"));
      await userEvent.click(await modal.findByRole("option", { name: /^Date\b(?!\s*and)/ }));
      // The Cardinality field's "Required" checkbox writes sh:minCount 1.
      await userEvent.click(modal.getByRole("checkbox", { name: "Required" }));
      await userEvent.click(modal.getByRole("button", { name: "Update" }));

      await waitFor(
        () => {
          expect(appPane.querySelector('input[type="date"]')).not.toBeNull();
          expect(app.getAllByLabelText("Required")).toHaveLength(2);
        },
        { timeout: 15000 },
      );
    });

    await step("The app kept its own edit and never reloaded", async () => {
      loadingObserver.disconnect();
      expect(reloaded).toBe(false);
      expect(app.getByDisplayValue("SK-A-2344-bis")).toBeVisible();
    });

    await step("The Editor dropdown lists every editor, classified by its spec", async () => {
      const modal = await openPropertyShape(canvasElement, "Material", "Property constraints");
      // Editor sits in <#propertyConstraintsInner>'s drawer, added through its "Add a property".
      await userEvent.click(modal.getByRole("combobox", { name: "Add a property" }));
      await userEvent.click(await modal.findByRole("option", { name: "Editor" }));
      await userEvent.click(await modal.findByRole("button", { name: "Editor" }));
      // The classification arrives with the options' batched role lookup, after the list opens.
      await waitFor(
        () => {
          expect(modal.getByRole("option", { name: /^Text Field\b(?! with)/ })).toHaveTextContent(
            "SHACL UI",
          );
          expect(modal.getByRole("option", { name: /^Color Picker/ })).toHaveTextContent(
            "ShapeThing",
          );
        },
        { timeout: 15000 },
      );
    });
  },
};
