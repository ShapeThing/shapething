import { faker as fakerLibrary } from "@faker-js/faker";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { castDataTypeTermToJs } from "@/helpers/castDataTypeTermToJs.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { getCodeIdentifier } from "@/helpers/getCodeIdentifier.ts";
import { faker, sh, shui, xsd } from "@/helpers/namespaces.ts";
import { termToJsValue } from "@/helpers/termToJsValue.ts";
import { jsToRdf } from "@/outputs/js-to-rdf.ts";
import { runFederatedQuery, substituteSearchParameters } from "@/outputs/render/hooks/query.ts";
import { shaclInstancesOfClass } from "@/resolution/targets.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { choiceBranchShapes } from "@/structure/choiceBranches.ts";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export interface GenerateOptions {
  shapesGraph: RdfStore;
  // Written into in place and also returned, same as jsToRdf's own dataGraph - pass an existing
  // one to merge generated data into it, or omit it to start from an empty store.
  dataGraph?: RdfStore;
  focusNode: Quad_Subject;
  nodeShapes: Quad_Subject[];
  // Only consulted if the shape actually has an rdf:langString property - defaults to "en" so a
  // shape can be faked without the caller having to think about content language up front.
  contentLanguage?: BCP47;
  // Seeds faker.js's own global RNG once, up front, so a given seed always produces the same
  // fake data for the same shape - useful for stable fixtures/snapshots. Omit for fresh random
  // data on every call.
  seed?: number;
}

/**
 * Generates a plausible fake data resource for a SHACL shape and writes it into `dataGraph` as
 * RDF, via jsToRdf - the write-side term construction (literal vs IRI vs blank node, sh:datatype
 * alternatives, rdf:langString tagging, sh:memberShape lists, node-level sh:or/sh:xone branch
 * selection) is all reused from there rather than duplicated here; this module only has to invent
 * *values*, structured the same way jsToRdf/rdfToJs's own `data` objects are.
 *
 * A property is faked, in order: its fixed sh:hasValue; a fresh nested object when sh:node is
 * declared (recursing into the referenced shape); a random pick among sh:in; the property's own
 * faker:generator annotation (see generateFromFakerAnnotation); or, with no annotation at all, a
 * default derived from sh:datatype plus a keyword guess from the property's own name (see
 * generateDefaultValue) - so a shape with no faker: vocabulary usage whatsoever still fakes
 * sensibly. A plain resource reference (sh:class, no sh:node/sh:in/sh:hasValue) can't be invented
 * out of nothing, so it's instead resolved against something real - the property's own
 * shui:searchQuery if declared, else any existing sh:class instance already in `dataGraph` (see
 * generateMatchingResource) - and only left unset when neither turns up a candidate. That lookup
 * is why generate() is async in the first place: everything else here is synchronous faker.js
 * calls.
 */
export async function generate(options: GenerateOptions): Promise<RdfStore> {
  if (options.seed !== undefined) fakerLibrary.seed(options.seed);

  // date.anytime()-style generators pick a duration relative to "now" by default, which would
  // make a seeded run non-reproducible across days - pinning refDate keeps them deterministic
  // alongside the seeded RNG. Only pinned when a seed is given, so unseeded calls stay genuinely
  // "now"-relative.
  const fakerSettings = options.seed !== undefined ? { refDate: "2020-01-01" } : {};
  const contentLanguage = options.contentLanguage ?? "en";

  // The same store jsToRdf below merges the generated data into - reused as the search space for
  // generateMatchingResource, so a resource-reference property can be pointed at a real instance
  // already present in a caller-supplied dataGraph (an empty freshly-created one otherwise, same
  // as jsToRdf's own default, so there's simply nothing to match yet).
  const existingDataGraph = options.dataGraph ?? RdfStore.createDefault();

  const node = new NodeUIElement({
    shapesGraph: options.shapesGraph,
    dataGraph: RdfStore.createDefault(),
    focusNode: options.focusNode,
    nodeShapes: options.nodeShapes,
  });

  const data = await generateChildren(node.children(), {
    fakerSettings,
    depth: 0,
    existingDataGraph,
    contentLanguage,
  });

  return jsToRdf({
    shapesGraph: options.shapesGraph,
    dataGraph: existingDataGraph,
    focusNode: options.focusNode,
    nodeShapes: options.nodeShapes,
    data,
    contentLanguage,
  });
}

type FakerValue = string | number | boolean | Date;

type GenerationContext = {
  fakerSettings: Record<string, unknown>;
  depth: number;
  existingDataGraph: RdfStore;
  contentLanguage: BCP47;
};

// A guard against infinite recursion for a self-referential shape (e.g. a Person shape whose
// sh:node'd "friend" property points back at the same Person shape) - unlike reading real data,
// there's no actual resource graph here to bottom out a cycle naturally, since every embed
// invents a fresh nested object.
const MAX_EMBED_DEPTH = 6;

// The default sh:maxCount used when a property leaves it unbounded - keeps generated arrays
// small rather than defaulting to some arbitrarily large count.
const DEFAULT_MAX_COUNT = 3;

async function generateChildren(
  children: (PropertyUIElement | ChoiceElement)[],
  context: GenerationContext,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  // Sequential, not Promise.all - faker.js's RNG is a single shared, seeded stream, so values
  // must be drawn in a fixed order for a given seed to stay reproducible (see the "deterministic
  // for a given seed" test); concurrent generation would let network-bound lookups (see
  // generateMatchingResource) resolve in a data-dependent order instead.
  for (const child of children) {
    if (child.kind === "property") {
      const value = await generateProperty(child, context);
      if (value === undefined) continue;
      result[getCodeIdentifier(child.shapesGraph, child.propertyShapes[0])] = value;
    } else {
      Object.assign(result, await generateChoice(child, context));
    }
  }

  return result;
}

async function generateProperty(
  property: PropertyUIElement,
  context: GenerationContext,
): Promise<unknown> {
  const memberShapeNodes = property.get(sh("memberShape"));
  if (memberShapeNodes.length > 0) {
    return generateMemberShapeValues(property, memberShapeNodes, context);
  }

  // A property-level sh:or/sh:xone constrains this property's value with an alternative set of
  // constraints (see structure/logicalBranches.ts) - pick one branch's constraints to generate
  // against, the same way a real edit would settle on one.
  const branches = logicalBranches(property);
  const effective =
    branches.length > 0 ? withBranch(property, pickRandom(branches).shape) : property;

  const minCount = effective.get(sh("minCount")) ?? 0;
  const maxCount = effective.get(sh("maxCount"));
  const count = fakerLibrary.number.int({
    min: minCount,
    max: maxCount ?? Math.max(minCount, DEFAULT_MAX_COUNT),
  });
  if (count === 0) return undefined;

  const values: unknown[] = [];
  for (let index = 0; index < count; index++) {
    const value = await generateValue(effective, context);
    if (value !== undefined) values.push(value);
  }
  if (values.length === 0) return undefined;

  return (maxCount ?? Infinity) > 1 ? values : values[0];
}

async function generateMemberShapeValues(
  property: PropertyUIElement,
  memberShapeNodes: Term[],
  context: GenerationContext,
): Promise<unknown[]> {
  const minCount = property.get(sh("minCount")) ?? 0;
  const maxCount = property.get(sh("maxCount"));
  const count = fakerLibrary.number.int({
    min: minCount,
    max: maxCount ?? Math.max(minCount, DEFAULT_MAX_COUNT),
  });

  const memberElement = new PropertyUIElement({
    shapesGraph: property.shapesGraph,
    dataGraph: property.dataGraph,
    focusNode: property.focusNode,
    propertyShapes: memberShapeNodes as NamedNode[],
  });

  const values: unknown[] = [];
  for (let index = 0; index < count; index++) {
    const value = await generateValue(memberElement, context);
    if (value !== undefined) values.push(value);
  }
  return values;
}

async function generateChoice(
  choice: ChoiceElement,
  context: GenerationContext,
): Promise<Record<string, unknown>> {
  const branchShapes = choiceBranchShapes(choice);
  if (branchShapes.length === 0) return {};

  const children = childrenForShape(
    choice.shapesGraph,
    choice.dataGraph,
    pickRandom(branchShapes),
    choice.focusNode,
    choice.scoresGraph,
    choice.widgetRegistry,
  );
  return generateChildren(children, context);
}

async function generateValue(
  property: PropertyUIElement,
  context: GenerationContext,
): Promise<unknown> {
  const hasValue = property.get(sh("hasValue"));
  if (hasValue) return termToPlainValue(hasValue);

  const nodeShapes = property.get(sh("node")) as Term[];
  if (nodeShapes.length > 0)
    return generateEmbeddedObject(property.shapesGraph, nodeShapes, context);

  const inValues = property.get(sh("in")) as Term[];
  if (inValues.length > 0) return termToPlainValue(pickRandom(inValues));

  const annotated = generateFromFakerAnnotation(property, context.fakerSettings);
  if (annotated !== undefined) return annotated;

  const matchedResource = await generateMatchingResource(property, context);
  if (matchedResource !== undefined) return matchedResource;

  return generateDefaultValue(property, context.fakerSettings);
}

async function generateEmbeddedObject(
  shapesGraph: RdfStore,
  nodeShapes: Term[],
  context: GenerationContext,
): Promise<Record<string, unknown> | undefined> {
  if (context.depth >= MAX_EMBED_DEPTH) return undefined;

  const children = childrenForShape(
    shapesGraph,
    RdfStore.createDefault(),
    nodeShapes,
    factory.blankNode(),
  );
  return generateChildren(children, { ...context, depth: context.depth + 1 });
}

function termToPlainValue(term: Term): FakerValue {
  return term.termType === "Literal" ? termToJsValue(term) : term.value;
}

function pickRandom<T>(items: T[]): T {
  return items[fakerLibrary.number.int({ min: 0, max: items.length - 1 })];
}

// faker:generator holds either one term (a faker:xxx.yyy function reference, or a plain literal
// used verbatim) or an rdf:List mixing both - e.g. `( faker:location.street " " faker:location.city )`
// to compose one string from several faker calls and literal separators. A single non-literal part
// returns that call's own value as-is (a Date/number/boolean, not stringified); mixing in a second
// part necessarily produces a string, since that's the only way to join them.
const FAKER_BASE = faker("").value;

function generateFromFakerAnnotation(
  property: PropertyUIElement,
  fakerSettings: Record<string, unknown>,
): FakerValue | undefined {
  const [declared] = property.get(faker("generator"));
  if (!declared) return undefined;

  const parts = expandListOrTerm(declared, property.shapesGraph);
  const rendered = parts.map(
    (part): FakerValue =>
      part.termType === "Literal"
        ? part.value
        : callFakerGenerator(part.value.slice(FAKER_BASE.length), fakerSettings),
  );

  return rendered.length === 1 ? rendered[0] : rendered.map(String).join("");
}

function callFakerGenerator(
  dotSeparatedPath: string,
  options: Record<string, unknown>,
): FakerValue {
  let pointer: unknown = fakerLibrary;
  for (const part of dotSeparatedPath.split(".")) {
    pointer = (pointer as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof pointer !== "function") {
    throw new Error(`Could not find faker generator: ${dotSeparatedPath}`);
  }
  return (pointer as (options: Record<string, unknown>) => FakerValue)(options);
}

// Keyword guesses for a plausible generator when a string-ish property has no faker:generator of
// its own - matched against the property's own code identifier (its sh:path's local name, by
// default; see getCodeIdentifier), so a shape needs no faker: vocabulary at all to fake sensibly.
const STRING_GENERATORS: [RegExp, () => string][] = [
  [/e-?mail/i, () => fakerLibrary.internet.email()],
  [/(phone|tel)/i, () => fakerLibrary.phone.number()],
  [/(given|first)name/i, () => fakerLibrary.person.firstName()],
  [/(family|last|sur)name/i, () => fakerLibrary.person.lastName()],
  [/^name$|fullname/i, () => fakerLibrary.person.fullName()],
  [/(url|website|homepage)/i, () => fakerLibrary.internet.url()],
  [/street/i, () => fakerLibrary.location.streetAddress()],
  [/(city|locality)/i, () => fakerLibrary.location.city()],
  [/(zip|postal)/i, () => fakerLibrary.location.zipCode()],
  [/(state|region|province)/i, () => fakerLibrary.location.state()],
  [/country/i, () => fakerLibrary.location.country()],
  [/(description|summary|bio|about)/i, () => fakerLibrary.lorem.paragraph()],
  [/(title|headline|subject)/i, () => fakerLibrary.lorem.sentence()],
  [/(company|organization|employer)/i, () => fakerLibrary.company.name()],
  [/colou?r/i, () => fakerLibrary.color.human()],
];

const FLOAT_DATATYPES = new Set([xsd("decimal").value, xsd("double").value, xsd("float").value]);

/**
 * A pure resource-reference property (sh:class, no sh:datatype - sh:node/sh:in/sh:hasValue are
 * already handled earlier in generateValue) can't be fabricated out of nothing the way a literal
 * can, so it's instead pointed at something real: the property's own shui:searchQuery (spec
 * §10.1), run the same way AutoCompleteEditor would (empty search term, so a class-scoped query
 * returns its whole candidate set rather than nothing); or, when there's no searchQuery or it
 * turns up nothing, any existing instance of sh:class already present in the dataGraph being
 * generated into (see resolution/targets.ts's shaclInstancesOfClass, which also walks the shapes
 * graph's own rdfs:subClassOf hierarchy so a subclass instance still counts as a match). Returns
 * undefined - left for generateDefaultValue's own "leave unset" fallback - when neither source has
 * a candidate, e.g. a brand-new dataGraph with nothing of that class in it yet.
 */
async function generateMatchingResource(
  property: PropertyUIElement,
  context: GenerationContext,
): Promise<string | undefined> {
  if (property.get(sh("datatype"))) return undefined;
  const classIri = property.get(sh("class"))[0] as NamedNode | undefined;
  if (!classIri) return undefined;

  const searchQuery = property.get(shui("searchQuery"))[0];
  if (searchQuery?.termType === "Literal") {
    // property.dataGraph is generate()'s own empty structural scratch store, not the real
    // dataGraph being generated into - a non-federated shui:searchQuery would otherwise always
    // find nothing to match against. A federated one (wrapped in its own SERVICE clause) ignores
    // this source anyway, so swapping it in is safe either way.
    const queryable = new PropertyUIElement({
      shapesGraph: property.shapesGraph,
      dataGraph: context.existingDataGraph,
      focusNode: property.focusNode,
      propertyShapes: property.propertyShapes,
    });
    const substituted = substituteSearchParameters(searchQuery.value, "", context.contentLanguage);
    const results = await runFederatedQuery(substituted, queryable, context.contentLanguage);
    if (results.length > 0) return pickRandom(results).term.value;
  }

  const existing = shaclInstancesOfClass(classIri, context.existingDataGraph, property.shapesGraph);
  if (existing.length > 0) return pickRandom(existing).value;

  return undefined;
}

// No faker:generator declared at all - fall back to sh:datatype (defaulting to a string, same as
// jsToRdf's own untyped-property fallback) plus, for strings, a keyword guess. A pure resource
// reference (sh:class with neither sh:node, sh:in nor sh:hasValue) that generateMatchingResource
// also couldn't resolve to a real instance has no meaningful value left to invent and is left
// unset.
function generateDefaultValue(
  property: PropertyUIElement,
  fakerSettings: Record<string, unknown>,
): unknown {
  const datatype = property.get(sh("datatype"));
  if (!datatype && (property.get(sh("class")) as Term[]).length > 0) return undefined;

  const jsType = datatype ? castDataTypeTermToJs(datatype) : "string";

  if (jsType === "boolean") return fakerLibrary.datatype.boolean();
  if (jsType === "Date") return fakerLibrary.date.anytime(fakerSettings);
  if (jsType === "number") return generateNumber(property, datatype);

  return generateString(property);
}

function generateNumber(property: PropertyUIElement, datatype: Term | undefined): number {
  const { min, max } = numericBounds(property);
  const isFloat = datatype ? FLOAT_DATATYPES.has(datatype.value) : false;
  return isFloat
    ? fakerLibrary.number.float({ min, max, fractionDigits: 2 })
    : fakerLibrary.number.int({ min, max });
}

function numericBounds(property: PropertyUIElement): { min: number; max: number } {
  const minInclusive = property.get(sh("minInclusive"));
  const maxInclusive = property.get(sh("maxInclusive"));
  const minExclusive = property.get(sh("minExclusive"));
  const maxExclusive = property.get(sh("maxExclusive"));

  const min = minInclusive ?? (minExclusive !== undefined ? minExclusive + 1 : 0);
  const max = maxInclusive ?? (maxExclusive !== undefined ? maxExclusive - 1 : min + 1000);
  return { min, max: Math.max(max, min) };
}

function generateString(property: PropertyUIElement): string {
  const codeIdentifier = getCodeIdentifier(property.shapesGraph, property.propertyShapes[0]);
  const generator = STRING_GENERATORS.find(([pattern]) => pattern.test(codeIdentifier))?.[1];
  return generator ? generator() : fakerLibrary.lorem.words({ min: 1, max: 3 });
}
