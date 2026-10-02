import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL core 1.2/4. SHACL Property Paths",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const PredicatePath: Story = {
  name: "4.1 Predicate Paths",
  args: argsByTestFile("4.1 predicate-paths.ttl", import.meta.url),
};

export const SequencePath: Story = {
  name: "4.2 Sequence Paths",
  args: argsByTestFile("4.2 sequence-paths.ttl", import.meta.url),
};

export const AlternativePath: Story = {
  name: "4.3 Alternative Paths",
  args: argsByTestFile("4.3.a alternative-paths.ttl", import.meta.url),
};

export const AlternativePathDcTitleRdfsLabel: Story = {
  name: "4.3 Alternative Paths (dc:title / rdfs:label)",
  args: {
    ...argsByTestFile("4.3.b alternative-paths-dc-title-rdfs-label.ttl", import.meta.url),
    enableAlternativePathSwitching: true,
  },
};

export const InversePath: Story = {
  name: "4.4 Inverse Paths",
  args: argsByTestFile("4.4 inverse-paths.ttl", import.meta.url),
};

export const ZeroOrMorePath: Story = {
  name: "4.5 Zero-or-More Paths",
  args: argsByTestFile("4.5 zero-or-more-paths.ttl", import.meta.url),
};

export const OneOrMorePath: Story = {
  name: "4.6 One-or-More Paths",
  args: argsByTestFile("4.6 one-or-more-paths.ttl", import.meta.url),
};

export const ZeroOrOnePath: Story = {
  name: "4.7 Zero-or-One Paths",
  args: argsByTestFile("4.7 zero-or-one-paths.ttl", import.meta.url),
};
