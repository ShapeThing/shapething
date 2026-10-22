import { useMemo } from "react";
import { useSelect } from "@/data-model/useSelect.ts";
import { buildClassIndex, buildPropertyIndex } from "./model.ts";
import classesQuery from "./classes.rq";
import propertiesQuery from "./properties.rq";

export function useOntology() {
  const classRows = useSelect(classesQuery);
  const propertyRows = useSelect(propertiesQuery);

  return useMemo(
    () => ({ classes: buildClassIndex(classRows), properties: buildPropertyIndex(propertyRows) }),
    [classRows, propertyRows],
  );
}
