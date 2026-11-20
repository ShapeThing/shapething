import { Suspense } from "react";
import { NavLink } from "react-router";
import { CreateButton } from "../app/edit/CreateButton.tsx";
import { ListDetail, SelectFirst } from "../app/ListDetail.tsx";
import { MetaView } from "../app/MetaView.tsx";
import { useOrigin, type Origin } from "../app/paths.ts";
import { termTitle, useBestByLanguage, useTermLabel } from "../app/termLabel.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { deactivatedClass } from "../data-model/editGraphs.ts";
import { factory, termKey, type Resource } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import { useCached } from "../data-model/storeCache.ts";
import { listItems, listTabs, type ListTab } from "./listTabs.ts";
import { shaclMeta } from "./metaShapes.ts";
import { type Subject, useSubject } from "./useSubject.ts";

// Its Edit button is in the section's heading (see routes.tsx).
export function SubjectMeta() {
  const subject = useSubject();
  if (!subject) return null;
  return <MetaView term={subject.term} shapes={shaclMeta.shape} />;
}

export function SubjectList({ tab }: { tab: ListTab }) {
  const subject = useSubject();
  const origin = useOrigin();
  const { create } = tab;

  return (
    <ListDetail
      title={tab.label}
      empty={
        subject && (
          <Suspense>
            <EmptyMessage tab={tab} subject={subject} origin={origin} />
          </Suspense>
        )
      }
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
  const items = useCached(listItems(dataModel, tab, subject, origin));
  const itemLabel = useItemLabel(tab);
  if (items.length === 0) return null;

  return (
    <ul>
      <SelectFirst to={termToSegment(items[0], dataModel)} />
      {items.map((item) => {
        return (
          <li key={termKey(item)}>
            <NavLink
              to={`./${termToSegment(item, dataModel)}`}
              title={termTitle(item, dataModel)}
              className={deactivatedClass(dataModel, item)}
            >
              {itemLabel(item)}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

// Shown in the detail column: an empty list leaves nothing to select.
function EmptyMessage({
  tab,
  subject,
  origin,
}: {
  tab: ListTab;
  subject: Subject;
  origin: Origin;
}) {
  const dataModel = useDataModel();
  const items = useCached(listItems(dataModel, tab, subject, origin));
  return items.length === 0 ? <p>{tab.empty}</p> : null;
}

export function useItemLabel(tab: ListTab | undefined): (term: Resource) => string {
  const { store } = useDataModel();
  const termLabel = useTermLabel();
  const bestByLanguage = useBestByLanguage();
  return (term) => termLabel(term, tab?.fallbackLabel?.(term, store, bestByLanguage));
}

function ListCount({ tab }: { tab: ListTab }) {
  const subject = useSubject();
  return subject ? <ItemCount tab={tab} subject={subject} /> : null;
}

function ItemCount({ tab, subject }: { tab: ListTab; subject: Subject }) {
  const dataModel = useDataModel();
  const origin = useOrigin();
  return useCached(listItems(dataModel, tab, subject, origin)).length;
}

export const PropertiesCount = () => <ListCount tab={listTabs.properties} />;
export const QueriesCount = () => <ListCount tab={listTabs.queries} />;
export const RulesCount = () => <ListCount tab={listTabs.rules} />;
