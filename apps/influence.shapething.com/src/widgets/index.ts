import { defaultWidgets, type Widgets } from "@shapething/shacl-renderer";
import { inf } from "../rdf/namespaces.ts";
import EntityLinkViewer from "./EntityLinkViewer/widget.tsx";
import LightboxImageViewer from "./LightboxImageViewer/widget.tsx";
import PortraitViewer from "./PortraitViewer/widget.tsx";
import RelativeInfluenceViewer from "./RelativeInfluenceViewer/widget.tsx";
import YearViewer from "./YearViewer/widget.tsx";

/**
 * The bundled widgets plus the app's own viewers, and shui:ImageViewer with a lightbox. A module constant: the renderer caches its
 * widget scoring per widgets object (by identity), so every renderer shares one scoring graph.
 */
export const widgets: Widgets = {
  ...defaultWidgets,
  viewers: {
    ...defaultWidgets.viewers,
    ImageViewer: { ...defaultWidgets.viewers.ImageViewer, Component: LightboxImageViewer },
    EntityLinkViewer: { widget: inf("EntityLinkViewer"), Component: EntityLinkViewer },
    PortraitViewer: { widget: inf("PortraitViewer"), Component: PortraitViewer },
    RelativeInfluenceViewer: {
      widget: inf("RelativeInfluenceViewer"),
      Component: RelativeInfluenceViewer,
    },
    YearViewer: { widget: inf("YearViewer"), Component: YearViewer },
  },
};
