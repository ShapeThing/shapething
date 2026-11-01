import { ShaclRenderer, type SubmitResult } from "@shapething/shacl-renderer";
import "@shapething/shacl-renderer/style.css";
import { DataFactory, Parser } from "n3";
import shapesTurtle from "./shapes.ttl?raw";

const { namedNode } = DataFactory;

// The shapes for a chef and a recipe, as an array of quads.
const shapes = new Parser().parse(shapesTurtle);

// Shows a chef, the shape decides which properties are shown and how.
export function Chef({ quads }) {
  return (
    <ShaclRenderer
      mode="view"
      shapesGraph={shapes}
      dataGraph={quads}
      focusNode={namedNode("https://example.org/chefs/gordon-ramsay")}
      nodeShapes={[namedNode("http://example.org/ChefShape")]}
    />
  );
}

// A form for a recipe, with fields and validation from the shape.
export function RecipeForm({ quads, onSave }) {
  // dataGraph holds the edited recipe, for example to write back to the store.
  const onSubmit = async ({ dataGraph }: SubmitResult) => {
    await onSave(dataGraph);
  };

  return (
    <ShaclRenderer
      mode="edit"
      shapesGraph={shapes}
      dataGraph={quads}
      focusNode={namedNode("https://example.org/recipes/beef-wellington")}
      nodeShapes={[namedNode("http://example.org/RecipeShape")]}
      onSubmit={onSubmit}
    />
  );
}
