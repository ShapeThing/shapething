import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory, inf, rdf, sh, shui, st } from "../rdf/namespaces.ts";

/**
 * The entity models (src/shapes/models) say what the data of a kind of thing is: a node shape with
 * an sh:targetClass, whose property shapes have a role (shui:propertyRole) such as the name
 * (shui:LabelRole), the picture (shui:DepictionRole) or the start of a life (inf:StartRole).
 *
 * The display shapes say how something is shown, whatever kind of thing it is. A property shape of
 * a display shape with a role and without an sh:path is a template: it gets as its path every path
 * the entity models give that role, as alternatives (sh:alternativePath). So inf:TeaserShape shows
 * the name of a person, a band or a programming language alike, and a new entity model is shown
 * without changing the display shapes.
 *
 * The same goes for the order of a list: inf:orderByRole on a property shape becomes an st:orderBy
 * with the paths of that role.
 */

const objects = (store: RdfStore, subject: Term, predicate: NamedNode): Term[] =>
  store.getQuads(subject, predicate).map((quad) => quad.object);

const listItems = (store: RdfStore, list: Term): Term[] => {
  const items: Term[] = [];
  let node = list;
  while (!node.equals(rdf("nil"))) {
    const [first] = objects(store, node, rdf("first"));
    const [rest] = objects(store, node, rdf("rest"));
    if (!first || !rest) break;
    items.push(first);
    node = rest;
  }
  return items;
};

const addList = (store: RdfStore, items: readonly Term[]): Quad_Object => {
  let list: Quad_Object = rdf("nil");
  for (const item of [...items].reverse()) {
    const node = factory.blankNode();
    store.addQuad(factory.quad(node, rdf("first"), item as Quad_Object));
    store.addQuad(factory.quad(node, rdf("rest"), list));
    list = node;
  }
  return list;
};

/** The alternatives of a path: the branches of an sh:alternativePath, or else the path itself. */
const alternativesOf = (store: RdfStore, path: Term): Term[] => {
  const [alternatives] = objects(store, path, sh("alternativePath"));
  return alternatives
    ? listItems(store, alternatives).flatMap((branch) => alternativesOf(store, branch))
    : [path];
};

/** The node shapes that are entity models (inf:EntityModel). */
export const entityModels = (store: RdfStore): Quad_Subject[] =>
  store.getQuads(null, rdf("type"), inf("EntityModel")).map((quad) => quad.subject);

/**
 * Every class a shape targets (sh:targetClass): the entity models' and the modal shapes'. The
 * queries type their items with them (rdf:type), so the shapes find what they target.
 */
export const targetClasses = (store: RdfStore): NamedNode[] => [
  ...new Map(
    store
      .getQuads(null, sh("targetClass"))
      .flatMap((quad) => (quad.object.termType === "NamedNode" ? [quad.object] : []))
      .map((term) => [term.value, term]),
  ).values(),
];

/** By role, the paths the entity models give it, in the order of the models, each once. */
export const pathsByRole = (store: RdfStore): Map<string, Term[]> => {
  const paths = new Map<string, Term[]>();
  for (const model of entityModels(store)) {
    for (const property of objects(store, model, sh("property"))) {
      const [path] = objects(store, property, sh("path"));
      if (!path) continue;
      for (const role of objects(store, property, shui("propertyRole"))) {
        const known = paths.get(role.value) ?? [];
        for (const alternative of alternativesOf(store, path)) {
          if (!known.some((term) => term.equals(alternative))) known.push(alternative);
        }
        paths.set(role.value, known);
      }
    }
  }
  return paths;
};

/** One path of the given alternatives: the path itself when there is one. */
const addPath = (store: RdfStore, alternatives: readonly Term[]): Quad_Object => {
  if (alternatives.length === 1) return alternatives[0] as Quad_Object;
  const path = factory.blankNode();
  store.addQuad(factory.quad(path, sh("alternativePath"), addList(store, alternatives)));
  return path;
};

/**
 * Fills in the templates of the display shapes in `store`, in place: an sh:path for each property
 * shape with a role and no path, an st:orderBy for each inf:orderByRole.
 */
export const compileRoles = (store: RdfStore): void => {
  const paths = pathsByRole(store);
  const pathOf = (property: Term, role: Term) => {
    const alternatives = paths.get(role.value);
    if (!alternatives?.length) {
      throw new Error(`No entity model has a path for ${role.value} (${property.value})`);
    }
    return addPath(store, alternatives);
  };

  for (const quad of store.getQuads(null, shui("propertyRole"))) {
    if (objects(store, quad.subject, sh("path")).length) continue;
    store.addQuad(factory.quad(quad.subject, sh("path"), pathOf(quad.subject, quad.object)));
  }

  for (const quad of store.getQuads(null, inf("orderByRole"))) {
    store.addQuad(factory.quad(quad.subject, st("orderBy"), pathOf(quad.subject, quad.object)));
  }
};

/**
 * The value `focus` has for a role in `dataGraph`: through the paths the entity models give the
 * role, the first that has one. Its name (shui:LabelRole) for a title, for example. Only plain
 * predicates are followed.
 */
export const roleValue = (
  paths: ReadonlyMap<string, readonly Term[]>,
  dataGraph: RdfStore,
  focus: Term,
  role: NamedNode,
): Term | undefined => {
  for (const path of paths.get(role.value) ?? []) {
    if (path.termType !== "NamedNode") continue;
    const [quad] = dataGraph.getQuads(focus, path);
    if (quad) return quad.object;
  }
  return undefined;
};
