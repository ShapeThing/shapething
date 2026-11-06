import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Whether the element has come near the visible part of `root` (a scroll container) yet; once it
 * has, it stays true. A column can have a thousand people, this keeps the renderers of the ones
 * that are scrolled far away from being made until they are needed. `force` makes it true at once.
 */
export const useInView = <Element extends HTMLElement>(
  root: RefObject<HTMLElement | null>,
  force = false,
) => {
  const ref = useRef<Element>(null);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (hasBeenInView || force || !element) return;

    if (!("IntersectionObserver" in window)) {
      setHasBeenInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasBeenInView(true);
          observer.disconnect();
        }
      },
      { root: root.current, rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasBeenInView, force, root]);

  return [ref, hasBeenInView || force] as const;
};
