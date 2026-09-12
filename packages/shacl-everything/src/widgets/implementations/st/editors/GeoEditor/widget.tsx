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
import { defaultEnvironment } from "@/environment.ts";
import "@/helpers/configureMaplibreWorker.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { canonicalWktValue, geometryToLiteral, termToFeature } from "./geometry.ts";
import "./style.css";

type FeatureSource = { getAllFeatureCollection(): FeatureCollection };

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

const POLL_INTERVAL_MS = 400;

export default function GeoEditor({ shape }: WidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapStyleUrl } = useEnvironment();

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl ?? defaultEnvironment.mapStyleUrl!,
      maxZoom: 18,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    let disposed = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    map.once("load", () => {
      if (disposed) return;
      const geoman = new Geoman(map, {});

      map.once("gm:loaded" as "load", () => {
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
