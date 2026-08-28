import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { useMemo } from "react";
import { sh } from "@/helpers/namespaces.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

type Column = {
  propertyShape: NamedNode;
  // A column shape can declare `sh:values sh:this` instead of a real sh:path to walk - the
  // fixture's way to include a column that's just the row's own value (e.g. an identifier), with
  // no predicate on the row connecting it to itself.
  isSelf: boolean;
};

function columnOrder(columnShape: Term, shapesGraph: RdfStore): number {
  const value = shapesGraph.getQuads(columnShape, sh("order"))[0]?.object.value;
  const parsed = value !== undefined ? parseFloat(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function columnsForNodeShape(nodeShape: Term, shapesGraph: RdfStore): Column[] {
  return shapesGraph
    .getQuads(nodeShape, sh("property"))
    .map((quad) => quad.object as NamedNode)
    .sort((a, b) => columnOrder(a, shapesGraph) - columnOrder(b, shapesGraph))
    .map((propertyShape) => ({
      propertyShape,
      isSelf: shapesGraph.getQuads(propertyShape, sh("values"), sh("this")).length > 0,
    }));
}

/**
 * A property-wide viewer (see meta.ts's singleUnifiedWidget) rendering every value of the outer
 * property as one table: rows are the property's own values, columns come from its sh:node's own
 * sh:property list (ordered by sh:order), each built into a one-shape PropertyUIElement per row so
 * its sh:path can be walked from that row's value rather than the outer property's focus node.
 * Cell values are shown as resolved labels, not through a further nested widget - a table cell has
 * no room for one.
 */
export default function ValueTableViewer({ shape }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const rows = useDataGraphObjects(shape);
  const nodeShape = shape.get(sh("node"))[0];

  const columns = useMemo(
    () => (nodeShape ? columnsForNodeShape(nodeShape, shape.shapesGraph) : []),
    [nodeShape, shape.shapesGraph],
  );

  if (columns.length === 0) return null;

  const columnElement = (column: Column, focusNode: Quad_Subject) =>
    new PropertyUIElement({
      shapesGraph: shape.shapesGraph,
      dataGraph: shape.dataGraph,
      scoresGraph: shape.scoresGraph,
      widgetRegistry: shape.widgetRegistry,
      focusNode,
      propertyShapes: [column.propertyShape],
    });

  const cellValue = (column: Column, row: Term): string => {
    const values = column.isSelf ? [row] : columnElement(column, row as Quad_Subject).getObjects();
    return values
      .map((value) =>
        value.termType === "Literal"
          ? value.value
          : valueNodeLabel({
              term: value,
              propertyShape: columnElement(column, shape.focusNode),
              languages: [activeLanguage],
            }).value,
      )
      .join(", ");
  };

  return (
    <table className="st-value-table-viewer">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.propertyShape.value}>
              {columnElement(column, shape.focusNode).label([activeInterfaceLanguage])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.value}>
            {columns.map((column) => (
              <td key={column.propertyShape.value}>{cellValue(column, row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
