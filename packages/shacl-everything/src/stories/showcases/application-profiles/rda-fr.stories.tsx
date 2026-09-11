import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import { minimalEnvironment, defaultEnvironment } from "@/environment.ts";
import { fetchText } from "@/l10n/locales.ts";

// A French interface translation for the rdafr:'s own vocabulary (its data and sh:name/
// sh:description labels are entirely @fr - see rdafr-shacl.ttl). Colocated with this story rather
// than shipped as a built-in locale (l10n/ftl/) since it's only relevant to this showcase; loaded
// via `interfaceLocales` below, the same mechanism an embedder would use to add their own
// translation. Resolved dynamically (not a literal `new URL("...", import.meta.url)`) so it's
// picked up by the same story-fixture serving/copying machinery as this showcase's .ttl fixture -
// see .storybook/copyStoryFixtures.ts and .storybook/serveAbsoluteStoryFixtures.ts.
const frenchLocaleFilename = "rda-fr.fr-FR.ftl";
const loadFrenchLocale = () => fetchText(new URL(frenchLocaleFilename, import.meta.url));

// RDA-FR's namespace mints opaque C1000xx identifiers for every class - all of them ultimately
// relate back to rdafr:C100013 ("entité rdafr") via rdfs:subClassOf. The ten picked out below are
// the FRBR/LRM "WEMI" bibliographic core (Work/Expression/Manifestation/Item), the three classic
// RDA Agent subtypes (Person/Corporate body/Family), Place, and one richly-modeled Work subtype
// (Continuing resource work) - chosen as the most heavily-propertied, non-abstract shapes in the
// file (most of the remaining ~70 are either thin abstract superclasses with no sh:property of
// their own, or small controlled-vocabulary/code-list shapes like Langue/Ecriture/Genre).
const RDAFR = "https://rdafr.fr/Elements#";

// rdafr-shacl-drawer-groups.ttl is a purely additive overlay (see its own header comment) - it
// adds one st:DrawerPropertyGroup per showcased class below and moves that class's own optional
// properties into it, entirely via `sh:group` triples on rdafr-shacl.ttl's existing named property
// shapes, without editing that 34k-line generated vocabulary dump itself. argsByTestFile merges
// both files into one shapesGraph, same mechanism used elsewhere for a shared-vocabulary split.
const shapeFiles = ["rdafr-shacl.ttl", "rdafr-shacl-drawer-groups.ttl"] as const;

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Application profiles/RDA",
  component: ShaclRenderer,
  args: {
    ...minimalEnvironment,
    interfaceLocales: {
      ...defaultEnvironment.interfaceLocales,
      "en-GB": undefined,
      "fr-FR": loadFrenchLocale,
    },
    interfaceLanguage: "fr-FR",
    contentLanguage: "fr-FR",
    contentLanguages: ["fr-FR"],
    enableLinksToResources: true,
  },
};

export const work: Story = {
  name: "Work (Œuvre)",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100001`)],
  },
};

export const expression: Story = {
  name: "Expression",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100006`)],
  },
};

export const manifestation: Story = {
  name: "Manifestation",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100007`)],
  },
};

export const item: Story = {
  name: "Item",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100003`)],
  },
};

export const agent: Story = {
  name: "Agent",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100002`)],
  },
};

export const person: Story = {
  name: "Person (Personne)",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100004`)],
  },
};

export const corporateBody: Story = {
  name: "Corporate body (Collectivité)",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100005`)],
  },
};

export const family: Story = {
  name: "Family (Famille)",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100008`)],
  },
};

export const place: Story = {
  name: "Place (Lieu)",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100009`)],
  },
};

export const continuingResourceWork: Story = {
  name: "Continuing resource work (Œuvre de ressource continue)",
  args: {
    ...argsByTestFile(shapeFiles, import.meta.url),
    nodeShapes: [factory.namedNode(`${RDAFR}C100026`)],
  },
};
