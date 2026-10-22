import type { NamedNode } from "@rdfjs/types";
import ResourceForm from "@/data-model/ResourceForm.tsx";

const classForm = new URL("./forms/class.ttl#class", import.meta.url);

export default function ClassForm({ owlClass }: { owlClass: NamedNode }) {
  return <ResourceForm form={classForm} focusNode={owlClass} />;
}
