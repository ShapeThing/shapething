import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import { Localized } from "@fluent/react/esm/localized.js";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";

export default function InstancesSelectEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const shClass = shape.getOne(sh("class"));
  const classes = shape.dataGraph.getQuads(null, rdf("type"), shClass).map((quad) => quad.subject);
  const existingObjects = useDataGraphObjects(shape);

  const options = classes.filter(
    (subject) =>
      !existingObjects.some((obj) => obj.value === subject.value && obj.value !== term.value),
  );

  return (
    <span className="st-select-wrapper">
      <select
        className="st-select"
        value={term.value}
        onChange={(e) => setTerm(factory.namedNode(e.target.value))}
        aria-labelledby={labelledBy}
      >
        {!term.value && (
          <option value="" disabled>
            <Localized id="select-an-option" />
          </option>
        )}
        {options.map((subject) => (
          <option key={subject.value} value={subject.value}>
            {
              valueNodeLabel({ term: subject, propertyShape: shape, languages: [activeLanguage] })
                .value
            }
          </option>
        ))}
      </select>
      <span className="st-select-arrow" aria-hidden="true" />
    </span>
  );
}
