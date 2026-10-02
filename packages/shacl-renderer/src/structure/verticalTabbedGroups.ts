import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { st } from "@/helpers/namespaces.ts";
import { hasGroupType } from "@/structure/groupTypes.ts";

/**
 * True when `node` (a sh:PropertyGroup node) is itself declared st:VerticalTabbedPropertyGroup -
 * the ShapeThing-original Drupal-style "vertical tabs" group type (see widgets/implementations/
 * st/groups/VerticalTabbedPropertyGroup). Checked against rdf:type (subclasses included, see groupTypes.ts) rather than through
 * widget resolution (registry.ts's getGroupWidget), for the same reason as isTabbedPropertyGroup
 * (see tabbedGroups.ts): sibling-family detection stays correct even for a caller-supplied
 * Widgets registry that maps a different Component to this IRI.
 */
export function isVerticalTabbedPropertyGroup(node: Term, shapesGraph: RdfStore): boolean {
  return hasGroupType(node, st("VerticalTabbedPropertyGroup"), [shapesGraph]);
}

// Stable DOM ids for the tab button and its panel - see tabbedGroups.ts's own sanitizeForId for
// why this can't be a useId(): the nav renders every sibling tab's button from a single instance,
// which only has the *other* tabs' plain GroupUIElement data (via context), not their own
// rendered React output.
function sanitizeForId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function verticalTabbedGroupTabId(node: Term): string {
  return `st-vtab-${sanitizeForId(node.value)}`;
}

export function verticalTabbedGroupPanelId(node: Term): string {
  return `st-vtabpanel-${sanitizeForId(node.value)}`;
}
