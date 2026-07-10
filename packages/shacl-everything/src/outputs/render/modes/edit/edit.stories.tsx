import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer from "@/outputs/render/render.tsx";
type Story = StoryObj<typeof ShaclRenderer>;

export default {
  title: "Shacl Renderer",
  component: ShaclRenderer,
};

console.log(new URL("contact.ttl", import.meta.url));

export const edit: Story = {
  args: {
    shapesGraph: new URL("contact.ttl", import.meta.url),
    nodeShapes: [],
  },
};
