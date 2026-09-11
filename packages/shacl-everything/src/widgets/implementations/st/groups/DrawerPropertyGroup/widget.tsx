import { useId } from "react";
import { Localized, useLocalization } from "@fluent/react";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import AddPropertySelect from "@/widgets/implementations/st/groups/DrawerPropertyGroup/AddPropertySelect.tsx";
import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function DrawerPropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { activeLanguage } = useContentLanguage();
  const { l10n } = useLocalization();
  const label = group.label([activeInterfaceLanguage]);
  const description = group.description([activeInterfaceLanguage]);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;
  const selectId = useId();

  // Only this group's own direct plain properties are ever candidates for the "unused" drawer - a
  // nested sub-group/choice always renders through the normal path below regardless of whether
  // anything inside it has a value yet, and a sh:memberShape property is an rdf:List head (see
  // PropertyUIComponent's own identical check), not a plain value this group could add on its own.
  const candidates = group.children.filter(
    (child): child is PropertyUIElement =>
      child.kind === "property" && child.get(sh("memberShape")).length === 0,
  );

  // Subscribes to a single, cheap pattern - every quad on this group's own focus node - rather
  // than one pattern per candidate property. useReactiveRead/reactiveRdfStore.ts auto-derives its
  // tracked patterns from whichever getQuads() calls `read` itself makes, so calling
  // candidate.getObjects() (one getQuads() each) directly inside `read` would register one pattern
  // per candidate - fine for one property's own useDataGraphObjects, but a real-world profile can
  // put hundreds of optional properties in a single group (e.g. the RDA-FR showcase, up to ~300),
  // and re-subscribing that many patterns on every render turned out to compound a separate,
  // pre-existing render-loop quirk in useReactiveRead into a multi-second stall. The actual
  // used/unused split is instead computed plainly below, on every render - cheap on its own, and
  // only re-derived when a write to this focus node actually happened.
  useReactiveRead(
    group.dataGraph,
    group.focusNode.value,
    () => group.dataGraph.getQuads(group.focusNode).length,
  );

  const unused = candidates.filter((candidate) => candidate.getObjects().length === 0);
  const unusedSet = new Set<PropertyUIElement>(unused);
  const visibleChildren = group.children.filter(
    (child) => !(child.kind === "property" && unusedSet.has(child)),
  );

  const addProperty = async (property: PropertyUIElement) => {
    const term = await property.getDefaultObject(activeLanguage);
    if (term) property.addObject(term);
  };

  return (
    <div className="st-property-group st-property-group--drawer" data-iri={group.node.value}>
      {label && (
        <div className="st-property-group__legend">
          <span className="st-property-group__title">{label}</span>
        </div>
      )}
      {description && <p className="st-property-group__description">{description}</p>}
      <div className="st-property-group__body">
        <UIElementChildren elements={visibleChildren} />
        {mode !== "view" && unused.length > 0 && (
          <FormElement
            size="small"
            className="st-drawer-property-group__add"
            label={<Localized id="drawer-property-group-add-label">Add a property</Localized>}
            htmlFor={selectId}
          >
            <AddPropertySelect
              triggerId={selectId}
              properties={unused}
              getLabel={(property) => property.label([activeInterfaceLanguage])}
              onSelect={(property) => {
                void addProperty(property);
              }}
              placeholder={l10n.getString("select-an-option", undefined, "- Select an option -")}
            />
          </FormElement>
        )}
      </div>
    </div>
  );
}
