import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import { Localized } from "@fluent/react/esm/localized.js";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";

export default function InstancesSelectEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const shClasses = shape.get(sh("class"));
  const classesMap = new Map(
    shClasses.flatMap((shClass) =>
      shape.dataGraph
        .getQuads(null, rdf("type"), shClass)
        .map((quad) => [quad.subject.value, quad.subject]),
    ),
  );
  const classes = [...classesMap.values()];
  const existingObjects = useDataGraphObjects(shape);

  const subjects = classes.filter(
    (subject) =>
      !existingObjects.some((obj) => obj.value === subject.value && obj.value !== term.value),
  );

  return (
    <SelectListbox
      ariaLabelledby={labelledBy}
      value={term.value}
      options={subjects.map((s) => s.value)}
      onChange={(v) => setTerm(factory.namedNode(v))}
      renderTriggerContent={(v) =>
        v ? (
          valueNodeLabel({
            term: factory.namedNode(v),
            propertyShape: shape,
            languages: [activeLanguage],
          }).value
        ) : (
          <Localized id="select-an-option" />
        )
      }
      renderOption={(v) =>
        valueNodeLabel({
          term: factory.namedNode(v),
          propertyShape: shape,
          languages: [activeLanguage],
        }).value
      }
    />
  );
}
