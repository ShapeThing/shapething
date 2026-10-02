import type { NamedNode } from "@rdfjs/types";
import FocusNodeEditor from "@/outputs/render/components/FocusNodeEditor/index.tsx";
import type { CreateInPlaceDraft } from "@/outputs/render/hooks/useCreateInPlace.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

/**
 * The "Identifier" field inside a "Create new…" modal (Environment.enableFocusNodeEditor): picks the
 * IRI the new resource is committed under instead of its minted urn:uuid - see useCreateInPlace's
 * renameSubject. Renders nothing while the option is off.
 */
export default function DraftFocusNodeEditor({
  draft,
  renameSubject,
}: {
  draft: CreateInPlaceDraft;
  renameSubject: (iri: NamedNode) => void;
}) {
  const { enableFocusNodeEditor } = useEnvironment();
  if (!enableFocusNodeEditor) return null;
  return (
    <FocusNodeEditor
      current={draft.subject}
      value={draft.renamedSubject}
      onChange={renameSubject}
      dataGraph={draft.dataGraph}
      shapesGraph={draft.node.shapesGraph}
      nodeShapes={draft.node.nodeShapes}
    />
  );
}
