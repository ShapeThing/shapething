import { termKey } from "@/helpers/termKey.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * A stable React key for one sibling in a UIElementChildren list, independent of the
 * PropertyUIElement/ChoiceElement/GroupUIElement instance's own identity - childrenForShape()/
 * groupChildren() legitimately construct a brand-new instance for the same logical
 * property/choice/group on every call (e.g. every write to a sh:targetWhere discriminant, see
 * useTargetWhereFragments.tsx), so keying a list by array index or by the instance itself causes
 * React to misattribute local state to the wrong element - or unmount/remount everything past a
 * length change - whenever that list's order or length shifts.
 *
 * - property: pathAsSparql() is the same canonical path groupPropertyShapesByPath() already groups
 *   co-path shapes by, so it stays identical no matter which subset of propertyShapes currently
 *   contributes to that path (e.g. a fragment attaching a co-path property shape doesn't change it).
 *   Only shapes with a parseable path ever become a PropertyUIElement, so this is never undefined.
 * - choice: shape+connective+list are literally the (subject, predicate, object) triple
 *   childrenForShape() matched to construct this ChoiceElement, unique per triple.
 * - group: termKey(node) - the same identity TabbedPropertyGroupFamily already keys tabs by.
 */
export function elementKey(element: PropertyUIElement | ChoiceElement | GroupUIElement): string {
  switch (element.kind) {
    case "property":
      return `property:${element.pathAsSparql()}`;
    case "choice":
      return `choice:${termKey(element.shape)}:${element.connective}:${termKey(element.list)}`;
    case "group":
      return `group:${termKey(element.node)}`;
  }
}
