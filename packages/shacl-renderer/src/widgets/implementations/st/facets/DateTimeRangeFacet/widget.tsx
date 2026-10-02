import { xsd } from "@/helpers/namespaces.ts";
import DateRangeFacet from "@/widgets/implementations/st/facets/DateRangeFacet/widget.tsx";
import type { FacetWidgetProps } from "@/widgets/types.ts";

export default function DateTimeRangeFacet(props: FacetWidgetProps) {
  return <DateRangeFacet {...props} type="datetime-local" datatype={xsd("dateTime")} />;
}
