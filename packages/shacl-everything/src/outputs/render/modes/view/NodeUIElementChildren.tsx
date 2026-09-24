import { useMemo } from "react";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { groupChildren } from "@/structure/groupChildren.ts";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import UIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";

export default function NodeUIElementChildren({ nodeUiElement }: { nodeUiElement: NodeUIElement }) {
  const environment = useEnvironment();
  // This view-mode tree can be mounted from inside edit mode (IRIEditor/LabelViewer's
  // enableViewInPlace modal, DetailsViewer for a readOnlyGraph value). Group widgets and editors
  // doubling as viewers (e.g. AutoCompleteEditor) pick edit vs view off Environment.mode, so it has
  // to read "view" for everything below here - otherwise grouped properties render as editors.
  const viewEnvironment = useMemo(
    () => (environment.mode === "view" ? environment : { ...environment, mode: "view" as const }),
    [environment],
  );
  const elements = groupChildren(
    nodeUiElement.children(),
    nodeUiElement.shapesGraph,
    nodeUiElement.dataGraph,
    nodeUiElement.focusNode,
    nodeUiElement.widgetRegistry,
  );
  return (
    <environmentContext.Provider value={viewEnvironment}>
      <UIElementChildren elements={elements} />
    </environmentContext.Provider>
  );
}
