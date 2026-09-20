import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import { hashString } from "@/helpers/hashString.ts";
import { sh, shui } from "@/helpers/namespaces.ts";
import type { BCP47, LanguageRange } from "@/types/BCP47.ts";
import {
  parsePropertyPath,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { insertPropertyPath } from "@/structure/paths/insertPropertyPath.ts";
import { replacePropertyPath } from "@/structure/paths/replacePropertyPath.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import {
  branchHoldingValue,
  defaultWriteBranch,
  switchableAlternativeBranches,
} from "@/structure/paths/alternativePathBranches.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { score, select, type WidgetScoreResult } from "@/scoring/score.ts";
import { createDefaultTerm } from "@/widgets/defaultTerm.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";
import { toSparql, type ToSparqlOptions } from "@/structure/paths/toSparql.ts";
import { resolutions } from "@/structure/constraintResolutions.ts";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { propertyDescription, propertyLabel } from "@/resolution/label.ts";

export type PropertyUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  widgetRegistry?: Widgets;
  focusNode: Quad_Subject;
  propertyShapes: NamedNode[];
  // The chain of SPARQL-rendered paths (toSparql) walked from the Environment's own root
  // focusNode down to this element's own focusNode - see NodeUIElementOptions.ancestorPath and
  // dataId() below.
  ancestorPath?: string[];
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
  | "closed"
  | "singleLine"
  | "uniqueLang"
  | "uniqueMembers"
  | "reificationRequired"
>;
type SingleTermPredicates = ShIri<
  | "name"
  | "codeIdentifier"
  | "group"
  | "severity"
  | "equals"
  | "hasValue"
  | "datatype"
>;

export type PredicateReturn<Iri extends string> = Iri extends NumberPredicates
  ? number | undefined
  : Iri extends BooleanPredicates ? boolean | undefined
  : Iri extends ShIri<"pattern"> ? RegExp | undefined
  : Iri extends SingleTermPredicates ? Term | undefined
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
  public widgetRegistry: Widgets;
  public focusNode: Quad_Subject;
  public propertyShapes: NamedNode[];
  public ancestorPath: string[];

  constructor(options: PropertyUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.scoresGraph = options.scoresGraph ?? RdfStore.createDefault();
    this.widgetRegistry = options.widgetRegistry ?? defaultWidgets;
    this.focusNode = options.focusNode;
    this.propertyShapes = options.propertyShapes;
    this.ancestorPath = options.ancestorPath ?? [];
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
  get(
    predicate: NamedNode,
    languages: LanguageRange[] | undefined,
  ): Term | undefined;
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
    transact(
      this.dataGraph,
      () =>
        insertPropertyPath(
          resolveAlternativeWritePath(this, path),
          this.focusNode,
          this.dataGraph,
          value,
        ),
    );
  }

  /**
   * Swaps `oldValue` for `newValue` in `this.dataGraph`, in place - unlike addObject(), which
   * always appends a sibling value, this edits the one value it's given rather than the whole set,
   * so it does nothing if `oldValue` isn't currently reachable through this element's path.
   */
  replaceObject(oldValue: Term, newValue: Term): void {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return;
    transact(this.dataGraph, () => {
      const existing = walkPropertyPath(path, this.focusNode, this.dataGraph)
        .some((term) => term.equals(oldValue));

      if (!existing) {
        insertPropertyPath(
          resolveAlternativeWritePath(this, path),
          this.focusNode,
          this.dataGraph,
          newValue,
        );
      } else {
        replacePropertyPath(
          resolveAlternativeWritePath(this, path, oldValue),
          this.focusNode,
          this.dataGraph,
          oldValue,
          newValue,
        );
      }
    });
  }

  /**
   * Removes `value` from `this.dataGraph` for this property on `this.focusNode` - the delete-side
   * counterpart to addObject(), dropping the one value it's given rather than the whole set, so it
   * does nothing if `value` isn't currently reachable through this element's path.
   */
  removeObject(value: Term): void {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return;
    transact(
      this.dataGraph,
      () =>
        removePropertyPath(
          resolveAlternativeWritePath(this, path, value),
          this.focusNode,
          this.dataGraph,
          value,
        ),
    );
  }

  /**
   * The branch predicates of this element's own path, when it's a top-level sh:alternativePath
   * every one of whose branches is a plain predicate (e.g. `sh:alternativePath (dc:title
   * rdfs:label)`) - see structure/paths/alternativePathBranches.ts's switchableAlternativeBranches.
   * `undefined` both when this isn't an alternative path at all and when it's a "complex" one (a
   * branch that's itself a sequence/inverse/nested alternative) - the UI layer's
   * AlternativePathSwitcher uses this to decide whether there's anything to switch between.
   */
  alternativePathBranches(): NamedNode[] | undefined {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    return path ? switchableAlternativeBranches(path) : undefined;
  }

  /**
   * Which of alternativePathBranches() currently holds `value` on this.focusNode - undefined both
   * when this element's path isn't a switchable alternative, and when `value` isn't currently
   * reachable through any branch (e.g. a not-yet-committed placeholder value). Purely derived from
   * dataGraph on every call, no separate "which branch was picked" state to keep in sync.
   */
  activeAlternativePathBranch(value: Term): NamedNode | undefined {
    const branches = this.alternativePathBranches();
    if (!branches) return undefined;
    return branchHoldingValue(branches, this.focusNode, this.dataGraph, value);
  }

  /**
   * Which branch a brand new value for this property would currently be written to - see
   * structure/paths/alternativePathBranches.ts's defaultWriteBranch. Used by
   * AlternativePathSwitcher to show a sensible pre-selection before anything has been pinned or
   * written yet.
   */
  defaultAlternativePathBranch(): NamedNode | undefined {
    const branches = this.alternativePathBranches();
    if (!branches) return undefined;
    return defaultWriteBranch(branches, this.focusNode, this.dataGraph);
  }

  /**
   * Moves `value` from whichever branch currently holds it to `branch` - the "move" counterpart to
   * replaceObject()'s "coerce" (see widgets/defaultTerm.ts's coerceTermToBranch, used for sh:or/
   * sh:xone instead): the term itself is untouched, only which predicate asserts it changes, so this
   * removes the exact (focusNode, currentBranch, value) triple and adds (focusNode, branch, value)
   * rather than reusing replacePropertyPath's same-predicate swap. No-ops when this element's path
   * isn't a switchable alternative, when `value` isn't currently reachable through any branch
   * (nothing to move), or when it's already under `branch`. Both writes are grouped into a single
   * transact() so Ctrl+Z undoes the whole move as one step.
   */
  setAlternativePathBranch(value: Term, branch: NamedNode): void {
    const branches = this.alternativePathBranches();
    if (!branches) return;

    const currentBranch = branchHoldingValue(branches, this.focusNode, this.dataGraph, value);
    if (!currentBranch || currentBranch.equals(branch)) return;

    transact(this.dataGraph, () => {
      removePropertyPath(
        { type: "predicate", predicate: currentBranch },
        this.focusNode,
        this.dataGraph,
        value,
      );
      insertPropertyPath(
        { type: "predicate", predicate: branch },
        this.focusNode,
        this.dataGraph,
        value,
      );
    });
  }

  /**
   * True when `value` is also reachable by walking this element's own path through
   * `readOnlyGraph` - the same walk getObjects() does over dataGraph, just against a different
   * graph. Used by edit mode to render a value's viewer instead of its editor (see
   * outputs/render/modes/edit/WidgetSlot.tsx) - purely graph-membership-driven, e.g. for an
   * embedder that materializes inferred/derived triples into dataGraph and also hands them back
   * here to mark them non-editable. Takes readOnlyGraph as a parameter rather than storing it on
   * the instance, keeping this layer decoupled from Environment.
   */
  isReadOnly(value: Term, readOnlyGraph: RdfStore): boolean {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return false;
    return walkPropertyPath(path, this.focusNode, readOnlyGraph).some((term) =>
      term.equals(value)
    );
  }

  /**
   * `prefixed: true` renders predicates as `prefix:localName` (toSparql's own ToSparqlOptions)
   * for human-facing display - e.g. a title tooltip - where a known vocabulary prefix makes the
   * path far more readable than its full `<iri>` form. Leave it unset for any use tied to this
   * path's identity (dataId(), nestedAncestorPath(), elementKey.ts, groupPropertyShapesByPath's
   * equality check): those need the exact, unambiguous `<iri>` form to stay stable/comparable.
   */
  pathAsSparql(options?: ToSparqlOptions): string | undefined {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    if (!path) return undefined;
    return toSparql(path, options);
  }

  /**
   * A stable, CSS-safe token identifying this exact property at this exact position in the form -
   * for an embedder to hook custom styling onto (see FormElement's own `data-id`). Hashes
   * ancestorPath + this property's own path rather than propertyShapes' own term identity: a
   * property shape is very often a blank node (the common `sh:property [ ... ]` pattern), whose
   * internal label is assigned arbitrarily by whichever parse produced it and isn't guaranteed
   * stable across reloads - the full path-from-root is entirely IRI/path-derived instead, so it
   * stays stable, and it disambiguates a path reused at different nesting depths (rdfs:label
   * being the classic case: the same path both at the top level and inside a nested DetailsEditor
   * form) where sparqlPath alone would collide.
   */
  dataId(): string | undefined {
    const sparqlPath = this.pathAsSparql();
    if (!sparqlPath) return undefined;
    return hashString([...this.ancestorPath, sparqlPath].join(">"));
  }

  /**
   * `ancestorPath` extended by this property's own path - the value a nested NodeUIElement built
   * "one hop past" this property (DetailsEditor's sh:node body, or a MemberShapeList item's own
   * nested form) should be given as its own `ancestorPath`. Falls back to this.ancestorPath
   * unchanged when this property has no sh:path of its own (a memberShape placeholder, see
   * MemberShapeList) - there's no segment to add for that hop.
   */
  nestedAncestorPath(): string[] {
    const sparqlPath = this.pathAsSparql();
    return sparqlPath ? [...this.ancestorPath, sparqlPath] : this.ancestorPath;
  }

  /**
   * The best available display label, per 8.2.2 Property Labels (with one deliberate divergence -
   * see propertyLabel()'s own step 1 comment): the property shape's own configured label value
   * (sh:name by default) if it has a value in the interface language being rendered, otherwise the
   * ontology property the path targets (rdfs:label by default), otherwise sh:name again in whatever
   * language it does have, and only then the term's own local name - so this never returns undefined.
   * For a path with no single terminal predicate (e.g. sh:alternativePath), the property shape node
   * itself stands in as the term to fall back from. `isPropertyPath: true` opts into propertyLabel()'s
   * step 1 (the property shape's own value) - only valid here, where `term` genuinely is this
   * element's own sh:path target; propertyLabel()'s other callers label unrelated terms (a widget
   * IRI, a class node) using this element purely as graph/language context, and must not have this
   * element's own sh:name leak into that.
   */
  label(languages?: BCP47[]): string {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    const predicate = (path && terminalPredicate(path)) ??
      this.propertyShapes[0];
    return propertyLabel({
      term: predicate,
      propertyShape: this,
      languages,
      isPropertyPath: true,
    });
  }

  /**
   * The property's description/help text - see propertyDescription() (resolution/label.ts) for the
   * resolution order (not a spec clause; mirrors label()'s own mechanism). Unlike label(), this can
   * return undefined - a property simply has no description when nothing matches, and every caller
   * already only renders it when truthy.
   */
  description(languages?: BCP47[]): string | undefined {
    const path = parsePropertyPath(this.propertyShapes[0], this.shapesGraph);
    const predicate = (path && terminalPredicate(path)) ??
      this.propertyShapes[0];
    return propertyDescription({
      term: predicate,
      propertyShape: this,
      languages,
    });
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
    const widget = select({
      focusNode: valueNode,
      dataGraph: this.dataGraph,
      shapeNode,
      shapesGraph,
      scoringGraph: this.scoresGraph,
      widgetPredicate,
    });

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
    return score({
      focusNode: valueNode,
      dataGraph: this.dataGraph,
      shapeNode,
      shapesGraph,
      scoringGraph: this.scoresGraph,
      widgetPredicate,
      widgets: this.widgetRegistry,
    });
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

// The concrete predicate path to actually write through for a given (possibly-alternative) path -
// see structure/paths/alternativePathBranches.ts. Resolves to `path` unchanged unless it's a
// top-level sh:alternativePath whose every branch is a plain predicate; anything else (any other
// path type, or a "complex" alternative) falls straight through to insertPropertyPath/
// replacePropertyPath/removePropertyPath's own existing behavior, including their throw for "no
// single, well-defined place to write to". `value` is the value already being written/removed,
// when there is one (omitted for addObject, and for replaceObject's not-yet-existing-anywhere
// case) - when given, whichever branch already holds it wins over defaultWriteBranch's "first
// non-empty branch" fallback.
function resolveAlternativeWritePath(
  element: PropertyUIElement,
  path: PropertyPath,
  value?: Term,
): PropertyPath {
  const branches = switchableAlternativeBranches(path);
  if (!branches) return path;

  const branch =
    (value && branchHoldingValue(branches, element.focusNode, element.dataGraph, value)) ??
    defaultWriteBranch(branches, element.focusNode, element.dataGraph);
  return { type: "predicate", predicate: branch };
}

// The scoring system validates a single shape node's own direct triples (sh:datatype, sh:class,
// shui:editor, ...) - so a grouped element backed by more than one property shape needs those
// triples merged onto one synthetic node first, for the same reason get() merges their values:
// SHACL treats repeated constraints conjunctively whether declared on one shape or several.
function widgetShapeSource(
  element: PropertyUIElement,
): { shapeNode: Term; shapesGraph: RdfStore } {
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
// Exported for propertyLabel (resolution/label.ts), which needs the raw, un-language-resolved list
// itself (to try a strict language match first, falling back to the ontology before a looser one).
export function orderedValues(
  element: PropertyUIElement,
  predicate: NamedNode,
): Term[] {
  const orderedShapes = [...element.propertyShapes].sort(
    (a, b) =>
      shapeOrder(a, element.shapesGraph) - shapeOrder(b, element.shapesGraph),
  );
  return orderedShapes.flatMap((shape) =>
    element.shapesGraph.getQuads(shape, predicate).map((quad) => quad.object)
  );
}
