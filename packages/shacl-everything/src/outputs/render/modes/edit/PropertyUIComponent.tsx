import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import MemberShapeList from "@/outputs/render/modes/edit/MemberShapeList.tsx";
import PropertyUIComponentValues from "@/outputs/render/modes/edit/PropertyUIComponentValues.tsx";
import { localName } from "@/helpers/localName.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";
import { useId } from "react";
import { languageLabels } from "@/helpers/languageLabels.ts";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  const { languageMode } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const isRdfLangString = propertyUIElement.get(sh("datatype"))?.equals(rdf("langString"));
  // Reads this.dataGraph reactively, same as PropertyUIComponentValues/MemberShapeList's own
  // reads below - only used here for the minCount/severity check, which is meaningful either way
  // ("does this property have a value at all" is a different question from a memberShape list's
  // own sh:minListLength).
  const existingObjects = useDataGraphObjects(propertyUIElement);
  // sh:memberShape means this property's value is an rdf:List head, not a plain value (or set of
  // values) to render one widget instance per - MemberShapeList owns that rendering entirely,
  // resolving each list item's own widget generically rather than PropertyUIComponentValues'
  // per-value loop, which assumes a value can be read/written directly through this element's
  // sh:path.
  const memberShapeNodes = propertyUIElement.get(sh("memberShape"));

  const labelId = useId();
  const label = propertyUIElement.label([activeInterfaceLanguage]);
  const description = propertyUIElement.get(sh("description"), [activeInterfaceLanguage])?.value;

  // sh:minCount isn't met yet - the shape's sh:severity (sh:Violation, the spec default, when
  // absent) describes how serious that unmet constraint is, for the caller to style as it sees fit.
  const minCount = propertyUIElement.get(sh("minCount")) ?? 0;
  const isMissingRequiredValue = existingObjects.length < minCount;
  const severity = isMissingRequiredValue
    ? (localName(propertyUIElement.get(sh("severity"))) ?? "Violation")
    : undefined;

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
          label
        )
      }
      labelTitle={propertyUIElement.pathAsSparql()}
      labelId={labelId}
      description={description}
      severity={severity}
    >
      {memberShapeNodes.length > 0 ? (
        <MemberShapeList
          propertyUIElement={propertyUIElement}
          memberShapeNodes={memberShapeNodes}
          labelledBy={labelId}
        />
      ) : (
        <PropertyUIComponentValues propertyUIElement={propertyUIElement} labelId={labelId} />
      )}
    </FormElement>
  );
}
