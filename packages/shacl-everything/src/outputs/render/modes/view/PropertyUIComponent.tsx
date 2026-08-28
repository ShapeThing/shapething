import { useId } from "react";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useRegisterContentLanguageSwitcherWidget } from "@/outputs/render/hooks/useRegisterContentLanguageSwitcherWidget.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import MemberShapeList from "@/outputs/render/modes/view/MemberShapeList.tsx";
import PropertyUIComponentObject from "@/outputs/render/modes/view/PropertyUIComponentObject.tsx";
import { filterByContentLanguage } from "@/helpers/filterByContentLanguage.ts";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import { languageLabels } from "@/helpers/languageLabels.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

/**
 * The view-mode counterpart to edit mode's PropertyUIComponent: same label/description chrome,
 * but read-only - no add/remove affordances, no empty-widget bookkeeping, and a property with no
 * values to show renders nothing at all rather than an empty field waiting to be filled in.
 */
export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  const { languageMode, viewModeLabelLayout } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const isRdfLangString = propertyUIElement.get(sh("datatype"))?.equals(rdf("langString"));
  // Resolved on the property shape alone (no valueNode), same reasoning as edit mode's own
  // early useWidget() call: this only needs whichever viewer would apply generically, to check
  // singleUnifiedWidget below - not the one a specific value might additionally score into.
  const widget = useWidget(shui("viewer"), propertyUIElement);
  useRegisterContentLanguageSwitcherWidget(Boolean(isRdfLangString));
  const memberShapeNodes = propertyUIElement.get(sh("memberShape"));

  const labelId = useId();
  const label = propertyUIElement.label([activeInterfaceLanguage]);
  const description = propertyUIElement.get(sh("description"), [activeInterfaceLanguage])?.value;

  const existingObjects = useDataGraphObjects(propertyUIElement);
  const languageFilteredObjects =
    languageMode === "individual"
      ? existingObjects
      : filterByContentLanguage(existingObjects, activeLanguage);

  // A singleUnifiedWidget (e.g. ValueTableViewer) renders once for the whole property and reads
  // every value itself via `shape` - see PropertyUIComponentValues' identical reasoning in edit
  // mode. Passing it every value here would render it once per value instead of once total.
  const isSingleUnifiedWidget = widget?.meta?.singleUnifiedWidget?.(propertyUIElement) === true;
  const objects = isSingleUnifiedWidget
    ? languageFilteredObjects.slice(0, 1)
    : languageFilteredObjects;

  // Nothing to view: unlike edit mode, there's no empty widget to fall back to. Also gates the
  // sh:memberShape branch below - a list property with no head triple yet has nothing to walk.
  if (objects.length === 0) return null;

  // "inline" only reads well for a single value sitting beside its label - a list of values (or
  // a singleUnifiedWidget like ValueTableViewer, inherently block-level) instead drops to its own
  // line below the label, same as "block", regardless of the global viewModeLabelLayout setting.
  const isList =
    memberShapeNodes.length > 0 || isSingleUnifiedWidget || languageFilteredObjects.length > 1;
  const labelLayout = isList ? "block" : viewModeLabelLayout;

  return (
    <FormElement
      label={
        label && activeLanguage && isRdfLangString ? (
          <>
            {label}{" "}
            {languageMode === "switcher" && (
              <span className="st-property-language-tag">
                ({Object.values(languageLabels([activeLanguage], activeInterfaceLanguage))})
              </span>
            )}
          </>
        ) : (
          `${label}`
        )
      }
      showColon={true}
      labelTitle={propertyUIElement.pathAsSparql()}
      labelId={labelId}
      tooltip={description}
      labelLayout={labelLayout}
    >
      {memberShapeNodes.length > 0 ? (
        <MemberShapeList
          propertyUIElement={propertyUIElement}
          memberShapeNodes={memberShapeNodes}
          labelledBy={labelId}
        />
      ) : (
        <div className="st-property-items">
          {objects.map((object, index) => (
            <PropertyUIComponentObject
              key={index}
              propertyUIElement={propertyUIElement}
              object={object}
              labelledBy={labelId}
            />
          ))}
        </div>
      )}
    </FormElement>
  );
}
