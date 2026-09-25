import { useEffect } from "react";
import type { Term } from "@rdfjs/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { termKey } from "@/helpers/termKey.ts";

/**
 * The term a fresh value for `property` should start as (see PropertyUIElement.getDefaultObject),
 * used to seed the first input for a property that has no values yet. Pass `enabled: false` to
 * skip resolving it - e.g. when `property` already has values and there's nothing to seed.
 *
 * A property constrained by sh:or/sh:xone has no value yet to detect a branch from, so the first
 * declared branch is used to seed it - otherwise this would fall back to a datatype-less generic
 * default, blind to any of the branches' own constraints (see structure/logicalBranches.ts).
 *
 * `existingObjects` (the property's own current live values) lets this self-correct once the
 * cached default has actually become one of them: most widgets swap their placeholder for a
 * differently-valued term on commit (a literal's replaceObject moves to a new, differently-valued
 * term), so the cached "fresh" default staying cached is harmless - it never coincides with a
 * real value. A compound-node widget (DetailsEditor) is different: it deliberately keeps the
 * placeholder's own identity across the commit (see DetailsEditor's own setTerm re-affirm), so
 * without this check, the exact same now-linked term would be handed out again as "the next fresh
 * slot" the moment "+" is clicked - rendering (and re-linking) the same value a second time instead
 * of seeding a genuinely new one.
 */
export function useDefaultObject(
  property: PropertyUIElement,
  enabled: boolean,
  existingObjects: readonly Term[] = [],
): Term | undefined {
  const { activeLanguage } = useContentLanguage();
  const queryClient = useQueryClient();

  // Keyed on the focus node too: a minted default (e.g. DetailsEditor's fresh blank node) must be
  // per-parent, or two sibling nested forms of the same shape (two authors, each with an empty
  // address) would be handed the same placeholder term and end up sharing one value.
  const queryKey = [
    "default-object",
    termKey(property.focusNode),
    property.propertyShapes.map((shape) => shape.value),
    activeLanguage,
    enabled,
  ];

  const { data } = useQuery({
    queryKey,
    ...noRefetch,
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so "nothing to seed" is represented as `null` instead.
    queryFn: async () => {
      if (!enabled) return null;
      const branches = logicalBranches(property);
      const source = branches.length > 0 ? withBranch(property, branches[0].shape) : property;
      return (await source.getDefaultObject(activeLanguage)) ?? null;
    },
  });

  const cachedDefaultIsNowLinked =
    data != null && existingObjects.some((object) => object.equals(data));
  useEffect(() => {
    if (cachedDefaultIsNowLinked) queryClient.invalidateQueries({ queryKey });
    // queryKey is a fresh array every render - keying this off cachedDefaultIsNowLinked alone
    // (recomputed from the same property/data/existingObjects every render) is what actually
    // determines whether there's new work to do here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedDefaultIsNowLinked]);

  return cachedDefaultIsNowLinked ? undefined : (data ?? undefined);
}
