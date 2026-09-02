import type { RefObject } from "react";
import useActiveElement from "@/outputs/render/hooks/useActiveElement.tsx";

/**
 * Whether the currently focused element shares its nearest `selector` ancestor with `ref` - true
 * both when `ref` itself is focused and when some *other* descendant of that same ancestor is
 * (e.g. a fly-out rendered as a sibling elsewhere within it), false once focus moves to a
 * *different*, more deeply nested such ancestor (e.g. a nested property's own wrapper nested
 * inside this one - see PropertyUIComponentObject, where a plain ref.contains() would otherwise
 * match every ancestor wrapper at once for a deeply nested field). Used to gate WidgetSlot's own
 * WidgetSwitcher specifically - a per-value "which widget renders this" choice that only makes
 * sense for whichever wrapper is actually innermost-focused, unlike LogicalConstraintSwitcher
 * (see useFocusWithin), which belongs to the property as a whole regardless of nesting depth.
 */
export function useFocusWithinNearest(ref: RefObject<Element | null>, selector: string): boolean {
  const activeElement = useActiveElement();
  const container = ref.current?.closest(selector) ?? null;
  if (!container || !activeElement) return false;
  return activeElement.closest(selector) === container;
}
