import type { NamedNode, Quad } from "@rdfjs/types";
import { minimalEnvironment, ShaclRenderer } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { clsx } from "../../clsx.ts";
import { shapesGraph } from "../../shapes/shapes.ts";
import { widgets } from "../../widgets/index.ts";
import "./style.scss";

type Props = {
  /** One of the display shapes of shapes/shapes.ttl. */
  shape: NamedNode;
  focusNode: NamedNode;
  /** The data graph (see data/graphs.ts). Quads are compared by content: an equal array keeps the
   * renderer, a different one starts it again. A live store (makeReactive) is kept as it is, and
   * what is added to it later shows up in place (see PersonRow). */
  dataGraph: Quad[] | RdfStore;
  className?: string;
};

/**
 * Renders `focusNode` with a display shape, read only. Wikidata labels are English or "mul" (the
 * default for all languages), so every value is shown whatever its language ("individual"), and
 * the interface has no language switchers.
 */
export default function Display({ shape, focusNode, dataGraph, className }: Props) {
  return (
    <div className={clsx("display", className)}>
      <ShaclRenderer
        {...minimalEnvironment}
        // Wikidata images are Commons originals; the display shapes' st:imageWidth loads Commons
        // thumbnails instead.
        enableImageResizing
        // The portraits' sh:defaultValue inf:Initials: people without a portrait get their
        // initials (see widgets/PortraitViewer).
        enableDefaultValuesInViewMode
        mode="view"
        languageMode="individual"
        contentLanguage="en"
        viewModeLabelLayout="inline"
        shapesGraph={shapesGraph}
        widgets={widgets}
        nodeShapes={[shape]}
        focusNode={focusNode}
        dataGraph={dataGraph}
        loadingIndicator={null}
      />
    </div>
  );
}
