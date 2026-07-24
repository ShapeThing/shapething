import type { Literal, NamedNode, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import { localName } from "@/helpers/localName.ts";
import { rdf, rdfs, sh, shui, xsd } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import { termKey } from "@/helpers/termKey.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { parsePropertyPath, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { insertPropertyPath } from "@/structure/paths/insertPropertyPath.ts";
import { replacePropertyPath } from "@/structure/paths/replacePropertyPath.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import { select } from "@/scoring/score.ts";
import { createDefaultTerm } from "@/widgets/defaultTerm.ts";

export type PropertyUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  focusNode: NamedNode;
  propertyShapes: NamedNode[];
};

export class PropertyUIElement {
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public scoresGraph: RdfStore;
  public focusNode: NamedNode;
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
   */
  get(predicate: NamedNode): Term[] {
    const values = orderedValues(this, predicate);
    if (values.length === 0) return [];

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

  /**
   * Convenience for single-valued predicates (e.g. sh:name, sh:minCount): `get(predicate)[0]`.
   *
   * With `languages`, picks the best BCP47 match among multi-lingual values (e.g. sh:name
   * "Given name"@en, "Gegeven naam"@nl) directly from the raw declared values - ahead of any
   * per-predicate merge like sh:name's "lowest sh:order wins" - falling back to a language-less
   * value and then to whatever is there when nothing matches. It has no effect (falls through to
   * `get(predicate)[0]`) when there is nothing language-tagged to choose between.
   */
  getOne(predicate: NamedNode, languages?: BCP47[]): Term | undefined {
    if (!languages || languages.length === 0) return this.get(predicate)[0];
    return bestByLanguage(orderedValues(this, predicate), languages);
  }

  /**
   * The best available display label: sh:name if declared on the property shape(s), otherwise
   * rdfs:label from the ontology property the path targets (see `ontologyLabel`) - sh:name is
   * shape-local metadata, while rdfs:label lives on the RDF property/vocabulary term itself.
   */
  label(languages?: BCP47[]): Term | undefined {
    return this.getOne(sh("name"), languages) ?? ontologyLabel(this, languages);
  }

  /**
   * The highest-scoring widget for this property, per this.scoresGraph's shui:WidgetScore rules
   * (see scoring/score.ts). `valueNode` is the current value to also score against each rule's
   * shui:dataGraphShape - omit it to score on the property shape(s) alone (e.g. before a value
   * exists yet), which every scoring rule supports falling back to.
   */
  async widget(widgetPredicate: Term, valueNode?: Term): Promise<Term | undefined> {
    const { shapeNode, shapesGraph } = widgetShapeSource(this);
    // select() yields candidates highest-score-first and is a lazy generator, so returning on the
    // first result stops it from validating every remaining WidgetScore - unlike Array.fromAsync,
    // which drains the whole thing just to keep index 0.
    for await (const widget of select({
      best: false,
      focusNode: valueNode,
      dataGraph: this.dataGraph,
      shapeNode,
      shapesGraph,
      scoringGraph: this.scoresGraph,
      widgetPredicate,
    })) {
      return widget;
    }
    return undefined;
  }

  /**
   * The term a fresh, not-yet-filled-in value for this property should start as - resolved via
   * the widget that would be picked for this property with no value yet (see widget()), then its
   * own createTerm if declared, otherwise the generic shape-derived default (see
   * widgets/defaultTerm.ts). `undefined` when no widget can be resolved at all.
   */
  async getDefaultObject(contentLanguage: BCP47): Promise<Term | undefined> {
    const widget = await this.widget(shui("editor"));
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

// rdfs:label lives on the RDF property the shape targets (the ontology term), not on the (often
// blank) SHACL property shape node itself, so it needs a separate lookup by path rather than
// going through get()/getOne(), which only ever query the property shape(s) as subjects.
function ontologyLabel(element: PropertyUIElement, languages?: BCP47[]): Term | undefined {
  const path = parsePropertyPath(element.propertyShapes[0], element.shapesGraph);
  const predicate = path && terminalPredicate(path);
  if (!predicate) return undefined;

  const values = element.shapesGraph.getQuads(predicate, rdfs("label")).map((quad) => quad.object);
  if (values.length === 0) return undefined;

  return languages && languages.length > 0 ? bestByLanguage(values, languages) : values[0];
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

function dedupeTerms(terms: Term[]): Term[] {
  const seen = new Map<string, Term>();
  for (const term of terms) {
    if (!seen.has(termKey(term))) seen.set(termKey(term), term);
  }
  return [...seen.values()];
}

// sh:in/sh:languageIn/sh:ignoredProperties/sh:uniqueValuesFor/sh:nodeKind may point at either a
// plain term or the head of an rdf:List. Both forms need to resolve to "the values this constraint
// is actually about" before they can be merged.
function expandListOrTerm(term: Term, shapesGraph: RdfStore): Term[] {
  if (term.termType !== "BlankNode" && term.termType !== "NamedNode") {
    return [term];
  }
  if (term.equals(rdf("nil"))) return [];
  if (shapesGraph.getQuads(term, rdf("first")).length === 0) return [term];
  return getRdfList(term, shapesGraph);
}

// xsd:date/dateTime-family literals sort by calendar time; everything else sorts numerically,
// which covers every datatype sh:minExclusive/minInclusive/maxExclusive/maxInclusive apply to.
const DATE_DATATYPES = new Set(
  [
    xsd("date"),
    xsd("dateTime"),
    xsd("gYear"),
    xsd("gYearMonth"),
    xsd("gMonthDay"),
    xsd("gDay"),
  ].map((datatype) => datatype.value),
);

function literalOrder(term: Term): number {
  const datatype = (term as Literal).datatype?.value;
  return datatype && DATE_DATATYPES.has(datatype)
    ? new Date(term.value).getTime()
    : parseFloat(term.value);
}

type ResolutionFunction = (values: Term[], element: PropertyUIElement, predicate: Term) => Term[];

const keepHighestLiteral: ResolutionFunction = (values) => {
  return [
    values.reduce((highest, term) => (literalOrder(term) > literalOrder(highest) ? term : highest)),
  ];
};

const keepLowestLiteral: ResolutionFunction = (values) => {
  return [
    values.reduce((lowest, term) => (literalOrder(term) < literalOrder(lowest) ? term : lowest)),
  ];
};

const keepHighestInteger: ResolutionFunction = (values) => {
  const highest = Math.max(...values.map((term) => parseInt(term.value)));
  return [factory.literal(highest.toString(), xsd("integer"))];
};

const keepLowestInteger: ResolutionFunction = (values) => {
  const lowest = Math.min(...values.map((term) => parseInt(term.value)));
  return [factory.literal(lowest.toString(), xsd("integer"))];
};

// Values are gathered in ascending sh:order across shapes, so `values[0]` already is "the first
// value declared by the lowest-order shape that declares one" - shapes without a value contribute
// nothing to the array, so there is nothing to skip over.
const keepFirst: ResolutionFunction = (values) => {
  return values.length ? [values[0]] : [];
};

const keepAll: ResolutionFunction = (values) => {
  return dedupeTerms(values);
};

const keepAllListItems: ResolutionFunction = (values, element) => {
  return dedupeTerms(values.flatMap((value) => expandListOrTerm(value, element.shapesGraph)));
};

const keepListIntersection: ResolutionFunction = (values, element) => {
  const sets = values.map((value) => dedupeTerms(expandListOrTerm(value, element.shapesGraph)));
  return sets.reduce((acc, set) => acc.filter((term) => set.some((other) => other.equals(term))));
};

// sh:pattern applies conjunctively: a value must match every declared pattern. That is folded into
// a single regex via lookaheads rather than returned as multiple terms, since consumers expect one
// pattern string (e.g. for an <input pattern> attribute).
const combinePatterns: ResolutionFunction = (values) => {
  const patterns = dedupeTerms(values);
  if (patterns.length === 1) return patterns;
  const combined = patterns.map((pattern) => `(?=.*(?:${pattern.value}))`).join("");
  return [factory.literal(combined, xsd("string"))];
};

const resolveBooleans: ResolutionFunction = (values) => {
  const isTrue = values.some((term) => term.value === "true");
  return [factory.literal(isTrue ? "true" : "false", xsd("boolean"))];
};

const enforceSame: ResolutionFunction = (values, _element, predicate) => {
  const unique = dedupeTerms(values);
  if (unique.length > 1) {
    throw new Error(
      `Conflicting values for property ${predicate.value}: ${unique
        .map((term) => term.value)
        .join(", ")}`,
    );
  }
  return unique;
};

function enforceSingular(resolve: ResolutionFunction): ResolutionFunction {
  return (values, element, predicate) => {
    const result = resolve(values, element, predicate);
    if (result.length > 1) {
      throw new Error(
        `Expected a singular value for ${localName(predicate)} but found disjoint values: ${result
          .map((term) => localName(term) ?? term.value)
          .join(", ")}`,
      );
    }
    return result;
  };
}

// sh:class ex:Dog, ex:Animal means a value must be a Dog (Dog being the more specific class); this
// keeps only the classes that are not an ancestor (via rdfs:subClassOf) of another declared class.
const keepMostSpecificClasses: ResolutionFunction = (values, element) => {
  const classes = dedupeTerms(values);
  const ancestorsOf = new Map<string, Term[]>();

  for (const classEntry of classes) {
    const ancestors: Term[] = [];
    let frontier = [classEntry];
    while (frontier.length > 0) {
      const next: Term[] = [];
      for (const node of frontier) {
        for (const quad of element.shapesGraph.getQuads(node, rdfs("subClassOf"))) {
          ancestors.push(quad.object);
          next.push(quad.object);
        }
      }
      frontier = next;
    }
    ancestorsOf.set(termKey(classEntry), ancestors);
  }

  return classes.filter((classEntry) => {
    return !classes.some((otherClass) => {
      if (classEntry.equals(otherClass)) return false;
      return ancestorsOf.get(termKey(otherClass))?.some((ancestor) => ancestor.equals(classEntry));
    });
  });
};

// sh:severity indicates how severe a shape's violations are; sh:Violation is the strictest (and
// SHACL's spec default when absent - left to callers to apply, same as sh:minCount's default of
// 0), then sh:Warning, then sh:Info. When grouped shapes disagree, the most severe wins, since
// that is the worst case a violation of this element could represent.
// TODO implement the structure from SHACL 1.2 here.
const SEVERITY_RANK = new Map<string, number>([
  [sh("Violation").value, 2],
  [sh("Warning").value, 1],
  [sh("Info").value, 0],
]);

const keepMostSevere: ResolutionFunction = (values) => {
  return [
    values.reduce((mostSevere, term) =>
      (SEVERITY_RANK.get(term.value) ?? 0) > (SEVERITY_RANK.get(mostSevere.value) ?? 0)
        ? term
        : mostSevere,
    ),
  ];
};

const NODE_KIND_COMBINATIONS = new Map<string, NamedNode[]>([
  [sh("BlankNode").value, [sh("BlankNode")]],
  [sh("IRI").value, [sh("IRI")]],
  [sh("Literal").value, [sh("Literal")]],
  [sh("BlankNodeOrIRI").value, [sh("BlankNode"), sh("IRI")]],
  [sh("BlankNodeOrLiteral").value, [sh("BlankNode"), sh("Literal")]],
  [sh("IRIOrLiteral").value, [sh("IRI"), sh("Literal")]],
  [sh("TripleTerm").value, [sh("TripleTerm")]],
]);

const nodeKindIntersection: ResolutionFunction = (values, element) => {
  const sets = values.map((value) =>
    dedupeTerms(
      expandListOrTerm(value, element.shapesGraph).flatMap(
        (item) => NODE_KIND_COMBINATIONS.get(item.value) ?? [item],
      ),
    ),
  );

  const intersection = sets.reduce((acc, set) =>
    acc.filter((term) => set.some((other) => other.equals(term))),
  );

  if (intersection.length === 0) {
    throw new Error(
      `No intersection found for sh:nodeKind: ${sets
        .map((set) => set.map((term) => localName(term)).join(", "))
        .join(" | ")}`,
    );
  }

  return intersection;
};

const resolutions = new Map<string, ResolutionFunction>([
  [sh("class").value, keepMostSpecificClasses],
  [sh("datatype").value, enforceSingular(keepMostSpecificClasses)],
  [sh("nodeKind").value, nodeKindIntersection],
  [sh("minCount").value, keepHighestInteger],
  [sh("maxCount").value, keepLowestInteger],
  [sh("minExclusive").value, keepHighestLiteral],
  [sh("minInclusive").value, keepHighestLiteral],
  [sh("maxExclusive").value, keepLowestLiteral],
  [sh("maxInclusive").value, keepLowestLiteral],
  [sh("minLength").value, keepHighestInteger],
  [sh("maxLength").value, keepLowestInteger],
  [sh("pattern").value, combinePatterns],
  [sh("singleLine").value, resolveBooleans],
  [sh("languageIn").value, keepListIntersection],
  [sh("uniqueLang").value, resolveBooleans],
  [sh("memberShape").value, keepAll],
  [sh("minListLength").value, keepHighestInteger],
  [sh("maxListLength").value, keepLowestInteger],
  [sh("uniqueMembers").value, resolveBooleans],
  [sh("equals").value, enforceSame],
  [sh("disjoint").value, keepAll],
  [sh("subsetOf").value, keepAll],
  [sh("lessThan").value, keepAll],
  [sh("lessThanOrEquals").value, keepAll],
  [sh("not").value, keepAll],
  [sh("and").value, keepAll],
  [sh("or").value, keepAll],
  [sh("xone").value, keepAll],
  [sh("node").value, keepAll],
  [sh("property").value, keepAll],
  [sh("someValue").value, keepAll],
  [sh("qualifiedValueShape").value, keepAll],
  [sh("qualifiedMinCount").value, keepHighestInteger],
  [sh("qualifiedMaxCount").value, keepLowestInteger],
  [sh("reificationRequired").value, resolveBooleans],
  [sh("closed").value, resolveBooleans],
  [sh("ignoredProperties").value, keepAllListItems],
  [sh("hasValue").value, enforceSingular(keepAll)],
  [sh("in").value, keepListIntersection],
  [sh("rootClass").value, keepMostSpecificClasses],
  [sh("uniqueValuesFor").value, keepAllListItems],
  [sh("severity").value, keepMostSevere],
  [sh("name").value, keepFirst],
  [sh("description").value, keepAll],
  [sh("intent").value, keepAll],
  [sh("agentInstruction").value, keepAll],
  [sh("codeIdentifier").value, keepFirst],
  [sh("unit").value, keepAll],
  [sh("order").value, keepLowestInteger],
  [sh("group").value, keepFirst],
]);
