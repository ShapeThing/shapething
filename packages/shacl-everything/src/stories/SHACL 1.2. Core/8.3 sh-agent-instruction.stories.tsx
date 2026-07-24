import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.3 sh:agentInstruction",
  component: ShaclRenderer,
};

export const shAgentInstruction: Story = {
  name: "Natural-language instructions for a software agent",
  args: argsByTestFile("8.3 sh-agent-instruction.ttl", import.meta.url),
};
