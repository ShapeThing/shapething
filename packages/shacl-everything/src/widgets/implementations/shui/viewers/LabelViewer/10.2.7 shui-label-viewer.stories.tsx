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

// ex:acme's schema:industry is annotated shui:ClassificationRole (see
// <#organizationShape>) - secondary, disambiguating text shown as a chip alongside the main
// rdfs:label, mirroring what AutoCompleteOption/EnumSelectEditor already show for this same role
// while editing (see useResolvedValueNode).
export const shuiLabelViewerClassificationRole: Story = {
  name: "shui:ClassificationRole renders as a chip alongside the label",
  args: {
    ...argsByTestFile("10.2.7 shui-label-viewer-classification-role.ttl", import.meta.url),
    mode: "view",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("ACME Corp");
    await canvas.findByText("Manufacturing");
  },
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

export const shuiLabelViewerNestedViewInPlace: Story = {
  name: "closing a modal opened from inside another view-in-place modal only closes that one",
  args: {
    ...argsByTestFile("10.2.7 shui-label-viewer-nested-view-in-place.ttl", import.meta.url),
    mode: "view",
    enableViewInPlace: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const employerLink = await canvas.findByRole("link", { name: /ACME Corp/i });
    await userEvent.click(employerLink);

    // ex:acme's own modal (Modal isn't portaled, so it renders nested inside canvasElement) shows
    // a "CEO" property that's itself a shui:LabelViewer - clicking it drills into a *second*,
    // nested Modal rendered as a DOM+React descendant of the first one's content.
    const outerDialog = await canvas.findByRole("dialog");
    const ceoLink = await within(outerDialog).findByRole("link", { name: /Jane Doe/i });
    await userEvent.click(ceoLink);
    await waitFor(() =>
      expect(canvasElement.querySelectorAll("dialog.st-modal[open]")).toHaveLength(2),
    );

    // Closing the inner (topmost) modal must only close that one. <dialog>'s "close"/"cancel"
    // events don't natively bubble, but React simulates bubbling for them through the React tree
    // regardless - without Modal's target guard, the inner dialog's own close event would also
    // fire the outer Modal's onClose, since the outer LabelViewer's Modal is its React ancestor.
    const dialogs = canvas.getAllByRole("dialog");
    const innerDialog = dialogs[dialogs.length - 1];
    const innerCloseButton = within(innerDialog).getByRole("button", { name: /close/i });
    await userEvent.click(innerCloseButton);

    await waitFor(() =>
      expect(canvasElement.querySelectorAll("dialog.st-modal[open]")).toHaveLength(1),
    );
    await expect(canvas.findByText("info@acme.example")).resolves.toBeVisible();
  },
};
