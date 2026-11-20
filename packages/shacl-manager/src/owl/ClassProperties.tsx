import { rdf, rdfs } from "@shapething/shacl-renderer";
import { Suspense } from "react";
import { CreateButton } from "../app/edit/CreateButton.tsx";
import { ListDetail } from "../app/ListDetail.tsx";
import { useOrigin } from "../app/paths.ts";
import { Tree } from "../app/Tree.tsx";
import { useTermParam } from "../app/useTermParam.ts";
import { factory, type Resource } from "../data-model/rdf.ts";
import { countNodes } from "../data-model/tree.ts";
import { owlMeta } from "./metaShapes.ts";
import { useClassPropertyTree } from "./propertyIndex.ts";

export function ClassProperties() {
  const term = useTermParam("class");
  const origin = useOrigin();

  return (
    <ListDetail
      title="Properties"
      actions={
        // An rdf:Property to start with; the form's type field can make it an OWL property.
        term &&
        origin === "managed" && (
          <CreateButton
            {...owlMeta.property.edit}
            label="property"
            kind="property"
            type={rdf("Property")}
            links={(node) => [factory.quad(node, rdfs("domain"), term)]}
            to={(segment) => `./${segment}`}
          />
        )
      }
    >
      {term && (
        <Suspense fallback="Loading properties…">
          <PropertyTree term={term} />
        </Suspense>
      )}
    </ListDetail>
  );
}

function PropertyTree({ term }: { term: Resource }) {
  const nodes = useClassPropertyTree(term);
  if (nodes.length === 0) return <p>No properties with this class as rdfs:domain.</p>;
  return <Tree nodes={nodes} linkTo={(segment) => `./${segment}`} />;
}

export function ClassPropertiesCount() {
  const term = useTermParam("class");
  return term ? <Count term={term} /> : null;
}

function Count({ term }: { term: Resource }) {
  return countNodes(useClassPropertyTree(term));
}
