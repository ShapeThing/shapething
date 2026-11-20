import { useCommit, useDataModel } from "../../data-model/dataModelContext.ts";
import { isDeactivated, setDeactivated } from "../../data-model/editGraphs.ts";
import type { Resource } from "../../data-model/rdf.ts";

// Switches an imported shape, constraint or rule off or on with a sh:deactivated triple in the
// data model's own graph. A blank node from an import has no name that triple could use once saved.
export function DeactivateButton({ term }: { term: Resource }) {
  const dataModel = useDataModel();
  const commit = useCommit();
  const deactivated = isDeactivated(dataModel, term);
  const blank = term.termType === "BlankNode";

  return (
    <button
      type="button"
      className="st-button"
      disabled={blank}
      title={
        blank ? "A blank node from an import can't be referred to from the data model." : undefined
      }
      onClick={() => commit(setDeactivated(dataModel, term, !deactivated))}
    >
      {deactivated ? "Enable" : "Disable"}
    </button>
  );
}
