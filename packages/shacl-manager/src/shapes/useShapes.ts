import { useMemo } from "react";
import { useSelect } from "@/data-model/useSelect.ts";
import { useOntology } from "@/ontology/useOntology.ts";
import {
  buildNodeReferences,
  buildNodeShapeIndex,
  buildPropertyShapes,
  groupByTargeting,
  shapesByTargetClass,
} from "./model.ts";
import type { ShapeGraph } from "./resolveProperties.ts";
import nodeShapesQuery from "./nodeShapes.rq";
import nodeReferencesQuery from "./nodeReferences.rq";
import propertyShapesQuery from "./propertyShapes.rq";

export function useShapes() {
  const { classes } = useOntology();
  const nodeShapeRows = useSelect(nodeShapesQuery);
  const nodeReferenceRows = useSelect(nodeReferencesQuery);
  const propertyShapeRows = useSelect(propertyShapesQuery);

  return useMemo(() => {
    const nodeShapes = buildNodeShapeIndex(nodeShapeRows);
    const graph: ShapeGraph = {
      nodeShapes,
      propertyShapes: buildPropertyShapes(propertyShapeRows),
      nodeReferences: buildNodeReferences(nodeReferenceRows),
      shapesByClass: shapesByTargetClass(nodeShapes),
      classes,
    };
    return { ...graph, targetingGroups: groupByTargeting(nodeShapes) };
  }, [classes, nodeShapeRows, nodeReferenceRows, propertyShapeRows]);
}
