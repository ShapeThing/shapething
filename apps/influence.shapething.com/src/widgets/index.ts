import { defaultWidgets, type Widgets } from "@shapething/shacl-renderer";
import { inf } from "../rdf/namespaces.ts";
import RelativeInfluenceViewer from "./RelativeInfluenceViewer/widget.tsx";
import YearViewer from "./YearViewer/widget.tsx";

/**
 * The bundled widgets plus the app's own viewers. A module constant: the renderer caches its
 * widget scoring per widgets object, and a new object would also rebuild every renderer.
 */
export const widgets: Widgets = {
  ...defaultWidgets,
  viewers: {
    ...defaultWidgets.viewers,
    RelativeInfluenceViewer: {
      widget: inf("RelativeInfluenceViewer"),
      Component: RelativeInfluenceViewer,
    },
    YearViewer: { widget: inf("YearViewer"), Component: YearViewer },
  },
};
