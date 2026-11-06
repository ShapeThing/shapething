import type { Preprocessor } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { factory, inf, sh } from "../rdf/namespaces.ts";

/**
 * A step after the renderer's own preprocessing (see EntityModal) that puts the property shapes
 * the renderer made for inf:AllPropertiesShape (enableMissingShapesGeneration) in a group: the
 * external identifiers in inf:identifiers, every other property in inf:statements (shapes.ttl).
 * Which predicates are identifiers is known from the query they came with (data/queries.ts's
 * useAllProperties), not from the data itself.
 *
 * The shapes graph is copied rather than changed in place: it is shared by every display.
 */
export const groupProperties =
  (identifiers: ReadonlySet<string>): Preprocessor =>
  (environment) => {
    const source = environment.shapesGraph as RdfStore;
    const shapesGraph = RdfStore.createDefault();
    for (const quad of source.getQuads()) shapesGraph.addQuad(quad);

    for (const { object: property } of source.getQuads(inf("AllPropertiesShape"), sh("property"))) {
      if (property.termType === "Literal" || property.termType === "Variable") continue;
      if (source.getQuads(property, sh("group")).length) continue;
      const path = source.getQuads(property, sh("path"))[0]?.object;
      if (path?.termType !== "NamedNode") continue;
      const group = identifiers.has(path.value) ? inf("identifiers") : inf("statements");
      shapesGraph.addQuad(factory.quad(property, sh("group"), group));
    }

    return { ...environment, shapesGraph };
  };
