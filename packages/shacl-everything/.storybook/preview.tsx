import type { Decorator, Preview } from "@storybook/react-vite";
import type { ArgTypesEnhancer } from "storybook/internal/csf";
import { RdfStore } from "rdf-stores";
import { withGraphInspector } from "./addons/graph-inspector/withGraphInspector.tsx";
import { withSubmitPreview } from "./withSubmitPreview.tsx";
import React from "react";

// EnvironmentContextProvider builds its Environment once per mount and never rebuilds it (see
// environment.ts / EnvironmentContextProvider.tsx) - dataGraph becomes a live, mutable store that
// widgets edit in place, so re-deriving the environment on every render would silently discard a
// user's in-progress edits. That's the right call for a real embedder, but it also means editing
// any Controls arg (e.g. enableWidgetSwitching) has no effect until the page is hard-reloaded,
// since nothing about a Storybook args update naturally remounts the component. Keying the story
// on its own args forces React to tear down and remount it on every Controls edit instead, which
// gives the same result as a reload without leaving Storybook.
export const withArgsKeyRemount: Decorator = (Story, context) => (
  <React.Fragment key={JSON.stringify(context.args)}>{Story()}</React.Fragment>
);

export const withMaxWidth: Decorator = (Story, context) =>
  context.parameters.maxWidth === false ? (
    Story()
  ) : (
    <div style={{ maxWidth: context.parameters.maxWidth ?? 600, marginInline: "auto" }}>
      {Story()}
    </div>
  );

type RdfTerm = { termType: string; value: string };

const isRdfTerm = (value: unknown): value is RdfTerm =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RdfTerm).termType === "string" &&
  typeof (value as RdfTerm).value === "string";

// RdfStore internals and RDF/JS terms aren't meant to be edited as raw objects, and walking them
// to infer a control (Storybook's default behaviour for any arg without an explicit argType) can
// hit a real cycle inside RdfStore's indices and crash with "detected a cycle in arg". Giving
// these an explicit type/control skips that walk, and table.defaultValue.summary lets the
// Controls/Docs row show a friendly string instead of the raw object.
const friendlyArgDisplay: ArgTypesEnhancer = (context) => {
  const enhanced: Record<string, unknown> = {};

  for (const [key, arg] of Object.entries(context.initialArgs)) {
    if (arg instanceof RdfStore) {
      enhanced[key] = {
        type: { name: "other", value: "RdfStore" },
        control: false,
        table: { defaultValue: { summary: `${arg.size} quad${arg.size === 1 ? "" : "s"}` } },
      };
    } else if (isRdfTerm(arg)) {
      enhanced[key] = {
        type: { name: "string" },
        control: false,
        table: { defaultValue: { summary: arg.value } },
      };
    } else if (Array.isArray(arg) && arg.length > 0 && arg.every(isRdfTerm)) {
      enhanced[key] = {
        type: { name: "array", value: { name: "string" } },
        control: false,
        table: { defaultValue: { summary: arg.map((term) => term.value).join(", ") } },
      };
    }
  }

  return { ...context.argTypes, ...enhanced };
};

// Environment fields with a closed set of string values (see environment.ts) render as a free-text
// Controls input by default, since no story declares an argTypes entry for them. Force a select
// dropdown instead so Controls can't be used to type an invalid value.
const ENUM_ARG_OPTIONS: Record<string, readonly string[]> = {
  mode: ["edit", "view", "facet"],
  languageMode: ["switcher", "individual"],
  viewModeLabelLayout: ["block", "inline"],
  facetChangeMode: ["live", "submit"],
};

const selectControlsForEnumArgs: ArgTypesEnhancer = (context) => {
  const enhanced: Record<string, unknown> = {};

  for (const key of Object.keys(context.initialArgs)) {
    const options = ENUM_ARG_OPTIONS[key];
    if (options) {
      enhanced[key] = { control: { type: "select" }, options };
    }
  }

  return { ...context.argTypes, ...enhanced };
};

// Ported from packages/shacl-renderer's own .storybook/preview.ts: st:FileUploadEditor's demo
// fixture (st-file-upload-editor.ttl) points st:uploadUrl at "/storage-service-worker", which
// public/sw.js (vendored from shacl-renderer, using localforage/IndexedDB) intercepts to fake a
// real upload backend - without registering it, dragging a file onto the dropzone in a live
// Storybook session would 404 instead of actually uploading.
const registerServiceWorker = async () => {
  // Skip under the Vitest browser (this project's "storybook" test project) integration, which
  // runs on this fixed port - see shacl-renderer's identical check for the same reason.
  if (location.port === "63315") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "/" });
  } catch (error) {
    console.error(`Service worker registration failed with ${error}`);
  }
};

void registerServiceWorker();

const preview: Preview = {
  decorators: [withArgsKeyRemount, withGraphInspector, withSubmitPreview, withMaxWidth],
  argTypesEnhancers: [friendlyArgDisplay, selectControlsForEnumArgs],
  parameters: {
    // Without this, the sidebar falls back to sorting by file-discovery/import order, which
    // isn't stable across runs (glob traversal order can shift as files are added/renamed) -
    // that's what caused chapters to reshuffle. "alphabetical" also numeric-sorts each title
    // segment (10.1.2 before 10.1.10), which plain string sort would get wrong.
    options: {
      storySort: {
        method: "alphabetical",
        order: [
          "Showcases",
          "Shapes and Ontologies",
          "Application profiles",
          "Specifications",
          "Tools",
          "Tests",
          "Environment",
          "Experiments",
        ],
      },
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
