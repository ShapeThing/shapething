import { createContext } from "react";
import type { ValidationIndex } from "@/outputs/render/contexts/validationIndex.ts";

/**
 * Report mode's results (Environment.report, indexed once per Environment - a report never changes
 * while it's shown), read by the view-mode tree it renders through to show each result inline.
 * Separate from validationContext on purpose: that one carries edit mode's live validation, and
 * the view-mode tree is also mounted inside edit mode (view-in-place modals, readOnlyGraph
 * values), where it should keep showing no validation at all.
 */
export const reportResultsContext = createContext<ValidationIndex | undefined>(undefined);
