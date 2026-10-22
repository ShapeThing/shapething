import type { BlankNode, NamedNode } from "@rdfjs/types";
import ResourceForm from "@/data-model/ResourceForm.tsx";

const nodeShapeForm = new URL("./forms/nodeShape.ttl#nodeShape", import.meta.url);

export default function NodeShapeForm({ shape }: { shape: NamedNode | BlankNode }) {
  return <ResourceForm form={nodeShapeForm} focusNode={shape} />;
}
