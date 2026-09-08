import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, spyOn, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:FileUploadEditor is a ShapeThing-original editor (ported from shacl-renderer's own
// FileUploadEditor), not part of the SHACL 1.2 Core spec or the shui: extension proposal - it
// lives in its own stories folder rather than alongside the spec-conformance suite. st:uploadUrl
// on the property shape names an endpoint accepting a multipart POST that answers with a JSON
// array of the uploaded files' resulting URLs (see widget.tsx's uploadFiles) - both interaction
// tests below mock fetch rather than hitting a real endpoint.
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:FileUploadEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stFileUploadEditor: Story = {
  name: "An already-uploaded file, plus the dropzone for more",
  args: argsByTestFile("st-file-upload-editor.ttl", import.meta.url),
};

export const stFileUploadEditorUpload: Story = {
  name: "Selecting a file uploads it and adds the resulting value",
  args: argsByTestFile("st-file-upload-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(["/uploads/new-photo.png"]), { status: 200 }),
    );

    // The form is suspense-loaded (see CLAUDE.md's Environment/preprocessing notes), so the
    // dropzone isn't necessarily there on play()'s first tick - wait for it rather than assuming.
    const input = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLInputElement>(
        ".st-file-upload-editor__dropzone input[type='file']",
      );
      if (!element) throw new Error("Could not find the file input");
      return element;
    });

    const file = new File(["binary content"], "new-photo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await expect(canvas.findByText("new-photo.png")).resolves.toBeVisible();
  },
};

export const stFileUploadEditorRemove: Story = {
  name: "Removing an existing value",
  args: argsByTestFile("st-file-upload-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText("sample.svg")).resolves.toBeVisible();

    const removeButton = canvasElement.querySelector<HTMLButtonElement>(
      ".st-file-upload-editor__remove",
    );
    if (!removeButton) throw new Error("Could not find the remove button");
    fireEvent.click(removeButton);

    await waitFor(() => expect(canvas.queryByText("sample.svg")).not.toBeInTheDocument());
  },
};
