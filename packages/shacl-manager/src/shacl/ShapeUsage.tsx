import { select } from "@shapething/shacl-renderer";
import { Suspense } from "react";
import { NavLink } from "react-router";
import { subjectPath, type Origin } from "../app/paths.ts";
import { termTitle, useTermLabel } from "../app/termLabel.ts";
import { useTermParam } from "../app/useTermParam.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { deactivatedClass } from "../data-model/editGraphs.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { termKey, type Resource } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import { cached, useCached } from "../data-model/storeCache.ts";
import type { ListTab } from "./listTabs.ts";
import shapeUsage from "./queries/shapeUsage.rq";
import { useSubject } from "./useSubject.ts";

type Usage = { shape: Resource; origin: Origin };

function loadUsage(dataModel: DataModel, tab: ListTab, node: Resource): Promise<Usage[]> {
  const predicate = tab.create.predicate;
  return cached(dataModel.store, `shapeUsage ${termKey(predicate)} ${termKey(node)}`, async () => {
    const rows = await select(shapeUsage, dataModel.store, {
      node,
      predicate,
      dataModel: dataModel.dataModelIRI,
    });
    return rows.map(({ shape, shapeOrigin }) => ({ shape, origin: shapeOrigin.value as Origin }));
  });
}

// The shapes a list item (a property shape, constraint or rule) belongs to, each linking to the
// item on that shape's page. On a shape's own page that shape is the context, not a usage: only
// the other shapes are listed, and nothing when the item is not reused.
export function ShapeUsage({ tab, path }: { tab: ListTab; path: string }) {
  const node = useTermParam(tab.param);
  const subject = useSubject();
  if (!node) return null;
  const current = subject?.kind === "shape" ? subject.term : undefined;
  return (
    <Suspense key={termKey(node)} fallback={null}>
      <UsageLinks tab={tab} path={path} node={node} current={current} />
    </Suspense>
  );
}

function UsageLinks({
  tab,
  path,
  node,
  current,
}: {
  tab: ListTab;
  path: string;
  node: Resource;
  current?: Resource;
}) {
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  const usage = useCached(loadUsage(dataModel, tab, node)).filter(
    ({ shape }) => !current || !shape.equals(current),
  );
  if (usage.length === 0) return null;

  const segment = termToSegment(node, dataModel);
  return (
    <div className="st-usage">
      <span className="st-usage__label">{current ? "Also used in" : "Used in"}</span>
      <ul className="st-usage__shapes">
        {usage.map(({ shape, origin }) => (
          <li key={termKey(shape)}>
            <NavLink
              to={`${subjectPath(origin, "shape", termToSegment(shape, dataModel))}/${path}/${segment}`}
              title={termTitle(shape, dataModel)}
              className={deactivatedClass(dataModel, shape)}
            >
              {termLabel(shape)}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
