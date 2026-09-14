import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.mapStyleUrl: a single MapLibre GL style URL shared by every map-based st: widget
// (GeoEditor, MapViewer, MapFacet), rather than a per-widget setting - overridden here to a
// different public style than the default (OpenFreeMap's "bright"). No play() interaction test -
// see GeoEditor's own story for why: the map renders onto a WebGL canvas, which isn't something a
// scripted assertion can meaningfully verify, and MapLibre's own style fetch is a real network
// request this suite doesn't stub.
export default {
  title: "Environment/mapStyleUrl",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix geo: <http://www.opengis.net/ont/geosparql#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix st: <http://shapething.com/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Place ;
    sh:property [
      sh:name "Location"@en ;
      sh:path ex:location ;
      sh:datatype geo:wktLiteral ;
      shui:editor st:GeoEditor ;
    ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix geo: <http://www.opengis.net/ont/geosparql#> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Place ; ex:location "POINT(4.895 52.370)"^^geo:wktLiteral .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const defaultStyle: Story = {
  name: "Default: OpenFreeMap's public \"bright\" style (defaultEnvironment.mapStyleUrl)",
  args: baseArgs as ShaclRendererProps,
};

export const customStyle: Story = {
  name: "Overridden to a different public MapLibre style URL",
  args: {
    ...baseArgs,
    mapStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
  } as ShaclRendererProps,
};
