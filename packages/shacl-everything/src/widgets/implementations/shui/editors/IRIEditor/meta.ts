import type { WidgetMeta } from "@/widgets/types.ts";

// This widget's value shape (datatype/nodeKind) is always readable straight off the
// property shape, so it needs no createTerm override - see defaultTermFromShape.
export default {} satisfies WidgetMeta;
