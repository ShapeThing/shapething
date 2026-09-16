import { useEffect, useMemo } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { sh } from "@/helpers/namespaces.ts";
import { Settings } from "@/helpers/icons.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";

export default function DetailsEditor({ shape, term, setTerm, autoFocus }: WidgetProps) {
  const nodeShapes = useMemo(() => shape.get(sh("node")) as Quad_Subject[], [shape]);
  const { enableLogicalBranchSwitching, enableWidgetSwitching } = useEnvironment();

  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph: shape.shapesGraph,
        dataGraph: shape.dataGraph,
        scoresGraph: shape.scoresGraph,
        widgetRegistry: shape.widgetRegistry,
        focusNode: term as Quad_Subject,
        nodeShapes,
        ancestorPath: shape.nestedAncestorPath(),
      }),
    [shape, term, nodeShapes],
  );

  // Unlike a widget that owns a fixed set of sub-predicates directly (AddressEditor, ColorEditor),
  // DetailsEditor only recurses into the value's own shape-declared properties - each nested field
  // writes just its own sub-triple (e.g. <term> sh:prefix "...") with no notion of this property's
  // own path at all. A freshly-created placeholder term (this property's "+"/empty-widget default)
  // is therefore never actually linked in via PropertyUIElement.replaceObject (see
  // PropertyUIComponentObject's setTerm) until something calls setTerm - a sh:or branch switch
  // calls setTerm itself, but a plain multi-valued property using DetailsEditor directly (no
  // branch) has nothing to. Re-affirm the link the moment this node gains its first real
  // sub-triple - mirrors AddressEditor's own setTerm(term) re-affirm - rather than unconditionally
  // on mount, so an untouched empty placeholder doesn't get linked (and validated) before the user
  // has typed anything.
  //
  // Excluded whenever `shape` has no sh:path of its own - both getObjects() and replaceObject()
  // already silently no-op in that case (parsePropertyPath has nothing to parse), which is
  // exactly the situation for a sh:memberShape list item: MemberShapeList builds `shape` straight
  // from the memberShape node itself, which never carries its own sh:path (see
  // MemberShapeList.tsx's `memberElement` - only .get()/.getDefaultObject() are meant to be used
  // on it). Without this guard, getObjects() there returns [] for every item (not just an
  // unlinked one), so every *already-linked* list item would look "not yet linked" here and call
  // setTerm on every render - and since MemberShapeList's onChange is a fresh closure each render,
  // that becomes an actual write-and-rerender loop, repeatedly rebuilding the whole rdf:list. A
  // member's own linkage is entirely MemberShapeList's job (it inserts a fresh item into the
  // rdf:list before DetailsEditor ever mounts) - this effect must stay out of it, and sh:path
  // presence is what tells the two cases apart generically.
  const hasOwnPath = (shape.get(sh("path")) as unknown[]).length > 0;
  const hasOwnTriples = useReactiveRead(
    shape.dataGraph,
    `details-editor-has-triples@${term.value}`,
    () => shape.dataGraph.getQuads(term as Quad_Subject).length > 0,
  );
  useEffect(() => {
    if (!hasOwnPath) return;
    if (hasOwnTriples && !shape.getObjects().some((object) => object.equals(term))) {
      setTerm(term);
    }
  }, [hasOwnPath, hasOwnTriples, shape, term, setTerm]);

  return (
    <div className="st-details-editor">
      {/* FormElement already renders this property's own sh:name above - no need to repeat a
          label here. This button stays purely as a focusable anchor that isn't inside a nested
          property's own .st-property-object__widget wrapper, so WidgetSlot's nearestFocused check
          can still find *this* widget's wrapper and keep the widget-switcher/branch-switcher
          fly-out reachable once the nested form below has its own focusable children. Placed
          before the nested body in DOM order (and visually restored to the trailing side via
          CSS `order`) so tabbing from it lands in the sub-form's own first field, rather than
          skipping past it straight to this property's own outer fly-out. */}
      {(enableLogicalBranchSwitching || enableWidgetSwitching) && (
        <Localized id="details-editor-options" attrs={{ "aria-label": true }}>
          <button
            type="button"
            className="st-icon-button st-details-editor__options"
            aria-label="Field options"
          >
            <Settings />
          </button>
        </Localized>
      )}
      <div className="st-details-editor__body">
        <NodeUIElementChildren nodeUiElement={nodeUiElement} autoFocusFirst={autoFocus} />
      </div>
    </div>
  );
}
