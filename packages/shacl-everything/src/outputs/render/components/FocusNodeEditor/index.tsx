import { useEffect, useId, useState } from "react";
import { Localized, useLocalization } from "@fluent/react";
import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import ValidationMessages from "@/outputs/render/components/ValidationMessages/index.tsx";
import { focusNodeIriProblem } from "@/outputs/render/components/FocusNodeEditor/focusNodeIriProblem.ts";

const PROBLEM_MESSAGE_IDS = {
  invalid: "focus-node-editor-invalid",
  "in-use": "focus-node-editor-in-use",
  pattern: "focus-node-editor-pattern",
} as const;

type Props = {
  // The focus node as the data graph currently has it - what the edited value is checked against.
  current: NamedNode;
  // The IRI it will have once the form is submitted (see Environment.enableFocusNodeEditor).
  value: NamedNode;
  onChange: (value: NamedNode) => void;
  dataGraph: RdfStore;
  shapesGraph: RdfStore;
  nodeShapes: Quad_Subject[];
};

/**
 * Edits the IRI of the resource the form itself is about (Environment.enableFocusNodeEditor). Only
 * a valid, unused IRI the node shapes allow is handed to onChange (on blur, like every other text
 * field) - anything else stays in the input with a message, so the pending identifier is always
 * one the form can actually be submitted with. The message is shown exactly like a SHACL
 * validation result on a value (same ValidationMessages, same data-severity on the value wrapper).
 */
export default function FocusNodeEditor({
  current,
  value,
  onChange,
  dataGraph,
  shapesGraph,
  nodeShapes,
}: Props) {
  const id = useId();
  const { l10n } = useLocalization();
  const [localValue, setLocalValue] = useState(value.value);
  useEffect(() => setLocalValue(value.value), [value.value]);
  const problem = focusNodeIriProblem(localValue.trim(), {
    current,
    dataGraph,
    shapesGraph,
    nodeShapes,
  });

  return (
    <Localized id="focus-node-editor" attrs={{ label: true, description: true }}>
      <FormElement
        className="st-focus-node-editor"
        label="Identifier"
        description="The IRI that identifies this resource."
        htmlFor={id}
      >
        <div className="st-property-object-wrapper">
          <div className="st-property-object" data-severity={problem ? "Violation" : undefined}>
            <div className="st-property-object-main">
              <div className="st-property-object__widget">
                <input
                  id={id}
                  type="text"
                  className="st-input"
                  inputMode="url"
                  spellCheck={false}
                  value={localValue}
                  aria-invalid={problem !== undefined}
                  onChange={(event) => setLocalValue(event.target.value)}
                  onBlur={() => {
                    const iri = localValue.trim();
                    if (problem === undefined && iri !== value.value) {
                      onChange(factory.namedNode(iri));
                    }
                  }}
                />
              </div>
              <ValidationMessages
                messages={
                  problem
                    ? [{ severity: "Violation", message: l10n.getString(PROBLEM_MESSAGE_IDS[problem]) }]
                    : []
                }
              />
            </div>
          </div>
        </div>
      </FormElement>
    </Localized>
  );
}
