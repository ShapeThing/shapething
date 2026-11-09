import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { useCallback, useMemo } from "react";
import { entityIri } from "../../data/entities.ts";
import { useAbstract, useAllProperties, useEntity, useItemLists } from "../../data/queries.ts";
import { useLiveStore } from "../../data/useLiveStore.ts";
import { factory, inf, schema, shui } from "../../rdf/namespaces.ts";
import { type EntityTab, entityModalHash, isOpenedFromModal, navigate } from "../../routing.ts";
import { modalShapeFor, PersonModalShape, valueOf } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import ErrorMessage from "../ErrorMessage/ErrorMessage.tsx";
import Modal from "../Modal/Modal.tsx";
import Thinking from "../Thinking/Thinking.tsx";
import "./lists.scss";
import "./style.scss";

/** The quads of a query in a store of their own, to read from. */
const storeOf = (quads: readonly Quad[] = []) => {
  const store = RdfStore.createDefault();
  quads.forEach((quad) => store.addQuad(quad));
  return store;
};

/**
 * An entity in the modal: a person, but also a work, interest or idea. What it shows is up to the
 * shape that targets the entity's class (src/shapes, modalShapeFor): the side column with the image
 * and the facts, and the tabs: the text, and a person's works, albums, artworks, ideas and
 * interests, each tab once it has something (st:TabbedPropertyGroup). The tab is in the URL
 * (#Q868/works); switching tabs replaces the history entry, so going back leaves the modal or
 * returns to the entity before.
 *
 * Its data is one live store: the entity (queries/entity.rq), the introduction of its Wikipedia
 * article, a person's lists (queries/itemLists.rq), and every property Wikidata states about the
 * entity (queries/allProperties.rq), each added as it arrives. The properties the shape does not
 * show otherwise are listed below the text (inf:ModalBase).
 *
 * Wikidata can be slow: every place that waits for it shows a thinker (components/Thinking).
 */
export default function EntityModal({
  id,
  tab,
  onClose,
}: {
  id: string;
  tab: EntityTab;
  onClose: () => void;
}) {
  const iri = useMemo(() => entityIri(id), [id]);
  const entity = useEntity(id);
  const entityStore = useMemo(() => storeOf(entity.data), [entity.data]);
  const shape = modalShapeFor(entityStore, iri);
  const name = valueOf(entityStore, iri, shui("LabelRole"))?.value;
  const article = entityStore.getQuads(null, schema("about"), iri)[0]?.subject;

  const abstract = useAbstract(article?.termType === "NamedNode" ? article : undefined);
  const itemLists = useItemLists(id, entity.data !== undefined && shape.equals(PersonModalShape));
  const allProperties = useAllProperties(id);
  // The introduction is waited for, so the modal does not change while it is read.
  const isComplete = entity.data !== undefined && (article === undefined || !abstract.isPending);

  const abstractQuads = useMemo(
    () => (abstract.data ? [factory.quad(iri, schema("abstract"), abstract.data)] : undefined),
    [iri, abstract.data],
  );
  const dataGraph = useLiveStore([entity.data, itemLists.data, abstractQuads, allProperties.data]);

  const onTabChange = useCallback(
    (group: string) =>
      // The state is kept: it says whether the modal can go back (isOpenedFromModal).
      navigate(entityModalHash(id, group.slice(inf("").value.length)), {
        replace: true,
        state: window.history.state,
      }),
    [id],
  );

  return (
    <Modal
      // Without a readable name, its identifier.
      title={name ?? (entity.isError ? "Not available" : entity.data ? id : "Loading…")}
      onClose={onClose}
      // Opened from a link in the modal (see useLinkHandling): back to the entity before.
      onBack={isOpenedFromModal() ? () => window.history.back() : undefined}
      footer={
        shape.equals(PersonModalShape) &&
        name && (
          <a className="entity-modal__start" href={`/${id}`}>
            Start with {name}
          </a>
        )
      }
    >
      {entity.isError ? (
        <ErrorMessage onRetry={() => void entity.refetch()} />
      ) : isComplete ? (
        <div className="entity-modal">
          <Display
            className="entity-modal__display"
            shape={shape}
            focusNode={iri}
            dataGraph={dataGraph}
            activeTab={inf(tab).value}
            onTabChange={onTabChange}
            // Every other property Wikidata states, below the text (inf:ModalBase), also when it
            // arrives after the rest.
            enableMissingShapesGeneration
            settleIndicator={<Thinking />}
          />
        </div>
      ) : (
        <div className="entity-modal__loading">
          <Thinking />
        </div>
      )}
    </Modal>
  );
}
