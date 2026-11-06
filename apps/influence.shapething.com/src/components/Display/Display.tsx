import type { NamedNode, Quad } from "@rdfjs/types";
import {
  minimalEnvironment,
  ShaclRenderer,
  type RdfSource,
  type ResolveLink,
} from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { useCallback } from "react";
import { clsx } from "../../clsx.ts";
import { entityId, isEntityId } from "../../data/entities.ts";
import { useAppLocation } from "../../routing.ts";
import { shapesGraph } from "../../shapes/shapes.ts";
import { widgets } from "../../widgets/index.ts";
import Spinner from "../Spinner/Spinner.tsx";
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
  /** The shapes of shapes/shapes.ttl, unless shapes are made for the data (see data/resource.ts). */
  shapes?: RdfSource;
  /** Links of this display's own, put over those of every display (see useAppLinks). */
  resolveLink?: ResolveLink;
  /** How a label stands to its values; "inline" (beside a single value) unless given. */
  labelLayout?: "block" | "inline" | "columns";
};

/**
 * The links of every display. A link to a Wikidata item (the works, interests and ideas, the
 * occupations, a country) opens that item in the modal instead of on Wikidata. A link to the entity
 * open in the modal, there or in the modal (a portrait's inf:aboutHref), is the current one: it
 * stands out in the columns behind the modal.
 */
const useAppLinks = (): ResolveLink => {
  const { modal } = useAppLocation();
  const focusedId = isEntityId(modal) ? modal : undefined;
  return useCallback(
    (href) => {
      const itemId = entityId(href);
      const id = itemId ?? (href.startsWith("#") ? href.slice(1) : undefined);
      const current = id !== undefined && id === focusedId ? "true" : undefined;
      if (itemId) return { href: `#${itemId}`, target: undefined, "aria-current": current };
      return current ? { "aria-current": current } : undefined;
    },
    [focusedId],
  );
};

/**
 * Renders `focusNode` with a display shape, read only. Wikidata labels are English or "mul" (the
 * default for all languages), so every value is shown whatever its language ("individual"), and
 * the interface has no language switchers.
 */
export default function Display({
  shape,
  focusNode,
  dataGraph,
  className,
  shapes = shapesGraph,
  resolveLink,
  labelLayout = "inline",
}: Props) {
  const appLinks = useAppLinks();
  const resolve = useCallback<ResolveLink>(
    (href) => {
      const own = resolveLink?.(href);
      const app = appLinks(href);
      return own || app ? { ...app, ...own } : undefined;
    },
    [appLinks, resolveLink],
  );

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
        viewModeLabelLayout={labelLayout}
        shapesGraph={shapes}
        widgets={widgets}
        nodeShapes={[shape]}
        focusNode={focusNode}
        dataGraph={dataGraph}
        // No spinner for each value that loads, but one while the renderer holds back the first
        // paint until the whole display has loaded (style.scss).
        loadingIndicator={null}
        settleIndicator={<Spinner />}
        resolveLink={resolve}
      />
    </div>
  );
}
