import { useMemo } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { Plus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import { shaclInstancesOfClass } from "@/resolution/targets.ts";
import { Localized } from "@fluent/react/esm/localized.js";
import { useCreateInPlace } from "@/outputs/render/hooks/useCreateInPlace.ts";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import "./style.css";

export default function InstancesSelectEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const shClasses = shape.get(sh("class"));
  const existingObjects = useDataGraphObjects(shape);

  const subjects = useMemo(() => {
    const seen = new Set<string>();
    const result: Quad_Subject[] = [];
    for (const shClass of shClasses) {
      for (const instance of shaclInstancesOfClass(shClass, shape.dataGraph, shape.shapesGraph)) {
        if (!seen.has(instance.value)) {
          seen.add(instance.value);
          result.push(instance);
        }
      }
    }
    return result.filter(
      (subject) =>
        !existingObjects.some((obj) => obj.value === subject.value && obj.value !== term.value),
    );
  }, [shClasses, shape, existingObjects, term]);

  // "Create new…": staged in a scratch copy, only written for real on Done - see useCreateInPlace.
  // Not offered at all without a shape describing the new instance's own fields (its sh:node, or a
  // node shape targeting its sh:class - see canCreateInPlace/valueNodeShapes).
  const { canCreate, draft, start: createNew, commit, cancel: cancelCreate } = useCreateInPlace(
    shape,
    setTerm,
  );

  return (
    <>
      <SelectListbox
        ariaLabelledby={labelledBy}
        autoFocus={autoFocus}
        value={term.value}
        options={subjects.map((s) => s.value)}
        onChange={(v) => setTerm(factory.namedNode(v))}
        renderTriggerContent={(v) =>
          v ? (
            valueNodeLabel({
              term: factory.namedNode(v),
              propertyShape: shape,
              languages: [activeInterfaceLanguage],
            }).value
          ) : (
            <Localized id="select-an-option" />
          )
        }
        renderOption={(v) =>
          valueNodeLabel({
            term: factory.namedNode(v),
            propertyShape: shape,
            languages: [activeInterfaceLanguage],
          }).value
        }
        // Always offered when enabled - regardless of whether any existing instances are already
        // available to pick - and visually set apart (see style.css) from the ordinary options
        // above it, since picking it does something categorically different (creates new data)
        // rather than just selecting among what already exists.
        extraRow={
          canCreate
            ? {
                content: (
                  <span className="st-create-option">
                    <Plus />
                    <Localized id="create-new-reference-option">Create new…</Localized>
                  </span>
                ),
                onActivate: createNew,
              }
            : undefined
        }
      />
      {draft && (
        <Modal
          open
          onClose={cancelCreate}
          title={<Localized id="create-new-reference-title">New item</Localized>}
          dataGraph={draft.dataGraph}
        >
          <NodeUIElementChildren nodeUiElement={draft.node} />
          <div className="st-instances-select-editor__create-actions">
            <button type="button" className="st-button st-button--primary" onClick={commit}>
              <Localized id="create-new-reference-done">Done</Localized>
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
