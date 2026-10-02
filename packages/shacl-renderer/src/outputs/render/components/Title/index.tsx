import type { Quad_Subject } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { termKey } from "@/helpers/termKey.ts";
import { focusNodeLabel, nodeShapeLabel } from "@/resolution/label.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";

type Props = {
  action: "edit" | "create" | "view" | "search";
  nodeShapes: Quad_Subject[];
  // The resource being edited/viewed - its own label wins over the shape's for "edit"/"view".
  focusNode?: Quad_Subject;
};

/**
 * The renderer's heading (Environment.enableTitle): "Edit Alice" / "Create Person" /
 * "Search Person". The resource's label is content (content language, kept live as it's edited);
 * the shape's label is chrome (interface language). Renders nothing when there is no label at
 * all, except for "search", which falls back to a plain "Search" (e.g. facet union mode, where
 * several shapes are active at once).
 */
export default function Title({ action, nodeShapes, focusNode }: Props) {
  const { shapesGraph, dataGraph } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { activeLanguage } = useContentLanguage();

  const withResourceLabel = focusNode && (action === "edit" || action === "view");
  const resourceLabel = useReactiveRead(
    dataGraph,
    `${focusNode ? termKey(focusNode) : ""}|${activeLanguage}|${nodeShapes.map(termKey).join(",")}`,
    () =>
      withResourceLabel
        ? focusNodeLabel({
          term: focusNode,
          nodeShapes,
          shapesGraph,
          dataGraph,
          languages: [activeLanguage],
        })
        : undefined,
  );
  const label = resourceLabel
    ?? nodeShapeLabel({ nodeShapes, shapesGraph, languages: [activeInterfaceLanguage] });

  if (!label) {
    if (action !== "search") return null;
    return (
      <h2 className="st-title">
        <Localized id="title-search-all">Search</Localized>
      </h2>
    );
  }

  return (
    <h2 className="st-title">
      <Localized id={`title-${action}`} vars={{ label }}>
        {label}
      </Localized>
    </h2>
  );
}
