import type { FeatureCollection } from "geojson";
// MapLibre 6 ships no default export (see maplibre-gl-geo-editor's own README, which GeoEditor's
// widget.tsx depends on) - a namespace import both constructs values (maplibregl.Map, .Popup,
// .NavigationControl below) and resolves types (maplibregl.MapGeoJSONFeature/.GeoJSONSource).
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { defaultEnvironment } from "@/environment.ts";
import "@/helpers/configureMaplibreWorker.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import { featureCollectionBounds, valueToFeature } from "./geometry.ts";
import "./style.css";

const SOURCE_ID = "st-map-viewer-data";
const LAYER_IDS = ["st-map-viewer-polygons", "st-map-viewer-lines", "st-map-viewer-points"];

// Built via textContent, never innerHTML/setHTML - title/classification come from RDF literal
// values (see geometry.ts's tooltipProperties), which this widget has no business treating as HTML.
function popupContent(feature: maplibregl.MapGeoJSONFeature): HTMLElement | null {
  const title = feature.properties.title;
  if (typeof title !== "string") return null;

  const container = document.createElement("div");
  container.className = "st-map-viewer__popup";

  const titleEl = document.createElement("div");
  titleEl.className = "st-map-viewer__popup-title";
  titleEl.textContent = title;
  container.appendChild(titleEl);

  const classification = feature.properties.classification;
  if (typeof classification === "string") {
    const classificationEl = document.createElement("div");
    classificationEl.className = "st-map-viewer__popup-classification";
    classificationEl.textContent = classification;
    container.appendChild(classificationEl);
  }

  return container;
}

/**
 * A property-wide viewer (see meta.ts's singleUnifiedWidget) plotting every value of the property
 * on one map, rather than rendering once per value - the map-viewer analogue of ValueTableViewer's
 * one-table-of-every-row. Each value is resolved to a GeoJSON feature by geometry.ts's
 * valueToFeature, which tries every representation this viewer understands (a GeoSPARQL WKT
 * literal, a plain GeoJSON string, or - one hop away, via st:GeoRole - a nested WKT/GeoJSON
 * literal) in turn, and stashes a resolved title/classification (via shui:LabelRole/
 * ClassificationRole) into the feature's own properties for the hover popup below.
 */
export default function MapViewer({ shape }: WidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { activeLanguage } = useContentLanguage();
  const { mapStyleUrl } = useEnvironment();
  const rows = useDataGraphObjects(shape);

  const collection = useMemo<FeatureCollection>(() => {
    const features = rows
      .map((row) => valueToFeature(shape, row, [activeLanguage]))
      .filter((feature) => feature !== undefined);
    return { type: "FeatureCollection", features };
  }, [rows, shape, activeLanguage]);

  // Map lifecycle (create once, destroy on unmount) is kept separate from applying `collection` -
  // this property's values can change after the map exists (e.g. edit mode rendering a read-only
  // shui:viewer widget alongside live editing elsewhere on the form), so re-mounting the whole map
  // on every data change would be both wasteful and visibly reset the user's current pan/zoom.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl ?? defaultEnvironment.mapStyleUrl!,
      maxZoom: 18,
    });
    map.addControl(new maplibregl.NavigationControl());
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyData = () => {
      const source = map.getSource<maplibregl.GeoJSONSource>(SOURCE_ID);
      if (source) {
        source.setData(collection);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data: collection });
        // All three layer types are always added regardless of which geometry types are actually
        // present - maplibre already only paints a layer's matching geometry type from a source
        // (a 'circle' layer ignores line/polygon features and vice versa), so there's no need to
        // filter per layer.
        map.addLayer({
          id: "st-map-viewer-polygons",
          type: "fill",
          source: SOURCE_ID,
          paint: { "fill-color": "#00ff7e", "fill-opacity": 0.4, "fill-outline-color": "#007cbf" },
        });
        map.addLayer({
          id: "st-map-viewer-lines",
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ff7e00", "line-width": 4 },
        });
        map.addLayer({
          id: "st-map-viewer-points",
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 6,
            "circle-color": "#007cbf",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        // One shared popup, reused across all three layers - registered once here (alongside the
        // layers themselves), not in the effect below, so it isn't torn down/rebuilt on every data
        // update.
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
        for (const layerId of LAYER_IDS) {
          map.on("mouseenter", layerId, (event) => {
            const feature = event.features?.[0];
            const content = feature && popupContent(feature);
            if (!content) return;
            map.getCanvas().style.cursor = "pointer";
            popup.setLngLat(event.lngLat).setDOMContent(content).addTo(map);
          });
          map.on("mousemove", layerId, (event) => {
            if (popup.isOpen()) popup.setLngLat(event.lngLat);
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
            popup.remove();
          });
        }
      }

      const bounds = featureCollectionBounds(collection);
      if (bounds) map.fitBounds(bounds, { padding: 20, animate: false });
    };

    if (map.isStyleLoaded()) applyData();
    else map.once("load", applyData);
  }, [collection]);

  return <div ref={containerRef} className="st-map-viewer" />;
}
