import type { NamedNode, Quad } from "@rdfjs/types";
import { minimalEnvironment, ShaclRenderer } from "@shapething/shacl-renderer";
import { clsx } from "../../clsx.ts";
import { shapesGraph } from "../../shapes/shapes.ts";
import { widgets } from "../../widgets/index.ts";
import "./style.scss";

type Props = {
  /** One of the display shapes of shapes/shapes.ttl. */
  shape: NamedNode;
  focusNode: NamedNode;
  /** The data graph (see data/graphs.ts). Keep it the same array while it does not change: a new
   * one starts the renderer again. */
  quads: Quad[];
  className?: string;
};

/**
 * Renders `focusNode` with a display shape, read only. Wikidata labels are English or "mul" (the
 * default for all languages), so every value is shown whatever its language ("individual"), and
 * the interface has no language switchers.
 */
export default function Display({ shape, focusNode, quads, className }: Props) {
  return (
    <div className={clsx("display", className)}>
      <ShaclRenderer
        {...minimalEnvironment}
        mode="view"
        languageMode="individual"
        contentLanguage="en"
        viewModeLabelLayout="inline"
        shapesGraph={shapesGraph}
        widgets={widgets}
        nodeShapes={[shape]}
        focusNode={focusNode}
        dataGraph={quads}
      />
    </div>
  );
}
