import type { NamedNode, Quad } from "@rdfjs/types";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { entityIri } from "../../data/entities.ts";
import { influenceOptions } from "../../data/queries.ts";
import { useLiveStore } from "../../data/useLiveStore.ts";
import { createInfluenceScale, InfluenceScaleContext } from "../../influence/influenceScale.ts";
import { inf, shui, wdt } from "../../rdf/namespaces.ts";
import {
  entityModalOf,
  navigate,
  pathForIds,
  useAppLocation,
  withoutModal,
} from "../../routing.ts";
import { columnShape, TeaserShape, valueOf } from "../../shapes/shapes.ts";
import type { SortOrder } from "../../sorting.ts";
import Column from "../Column/Column.tsx";
import EntityModal from "../EntityModal/EntityModal.tsx";
import FixedMenu from "../FixedMenu/FixedMenu.tsx";
import InfoModal from "../InfoModal/InfoModal.tsx";
import TimelineModal from "../TimelineModal/TimelineModal.tsx";
import "./style.scss";

type ColumnModel = {
  key: string;
  title: string;
  /** What the column renders, with which shape (see Column). */
  subject: NamedNode;
  shape: NamedNode;
  /** The answer of the column's query, once there is one. */
  quads: readonly Quad[] | undefined;
  /** Whether that answer has anyone in it (the triples wdt:P737 the column shape lists). */
  isEmpty: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Where the sort order of the column is kept in the URL (see sorting.ts); the starting person's
   * column, with one person only, has none. */
  sortKey?: string;
  /**
   * The position in the path this column chooses: opening someone in it puts them there.
   * -1 is the column of influencers, choosing there starts a new chain.
   */
  position: number;
};

/** Whether the answer of a column's query has anyone in it. */
const isEmpty = (quads: readonly Quad[] | undefined) =>
  quads !== undefined && !quads.some((quad) => quad.predicate.equals(wdt("P737")));

/**
 * The chain of people: the influencers of the first person, the first person, and for every person
 * in the path the people they influenced. The answers of the queries of every column (triples, see
 * data/queries.ts) go into one live store (useLiveStore), that every column renders from.
 */
export default function ColumnsPage({ ids }: { ids: string[] }) {
  const { modal, sorts } = useAppLocation();
  const entityModal = entityModalOf(modal);
  const [start] = ids;

  const influencers = useQuery(influenceOptions(start, "influencers"));
  const influenced = useQueries({ queries: ids.map((id) => influenceOptions(id, "influenced")) });

  // One live store for the page, that every column renders from. An answer stays when its column
  // goes: what it says is still true, and a column that comes back has its people right away.
  const dataGraph = useLiveStore([influencers.data, ...influenced.map((query) => query.data)]);
  // The names in the titles: everyone in the chain is in the store (the first person's data comes
  // with the people they influenced, the others are among the people before them).
  const nameOf = (index: number) =>
    valueOf(dataGraph, entityIri(ids[index]), shui("LabelRole"))?.value ?? "…";
  const sortOf = (key: string) => sorts.get(key) ?? "influence";

  const columns: ColumnModel[] = [
    {
      key: `influencers ${start}`,
      title: `Influencers of ${nameOf(0)}`,
      subject: entityIri(start),
      shape: columnShape("influencers", sortOf("influencers")),
      quads: influencers.data,
      isEmpty: isEmpty(influencers.data),
      isLoading: influencers.isPending,
      isError: influencers.isError,
      onRetry: () => void influencers.refetch(),
      sortKey: "influencers",
      position: -1,
    },
    {
      // The query of the people the first person influenced has the first person's data too.
      key: `start ${start}`,
      title: "Your starting selection:",
      subject: entityIri(start),
      shape: TeaserShape,
      quads: influenced[0].data,
      isEmpty: false,
      isLoading: influenced[0].isPending,
      isError: influenced[0].isError,
      onRetry: () => void influenced[0].refetch(),
      position: 0,
    },
    ...ids.map((id, index) => ({
      key: `influenced ${index} ${id}`,
      title: `Influenced by ${nameOf(index)}`,
      subject: entityIri(id),
      shape: columnShape("influenced", sortOf(id)),
      quads: influenced[index].data,
      isEmpty: isEmpty(influenced[index].data),
      isLoading: influenced[index].isPending,
      isError: influenced[index].isError,
      onRetry: () => void influenced[index].refetch(),
      sortKey: id,
      position: index + 1,
    })),
  ];

  // The relative influence is measured against everyone shown.
  // Kept as one string, so the scale (and with it every bar) only changes when a count does.
  const countsKey = columns
    .flatMap(
      (column) =>
        column.quads?.flatMap((quad) =>
          quad.predicate.equals(inf("influenceCount")) ? [quad.object.value] : [],
        ) ?? [],
    )
    .join(",");
  const scale = useMemo(
    () => createInfluenceScale(countsKey ? countsKey.split(",").map(Number) : []),
    [countsKey],
  );

  // A new column scrolls into view: right away when the page opens, smoothly after.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const loadedColumns = columns.filter((column) => column.quads !== undefined).length;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      left: scroller.scrollWidth,
      behavior: hasScrolled.current ? "smooth" : "instant",
    });
    hasScrolled.current = true;
  }, [ids.length, loadedColumns]);

  const closeModal = () => navigate(withoutModal());
  const path = pathForIds(ids);

  // A link to another chain keeps the sort orders of the columns that stay: those of the people
  // still in the chain, and of the influencers.
  const hrefForIds = (nextIds: readonly string[]) => pathForIds(nextIds, sorts);
  // Sorting replaces the history entry: going back leaves the chain, not one sort order.
  const sortColumn = (key: string) => (order: SortOrder) =>
    navigate(`${pathForIds(ids, new Map([...sorts, [key, order]]))}${window.location.hash}`, {
      replace: true,
    });

  // Closing a person first spins its cross and folds away the columns after it; the URL changes
  // when they are gone. Kept with the path it was started on, so it ends with any navigation.
  const [closing, setClosing] = useState<{ path: string; position: number; href: string }>();
  const closingNow = closing?.path === path ? closing : undefined;
  const lastPosition = columns[columns.length - 1].position;

  return (
    <InfluenceScaleContext.Provider value={scale}>
      <div className="columns-page" ref={scrollerRef}>
        <main className="columns">
          {columns.map((column) => (
            <Column
              key={column.key}
              title={column.title}
              subject={column.subject}
              shape={column.shape}
              dataGraph={dataGraph}
              isEmpty={column.isEmpty}
              isLoading={column.isLoading}
              isError={column.isError}
              onRetry={column.onRetry}
              sortOrder={column.sortKey ? sorts.get(column.sortKey) : undefined}
              onSortChange={column.sortKey ? sortColumn(column.sortKey) : undefined}
              isSelected={column.position === 0}
              activeId={column.position >= 0 ? ids[column.position] : undefined}
              isClosing={closingNow?.position === column.position}
              isRemoving={closingNow !== undefined && column.position > closingNow.position}
              onRemoved={
                closingNow && column.position === lastPosition
                  ? () => {
                      setClosing(undefined);
                      navigate(closingNow.href);
                    }
                  : undefined
              }
              onClose={
                // The starting person closes right away, there are no columns to fold away.
                column.position > 0
                  ? (href) => setClosing({ path, position: column.position, href })
                  : undefined
              }
              hrefFor={(id) =>
                column.position < 0
                  ? hrefForIds([id])
                  : id === ids[column.position]
                    ? hrefForIds(ids.slice(0, column.position))
                    : hrefForIds([...ids.slice(0, column.position), id])
              }
            />
          ))}
        </main>
        <FixedMenu key={path} path={path} />
      </div>

      {modal === "info" ? (
        <InfoModal onClose={closeModal} />
      ) : modal === "timeline" ? (
        <TimelineModal dataGraph={dataGraph} people={ids.map(entityIri)} onClose={closeModal} />
      ) : entityModal ? (
        <EntityModal
          key={entityModal.id}
          id={entityModal.id}
          tab={entityModal.tab}
          onClose={closeModal}
        />
      ) : null}
    </InfluenceScaleContext.Provider>
  );
}
