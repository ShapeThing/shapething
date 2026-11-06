import { useMemo } from "react";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useEntity } from "../../data/queries.ts";
import { ModalShape } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Modal from "../Modal/Modal.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

const IMAGE_WIDTH = 500;

/**
 * An entity in the modal, rendered with inf:ModalShape: a person, but also a work, interest or idea
 * from the lists of a person. A person can be made the start of a new chain from here.
 */
export default function EntityModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entity = useEntity(id);
  const article = entity.data?.article;
  const abstract = useAbstract(article);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  const quads = useMemo(
    () =>
      isComplete && entity.data
        ? entityQuads(entity.data, abstract.data ?? undefined, IMAGE_WIDTH)
        : undefined,
    [isComplete, entity.data, abstract.data],
  );

  return (
    <Modal
      title={entity.data?.name ?? (entity.isError ? "Not available" : "Loading…")}
      onClose={onClose}
      footer={
        entity.data?.isHuman && (
          <a className="entity-modal__start" href={`/${id}`}>
            Start with {entity.data.name}
          </a>
        )
      }
    >
      {entity.isError ? (
        <p>Unfortunately the data source is unavailable. Please come back later.</p>
      ) : quads ? (
        <Display
          className="entity-modal__display"
          shape={ModalShape}
          focusNode={entityIri(id)}
          quads={quads}
        />
      ) : (
        <div className="entity-modal__loading">
          <Spinner />
        </div>
      )}
    </Modal>
  );
}
