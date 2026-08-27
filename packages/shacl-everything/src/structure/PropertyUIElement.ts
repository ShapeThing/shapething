import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import { sh, shui } from "@/helpers/namespaces.ts";
import type { BCP47, LanguageRange } from "@/types/BCP47.ts";
import { parsePropertyPath, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { insertPropertyPath } from "@/structure/paths/insertPropertyPath.ts";
import { replacePropertyPath } from "@/structure/paths/replacePropertyPath.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import { score, select, type WidgetScoreResult } from "@/scoring/score.ts";
import { createDefaultTerm } from "@/widgets/defaultTerm.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import { resolutions } from "@/structure/constraintResolutions.ts";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { propertyLabel } from "@/resolution/label.ts";

export type PropertyUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  focusNode: Quad_Subject;
  propertyShapes: NamedNode[];
};

type ShBase = "http://www.w3.org/ns/shacl#";
type ShIri<T extends string> = `${ShBase}${T}`;

type NumberPredicates = ShIri<
  | "minCount"
  | "maxCount"
  | "minLength"
  | "maxLength"
  | "qualifiedMinCount"
  | "qualifiedMaxCount"
  | "minListLength"
  | "maxListLength"
  | "order"
  | "minExclusive"
  | "minInclusive"
  | "maxExclusive"
  | "maxInclusive"
>;
type BooleanPredicates = ShIri<
  "closed" | "singleLine" | "uniqueLang" | "uniqueMembers" | "reificationRequired"
>;
type SingleTermPredicates = ShIri<
  "name" | "codeIdentifier" | "group" | "severity" | "equals" | "hasValue" | "datatype"
>;

export type PredicateReturn<Iri extends string> = Iri extends NumberPredicates
  ? number | undefined
  : Iri extends BooleanPredicates
    ? boolean | undefined
    : Iri extends ShIri<"pattern">
      ? RegExp | undefined
      : Iri extends SingleTermPredicates
        ? Term | undefined
        : Term[];

export class PropertyUIElement {
  // A tag, not just a class to `instanceof`-check against: Vite HMR can reload this module (or one
  // it depends on) while an already-constructed instance is still sitting in memoized React state,
  // leaving that instance's prototype pointing at the *old* PropertyUIElement class. `instanceof`
  // against the newly re-imported class then returns false, so callers discriminating the
  // PropertyUIElement | ChoiceElement union must switch on `kind`, not `instanceof`.
  public readonly kind = "property" as const;
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public scoresGraph: RdfStore;
  public focusNode: Quad_Subject;
  public propertyShapes: NamedNode[];

  constructor(options: PropertyUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.scoresGraph = options.scoresGraph ?? RdfStore.createDefault();
    this.focusNode = options.focusNode;
    this.propertyShapes = options.propertyShapes;
  }

  /**
   * Returns the value(s) declared for `predicate` across every property shape
   * grouped into this element. SHACL treats repeated constraint values
   * conjunctively (whether they come from one shape or several sharing this
   * element's path), so when more than one value is found it is resolved
   * per predicate (e.g. sh:minCount keeps the highest, sh:class keeps the
   * most specific, sh:in/sh:languageIn lists intersect). Predicates without a
   * registered resolution, and the common case of a single value, are simply
   * deduplicated and returned as-is.
   *
   * When `languages` is passed, the per-predicate resolution is bypassed
   * entirely in favor of picking the single best BCP47 match among the raw,
   * sh:order-ordered values (e.g. sh:name "Given name"@en, "Gegeven naam"@nl) -
   * falling back to a language-less value and then to whatever is there when
   * nothing matches. An empty `languages` array just returns the first raw
   * declared value by sh:order.
   */
  get<Iri extends string>(predicate: NamedNode<Iri>): PredicateReturn<Iri>;
  get(predicate: NamedNode, languages: LanguageRange[] | undefined): Term | undefined;
  get(predicate: NamedNode, languages?: LanguageRange[]): unknown {
    const values = orderedValues(this, predicate);
    if (languages !== undefined) {
      return languages.length ? bestByLanguage(values, languages) : values[0];
    }
    const resolve = resolutions.get(predicate.value);
    return resolve ? resolve(values, this, predicate) : dedupeTerms(values);
  }

  /**
   * The actual value(s) this property currently holds on `this.focusNode`, found by walking this
   * element's path through `dataGraph` - as opposed to `get()`, which reads shape metadata like
   * sh:minCount from `shapesGraph`. Every grouped shape shares the same path (propertiesForShape
   * groups them by it), so propertyShapes[0] alone is enough to determine it.
   */
  getObjects(): Term[] {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return [];
    return walkPropertyPath(path, this.focusNode, this.dataGraph);
  }

  /**
   * Writes `value` into `this.dataGraph` as an additional value of this property on
   * `this.focusNode` - the write-side counterpart to getObjects(), walking (and creating any
   * missing intermediate nodes along) this element's path rather than reading through it.
   */
  addObject(value: Term): void {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return;
    insertPropertyPath(path, this.focusNode, this.dataGraph, value);
  }

  /**
   * Swaps `oldValue` for `newValue` in `this.dataGraph`, in place - unlike addObject(), which
   * always appends a sibling value, this edits the one value it's given rather than the whole set,
   * so it does nothing if `oldValue` isn't currently reachable through this element's path.
   */
  replaceObject(oldValue: Term, newValue: Term): void {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return;
    const existing = walkPropertyPath(path, this.focusNode, this.dataGraph).some((term) =>
      term.equals(oldValue),
    );

    if (!existing) {
      insertPropertyPath(path, this.focusNode, this.dataGraph, newValue);
    } else {
      replacePropertyPath(path, this.focusNode, this.dataGraph, oldValue, newValue);
    }
  }

  /**
   * Removes `value` from `this.dataGraph` for this property on `this.focusNode` - the delete-side
   * counterpart to addObject(), dropping the one value it's given rather than the whole set, so it
   * does nothing if `value` isn't currently reachable through this element's path.
   */
  removeObject(value: Term): void {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return;
    removePropertyPath(path, this.focusNode, this.dataGraph, value);
  }

  pathAsSparql(): string | undefined {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return undefined;
    return toSparql(path);
  }

  /**
   * The best available display label, per 8.2.2 Property Labels: the property shape's own
   * configured label value (sh:name by default) if declared, otherwise the ontology property the
   * path targets (rdfs:label by default). propertyLabel() always resolves to *something* (falling
   * back to the term's own local name), so this never returns undefined - for a path with no single
   * terminal predicate (e.g. sh:alternativePath), the property shape node itself stands in as the
   * term to fall back from. `isPropertyPath: true` opts into propertyLabel()'s step 1 (the property
   * shape's own value) - only valid here, where `term` genuinely is this element's own sh:path
   * target; propertyLabel()'s other callers label unrelated terms (a widget IRI, a class node) using
   * this element purely as graph/language context, and must not have this element's own sh:name leak
   * into that.
   */
  label(languages?: BCP47[]): string {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    const predicate = (path && terminalPredicate(path)) ?? this.propertyShapes[0];
    return propertyLabel({ term: predicate, propertyShape: this, languages, isPropertyPath: true });
  }

  /**
   * The highest-scoring widget for this property, per this.scoresGraph's shui:WidgetScore rules
   * (see scoring/score.ts). `valueNode` is the current value to also score against each rule's
   * shui:dataGraphShape - omit it to score on the property shape(s) alone (e.g. before a value
   * exists yet), which every scoring rule supports falling back to.
   */
  async widget({
    widgetPredicate,
    valueNode,
  }: {
    widgetPredicate: Term;
    valueNode?: Term;
  }): Promise<Term | undefined> {
    const { shapeNode, shapesGraph } = widgetShapeSource(this);
    const [widget] = await Array.fromAsync(
      select({
        best: true,
        focusNode: valueNode,
        dataGraph: this.dataGraph,
        shapeNode,
        shapesGraph,
        scoringGraph: this.scoresGraph,
        widgetPredicate,
      }),
    );

    return widget;
  }

  async widgets({
    widgetPredicate,
    valueNode,
  }: {
    widgetPredicate: Term;
    valueNode?: Term;
  }): Promise<WidgetScoreResult[]> {
    const { shapeNode, shapesGraph } = widgetShapeSource(this);
    return Array.fromAsync(
      score({
        focusNode: valueNode,
        dataGraph: this.dataGraph,
        shapeNode,
        shapesGraph,
        scoringGraph: this.scoresGraph,
        widgetPredicate,
      }),
    );
  }

  /**
   * The term a fresh, not-yet-filled-in value for this property should start as - resolved via
   * the widget that would be picked for this property with no value yet (see widget()), then its
   * own createTerm if declared, otherwise the generic shape-derived default (see
   * widgets/defaultTerm.ts). `undefined` when no widget can be resolved at all.
   */
  async getDefaultObject(contentLanguage: BCP47): Promise<Term | undefined> {
    const widget = await this.widget({
      widgetPredicate: shui("editor"),
    });
    if (!widget || widget.termType !== "NamedNode") return undefined;
    return createDefaultTerm(widget, this, { contentLanguage });
  }
}

// The scoring system validates a single shape node's own direct triples (sh:datatype, sh:class,
// shui:editor, ...) - so a grouped element backed by more than one property shape needs those
// triples merged onto one synthetic node first, for the same reason get() merges their values:
// SHACL treats repeated constraints conjunctively whether declared on one shape or several.
function widgetShapeSource(element: PropertyUIElement): { shapeNode: Term; shapesGraph: RdfStore } {
  if (element.propertyShapes.length === 1) {
    return {
      shapeNode: element.propertyShapes[0],
      shapesGraph: element.shapesGraph,
    };
  }

  // TODO this probably is a huge mistake.
  const synthetic = factory.blankNode();
  const merged = RdfStore.createDefault();
  for (const shape of element.propertyShapes) {
    for (const quad of element.shapesGraph.getQuads(shape)) {
      merged.addQuad(factory.quad(synthetic, quad.predicate, quad.object));
    }
  }
  return { shapeNode: synthetic, shapesGraph: merged };
}

function shapeOrder(shape: Term, shapesGraph: RdfStore): number {
  const value = shapesGraph.getQuads(shape, sh("order"))[0]?.object.value;
  const parsed = value !== undefined ? parseInt(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

// The RDF property a path ultimately reads from - e.g. for a sequence path the last step, since
// that is the property whose rdfs:label best represents the whole path. sh:alternativePath has no
// single terminal property (each branch is a distinct, equally valid option), so it resolves to
// nothing rather than arbitrarily picking one branch's label.
function terminalPredicate(path: PropertyPath): NamedNode | undefined {
  switch (path.type) {
    case "predicate":
      return path.predicate;
    case "sequence": {
      const last = path.items.at(-1);
      return last && terminalPredicate(last);
    }
    case "inverse":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      return terminalPredicate(path.path);
    case "alternative":
      return undefined;
  }
}

// Raw values for `predicate` across every grouped shape, in ascending sh:order - the ordering
// both a keepFirst-style resolution and language selection rely on to break ties consistently.
function orderedValues(element: PropertyUIElement, predicate: NamedNode): Term[] {
  const orderedShapes = [...element.propertyShapes].sort(
    (a, b) => shapeOrder(a, element.shapesGraph) - shapeOrder(b, element.shapesGraph),
  );
  return orderedShapes.flatMap((shape) =>
    element.shapesGraph.getQuads(shape, predicate).map((quad) => quad.object),
  );
}
