import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

const fixture = "6.3 subclass-of-inheritance.ttl";

export default {
  title:
    "Specifications/SHACL core 1.2/6. Validation and Graphs/6.3 Graph for rdfs:subClassOf Triples",
  component: ShaclRenderer,
};

const iri = (fragment: string) =>
  factory.namedNode(fixtureUrl(`${fixture}#${fragment}`, import.meta.url).href);

// Only the most specific shape is given - the renderer adds the shape of every superclass of its
// sh:targetClass (walking rdfs:subClassOf, queried from the shapes graph too, see 6.3's
// subClassOfInShapesGraph), so the form is the union of the whole class chain.
const argsFor = (focusNode: string, nodeShape: string) => ({
  ...argsByTestFile(fixture, import.meta.url),
  focusNode: iri(focusNode),
  nodeShapes: [iri(nodeShape)],
});

export const manager: Story = {
  name: "Manager (Person → Employee → Manager)",
  args: argsFor("data", "managerShape"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Ada", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Head of Engineering");
    await canvas.findByText("Budget");
    await expect(canvas.queryByText("Student number")).toBeNull();
  },
};

export const employee: Story = {
  name: "Employee (Person → Employee)",
  args: argsFor("employee", "employeeShape"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Charles", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Engineer");
    await expect(canvas.queryByText("Budget")).toBeNull();
    await expect(canvas.queryByText("Student number")).toBeNull();
  },
};

export const student: Story = {
  name: "Student (Person → Student)",
  args: argsFor("student", "studentShape"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Grace", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("S-1906");
    await expect(canvas.queryByText("Job title")).toBeNull();
  },
};

// No nodeShapes at all: the shapes are resolved from the focus node itself - every shape whose
// target includes it, i.e. its rdf:type's shape plus every superclass's.
export const withoutNodeShapes: Story = {
  name: "No nodeShapes given (resolved from the focus node)",
  args: { ...argsFor("data", "managerShape"), nodeShapes: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Ada", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Head of Engineering");
    await canvas.findByText("Budget");
    await expect(canvas.queryByText("Student number")).toBeNull();
  },
};
