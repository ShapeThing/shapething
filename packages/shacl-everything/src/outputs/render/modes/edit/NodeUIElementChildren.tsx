import { memo } from "react";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { groupChildren } from "@/structure/groupChildren.ts";
import UIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";

// Memoized: NodeUIComponent re-renders whenever useTargetWhereFragments sees a write to a
// predicate a sh:targetWhere shape watches, but nodeUiElement (and so groupChildren's cached
// result) only changes when the attached fragments actually do - without this, every such write
// re-rendered the whole form. Everything below reads its own data reactively.
export default memo(function NodeUIElementChildren({
  nodeUiElement,
  autoFocusFirst,
}: {
  nodeUiElement: NodeUIElement;
  // Forwarded from a composite widget (DetailsEditor) that has no single control of its own to
  // focus when it was just added - the first rendered child gets a chance to focus itself (or
  // recurse further, if it's itself another composite) instead.
  autoFocusFirst?: boolean;
}) {
  const elements = groupChildren(
    nodeUiElement.children(),
    nodeUiElement.shapesGraph,
    nodeUiElement.dataGraph,
    nodeUiElement.focusNode,
    nodeUiElement.widgetRegistry,
  );
  return <UIElementChildren elements={elements} autoFocusFirst={autoFocusFirst} />;
});
