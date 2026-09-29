import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";

const args = argsByTestFile("title.ttl", import.meta.url);
const heading = (canvasElement: HTMLElement) =>
  within(canvasElement).findByRole("heading", {}, { timeout: 15000 });

export default {
  title: "Tests/Interaction/Title",
};

type Story = StoryObj;

export const editTitle: Story = {
  name: "Edit mode titles an existing resource by its own label, live",
  render: () => <ShaclRenderer {...args} mode="edit" enableTitle />,
  play: async ({ canvasElement }) => {
    expect((await heading(canvasElement)).textContent).toMatch(/^Edit ⁨?Alice⁩?$/);

    const input = await within(canvasElement).findByDisplayValue("Alice");
    await userEvent.clear(input);
    await userEvent.type(input, "Bob");
    await userEvent.tab();
    await waitFor(() =>
      expect(canvasElement.querySelector(".st-title")?.textContent).toMatch(/Bob/)
    );
  },
};

export const createTitle: Story = {
  name: "Edit mode on a new resource titles it by the shape's label",
  render: () => (
    <ShaclRenderer
      {...args}
      focusNode={factory.namedNode(fixtureUrl("title.ttl#new", import.meta.url).href)}
      mode="edit"
      enableTitle
    />
  ),
  play: async ({ canvasElement }) => {
    expect((await heading(canvasElement)).textContent).toMatch(/^Create ⁨?Person⁩?$/);
  },
};

export const searchTitle: Story = {
  name: "Facet mode titles the search by the shape's label",
  render: () => <ShaclRenderer {...args} mode="facet" enableTitle />,
  play: async ({ canvasElement }) => {
    expect((await heading(canvasElement)).textContent).toMatch(/^Search ⁨?Person⁩?$/);
  },
};

export const noTitleByDefault: Story = {
  name: "No title unless enableTitle is set",
  render: () => <ShaclRenderer {...args} mode="edit" />,
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByDisplayValue("Alice", {}, { timeout: 15000 });
    expect(canvasElement.querySelector(".st-title")).toBeNull();
  },
};
