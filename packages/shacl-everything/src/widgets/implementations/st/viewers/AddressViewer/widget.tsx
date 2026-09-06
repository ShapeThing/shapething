import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { schema } from "@/helpers/namespaces.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Read-only counterpart to AddressEditor - same fixed schema:* sub-fields, same content-language
// resolution, no search affordance.
export default function AddressViewer({ shape, term }: WidgetProps) {
  const node = term as Quad_Subject;
  const { activeLanguage } = useContentLanguage();

  const read = (predicate: NamedNode) =>
    bestByLanguage(
      shape.dataGraph.getQuads(node, predicate).map((quad) => quad.object),
      [activeLanguage, ""],
    )?.value;

  const [street, locality, region, postalCode, country] = useReactiveRead(
    shape.dataGraph,
    `address-viewer@${term.value}@${activeLanguage}`,
    () =>
      [
        read(schema("streetAddress")),
        read(schema("addressLocality")),
        read(schema("addressRegion")),
        read(schema("postalCode")),
        read(schema("addressCountry")),
      ] as const,
  );

  const lines = [
    street,
    [postalCode, locality].filter(Boolean).join(" "),
    [region, country].filter(Boolean).join(" "),
  ].filter((line) => line && line.trim().length > 0);

  return (
    <span className="st-address-viewer">
      {lines.map((line, index) => (
        <span key={index} className="st-address-viewer__line">
          {line}
        </span>
      ))}
    </span>
  );
}
