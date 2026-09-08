import { createContext } from "react";

export type MemberShapeTableContextValue = {
  // True only inside a MemberShapeList whose items collapse into one st:HorizontalPropertyGroup
  // and therefore render a single header row above them (see MemberShapeList/
  // MemberShapeListHeader) - every grouped field inside a row must then suppress its own per-row
  // FormElement label/legend, since the header already carries it once for the whole list.
  hideLabels: boolean;
  // The id of this column's header label, for a row's own field to point its aria-labelledby at
  // instead of rendering (and needing) a label of its own. Only meaningful when hideLabels is
  // true - the default no-op means "not inside a table-mode list at all".
  labelledByForColumn: (columnIndex: number) => string | undefined;
};

// A concrete default (not undefined) rather than the usual context-plus-throwing-hook pattern:
// "no provider above me" and "hideLabels: false" are the same thing here, so there's no invalid
// state to guard against - HorizontalPropertyGroup can read this unconditionally, including for
// its many uses outside any MemberShapeList (e.g. a single-instance sh:maxCount 1 group).
export const memberShapeTableContext = createContext<MemberShapeTableContextValue>({
  hideLabels: false,
  labelledByForColumn: () => undefined,
});
