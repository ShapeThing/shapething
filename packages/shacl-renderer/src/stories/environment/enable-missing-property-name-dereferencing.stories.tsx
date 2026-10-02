import type { StoryObj } from "@storybook/react-vite";
import { within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableMissingPropertyNameDereferencing (off by default): preprocess/ontologyLabels.ts's
// dereferenceMissingPropertyNames dereferences an unnamed property shape's own sh:path predicate
// over real HTTP (via Comunica) and merges whatever rdfs:label it finds there.
// enable-missing-property-name-dereferencing.term.ttl plays the role of "the property's own
// ontology document" - the property shape's sh:path is a relative IRI resolving to this colocated
// fixture's own URL, and the fixture labels itself via `<> rdfs:label "Team name"@en`, exactly the
// way a real ontology term document names itself. That makes this a genuine HTTP round trip
// through this package's own dev/test static server (see .storybook/serveAbsoluteStoryFixtures.ts
// and .storybook/copyStoryFixtures.ts) rather than a mocked one.
export default {
  title: "Environment/enableMissingPropertyNameDereferencing",
  component: ShaclRenderer,
};

const baseArgs: ShaclRendererProps = argsByTestFile(
  "enable-missing-property-name-dereferencing.ttl",
  import.meta.url,
);

export const withoutDereferencing: Story = {
  name: "Without the flag, an unnamed property falls back to its humanized local name",
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Acme", {}, { timeout: 5000 });
    // No sh:name and nothing dereferenced - propertyLabel() falls all the way back to the sh:path
    // predicate's own local name, humanized (see resolution/label.ts, localNameLabel.ts).
    await canvas.findByText("enable missing property name dereferencing term ttl", {}, {
      timeout: 5000,
    });
  },
};

export const withDereferencing: Story = {
  name: "With the flag, the property is labeled from its own dereferenced rdfs:label",
  args: { ...baseArgs, enableMissingPropertyNameDereferencing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Acme", {}, { timeout: 5000 });
    await canvas.findByText("Team name", {}, { timeout: 5000 });
  },
};
