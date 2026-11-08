import { useMemo } from "react";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useAllProperties, useEntity } from "../../data/queries.ts";
import { isOpenedFromModal } from "../../routing.ts";
import { AllPropertiesShape, ModalShapes } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
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
 * Wikidata can be slow: every place that waits for it shows a spinner, and a thinker when the wait
 * goes on (components/Thinking).
 */
export default function EntityModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entity = useEntity(id);
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
        <div className="entity-modal">
          <Display
            className="entity-modal__display"
            shape={ModalShapes[entity.data.kind]}
            focusNode={entityIri(id)}
            dataGraph={quads}
            settleIndicator={<Thinking />}
          />
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
        </div>
      ) : (
        <div className="entity-modal__loading">
          <Thinking />
        </div>
      )}
    </Modal>
  );
}
