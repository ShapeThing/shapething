import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.additionsGraph/deletionsGraph (view mode): render a change. dataGraph is the data as
// it is now, additionsGraph what was added to get there, deletionsGraph what was removed - the same
// shape as an edit's SubmitResult. Removed values are shown struck through next to the current
// ones, added ones highlighted, and a text value that was swapped for another shows as one value
// with the edit marked inside it.
export default {
  title: "Environment/additionsGraph and deletionsGraph",
  component: ShaclRenderer,
};

const prefixes = `
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  @prefix sh: <http://www.w3.org/ns/shacl#> .
`;

const shapesGraph = `${prefixes}
  ex:PersonShape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Name"@en ; sh:path schema:name ; sh:datatype xsd:string ; sh:order 0 ] ;
    sh:property [
      sh:name "Description"@en ; sh:path schema:description ; sh:datatype xsd:string ; sh:order 1
    ] ;
    sh:property [
      sh:name "Motto"@en ; sh:path ex:motto ; sh:datatype rdf:langString ; sh:order 2
    ] ;
    sh:property [ sh:name "Nickname"@en ; sh:path ex:nickname ; sh:datatype xsd:string ; sh:order 3 ] ;
    sh:property [ sh:name "Email"@en ; sh:path schema:email ; sh:nodeKind sh:IRI ; sh:order 4 ] ;
    sh:property [ sh:name "Job title"@en ; sh:path schema:jobTitle ; sh:datatype xsd:string ; sh:order 5 ] .
`;

// The data as it is now.
const dataGraph = `${prefixes}
  ex:alice a schema:Person ;
    schema:name "Alice" ;
    schema:description "Likes the slow brown fox" ;
    ex:motto "Carpe noctem"@en ;
    ex:nickname "Ally" ;
    schema:email <mailto:alice@example.com> .
`;

const additionsGraph = `${prefixes}
  ex:alice
    schema:description "Likes the slow brown fox" ;
    ex:motto "Carpe noctem"@en ;
    ex:nickname "Ally" ;
    schema:email <mailto:alice@example.com> .
`;

const deletionsGraph = `${prefixes}
  ex:alice
    schema:description "Likes the quick brown fox" ;
    ex:motto "Carpe diem"@en ;
    schema:email <mailto:alice@example.org> ;
    schema:jobTitle "Engineer" .
`;

const formElement = (canvasElement: HTMLElement, label: string) =>
  waitFor(() => {
    const element = [...canvasElement.querySelectorAll(".st-form-element")].find(
      (candidate) =>
        candidate.querySelector(".st-form-element__label-text")?.textContent?.trim() === label,
    );
    if (!element) throw new Error(`No "${label}" property rendered yet`);
    return element;
  });

export const diff: Story = {
  name: "Additions highlighted, deletions struck through, edited text marked inline",
  args: {
    shapesGraph,
    dataGraph,
    additionsGraph,
    deletionsGraph,
    mode: "view",
    nodeShapes: [factory.namedNode("http://example.org/PersonShape")],
    focusNode: factory.namedNode("http://example.org/alice"),
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    // Unchanged: no marker at all.
    const name = await formElement(canvasElement, "Name");
    expect(name.querySelector("[data-diff]")).toBeNull();

    // One xsd:string swapped for another: a single value, the edit marked inside it.
    const description = await formElement(canvasElement, "Description");
    expect(description.querySelectorAll(".st-property-object-wrapper")).toHaveLength(1);
    expect(description.querySelector("[data-diff]")).toHaveAttribute("data-diff", "changed");
    expect(description.querySelector(".st-diff-text__removed")).toHaveTextContent("quick");
    expect(description.querySelector(".st-diff-text__added")).toHaveTextContent("slow");

    // Same for rdf:langString.
    const motto = await formElement(canvasElement, "Motto");
    expect(motto.querySelector(".st-diff-text__removed")).toHaveTextContent("diem");
    expect(motto.querySelector(".st-diff-text__added")).toHaveTextContent("noctem");

    // Only added.
    const nickname = await formElement(canvasElement, "Nickname");
    expect(nickname.querySelector("ins[data-diff='added']")).toHaveTextContent("Ally");

    // IRIs are never merged into one value: the old one removed, the new one added.
    const email = await formElement(canvasElement, "Email");
    expect(email.querySelector("del[data-diff='removed']")).toHaveTextContent(/example org/);
    expect(email.querySelector("ins[data-diff='added']")).toHaveTextContent(/example com/);

    // A property that only had a value before is still shown - as removed.
    const jobTitle = await formElement(canvasElement, "Job title");
    expect(jobTitle.querySelector("del[data-diff='removed']")).toHaveTextContent("Engineer");
  },
};
