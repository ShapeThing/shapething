import { filterByContentLanguage } from "@/helpers/filterByContentLanguage.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { Environment } from "@/environment.ts";

/**
 * True when view mode would render at least one value somewhere under `element` - the same
 * "anything to show?" test view mode's PropertyUIComponent applies to a single property (its
 * values, narrowed to the active content language unless languageMode is "individual"), lifted to
 * choices and groups by recursing into their children. Lets view mode drop a group whose every
 * property renders null, instead of leaving its empty chrome (heading, tab button, panel) behind.
 *
 * A choice counts as having content when any of its branches does - view mode's
 * ChoiceElementComponent itself falls back to the first branch when none conforms, so this errs
 * on the side of keeping a group visible rather than duplicating its branch detection here.
 */
export function hasViewableContent(
  element: PropertyUIElement | ChoiceElement | GroupUIElement,
  activeLanguage: BCP47,
  languageMode: Environment["languageMode"],
): boolean {
  switch (element.kind) {
    case "property": {
      const objects = element.getObjects();
      return languageMode === "individual"
        ? objects.length > 0
        : filterByContentLanguage(objects, activeLanguage).length > 0;
    }
    case "choice":
      return element
        .children()
        .some((branch) =>
          branch.some((child) => hasViewableContent(child, activeLanguage, languageMode)),
        );
    case "group":
      return element.children.some((child) =>
        hasViewableContent(child, activeLanguage, languageMode),
      );
  }
}
