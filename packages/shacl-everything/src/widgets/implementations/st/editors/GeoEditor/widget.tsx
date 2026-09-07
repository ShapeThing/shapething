import type { Literal } from "@rdfjs/types";
import type { Feature, FeatureCollection } from "geojson";
import { Geoman } from "@geoman-io/maplibre-geoman-free";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
// MapLibre 6 ships no default export - see MapViewer/widget.tsx's own namespace-import comment.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GeoEditor as GeometryEditorControl } from "maplibre-gl-geo-editor";
import "maplibre-gl-geo-editor/style.css";
import { useEffect, useRef } from "react";
import { termKey } from "@/helpers/termKey.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { canonicalWktValue, geometryToLiteral, termToFeature } from "./geometry.ts";
import "./style.css";

const STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

// The one method syncFromEditor actually needs - kept as its own minimal structural type (rather
// than the full GeoEditor class) so it can be exercised directly against a plain stub in tests,
// with no real maplibre-gl/Geoman map involved (see geometry.test.ts's siblings and widget.test.ts).
type FeatureSource = { getAllFeatureCollection(): FeatureCollection };

/**
 * Reconciles `shape`'s whole value set against `editor`'s current features, called after every
 * create/edit/delete. Deliberately doesn't correlate "this map feature" to "that RDF term" by
 * feature id: onFeatureDelete only ever hands back maplibre-gl-geo-editor's own internal feature-
 * store id (Geoman's own bookkeeping id, resolved via its `geomanData`) rather than the `id` this
 * widget set when it originally loaded that feature onto the map (see termToFeature) - for a
 * pre-loaded feature the two are simply different values, so a delete of one never found its way
 * back to the term that produced it. Comparing by canonical WKT text instead (see geometry.ts's
 * canonicalWktValue) sidesteps that mismatch entirely: an existing term whose canonical WKT is no
 * longer among the editor's current features gets removed; a current feature whose canonical WKT
 * isn't already an existing term gets added; anything present on both sides is left untouched (so
 * an unrelated edit elsewhere on the map never reorders/rewrites values that didn't actually
 * change).
 */
export function syncFromEditor(shape: PropertyUIElement, editor: FeatureSource): void {
  const desired = new Map(
    editor
      .getAllFeatureCollection()
      .features.map((feature) => geometryToLiteral(feature))
      .filter((literal): literal is Literal => literal !== undefined)
      .map((literal) => [literal.value, literal] as const),
  );

  for (const term of shape.getObjects()) {
    const canonical = canonicalWktValue(term);
    if (canonical === undefined) continue; // not a value this editor manages - leave it alone
    if (desired.has(canonical)) desired.delete(canonical);
    else shape.removeObject(term);
  }
  for (const literal of desired.values()) shape.addObject(literal);
}

// How often the fallback poll below re-checks the editor's feature set against dataGraph.
// syncFromEditor() is a no-op (zero dataGraph writes) when nothing has actually changed, so
// polling unconditionally at this rate is cheap - it only ever produces real writes once per
// actual change, just possibly up to this long after it happened for a change that isn't also
// covered by one of the immediate onFeatureCreate/onFeatureEdit/onFeatureDelete callbacks below.
const POLL_INTERVAL_MS = 400;

/**
 * A property-wide editor (see meta.ts's singleUnifiedWidget) drawing and editing every value of
 * the property as features on one shared map, via maplibre-gl-geo-editor's Geoman-based drawing/
 * editing toolbar - the edit-mode counterpart to MapViewer. Deliberately scoped to the one
 * representation it can both read and write unambiguously: a direct GeoSPARQL WKT literal value
 * (see geometry.ts) - unlike MapViewer, it doesn't also read a plain GeoJSON string or a nested
 * st:GeoRole node, since a freshly-drawn shape has nowhere sensible to write back into for either
 * of those without guessing at a shape author's own modeling choices. Only the toolbar's basic
 * draw tools (marker/line/polygon/rectangle/circle) and basic edit tools (select/drag/change/
 * rotate/delete) are enabled - the advanced multi-feature tools (union/difference/split/lasso/
 * copy/cut/scale/simplify) are left out, since they don't map onto this widget's one-feature-per-
 * value model: a union of two drawn polygons, for instance, has no single RDF value to replace
 * either of the originals with.
 *
 * Ownership after the initial load is one-way: the map is seeded once from this property's
 * existing values on mount, and from then on every write flows from the map's own feature set
 * into `dataGraph` (via syncFromEditor), never the other way around - re-seeding the map on every
 * dataGraph change, the way MapViewer safely does being read-only, would otherwise blow away the
 * user's in-progress selection/undo history the moment their own edit round-trips back through
 * React.
 *
 * The onFeatureCreate/onFeatureEdit/onFeatureDelete options below only cover *some* of the ways
 * the editor's feature set can change: deleting a feature via "select it, then click the trash
 * tool" fires onFeatureDelete, but "click the trash tool first, then click a feature" drops into
 * Geoman's own native removal mode instead, which never calls it at all - same for undo/redo,
 * which mutate Geoman's internal feature store directly. Rather than chase every one of this
 * third-party library's internal code paths (there is no complete, documented event for "the
 * feature set changed"), a short poll re-runs syncFromEditor() on a fixed interval as a fallback
 * that doesn't depend on any of them - the options callbacks stay for the paths they do cover,
 * purely so those feel instant rather than waiting for the next poll tick.
 */
export default function GeoEditor({ shape }: WidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mount-once map/editor lifecycle, mirroring MapViewer's own first effect - `shape` is read via
  // closure (its own writes, not this widget's re-renders, are what should ever change the data),
  // so it's deliberately not a dependency here; re-running this effect would tear down and rebuild
  // the whole drawing session (and its undo history) on every unrelated re-render.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      maxZoom: 18,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    let disposed = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    map.once("load", () => {
      if (disposed) return;
      const geoman = new Geoman(map, {});

      map.once("gm:loaded", () => {
        if (disposed) return;

        const editor = new GeometryEditorControl({
          position: "top-left",
          drawModes: ["marker", "line", "polygon", "rectangle", "circle"],
          editModes: ["select", "drag", "change", "rotate", "delete"],
          fileModes: [],
          fitBoundsOnLoad: true,
          onFeatureCreate: () => syncFromEditor(shape, editor),
          onFeatureEdit: () => syncFromEditor(shape, editor),
          onFeatureDelete: () => syncFromEditor(shape, editor),
        });
        editor.setGeoman(geoman);
        map.addControl(editor, "top-left");

        const initialFeatures = shape
          .getObjects()
          .map((term) => termToFeature(term, termKey(term)))
          .filter((feature): feature is Feature => feature !== undefined);
        const collection: FeatureCollection = {
          type: "FeatureCollection",
          features: initialFeatures,
        };
        void editor.loadGeoJson(collection);

        pollId = setInterval(() => syncFromEditor(shape, editor), POLL_INTERVAL_MS);
      });
    });

    return () => {
      disposed = true;
      clearInterval(pollId);
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="st-geo-editor" />;
}
