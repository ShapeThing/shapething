import { useMemo } from "react";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useAllProperties, useEntity, useItemLists } from "../../data/queries.ts";
import type { ItemKind } from "../../data/person.ts";
import { type EntityTab, entityModalHash, isOpenedFromModal, navigate } from "../../routing.ts";
import { AllPropertiesShape, ModalShapes } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import EntityLists from "../EntityLists/EntityLists.tsx";
import ErrorMessage from "../ErrorMessage/ErrorMessage.tsx";
import Modal from "../Modal/Modal.tsx";
import Thinking from "../Thinking/Thinking.tsx";
import "./style.scss";

/**
 * An entity in the modal: a person, but also a work, interest or idea from the lists of a person.
 * Each kind of entity has its own shape (src/shapes), so a work never shows a lifespan or an
 * influence. A person can be made the start of a new chain from here (the footer).
 *
 * The shape has two groups: the side column (inf:side: the image, the short description and the
 * facts) and the main one (inf:main: the text). Below the text a second renderer lists every
 * property Wikidata states about the entity (see queries/allProperties.rq). It loads on its own, so the rest
 * is not kept waiting for it. On a wide screen the side column is beside the text and the
 * properties, sticky while they scroll (style.scss). A concept without an image or
 * a description has no facts either: its side group is empty, so the renderer leaves it out.
 *
 * A person (or a band) has more tabs: what they made (works, albums, artworks), their ideas and
 * their interests (components/EntityLists), each once it is known they have any. The tabs take the place of the text and the properties; the side column
 * stays (style.scss). The tab is in the URL (#Q868/works, see routing.ts); switching tabs replaces
 * the history entry, so going back leaves the modal or returns to the entity before. The text and
 * the properties stay rendered while another tab shows, so going back to them loads nothing again.
 *
 * Wikidata can be slow: every place that waits for it shows a spinner, and a thinker when the wait
 * goes on (components/Thinking).
 */
const LIST_TABS: ReadonlyArray<{ kind: ItemKind; label: string }> = [
  { kind: "works", label: "Works" },
  { kind: "albums", label: "Albums" },
  { kind: "artworks", label: "Artworks" },
  { kind: "ideas", label: "Ideas" },
  { kind: "interests", label: "Interests" },
];

export default function EntityModal({
  id,
  tab,
  onClose,
}: {
  id: string;
  tab: EntityTab;
  onClose: () => void;
}) {
  const entity = useEntity(id);
  const isPerson = entity.data?.kind === "person";
  const itemLists = useItemLists(id, isPerson);
  const lists = itemLists.data;
  // A list's tab once the list is known to have something, so tabs do not come and go; opened on a
  // tab (from the URL), it shows while the lists load. The longest list first: a painter's
  // artworks before their one book. Lists as long as each other keep the order of LIST_TABS.
  const listTabs = isPerson
    ? LIST_TABS.filter(({ kind }) => (lists ? lists[kind].length > 0 : kind === tab)).sort(
        (a, b) => (lists ? lists[b.kind].length - lists[a.kind].length : 0),
      )
    : [];
  const activeList = listTabs.find(({ kind }) => kind === tab)?.kind;
  const selectTab = (next: EntityTab) =>
    // The state is kept: it says whether the modal can go back (isOpenedFromModal).
    navigate(entityModalHash(id, next), { replace: true, state: window.history.state });

  const allProperties = useAllProperties(id);
  const article = entity.data?.article;
  const abstract = useAbstract(article);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  // A Commons thumbnail wide enough for the widest modal on a high density screen, not the original.
  const banner = entity.data?.banner && `${entity.data.banner.value}?width=1600`;

  const quads = useMemo(
    () =>
      isComplete && entity.data ? entityQuads(entity.data, abstract.data ?? undefined) : undefined,
    [isComplete, entity.data, abstract.data],
  );

  return (
    <Modal
      title={entity.data?.name ?? (entity.isError ? "Not available" : "Loading…")}
      onClose={onClose}
      // Opened from a link in the modal (see useLinkHandling): back to the entity before.
      onBack={isOpenedFromModal() ? () => window.history.back() : undefined}
      banner={banner}
      footer={
        entity.data?.kind === "person" && (
          <a className="entity-modal__start" href={`/${id}`}>
            Start with {entity.data.name}
          </a>
        )
      }
    >
      {entity.isError ? (
        <ErrorMessage onRetry={() => void entity.refetch()} />
      ) : quads && entity.data ? (
        <div className="entity-modal" data-tab={activeList ?? "about"}>
          <Display
            className="entity-modal__display"
            shape={ModalShapes[entity.data.kind]}
            focusNode={entityIri(id)}
            dataGraph={quads}
            settleIndicator={<Thinking />}
          />
          {listTabs.length > 0 && (
            <div className="entity-tabs">
              <div className="entity-tabs__list" role="tablist" aria-label="Sections">
                {[{ kind: "about" as const, label: "About" }, ...listTabs].map(
                  ({ kind, label }) => {
                    const count = kind !== "about" ? lists?.[kind].length : undefined;
                    return (
                      <button
                        key={kind}
                        type="button"
                        role="tab"
                        className="entity-tabs__tab"
                        aria-selected={kind === (activeList ?? "about")}
                        onClick={() => selectTab(kind)}
                      >
                        {label}
                        {count !== undefined && <span className="entity-tabs__count">{count}</span>}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}
          <section className="entity-modal__all-properties" aria-label="All properties">
            {allProperties.data ? (
              <Display
                shape={AllPropertiesShape}
                focusNode={entityIri(id)}
                dataGraph={allProperties.data}
                enableMissingShapesGeneration
                // Two columns, the labels beside the values; on a narrow screen one (style.scss).
                labelLayout="columns"
                settleIndicator={<Thinking caption="Gathering everything Wikidata knows…" />}
              />
            ) : allProperties.isError ? (
              <ErrorMessage onRetry={() => void allProperties.refetch()}>
                The other properties are not available at the moment.
              </ErrorMessage>
            ) : (
              <div className="entity-modal__loading">
                <Thinking caption="Gathering everything Wikidata knows…" />
              </div>
            )}
          </section>
          {activeList && (
            <section className="entity-modal__list" role="tabpanel">
              {lists ? (
                <EntityLists person={entity.data} lists={lists} kind={activeList} />
              ) : itemLists.isError ? (
                <ErrorMessage onRetry={() => void itemLists.refetch()} />
              ) : (
                <div className="entity-modal__loading">
                  <Thinking />
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="entity-modal__loading">
          <Thinking />
        </div>
      )}
    </Modal>
  );
}
