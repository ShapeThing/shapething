import { useMemo } from "react";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useEntity } from "../../data/queries.ts";
import { ModalShapes } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Modal from "../Modal/Modal.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

/**
 * An entity in the modal: a person, but also a work, interest or idea from the lists of a person.
 * Each kind of entity has its own shape (shapes.ttl), so a work never shows a lifespan or an
 * influence. A person can be made the start of a new chain from here.
 */
export default function EntityModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entity = useEntity(id);
  const article = entity.data?.article;
  const abstract = useAbstract(article);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  const quads = useMemo(
    () =>
      isComplete && entity.data ? entityQuads(entity.data, abstract.data ?? undefined) : undefined,
    [isComplete, entity.data, abstract.data],
  );

  return (
    <Modal
      title={entity.data?.name ?? (entity.isError ? "Not available" : "Loading…")}
      onClose={onClose}
      footer={
        entity.data?.kind === "person" && (
          <a className="entity-modal__start" href={`/${id}`}>
            Start with {entity.data.name}
          </a>
        )
      }
    >
      {entity.isError ? (
        <p>Unfortunately the data source is unavailable. Please come back later.</p>
      ) : quads && entity.data ? (
        <Display
          className="entity-modal__display"
          shape={ModalShapes[entity.data.kind]}
          focusNode={entityIri(id)}
          dataGraph={quads}
        />
      ) : (
        <div className="entity-modal__loading">
          <Spinner />
        </div>
      )}
    </Modal>
  );
}
