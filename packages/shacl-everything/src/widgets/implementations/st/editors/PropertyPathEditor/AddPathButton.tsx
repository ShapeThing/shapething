import { useState } from "react";
import { Localized } from "@fluent/react";
import { Plus } from "@/helpers/icons.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import PathItemModal from "./PathItemModal.tsx";

type Props = {
  shape: PropertyUIElement;
  className?: string;
  children?: React.ReactNode;
  onAdd: (newItem: PropertyPath) => void;
};

// Every "+" in PropertyPathEditor opens PathItemModal instead of inserting a hardcoded default
// predicate straight away - the user picks the predicate IRI and the path type up front, and
// nothing is added to the path until they hit Save.
export default function AddPathButton({ shape, className, onAdd, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={`${className ?? ""}`} onClick={() => setOpen(true)}>
        {children ?? <Plus />}
      </button>
      <PathItemModal
        open={open}
        shape={shape}
        title={<Localized id="property-path-editor-add-title">Add path item</Localized>}
        onClose={() => setOpen(false)}
        onSave={(newItem) => {
          onAdd(newItem);
          setOpen(false);
        }}
      />
    </>
  );
}
