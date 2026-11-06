import { useCallback, useMemo, useRef } from "react";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useAllProperties, useEntity } from "../../data/queries.ts";
import { allPropertiesGraphs, shownPredicates } from "../../data/resource.ts";
import { AllPropertiesShape, ModalShapes, shapesGraph } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Modal from "../Modal/Modal.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import { useMediaQuery } from "../../useMediaQuery.ts";
import "./style.scss";

/**
 * An entity in the modal: a person, but also a work, interest or idea from the lists of a person.
 * Each kind of entity has its own shape (shapes.ttl), so a work never shows a lifespan or an
 * influence. A person can be made the start of a new chain from here (the footer).
 *
 * The shape has two groups: the side column (inf:side: the image, the short description and the
 * facts) and the main one (inf:main: the text). Below the text a second renderer lists every
 * property Wikidata states about the entity (see data/resource.ts). It loads on its own, so the rest
 * is not kept waiting for it. On a wide screen the side column is beside the text and the
 * properties, sticky while they scroll (style.scss, useSideStickyTop). A concept without an image or
 * a description has no facts either: its side group is empty, so the renderer leaves it out.
 */
/**
 * The side column sticks to the top of the modal while the text and the properties scroll. A side
 * column taller than the modal would then never show its end, so it scrolls along until its end is
 * in view, and sticks there: --side-sticky-top is how far above the top that is (0 when it fits).
 * Measured again whenever the side column or the modal changes size, as when the image has loaded.
 * The side column is rendered after the modal (the renderer loads), so it is looked up each time.
 */
const useSideStickyTop = () => {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((modal: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const scroller = modal?.closest<HTMLElement>(".modal__body");
    if (!modal || !scroller) return;

    let side: HTMLElement | null = null;
    const update = () => {
      const current = modal.querySelector<HTMLElement>(".entity-modal__side");
      if (current !== side) {
        side = current;
        if (side) observer.current?.observe(side);
      }
      if (!side) return;
      // A sticky offset counts from inside the padding of the scrolling element.
      const style = getComputedStyle(scroller);
      const room =
        scroller.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      modal.style.setProperty("--side-sticky-top", `${Math.min(0, room - side.offsetHeight)}px`);
    };
    observer.current = new ResizeObserver(update);
    observer.current.observe(modal);
    observer.current.observe(scroller);
    update();
  }, []);
};

export default function EntityModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entity = useEntity(id);
  const sideStickyTop = useSideStickyTop();
  const isNarrow = useMediaQuery("(max-width: 519.98px)");
  const allProperties = useAllProperties(id);
  const article = entity.data?.article;
  const abstract = useAbstract(article);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  const kind = entity.data?.kind;

  // Every property, but those the side column and the text already show and those
  // inf:AllPropertiesShape lists under sh:ignoredProperties.
  const allPropertiesGraph = useMemo(() => {
    if (!allProperties.data || !kind) return undefined;
    const { iri, resource, labelRows } = allProperties.data;
    const shown = shownPredicates(shapesGraph, [ModalShapes[kind], AllPropertiesShape]);
    return allPropertiesGraphs(iri, resource, labelRows, shown);
  }, [allProperties.data, kind]);

  const allPropertiesShapes = useMemo(
    () => allPropertiesGraph && [shapesGraph, allPropertiesGraph.shapes],
    [allPropertiesGraph],
  );

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
        <p>Unfortunately the data source is unavailable. Please come back later.</p>
      ) : quads && entity.data ? (
        <div ref={sideStickyTop} className="entity-modal">
          <Display
            className="entity-modal__display"
            shape={ModalShapes[entity.data.kind]}
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
                // Two columns, the labels beside the values; a narrow screen has no room for
                // that, so each label stands above its values.
                labelLayout={isNarrow ? "block" : "columns"}
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
      ) : (
        <div className="entity-modal__loading">
          <Spinner />
        </div>
      )}
    </Modal>
  );
}
