import { useMemo, useRef, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RdfStore } from "rdf-stores";
import ShaclRenderer from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment, type Environment } from "@/environment.ts";
import { defaultPreprocessors, type Preprocessor } from "@/preprocess/index.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import "./the-shape-is-the-app.css";

// <#shape> is the collection's data model and <#data> one artwork in it - the right-hand side's
// own args. The left-hand side renders that same file as data, with meta/shape.ttl as its shapes:
// its focus node is <#shape>, and its node shape (meta/shape.ttl's <#nodeShape>) is resolved from
// targeting, since <#shape> is an sh:NodeShape.
const appArgs = argsByTestFile("the-shape-is-the-app.ttl", import.meta.url);
const metaShapesGraph = argsByTestFile("../meta/shape.ttl", import.meta.url).shapesGraph;
const artworkShape = appArgs.nodeShapes[0];

type Mode = Environment["mode"];
const MODES: Mode[] = ["edit", "view", "facet"];

const snapshot = (store: RdfStore): RdfStore => {
  const copy = RdfStore.createDefault();
  for (const quad of store.getQuads()) copy.addQuad(quad);
  return copy;
};

/**
 * ShaclRenderer copies any graph handed to it (see resolveRdfSources.ts's copyStore) and edits
 * that copy in place, so the caller's own store never sees an edit. Appended after the default
 * preprocessors, this hands out the renderer's own working dataGraph instead - wrapped so every
 * write is reported - which is how the left-hand side's edits reach the right-hand side while
 * they happen, rather than only on submit.
 */
function observeDataGraph(onChange: (dataGraph: RdfStore) => void): Preprocessor {
  return (environment) => {
    const dataGraph = environment.dataGraph as RdfStore;
    const observed = new Proxy(dataGraph, {
      get(target, property) {
        if (property === "addQuad" || property === "removeQuad") {
          return (...args: Parameters<RdfStore["addQuad"]>) => {
            const changed = target[property](...args);
            if (changed) onChange(target);
            return changed;
          };
        }
        // Bound to the real store - RdfStore's internals rely on private class fields.
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    onChange(dataGraph);
    return { ...environment, dataGraph: observed };
  };
}

type Graphs = { shapesGraph: RdfStore; dataGraph: RdfStore | RdfSource };

function TheShapeIsTheApp({ initialMode = "edit" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [graphs, setGraphs] = useState<Graphs>();

  // The right-hand side's own live edits, carried over into its next mount - a new shapesGraph is
  // an identity prop (see environmentProps.ts), so every shape edit remounts it from its inputs.
  const liveDataRef = useRef<RdfStore>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const shapePreprocessors = useMemo(
    () => [
      ...defaultPreprocessors,
      observeDataGraph((shapes) => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setGraphs({
            shapesGraph: snapshot(shapes),
            dataGraph: liveDataRef.current ? snapshot(liveDataRef.current) : appArgs.dataGraph,
          });
        }, 250);
      }),
    ],
    [],
  );

  const appPreprocessors = useMemo(
    () => [
      ...defaultPreprocessors,
      observeDataGraph((data) => {
        liveDataRef.current = data;
      }),
    ],
    [],
  );

  return (
    <div className="shape-is-the-app">
      <section className="shape-is-the-app__pane" aria-label="The shape">
        <header className="shape-is-the-app__header">
          <h2>The shape</h2>
          <p>
            A SHACL shape, edited with a SHACL renderer. Open a property with its pencil, change a
            constraint and press Update.
          </p>
        </header>
        <ShaclRenderer
          {...testingEnvironment}
          shapesGraph={metaShapesGraph}
          dataGraph={appArgs.dataGraph}
          focusNode={artworkShape}
          mode="edit"
          // meta/shape.ttl's owl:imports sh: - w3.org serves no CORS headers.
          corsProxyUrl="https://cors.shapething.com/?url="
          preprocessors={shapePreprocessors}
        />
      </section>

      <section className="shape-is-the-app__pane" aria-label="The app">
        <header className="shape-is-the-app__header">
          <h2>The app</h2>
          <p>Everything below is generated from the shape on the left - there is no form code.</p>
          <div className="shape-is-the-app__modes" role="group" aria-label="Mode">
            {MODES.map((option) => (
              <button
                key={option}
                type="button"
                className={`st-button${option === mode ? " st-button--primary" : ""}`}
                aria-pressed={option === mode}
                onClick={() => setMode(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </header>
        {graphs && (
          <ShaclRenderer
            {...testingEnvironment}
            {...appArgs}
            shapesGraph={graphs.shapesGraph}
            dataGraph={graphs.dataGraph}
            mode={mode}
            preprocessors={appPreprocessors}
          />
        )}
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
// form, the read-only view and the facets on the right.
export const theShapeIsTheApp: Story = {
  name: "The shape is the app",
};

const findPane = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement).findByRole("region", { name }, { timeout: 15000 });

// Opens one of <#shape>'s property shapes in the left-hand side's edit-in-place modal, on `tab`.
async function openPropertyShape(canvasElement: HTMLElement, label: string, tab: string) {
  const shape = within(await findPane(canvasElement, "The shape"));
  await userEvent.click(
    await shape.findByText("Properties for the shape.", {}, { timeout: 15000 }),
  );
  // Fluent wraps the interpolated label in Unicode isolation marks (U+2068/U+2069).
  await userEvent.click(await shape.findByLabelText(new RegExp(`^Edit \u2068?${label}\u2069?$`)));
  const modal = within(await within(document.body).findByRole("dialog", {}, { timeout: 15000 }));
  await userEvent.click(await modal.findByText(tab));
  return modal;
}

// Picks `property` from a drawer group's "Add a property" dropdown, revealing its field.
async function addProperty(modal: ReturnType<typeof within>, property: string) {
  const drawer = modal.getByText("Add a property").closest("div")!.parentElement!;
  await userEvent.click(within(drawer).getByRole("combobox"));
  await userEvent.click(await within(document.body).findByRole("option", { name: property }));
}

// The tour from the story above, played out: each step edits one constraint of the shape on the
// left, and the app on the right follows.
export const guidedTour: Story = {
  name: "The shape is the app (guided tour)",
  play: async ({ canvasElement, step }) => {
    const appPane = await findPane(canvasElement, "The app");
    const app = within(appPane);
    const materials = ["oil on canvas", "oil on panel", "oil on cardboard"];

    await step(
      "Material turns into a dropdown once the shape lists its allowed values",
      async () => {
        expect(await app.findByDisplayValue("oil on canvas", {}, { timeout: 15000 })).toBeVisible();

        const modal = await openPropertyShape(canvasElement, "material", "Value constraints");
        for (const material of materials) {
          await userEvent.click(modal.getAllByRole("button", { name: "Add item" })[0]);
          const [empty] = modal
            .getAllByRole("textbox")
            .filter((input) => !(input as HTMLInputElement).value);
          await userEvent.type(empty, material);
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

      const modal = await openPropertyShape(canvasElement, "last Restored", "Property constraints");
      await userEvent.click(modal.getByText("Text"));
      await userEvent.click(await modal.findByRole("option", { name: /^Date\b(?!\s*and)/ }));
      await addProperty(modal, "Minimum count");
      await userEvent.type(await modal.findByLabelText("Minimum count"), "1");
      await userEvent.tab();
      await userEvent.click(modal.getByRole("button", { name: "Update" }));

      await waitFor(
        () => {
          expect(appPane.querySelector('input[type="date"]')).not.toBeNull();
          expect(app.getAllByLabelText("Required")).toHaveLength(2);
        },
        { timeout: 15000 },
      );
    });

    await step("The same shape, as facets: Material lists its allowed values", async () => {
      await userEvent.click(app.getByRole("button", { name: "facet" }));
      for (const material of materials) {
        expect(await app.findByText(material, {}, { timeout: 15000 })).toBeVisible();
      }
    });
  },
};
