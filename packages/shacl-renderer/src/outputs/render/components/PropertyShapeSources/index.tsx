import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { prefixedIri } from "@/helpers/prefixedIri.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { Code } from "@/helpers/icons.tsx";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";

type Props = {
  propertyUIElement: PropertyUIElement;
};

/**
 * Debug aid behind Environment.enablePropertyShapeSources: a small icon next to the property's
 * label (with a count when more than one shape was merged) whose tooltip lists every property shape
 * groupPropertyShapesByPath merged into this one PropertyUIElement (see shapeComposition.ts's
 * groupShapesByPath), with the node shape(s) declaring each via sh:property and that shape's own
 * raw triples - so a surprising merged constraint (PropertyUIElement.get's resolution across all
 * of them) can be traced back to the shape, and thus the file, it came from.
 */
export default function PropertyShapeSources({ propertyUIElement }: Props) {
  const { enablePropertyShapeSources, sourcePrefixes } = useEnvironment();
  if (!enablePropertyShapeSources) return null;

  const { propertyShapes, shapesGraph } = propertyUIElement;
  const display = (term: Term) => displayTerm(term, sourcePrefixes);
  const count = propertyShapes.length;

  return (
    <Tooltip
      bare
      enabled
      placement="right"
      tip={
        <ol className="st-property-shape-sources__list">
          {propertyShapes.map((propertyShape, index) => (
            <li key={index} className="st-property-shape-sources__shape">
              <code className="st-property-shape-sources__iri">{display(propertyShape)}</code>
              <span className="st-property-shape-sources__declared-by">
                {" in "}
                {declaringShapes(propertyShape, shapesGraph).map(display).join(", ") || "(none)"}
              </span>
              <table className="st-property-shape-sources__triples">
                <tbody>
                  {shapesGraph.getQuads(propertyShape).map((quad, quadIndex) => (
                    <tr key={quadIndex}>
                      <th>{display(quad.predicate)}</th>
                      <td>{display(quad.object)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          ))}
        </ol>
      }
    >
      <span
        className="st-property-shape-sources"
        data-merged={count > 1 || undefined}
        role="img"
        aria-label={`${count} property shape${count === 1 ? "" : "s"}`}
      >
        <Code />
        {count > 1 && <span className="st-property-shape-sources__count">{count}</span>}
      </span>
    </Tooltip>
  );
}

function declaringShapes(propertyShape: NamedNode, shapesGraph: RdfStore): Term[] {
  return shapesGraph.getQuads(null, sh("property"), propertyShape).map((quad) => quad.subject);
}

function displayTerm(term: Term, sourcePrefixes?: Record<string, string>): string {
  if (term.termType === "NamedNode") return prefixedIri(term, sourcePrefixes) ?? `<${term.value}>`;
  if (term.termType === "BlankNode") return `_:${term.value}`;
  if (term.termType === "Literal") {
    if (term.language) return `"${term.value}"@${term.language}`;
    const datatype = prefixedIri(term.datatype, sourcePrefixes) ?? term.datatype.value;
    return datatype === "xsd:string" ? `"${term.value}"` : `"${term.value}"^^${datatype}`;
  }
  return term.value;
}
