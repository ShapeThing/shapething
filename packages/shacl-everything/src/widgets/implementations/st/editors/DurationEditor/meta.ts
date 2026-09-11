import type { WidgetMeta } from "@/widgets/types.ts";

// sh:datatype xsd:duration on the property shape is enough for defaultTermFromShape to produce a
// correctly-typed empty term - see DatePickerEditor's meta.ts for the same reasoning.
export default {} satisfies WidgetMeta;
