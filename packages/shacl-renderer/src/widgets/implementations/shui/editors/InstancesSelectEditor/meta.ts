import { sh } from "@/helpers/namespaces.ts";
import { shaclInstancesOfClass } from "@/resolution/targets.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  canAddMore: (shape) => {
    const shClasses = shape.get(sh("class"));
    const existingObjects = shape.getObjects();
    return shClasses.some((shClass) =>
      shaclInstancesOfClass(shClass, shape.dataGraph, shape.shapesGraph).some(
        (subject) => !existingObjects.some((obj) => obj.value === subject.value),
      ),
    );
  },
} satisfies WidgetMeta;
