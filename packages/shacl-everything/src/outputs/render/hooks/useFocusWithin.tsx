import type { RefObject } from "react";
import useActiveElement from "@/outputs/render/hooks/useActiveElement.tsx";

/**
 * Whether the currently focused element is `ref` itself or any descendant of it - including one
 * nested arbitrarily deep inside another element of the same kind (e.g. a nested value's own
 * widget, such as DetailsEditor's inline sub-form, which renders its own properties'
 * `.st-property-object__widget` wrappers inside this one). A property's fly-out belongs to that
 * property itself, not to whichever of its descendants currently has focus, so it must stay
 * mounted - and Tab-reachable - for as long as focus is anywhere within its own subtree.
 */
export function useFocusWithin(ref: RefObject<Element | null>): boolean {
  const activeElement = useActiveElement();
  if (!ref.current || !activeElement) return false;
  return ref.current === activeElement || ref.current.contains(activeElement);
}
