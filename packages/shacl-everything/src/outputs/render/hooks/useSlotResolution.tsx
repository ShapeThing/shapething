import type { NamedNode, Term } from "@rdfjs/types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { termKey } from "@/helpers/termKey.ts";
import { activeBranchQueryOptions } from "@/outputs/render/hooks/useActiveBranch.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { widgetQueryOptions } from "@/outputs/render/hooks/useWidget.tsx";
import { logicalBranches, withBranch, type LogicalBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getWidgetComponent, getWidgetMeta, widgetModeForPredicate } from "@/widgets/registry.ts";
import type { WidgetComponent, WidgetMeta } from "@/widgets/types.ts";

export type SlotResolution = {
  branches: LogicalBranch[];
  // The branch `value` itself conforms to (see detectActiveBranch) - undefined when none does.
  detectedBranch: LogicalBranch | undefined;
  // detectedBranch, or else the caller's pinnedBranchKey branch - whichever constraints are
  // actually merged into effectiveProperty.
  activeBranch: LogicalBranch | undefined;
  effectiveProperty: PropertyUIElement;
  Widget: WidgetComponent | undefined;
  iri: NamedNode | undefined;
  meta: WidgetMeta | undefined;
  // True while everything above is still the previous key's resolution (keepPreviousData) - see
  // useWidget's own isPlaceholderData.
  isPlaceholderData: boolean;
};

type ResolvedSlot = { detectedBranchKey: string | null; activeBranchKey: string | null; iri: Term | null };

/**
 * One value slot's whole resolution - which sh:or/sh:xone branch is active and which widget
 * renders the value under that branch - as a single query, instead of chaining useActiveBranch
 * (SHACL validation) into a second useWidget query keyed on its result: that chain first scored
 * (and briefly rendered) the unbranched property's widget, then re-scored once the branch landed.
 * Both steps still go through their own cached queries (activeBranchQueryOptions/
 * widgetQueryOptions, via fetchQuery), so re-keying this query - e.g. a pin being set or cleared -
 * never repeats validation or scoring that already ran.
 *
 * `value` may be omitted to resolve on the property shape alone (no branch detection) - see
 * PropertyUIComponentValues' warm-up call for a still-unresolved default object. Callers that
 * need the same resolution (WidgetSlot, PropertyUIComponentObject's meta) share one query by
 * passing the same arguments.
 */
export function useSlotResolution(
  property: PropertyUIElement,
  value: Term | undefined,
  { widgetPredicate, pinnedBranchKey }: { widgetPredicate: Term; pinnedBranchKey?: string },
): SlotResolution {
  const queryClient = useQueryClient();
  const { mode: environmentMode } = useEnvironment();
  const mode = widgetModeForPredicate(widgetPredicate) ?? environmentMode;
  const branches = useMemo(() => logicalBranches(property), [property]);

  const { data, isPlaceholderData } = useQuery({
    queryKey: [
      "slot-resolution",
      mode,
      property.propertyShapes.map((shape) => shape.value),
      value ? termKey(value) : "no-object",
      pinnedBranchKey ?? null,
    ],
    queryFn: async (): Promise<ResolvedSlot> => {
      const detected =
        value && branches.length > 0
          ? await queryClient.fetchQuery({
              ...activeBranchQueryOptions(property, value, branches),
              staleTime: Infinity,
            })
          : null;
      const active =
        detected ?? branches.find((branch) => branch.shape.value === pinnedBranchKey) ?? null;
      const effective = active ? withBranch(property, active.shape) : property;
      const iri = await queryClient.fetchQuery({
        ...widgetQueryOptions(mode, widgetPredicate, effective, value),
        staleTime: Infinity,
      });
      return {
        detectedBranchKey: detected?.shape.value ?? null,
        activeBranchKey: active?.shape.value ?? null,
        iri,
      };
    },
    placeholderData: keepPreviousData,
    ...noRefetch,
  });

  const detectedBranch = branches.find((branch) => branch.shape.value === data?.detectedBranchKey);
  const activeBranch = branches.find((branch) => branch.shape.value === data?.activeBranchKey);
  const activeBranchKey = activeBranch?.shape.value;
  const effectiveProperty = useMemo(
    () => (activeBranchKey ? withBranch(property, activeBranch!.shape) : property),
    // activeBranch is looked up from activeBranchKey + property, so those two cover it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [property, activeBranchKey],
  );

  const iri = data?.iri?.termType === "NamedNode" ? (data.iri as NamedNode) : undefined;
  return {
    branches,
    detectedBranch,
    activeBranch,
    effectiveProperty,
    // Edit/view callers only (facet mode never resolves per-value slots), so the component is
    // always a WidgetComponent here - see registry.ts's getWidgetComponent on narrowing its union.
    Widget: iri
      ? (getWidgetComponent(mode, iri, property.widgetRegistry) as WidgetComponent | undefined)
      : undefined,
    iri,
    meta: iri ? getWidgetMeta(iri, property.widgetRegistry) : undefined,
    isPlaceholderData,
  };
}
