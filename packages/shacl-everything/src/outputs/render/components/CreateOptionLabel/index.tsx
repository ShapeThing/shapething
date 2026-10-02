import { Localized } from "@fluent/react/esm/localized.js";
import { Plus } from "@/helpers/icons.tsx";

/**
 * The "Create new…" row content shared by the reference-picking editors (see useCreateInPlace) -
 * "Create new Dog…" instead once `label` names which of several creatable classes it is.
 */
export default function CreateOptionLabel({ label }: { label: string | undefined }) {
  return (
    <span className="st-create-option">
      <Plus />
      {label === undefined ? (
        <Localized id="create-new-reference-option">Create new…</Localized>
      ) : (
        <Localized id="create-new-reference-option-class" vars={{ class: label }}>
          {`Create new ${label}…`}
        </Localized>
      )}
    </span>
  );
}
