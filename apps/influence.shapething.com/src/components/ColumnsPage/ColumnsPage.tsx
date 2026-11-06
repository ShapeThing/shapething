import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { isEntityId } from "../../data/entities.ts";
import { entityOptions, influenceOptions } from "../../data/queries.ts";
import type { PersonSummary } from "../../data/person.ts";
import { createInfluenceScale, InfluenceScaleContext } from "../../influence/influenceScale.ts";
import { navigate, pathForIds, useAppLocation, withoutModal } from "../../routing.ts";
import Column from "../Column/Column.tsx";
import EntityModal from "../EntityModal/EntityModal.tsx";
import FixedMenu from "../FixedMenu/FixedMenu.tsx";
import InfoModal from "../InfoModal/InfoModal.tsx";
import "./style.scss";

type ColumnModel = {
  key: string;
  title: string;
  people: readonly PersonSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /**
   * The position in the path this column chooses: opening someone in it puts them there.
   * -1 is the column of influencers, choosing there starts a new chain.
   */
  position: number;
};

/**
 * The chain of people: the influencers of the first person, the first person, and for every person
 * in the path the people they influenced.
 */
export default function ColumnsPage({ ids }: { ids: string[] }) {
  const { modal } = useAppLocation();
  const [start] = ids;

  const entities = useQueries({ queries: ids.map((id) => entityOptions(id)) });
  const influencers = useQuery(influenceOptions(start, "influencers"));
  const influenced = useQueries({ queries: ids.map((id) => influenceOptions(id, "influenced")) });

  const nameOf = (index: number) => entities[index]?.data?.name ?? "…";
  const startEntity = entities[0];

  const columns: ColumnModel[] = [
    {
      key: `influencers ${start}`,
      title: `Influencers of ${nameOf(0)}`,
      people: influencers.data,
      isLoading: influencers.isPending,
      isError: influencers.isError,
      position: -1,
    },
    {
      key: `start ${start}`,
      title: "Your starting selection:",
      people: startEntity.data ? [startEntity.data] : undefined,
      isLoading: startEntity.isPending,
      isError: startEntity.isError,
      position: 0,
    },
    ...ids.map((id, index) => ({
      key: `influenced ${index} ${id}`,
      title: `Influenced by ${nameOf(index)}`,
      people: influenced[index].data,
      isLoading: influenced[index].isPending,
      isError: influenced[index].isError,
      position: index + 1,
    })),
  ];

  // The relative influence is measured against everyone shown.
  // Kept as one string, so the scale (and with it every bar) only changes when a count does.
  const countsKey = columns
    .flatMap((column) => column.people?.map((person) => person.influence) ?? [])
    .join(",");
  const scale = useMemo(
    () => createInfluenceScale(countsKey ? countsKey.split(",").map(Number) : []),
    [countsKey],
  );

  // A new column scrolls into view: right away when the page opens, smoothly after.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const loadedColumns = columns.filter((column) => column.people !== undefined).length;
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
  // The person or item open in the modal stands out in the columns behind it.
  const focusedId = isEntityId(modal) ? modal : undefined;
  const path = pathForIds(ids);

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
              people={column.people}
              isLoading={column.isLoading}
              isError={column.isError}
              isSelected={column.position === 0}
              focusedId={focusedId}
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
              hrefFor={(person) =>
                column.position < 0
                  ? pathForIds([person.id])
                  : person.id === ids[column.position]
                    ? pathForIds(ids.slice(0, column.position))
                    : pathForIds([...ids.slice(0, column.position), person.id])
              }
              linkLabelFor={(person) =>
                column.position < 0
                  ? `Start with ${person.name}`
                  : person.id === ids[column.position]
                    ? `Close ${person.name}`
                    : `Show who ${person.name} influenced`
              }
            />
          ))}
        </main>
        <FixedMenu key={path} path={path} />
      </div>

      {/* The links to the item in the modal (works, interests, ideas) are rendered by the display,
          so they are found by their href. focusedId is a checked Wikidata identifier. */}
      {focusedId && (
        <style>{`.columns a[href$="/entity/${focusedId}"] { color: var(--color-accent); }`}</style>
      )}

      {modal === "info" ? (
        <InfoModal onClose={closeModal} />
      ) : isEntityId(modal) ? (
        <EntityModal key={modal} id={modal} onClose={closeModal} />
      ) : null}
    </InfluenceScaleContext.Provider>
  );
}
