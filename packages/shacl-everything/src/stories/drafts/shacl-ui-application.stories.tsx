import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclUIApplication, {
  type ShaclUIApplicationProps,
} from "@/outputs/application/ShaclUIApplication.tsx";
import { ex } from "@/helpers/namespaces.ts";

// Draft: exercises the (not-yet-numbered) SHACL UI Application spec section - a component that
// drives one or more ShaclRenderer instances by resolving (focus node, node shape) pairs, rather
// than a single spec clause the way the rest of src/stories/ is organized. Lives outside
// "SHACL 1.2 UI/" until that section is actually assigned a number in the spec.
type Story = StoryObj<ShaclUIApplicationProps>;

export default {
  title: "Drafts/SHACL UI Application",
  component: ShaclUIApplication,
};

// Example 6 from the spec: a node shape given, no focus node - resolution targets every
// foaf:Person instance in the data graph, and the application renders each as its own read-only
// card in a list, using ShaclRenderer (mode "view") for each one.
export const peopleList: Story = {
  name: "People (list, view mode)",
  args: {
    shapesGraph: new URL("people.ttl", import.meta.url),
    dataGraph: new URL("people.ttl", import.meta.url),
    nodeShape: ex("PersonShape"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const timeout = { timeout: 10000 };
    await canvas.findByText("Alice", {}, timeout);
    await canvas.findByText("Anderson", {}, timeout);
    await canvas.findByText("alice@example.org", {}, timeout);

    await canvas.findByText("Bob", {}, timeout);
    await canvas.findByText("Baker", {}, timeout);
    await canvas.findByText("bob@example.org", {}, timeout);

    await canvas.findByText("Carol", {}, timeout);
    await canvas.findByText("Chen", {}, timeout);
    await canvas.findByText("carol@example.org", {}, timeout);

    expect(canvas.getAllByRole("listitem")).toHaveLength(3);

    // sh:name carries an @nl translation too - each item is its own ShaclRenderer with its own
    // interface language, so switching the first item's switcher only relabels that one card.
    const [firstItem] = canvas.getAllByRole("listitem");
    const trigger = firstItem.querySelector<HTMLButtonElement>(
      ".st-interface-language-switcher .st-listbox__trigger",
    );
    if (!trigger) throw new Error("Could not find the interface language switcher");
    await userEvent.click(trigger);
    const dutchOption = firstItem.querySelector<HTMLElement>(
      '.st-interface-language-switcher [data-value="nl-NL"]',
    );
    if (!dutchOption) throw new Error('Could not find interface language option "nl-NL"');
    await userEvent.click(dutchOption);

    const withinFirstItem = within(firstItem);
    await withinFirstItem.findByText("Voornaam", {}, timeout);
    await withinFirstItem.findByText("Achternaam", {}, timeout);
    await withinFirstItem.findByText("E-mail", {}, timeout);
  },
};
