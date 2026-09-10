import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, st } from "@/helpers/namespaces.ts";

/**
 * True when `node` (a sh:PropertyGroup node) is itself declared st:TabbedPropertyGroup - the
 * ShapeThing-original "wizard step" group type (see widgets/implementations/st/groups/
 * TabbedPropertyGroup). Checked directly against rdf:type rather than through widget resolution
 * (registry.ts's getGroupWidget), so sibling-family detection (TabbedPropertyGroupFamily) stays
 * correct even for a caller-supplied Widgets registry that maps a different Component to this IRI,
 * or doesn't register it under this exact key.
 */
export function isTabbedPropertyGroup(node: Term, shapesGraph: RdfStore): boolean {
  return shapesGraph.getQuads(node, rdf("type"), st("TabbedPropertyGroup")).length > 0;
}

// Stable DOM ids shared between TabbedPropertyGroupFamily's own <button role="tab"> (aria-controls)
// and the TabbedPropertyGroup widget's own <div role="tabpanel"> (id, aria-labelledby) - the two
// are separate React components with no ref to one another, so the id must be derivable from the
// group node alone on both sides rather than generated once via useId().
function sanitizeForId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function tabbedGroupTabId(node: Term): string {
  return `st-tab-${sanitizeForId(node.value)}`;
}

export function tabbedGroupPanelId(node: Term): string {
  return `st-tabpanel-${sanitizeForId(node.value)}`;
}
