import type { WidgetMeta } from "@/widgets/types.ts";

// This widget's value shape (sh:datatype the iconifyDatatype sentinel) is always readable
// straight off the property shape, so it needs no createTerm override - see defaultTermFromShape.
export default {} satisfies WidgetMeta;
