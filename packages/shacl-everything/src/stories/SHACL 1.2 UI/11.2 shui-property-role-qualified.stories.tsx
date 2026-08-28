import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/11. Property Roles/11.2 Qualified Role Annotation",
  component: ShaclRenderer,
};

export const qualifiedRoleAnnotationBlankNode: Story = {
  name: "Blank-node qualified annotation, sh:order picks skos:prefLabel over schema:name",
  args: argsByTestFile("11.2.a shui-property-role-qualified.ttl", import.meta.url),
};

export const qualifiedRoleAnnotationTripleAnnotation: Story = {
  name: "RDF 1.2 triple-annotation form of the same qualified role annotation",
  args: argsByTestFile("11.2.b shui-property-role-qualified.ttl", import.meta.url),
};
