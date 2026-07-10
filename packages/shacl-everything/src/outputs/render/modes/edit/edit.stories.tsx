import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer",
  component: ShaclRenderer,
};

const contactUrl = new URL("contact.ttl", import.meta.url);

export const edit: Story = {
  args: {
    shapesGraph: contactUrl,
    nodeShapes: [factory.namedNode(contactUrl.href)],
    interfaceLanguage: "nl-NL",
  },
};
