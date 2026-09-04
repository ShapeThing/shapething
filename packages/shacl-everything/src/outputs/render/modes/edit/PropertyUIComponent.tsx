import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import ValidationMessages from "@/outputs/render/components/ValidationMessages/index.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useRegisterContentLanguageSwitcherWidget } from "@/outputs/render/hooks/useRegisterContentLanguageSwitcherWidget.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { usePropertyValidationResults } from "@/outputs/render/hooks/usePropertyValidationResults.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import MemberShapeList from "@/outputs/render/modes/edit/MemberShapeList.tsx";
import PropertyUIComponentValues from "@/outputs/render/modes/edit/PropertyUIComponentValues.tsx";
import { localName } from "@/helpers/localName.ts";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import language, { configuredLanguages } from "@/resolution/language.ts";
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
  // Resolved on the property shape alone (no valueNode) so this stays stable across a value's own
  // async default-term resolution and per-value add/remove, rather than tracking whichever widget
  // instance happens to be mounted right now - see useRegisterContentLanguageSwitcherWidget.
  const widget = useWidget(shui("editor"), propertyUIElement);
  useRegisterContentLanguageSwitcherWidget(Boolean(widget?.meta?.needsLanguageSwitcher));
  // sh:memberShape means this property's value is an rdf:List head, not a plain value (or set of
  // values) to render one widget instance per - MemberShapeList owns that rendering entirely,
  // resolving each list item's own widget generically rather than PropertyUIComponentValues'
  // per-value loop, which assumes a value can be read/written directly through this element's
  // sh:path.
  const memberShapeNodes = propertyUIElement.get(sh("memberShape"));

  const labelId = useId();
  const label = propertyUIElement.label([activeInterfaceLanguage]);
  const description = propertyUIElement.description([activeInterfaceLanguage]);

  // Real SHACL validation results for this property (see ValidationContextProvider) - both
  // property-wide (e.g. sh:minCount, no `value`) and per-value (e.g. sh:pattern tied to one
  // specific value, shown instead by PropertyUIComponentObject to avoid reporting it twice).
  const validationResults = usePropertyValidationResults(propertyUIElement);
  const propertyWideResults = validationResults.filter((result) => !result.value);
  // sh:message is chrome (like sh:name/sh:description), so it's resolved the same way - one
  // best-matching language-tagged literal, not every language variant concatenated together.
  const messageLanguages = configuredLanguages(propertyUIElement.shapesGraph, [
    activeInterfaceLanguage,
  ]);

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
    >
      <ValidationMessages
        className="st-validation-messages--property"
        messages={propertyWideResults.map((result) => ({
          severity: localName(result.severity) ?? "Violation",
          message: result.message.length ? language(result.message, messageLanguages).value : "",
        }))}
      />
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
