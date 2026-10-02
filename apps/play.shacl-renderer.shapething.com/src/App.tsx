import "@fontsource-variable/roboto-condensed/index.css";
import { Icon } from "@iconify/react/offline";
import { write } from "@jeswr/pretty-turtle/dist";
import factory from "@rdfjs/data-model";
import {
  AccordionItem,
  ControlledAccordion,
  useAccordionProvider,
} from "@szhsin/react-accordion";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useEffect, useState, type CSSProperties } from "react";
import { ErrorBoundary } from "react-error-boundary";
import Select from "react-select";
import "share-api-polyfill";
import {
  ShaclRenderer,
  resolveRdfSource,
  type ShaclRendererProps,
} from "@shapething/shacl-renderer";
import { jsToRdf, rdfToJs } from "@shapething/shacl-renderer/tools";
import "@shapething/shacl-renderer/style.css";
import type { RdfStore } from "rdf-stores";
import { AccordionHeading } from "./components/AccordionHeading";
import { Turtle } from "./components/Turtle";
import { examples, settingsSubject } from "./constants";
import { shareIcon } from "./helpers/icons";
import "./style.scss";

const defaultSettings = {
  mode: "edit",
  languageMode: "switcher",
};

const propsUrl = new URL("./props.ttl", location.href);
const propsShape = factory.namedNode(propsUrl.href);

// The playground's convention: example data describes its resource as <>, which parses (without a
// base IRI) to the empty IRI - so that is the default focus node whenever there is data.
const emptyIri = factory.namedNode("");

// Settings hold IRIs as plain strings; the renderer wants terms.
const rendererProps = (
  { focusNode, nodeShape, ...settings }: Record<string, unknown>,
  dataString: string
): ShaclRendererProps => {
  const props = settings as ShaclRendererProps;
  if (typeof focusNode === "string" && focusNode) props.focusNode = factory.namedNode(focusNode);
  else if (dataString) props.focusNode = emptyIri;
  if (typeof nodeShape === "string" && nodeShape) props.nodeShapes = [factory.namedNode(nodeShape)];
  return props;
};

const prefixesOf = (text: string) =>
  Object.fromEntries(
    [...text.matchAll(/@prefix\s+([\w.-]*):\s*<([^>]*)>\s*\./gi)].map(([, alias, iri]) => [alias, iri])
  );

// The Options panel edits the playground's settings (plain JSON in localStorage) with a form
// rendered from props.ttl, converting to and from RDF with the shacl-renderer tools.
function SettingsForm({
  settings,
  onChange,
}: {
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
}) {
  const [propsShapes, setPropsShapes] = useState<RdfStore>();
  useEffect(() => {
    resolveRdfSource(propsUrl, new Map(), undefined).then(setPropsShapes);
  }, []);
  if (!propsShapes) return null;

  const dataGraph = jsToRdf({
    shapesGraph: propsShapes,
    focusNode: settingsSubject,
    nodeShapes: [propsShape],
    data: settings,
  });

  return (
    <ShaclRenderer
      key={JSON.stringify(settings)}
      shapesGraph={propsShapes}
      dataGraph={dataGraph}
      focusNode={settingsSubject}
      nodeShapes={[propsShape]}
      mode="edit"
      onSubmit={async (result) =>
        onChange(
          await rdfToJs({
            shapesGraph: propsShapes,
            dataGraph: result.dataGraph,
            focusNode: settingsSubject,
            nodeShapes: [propsShape],
          })
        )
      }
    />
  );
}

export default function App() {
  const providerValue = useAccordionProvider({});
  const { toggleAll } = providerValue;
  const [example, setExample] = useLocalStorage<string | null>("example", null);

  const [shapesString, setShapesString] = useLocalStorage<string>("shapes", "");
  const [dataString, setDataString] = useLocalStorage<string>("data", "");
  const [initialDataString, setInitialDataString] = useLocalStorage<string>(
    "initialData",
    ""
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settings, setSettings] = useLocalStorage<any>(
    "settings",
    defaultSettings
  );

  const exampleOptions = Object.entries(examples).map(([groupLabel, items]) => {
    return {
      label: groupLabel,
      options: Object.entries(items).map(([key]) => ({
        value: key,
        label: key,
      })),
    };
  });

  useEffect(() => {
    if (location.hash) {
      try {
        const [shapesString, dataString, settings] = JSON.parse(
          atob(location.hash.substring(1))
        );
        setDataString(dataString);
        setShapesString(shapesString);
        setSettings(settings);
        setExample(null);
        toggleAll(false);
        history.replaceState(null, "", location.pathname);
      } catch {
        // ignore errors
      }
    }
  }, []);

  const url =
    window.location != window.parent.location
      ? document.referrer
      : document.location.href;

  return (
    <>
      <div className="left">
        <header className="site-header">
          {navigator.share ? (
            <button
              className="button"
              onClick={() =>
                navigator.share({
                  text: "",
                  title: "",
                  url: `${url}${window.location != window.parent.location
                    ? "playground"
                    : ""
                    }#${btoa(
                      JSON.stringify([shapesString, dataString, settings])
                    )}`,
                })
              }
            >
              <Icon icon={shareIcon} />
              &nbsp;&nbsp;Share current state
            </button>
          ) : null}

          <Select<{ value: string | null; label: string }>
            value={example ? { value: example, label: example } : null}
            className="example-select"
            placeholder={"Pick an example..."}
            options={exampleOptions}
            backspaceRemovesValue={true}
            isClearable={true}
            onChange={async (option) => {
              setExample(option?.value ?? null);

              const selectedExample = Object.entries(examples)
                .flatMap(([, items]) => Object.entries(items))
                .find(([key]) => key === option?.value)?.[1];

              if (!option || !selectedExample) {
                setShapesString("");
                setDataString("");
                setInitialDataString("");
                setSettings(defaultSettings);
                toggleAll(false);
                return;
              }

              const shapesString = await fetch(selectedExample.shapes).then(
                (res) => res.text()
              );
              setShapesString(shapesString);

              const dataString =
                "data" in selectedExample
                  ? await fetch(selectedExample.data).then((res) => res.text())
                  : "";
              setDataString(dataString);
              setInitialDataString(dataString);
              setSettings(selectedExample.props ?? defaultSettings);
            }}
          />
        </header>

        <ControlledAccordion
          providerValue={providerValue}
          style={{ "--items": 3 } as CSSProperties}
        >
          <AccordionItem
            itemKey={"shapes"}
            header={
              <AccordionHeading>
                Shapes <em>(optional)</em>
              </AccordionHeading>
            }
          >
            <ErrorBoundary fallback={<div>Error loading Turtle editor</div>}>
              <Turtle
                value={shapesString}
                onChange={(value) => {
                  setShapesString(value);
                }}
              />
            </ErrorBoundary>
          </AccordionItem>
          <AccordionItem
            itemKey={"data"}
            header={
              <AccordionHeading>
                Data <em>(optional)</em>
              </AccordionHeading>
            }
          >
            <ErrorBoundary fallback={<div>Error loading Turtle editor</div>}>
              <Turtle
                value={dataString}
                onChange={(value) => {
                  setDataString(value);
                  setInitialDataString(value);
                }}
              />
            </ErrorBoundary>
          </AccordionItem>
          <AccordionItem
            itemKey={"options"}
            header={<AccordionHeading>Options</AccordionHeading>}
          >
            <SettingsForm settings={settings} onChange={setSettings} />
          </AccordionItem>
        </ControlledAccordion>
      </div>
      <div className="right">
        {shapesString || dataString ? (
          <ErrorBoundary fallback={<div>Error rendering</div>}>
            <ShaclRenderer
              key={shapesString + initialDataString + JSON.stringify(settings)}
              {...rendererProps(settings, dataString)}
              shapesGraph={shapesString}
              dataGraph={dataString}
              onSubmit={async ({ dataGraph }) => {
                const replaceSubject = factory.namedNode("urn:replace-me");
                const quads = dataGraph.getQuads().map((quad) =>
                  factory.quad(
                    quad.subject.value === "" ? replaceSubject : quad.subject,
                    quad.predicate,
                    quad.object,
                    quad.graph
                  )
                );
                let dataString = await write(quads, {
                  prefixes: prefixesOf(shapesString + "\n" + initialDataString),
                });
                dataString = dataString.replace(/urn:replace-me/g, "");
                setDataString(dataString);
              }}
            />
          </ErrorBoundary>
        ) : (
          <div className="introduction">
            <h1>ShapeThing SHACL renderer Playground</h1>
            <p>
              This is a playground. It allows you to test various configurations
              of the SHACL renderer.
            </p>
            <p>You can find examples of shapes and data in the sidebar.</p>
          </div>
        )}
      </div>
    </>
  );
}
