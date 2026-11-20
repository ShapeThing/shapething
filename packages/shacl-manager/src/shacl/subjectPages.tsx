import { Suspense, use } from "react";
import { NavLink } from "react-router";
import { CreateButton } from "../app/edit/CreateButton.tsx";
import { ListDetail, SelectFirst } from "../app/ListDetail.tsx";
import { MetaView } from "../app/MetaView.tsx";
import { useOrigin, type Origin } from "../app/paths.ts";
import { termTitle, useBestByLanguage, useTermLabel } from "../app/termLabel.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { factory, termKey, type Resource } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import { listItems, listTabs, type ListTab } from "./listTabs.ts";
import { shaclMeta } from "./metaShapes.ts";
import { type Subject, useSubject } from "./useSubject.ts";

// A class page gathers what every shape of the origin says about the class: not one node to edit.
export function SubjectMeta() {
  const subject = useSubject();
  if (!subject) return null;
  return (
    <MetaView term={subject.term} shapes={shaclMeta.shape} editable={subject.kind !== "class"} />
  );
}

export function SubjectList({ tab }: { tab: ListTab }) {
  const subject = useSubject();
  const origin = useOrigin();
  const { create } = tab;

  return (
    <ListDetail
      title={tab.label}
      actions={
        // Only a shape owns what it lists; a class or group page gathers it from several.
        subject?.kind === "shape" &&
        origin === "managed" && (
          <CreateButton
            {...tab.shapes.edit}
            label={create.label}
            kind={create.kind}
            type={create.type}
            links={(node) => [factory.quad(subject.term, create.predicate, node)]}
            to={(segment) => `./${segment}`}
          />
        )
      }
    >
      {subject && (
        <Suspense fallback="Loading…">
          <Items tab={tab} subject={subject} origin={origin} />
        </Suspense>
      )}
    </ListDetail>
  );
}

function Items({ tab, subject, origin }: { tab: ListTab; subject: Subject; origin: Origin }) {
  const dataModel = useDataModel();
  const items = use(listItems(dataModel, tab, subject, origin));
  const itemLabel = useItemLabel(tab);
  if (items.length === 0) return <p>{tab.empty}</p>;

  return (
    <ul>
      <SelectFirst to={termToSegment(items[0], dataModel)} />
      {items.map((item) => (
        <li key={termKey(item)}>
          <NavLink to={`./${termToSegment(item, dataModel)}`} title={termTitle(item, dataModel)}>
            {itemLabel(item)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function useItemLabel(tab: ListTab | undefined): (term: Resource) => string {
  const { store } = useDataModel();
  const termLabel = useTermLabel();
  const bestByLanguage = useBestByLanguage();
  return (term) => termLabel(term, tab?.fallbackLabel?.(term, store, bestByLanguage));
}

function ListCount({ tab }: { tab: ListTab }) {
  const dataModel = useDataModel();
  const subject = useSubject();
  const origin = useOrigin();
  return subject ? use(listItems(dataModel, tab, subject, origin)).length : null;
}

export const PropertiesCount = () => <ListCount tab={listTabs.properties} />;
export const QueriesCount = () => <ListCount tab={listTabs.queries} />;
export const RulesCount = () => <ListCount tab={listTabs.rules} />;
