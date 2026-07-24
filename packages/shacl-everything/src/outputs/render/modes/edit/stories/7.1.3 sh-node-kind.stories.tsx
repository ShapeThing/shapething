import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.1.3 sh:nodeKind",
  component: ShaclRenderer,
};

export const shNodeKindA: Story = {
  name: "sh:IRI",
  args: argsByTestFile("7.1.3.a sh-node-kind.ttl", import.meta.url),
};

export const shNodeKindB: Story = {
  name: "sh:Literal",
  args: argsByTestFile("7.1.3.b sh-node-kind.ttl", import.meta.url),
};

export const shNodeKindC: Story = {
  name: "sh:BlankNode",
  args: argsByTestFile("7.1.3.c sh-node-kind.ttl", import.meta.url),
};

export const shNodeKindD: Story = {
  name: "sh:BlankNodeOrIRI",
  args: argsByTestFile("7.1.3.d sh-node-kind.ttl", import.meta.url),
};

export const shNodeKindE: Story = {
  name: "sh:BlankNodeOrLiteral",
  args: argsByTestFile("7.1.3.e sh-node-kind.ttl", import.meta.url),
};

export const shNodeKindF: Story = {
  name: "sh:IRIOrLiteral",
  args: argsByTestFile("7.1.3.f sh-node-kind.ttl", import.meta.url),
};

export const shNodeKindG: Story = {
  name: "sh:TripleTerm",
  args: argsByTestFile("7.1.3.g sh-node-kind.ttl", import.meta.url),
};
