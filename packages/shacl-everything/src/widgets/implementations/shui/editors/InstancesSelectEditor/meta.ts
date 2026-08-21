import { rdf, sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  canAddMore: (shape) => {
    const shClasses = shape.get(sh("class"));
    const classesMap = new Map(
      shClasses.flatMap((shClass) =>
        shape.dataGraph.getQuads(null, rdf("type"), shClass).map((
          quad,
        ) => [quad.subject.value, quad.subject])
      ),
    );
    const classes = [...classesMap.values()];
    const existingObjects = shape.getObjects();
    const availableOptions = classes.filter(
      (subject) => !existingObjects.some((obj) => obj.value === subject.value),
    );
    return availableOptions.length > 0;
  },
} satisfies WidgetMeta;
