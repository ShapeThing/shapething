import { rdf, sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  canAddMore: (shape) => {
    const shClass = shape.getOne(sh("class"));
    const classes = shape.dataGraph
      .getQuads(null, rdf("type"), shClass)
      .map((quad) => quad.subject);
    const existingObjects = shape.getObjects();
    const availableOptions = classes.filter(
      (subject) => !existingObjects.some((obj) => obj.value === subject.value),
    );
    return availableOptions.length > 0;
  },
} satisfies WidgetMeta;
