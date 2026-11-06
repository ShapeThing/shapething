import { defaultPreprocessors } from "@shapething/shacl-renderer";
import { useMemo } from "react";
import { entityIri } from "../../data/entities.ts";
import { entityQuads } from "../../data/graphs.ts";
import { useAbstract, useAllProperties, useEntity } from "../../data/queries.ts";
import { groupProperties } from "../../shapes/groupProperties.ts";
import { AllPropertiesShape, ModalShapes } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Modal from "../Modal/Modal.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

/**
 * An entity in the modal: a person, but also a work, interest or idea from the lists of a person.
 * Each kind of entity has its own shape (shapes.ttl), so a work never shows a lifespan or an
 * influence. A person can be made the start of a new chain from here (the footer).
 *
 * The shape has two groups: the side column (inf:side: the image, the short description and the
 * facts) and the main one (inf:main: the text). Below the text a second renderer lists every
 * property Wikidata states about the entity (see queries/allProperties.rq). It loads on its own, so the rest
 * is not kept waiting for it. On a wide screen the side column is beside the text and the
 * properties, sticky while they scroll (style.scss). A concept without an image or
 * a description has no facts either: its side group is empty, so the renderer leaves it out.
 */
export default function EntityModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entity = useEntity(id);
  const allProperties = useAllProperties(id);
  const article = entity.data?.article;
  const abstract = useAbstract(article);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  // Every property of a person in one graph; which of them are external identifiers is known from
  // the query they came with, and that puts them in their group (shapes/groupProperties.ts).
  const allPropertiesDisplay = useMemo(() => {
    if (!allProperties.data) return undefined;
    const { statements, identifiers } = allProperties.data;
    const identifierPredicates = new Set(identifiers.map((quad) => quad.predicate.value));
    return {
      dataGraph: [...statements, ...identifiers],
      preprocessors: [...defaultPreprocessors, groupProperties(identifierPredicates)],
    };
  }, [allProperties.data]);

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
        <div className="entity-modal">
          <Display
            className="entity-modal__display"
            shape={ModalShapes[entity.data.kind]}
            focusNode={entityIri(id)}
            dataGraph={quads}
          />
          {/* Only people have a shape for all their properties so far (inf:AllPropertiesShape). */}
          {entity.data.kind === "person" && (
            <section className="entity-modal__all-properties" aria-label="All properties">
              {allPropertiesDisplay ? (
                <Display
                  shape={AllPropertiesShape}
                  focusNode={entityIri(id)}
                  dataGraph={allPropertiesDisplay.dataGraph}
                  preprocessors={allPropertiesDisplay.preprocessors}
                  enableMissingShapesGeneration
                  // Two columns, the labels beside the values; on a narrow screen one (style.scss).
                  labelLayout="columns"
                />
              ) : allProperties.isError ? (
                <p>The other properties are not available at the moment.</p>
              ) : (
                <div className="entity-modal__loading">
                  <Spinner />
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="entity-modal__loading">
          <Spinner />
        </div>
      )}
    </Modal>
  );
}
