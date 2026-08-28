import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.7 shui:LabelViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiLabelViewer: Story = {
  name: "IRI value rendered as a hyperlink by its resolved display label",
  args: { ...argsByTestFile("10.2.7 shui-label-viewer.ttl", import.meta.url), mode: "view" },
};

export const shuiLabelViewerViewInPlace: Story = {
  name: "Environment.enableViewInPlace opens a shaped, already-in-dataGraph value in a modal",
  args: {
    ...argsByTestFile("10.2.7 shui-label-viewer-view-in-place.ttl", import.meta.url),
    mode: "view",
    enableViewInPlace: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole("link", { name: /ACME Corp/i });

    // ex:acme both already exists in dataGraph and is targeted by <#organizationShape>
    // (sh:targetClass schema:Organization) - clicking must open it inline rather than navigate
    // away. Modal isn't portaled here (unlike AutoCompleteOption's edit-in-place modal), so it
    // stays inside canvasElement.
    await userEvent.click(link);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).findByText("info@acme.example")).resolves.toBeVisible();

    const closeButton = within(dialog).getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);
    await waitFor(() => expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull());
  },
};
