import { useCallback, useMemo, useRef } from "react";
import { clsx } from "../../clsx.ts";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useAllProperties, useEntity } from "../../data/queries.ts";
import { allPropertiesGraphs, shownPredicates } from "../../data/resource.ts";
import { wdt } from "../../rdf/namespaces.ts";
import {
  AllPropertiesShape,
  ModalShapes,
  ModalTextShape,
  shapesGraph,
} from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Modal from "../Modal/Modal.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

/**
 * An entity in the modal: a person, but also a work, interest or idea from the lists of a person.
 * Each kind of entity has its own shape (shapes.ttl), so a work never shows a lifespan or an
 * influence. A person can be made the start of a new chain from here.
 *
 * Below it a second renderer lists every property Wikidata states about the entity (see
 * data/resource.ts). It loads on its own, so the rest is not kept waiting for it.
 *
 * The image and the facts (the years, the influence) are a side column: on a wide screen beside
 * the rest. The image scrolls away with it, the facts stay in view (see useSideImageOffset). A
 * concept without an image has no facts either, so no side column.
 */
/**
 * Measures how far the image of the side column reaches: from its top to the next field (the full
 * name). That is set as --side-image-offset on the modal, and the side column sticks that far above
 * the top (style.scss): the image scrolls away with the text, the rest of the side column stays.
 * Measured again whenever the side column changes size, as when the image has loaded.
 */
const useSideImageOffset = () => {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((modal: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const side = modal?.querySelector<HTMLElement>(".entity-modal__side");
    if (!modal || !side) return;

    const update = () => {
      const image = side
        .querySelector('[data-widget="ImageViewer"]')
        ?.closest<HTMLElement>(".st-view-mode > .st-form-element");
      const next = image?.nextElementSibling;
      const offset =
        image && next ? next.getBoundingClientRect().top - image.getBoundingClientRect().top : 0;
      modal.style.setProperty("--side-image-offset", `${offset}px`);
    };
    observer.current = new ResizeObserver(update);
    observer.current.observe(side);
    update();
  }, []);
};

export default function EntityModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entity = useEntity(id);
  const sideImageOffset = useSideImageOffset();
  const allProperties = useAllProperties(id);
  const article = entity.data?.article;
  const abstract = useAbstract(article);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  const kind = entity.data?.kind;

  // Every property, but those the side column and the text already show. The full name
  // (inf:fullName) is the name in native language (P1559), so that one is left out too.
  const allPropertiesGraph = useMemo(() => {
    if (!allProperties.data || !kind) return undefined;
    const { iri, resource, labelRows } = allProperties.data;
    const shown = shownPredicates(shapesGraph, [ModalShapes[kind], ModalTextShape]);
    shown.add(wdt("P1559").value);
    return allPropertiesGraphs(iri, resource, labelRows, shown);
  }, [allProperties.data, kind]);

  const allPropertiesShapes = useMemo(
    () => allPropertiesGraph && [shapesGraph, allPropertiesGraph.shapes],
    [allPropertiesGraph],
  );

  const hasSide =
    entity.data !== undefined && (entity.data.kind !== "concept" || !!entity.data.image);

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
        <div
          ref={hasSide ? sideImageOffset : undefined}
          className={clsx("entity-modal", hasSide && "entity-modal--with-side")}
        >
          {hasSide && (
            <Display
              className="entity-modal__side"
              shape={ModalShapes[entity.data.kind]}
              focusNode={entityIri(id)}
              dataGraph={quads}
            />
          )}
          <div className="entity-modal__main">
            <Display
              className="entity-modal__display"
              shape={ModalTextShape}
              focusNode={entityIri(id)}
              dataGraph={quads}
            />
            <section className="entity-modal__all-properties" aria-label="All properties">
              {allPropertiesGraph && allPropertiesShapes ? (
                <Display
                  shape={AllPropertiesShape}
                  focusNode={entityIri(id)}
                  dataGraph={allPropertiesGraph.data}
                  shapes={allPropertiesShapes}
                />
              ) : allProperties.isError ? (
                <p>The other properties are not available at the moment.</p>
              ) : (
                <div className="entity-modal__loading">
                  <Spinner />
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="entity-modal__loading">
          <Spinner />
        </div>
      )}
    </Modal>
  );
}
