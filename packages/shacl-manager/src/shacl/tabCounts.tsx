import { useMatch } from "react-router";
import { useShapeProperties } from "./pages/ShapeProperties/useShapeProperties.ts";
import { useShaclRules } from "./pages/ShapeRules/useShaclRules.ts";
import { useSparqlConstraints } from "./pages/ShapeQueries/useSparqlConstraints.ts";
import type { Origin } from "./useShapeTree.ts";
import { type Subject, useSubject } from "./useSubject.ts";

// The numbers next to a shape page's tabs. Each reuses the (cached) query that fills its tab, so a
// count always matches what the tab lists, and showing the count starts that query before the tab
// is opened.

const useOrigin = () => (useMatch("/shapes/:origin/*")?.params.origin ?? "managed") as Origin;

type UseList = (subject: Subject, origin: Origin) => unknown[];

const countOf = (useList: UseList) =>
  function TabCount() {
    const subject = useSubject();
    return subject ? <ListCount useList={useList} subject={subject} /> : null;
  };

// Split off so the hook is only called once there is a subject.
function ListCount({ useList, subject }: { useList: UseList; subject: Subject }) {
  return useList(subject, useOrigin()).length;
}

export const PropertiesCount = countOf(useShapeProperties);
export const QueriesCount = countOf(useSparqlConstraints);
export const RulesCount = countOf(useShaclRules);
