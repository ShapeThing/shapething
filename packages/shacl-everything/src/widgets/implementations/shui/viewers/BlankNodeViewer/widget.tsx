import type { NamedNode } from "@rdfjs/types";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { propertyLabel, valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Fallback, shape-agnostic rendering of a node value with no sh:node of its own to describe its
 * structure (unlike DetailsViewer, which relies on one) - lists every raw predicate/value pair
 * found on it in the data graph directly. Predicate labels are chrome (describing the vocabulary
 * term itself), so they follow interface language; the values themselves are content, so they
 * follow content language - same propertyLabel/valueNodeLabel reused purely for graph/language
 * context, the same way DetailsEditor/SubClassEditor already do for unrelated terms.
 */
export default function BlankNodeViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();

  const rows = useReactiveRead(shape.dataGraph, `blank-node-viewer@${term.value}`, () =>
    shape.dataGraph
      .getQuads(term)
      .map((quad) => ({ predicate: quad.predicate as NamedNode, object: quad.object })),
  );

  if (rows.length === 0) return null;

  return (
    <dl className="st-blank-node-viewer">
      {rows.map(({ predicate, object }, index) => (
        <div key={index} className="st-blank-node-viewer__row">
          <dt>
            {propertyLabel({
              term: predicate,
              propertyShape: shape,
              languages: [activeInterfaceLanguage],
            })}
          </dt>
          <dd>
            {object.termType === "Literal"
              ? object.value
              : valueNodeLabel({ term: object, propertyShape: shape, languages: [activeLanguage] })
                  .value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
