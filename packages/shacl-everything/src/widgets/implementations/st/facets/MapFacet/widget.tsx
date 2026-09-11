import { Geoman } from "@geoman-io/maplibre-geoman-free";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
// MapLibre 6 ships no default export - see MapViewer/widget.tsx's own namespace-import comment.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GeoEditor as GeometryEditorControl } from "maplibre-gl-geo-editor";
import "maplibre-gl-geo-editor/style.css";
import { useEffect, useMemo, useRef } from "react";
import "@/helpers/configureMaplibreWorker.ts";
import { st } from "@/helpers/namespaces.ts";
import { featureCollectionBounds } from "@/widgets/implementations/st/viewers/MapViewer/geometry.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import {
  areaLiteralToFeatureCollection,
  drawnFeaturesToAreaLiteral,
  valuesToFeatureCollection,
} from "./geometry.ts";
import "./style.css";

const STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const SOURCE_ID = "st-map-facet-values";
const POLL_INTERVAL_MS = 400;

/**
 * A map-based facet for geometry-valued properties (sh:datatype geosparql:wktLiteral): plots every
 * value found across every target instance (structure/facetValues.ts's aggregateFacetValues) as
 * markers, and lets the user draw one or more rectangles/polygons - via the same
 * @geoman-io/maplibre-geoman-free + maplibre-gl-geo-editor toolbar GeoEditor uses for actually
 * editing geometry - to select an area. Every value falling inside any drawn shape narrows the
 * result set (drawing more than one shape is an OR: "in this area or that one").
 *
 * Unlike GeoEditor, the drawn shape(s) here are never a data value themselves: they're combined
 * into a single MultiPolygon st:withinArea literal on the generated filter shape (see
 * structure/filterShape.ts's instanceSatisfiesConstraintNode) - the facet-mode analogue of
 * NumberRangeFacet's sh:minInclusive/sh:maxInclusive. st:withinArea is a ShapeThing-original
 * constraint predicate, since neither SHACL nor SHACL-UI has a notion of spatial containment.
 */
export default function MapFacet({ values, getConstraint, setConstraint, labelledBy }: FacetWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const collection = useMemo(() => valuesToFeatureCollection(values), [values]);

  // Read once, at mount - the draw editor owns the live "what's currently selected" state from here
  // on (see syncSelection below), so a pre-existing st:withinArea constraint (e.g. restored from a
  // previous facet-mode session's onSubmit output) only needs to seed the editor's very first load,
  // never re-read afterwards.
  const initialAreaRef = useRef(getConstraint(st("withinArea"))[0]);

  // Map + draw-editor lifecycle: created once and torn down on unmount, same "stable for the
  // widget's lifetime" reasoning as GeoEditor's own single effect - the user's in-progress selection
  // must survive independently of `values` (this property's data-point markers, applied by the
  // separate effect below), which never actually changes live within one facet-mode session anyway.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      maxZoom: 18,
    });
    map.addControl(new maplibregl.NavigationControl());
    mapRef.current = map;

    let disposed = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    map.once("load", () => {
      if (disposed) return;
      const geoman = new Geoman(map, {});

      map.once("gm:loaded" as "load", () => {
        if (disposed) return;

        const syncSelection = () =>
          setConstraint(
            st("withinArea"),
            drawnFeaturesToAreaLiteral(editor.getAllFeatureCollection()),
          );

        // Only rectangle/polygon draw modes - a selection *area*, not general-purpose geometry
        // editing (contrast GeoEditor's marker/line/polygon/rectangle/circle). "select" lets the
        // user pick an already-drawn shape to drag/resize/delete; "delete" (via the toolbar or a
        // selected shape's own handle) is how a selection is cleared back out.
        const editor = new GeometryEditorControl({
          position: "top-right",
          drawModes: ["rectangle", "polygon"],
          editModes: ["select", "drag", "change", "delete"],
          fileModes: [],
          fitBoundsOnLoad: false,
          onFeatureCreate: syncSelection,
          onFeatureEdit: syncSelection,
          onFeatureDelete: syncSelection,
        });
        editor.setGeoman(geoman);
        map.addControl(editor, "top-right");

        void editor.loadGeoJson(areaLiteralToFeatureCollection(initialAreaRef.current));
        pollId = setInterval(syncSelection, POLL_INTERVAL_MS);
      });
    });

    return () => {
      disposed = true;
      clearInterval(pollId);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The data-point markers, applied/updated separately from the map's own lifecycle above - mirrors
  // MapViewer/widget.tsx's own two-effect split, so this property's values populating (or changing)
  // never tears down the user's in-progress draw selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyData = () => {
      const source = map.getSource<maplibregl.GeoJSONSource>(SOURCE_ID);
      if (source) {
        source.setData(collection);
        return;
      }

      map.addSource(SOURCE_ID, { type: "geojson", data: collection });
      // Both layer types are always added regardless of which geometry types are actually present -
      // maplibre already only paints a layer's matching geometry type from a source (see
      // MapViewer/widget.tsx's own comment on the same point).
      map.addLayer({
        id: `${SOURCE_ID}-polygons`,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#00ff7e", "fill-opacity": 0.3, "fill-outline-color": "#007cbf" },
      });
      map.addLayer({
        id: `${SOURCE_ID}-points`,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 5,
          "circle-color": "#007cbf",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });

      const bounds = featureCollectionBounds(collection);
      if (bounds) map.fitBounds(bounds, { padding: 30, animate: false });
    };

    if (map.isStyleLoaded()) applyData();
    else map.once("load", applyData);
  }, [collection]);

  return (
    <div
      ref={containerRef}
      className="st-map-facet"
      role="group"
      aria-labelledby={labelledBy}
    />
  );
}
