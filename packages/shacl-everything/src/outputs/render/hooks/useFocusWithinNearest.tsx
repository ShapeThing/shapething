import type { RefObject } from "react";
import useActiveElement from "@/outputs/render/hooks/useActiveElement.tsx";

/**
 * Whether the currently focused element shares its nearest `selector` ancestor with `ref` - true
 * both when `ref` itself is focused and when some *other* descendant of that same ancestor is
 * (e.g. a fly-out rendered as a sibling elsewhere within it), false once focus moves to a
 * *different* such ancestor (e.g. a nested property's own wrapper nested inside this one - see
 * PropertyUIComponentObject, where a plain ref.contains() would otherwise match every ancestor
 * wrapper at once for a deeply nested field).
 */
export function useFocusWithinNearest(ref: RefObject<Element | null>, selector: string): boolean {
  const activeElement = useActiveElement();

  const hasBlock = ref.current?.querySelector("[data-block-fly-out]") !== null;
  if (hasBlock) {
    return false;
  }

  const container = ref.current?.closest(selector) ?? null;
  if (!container || !activeElement) return false;
  return activeElement.closest(selector) === container;
}
