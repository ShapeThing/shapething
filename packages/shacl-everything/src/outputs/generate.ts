import { faker as fakerLibrary } from "@faker-js/faker";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { castDataTypeTermToJs } from "@/helpers/castDataTypeTermToJs.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { getCodeIdentifier } from "@/helpers/getCodeIdentifier.ts";
import { faker, sh, xsd } from "@/helpers/namespaces.ts";
import { termToJsValue } from "@/helpers/termToJsValue.ts";
import { jsToRdf } from "@/outputs/js-to-rdf.ts";
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
 * sensibly. A plain resource reference (sh:class, no sh:node/sh:in/sh:hasValue) can't be
 * fabricated meaningfully and is left unset.
 */
export function generate(options: GenerateOptions): RdfStore {
  if (options.seed !== undefined) fakerLibrary.seed(options.seed);

  // date.anytime()-style generators pick a duration relative to "now" by default, which would
  // make a seeded run non-reproducible across days - pinning refDate keeps them deterministic
  // alongside the seeded RNG. Only pinned when a seed is given, so unseeded calls stay genuinely
  // "now"-relative.
  const fakerSettings = options.seed !== undefined ? { refDate: "2020-01-01" } : {};

  const node = new NodeUIElement({
    shapesGraph: options.shapesGraph,
    dataGraph: RdfStore.createDefault(),
    focusNode: options.focusNode,
    nodeShapes: options.nodeShapes,
  });

  const data = generateChildren(node.children(), { fakerSettings, depth: 0 });

  return jsToRdf({
    shapesGraph: options.shapesGraph,
    dataGraph: options.dataGraph,
    focusNode: options.focusNode,
    nodeShapes: options.nodeShapes,
    data,
    contentLanguage: options.contentLanguage ?? "en",
  });
}

type FakerValue = string | number | boolean | Date;

type GenerationContext = {
  fakerSettings: Record<string, unknown>;
  depth: number;
};

// A guard against infinite recursion for a self-referential shape (e.g. a Person shape whose
// sh:node'd "friend" property points back at the same Person shape) - unlike reading real data,
// there's no actual resource graph here to bottom out a cycle naturally, since every embed
// invents a fresh nested object.
const MAX_EMBED_DEPTH = 6;

// The default sh:maxCount used when a property leaves it unbounded - keeps generated arrays
// small rather than defaulting to some arbitrarily large count.
const DEFAULT_MAX_COUNT = 3;

function generateChildren(
  children: (PropertyUIElement | ChoiceElement)[],
  context: GenerationContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const child of children) {
    if (child.kind === "property") {
      const value = generateProperty(child, context);
      if (value === undefined) continue;
      result[getCodeIdentifier(child.shapesGraph, child.propertyShapes[0])] = value;
    } else {
      Object.assign(result, generateChoice(child, context));
    }
  }

  return result;
}

function generateProperty(property: PropertyUIElement, context: GenerationContext): unknown {
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
  const count = fakerLibrary.number.int({ min: minCount, max: maxCount ?? Math.max(minCount, DEFAULT_MAX_COUNT) });
  if (count === 0) return undefined;

  const values: unknown[] = [];
  for (let index = 0; index < count; index++) {
    const value = generateValue(effective, context);
    if (value !== undefined) values.push(value);
  }
  if (values.length === 0) return undefined;

  return (maxCount ?? Infinity) > 1 ? values : values[0];
}

function generateMemberShapeValues(
  property: PropertyUIElement,
  memberShapeNodes: Term[],
  context: GenerationContext,
): unknown[] {
  const minCount = property.get(sh("minCount")) ?? 0;
  const maxCount = property.get(sh("maxCount"));
  const count = fakerLibrary.number.int({ min: minCount, max: maxCount ?? Math.max(minCount, DEFAULT_MAX_COUNT) });

  const memberElement = new PropertyUIElement({
    shapesGraph: property.shapesGraph,
    dataGraph: property.dataGraph,
    focusNode: property.focusNode,
    propertyShapes: memberShapeNodes as NamedNode[],
  });

  const values: unknown[] = [];
  for (let index = 0; index < count; index++) {
    const value = generateValue(memberElement, context);
    if (value !== undefined) values.push(value);
  }
  return values;
}

function generateChoice(choice: ChoiceElement, context: GenerationContext): Record<string, unknown> {
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

function generateValue(property: PropertyUIElement, context: GenerationContext): unknown {
  const hasValue = property.get(sh("hasValue"));
  if (hasValue) return termToPlainValue(hasValue);

  const nodeShapes = property.get(sh("node")) as Term[];
  if (nodeShapes.length > 0) return generateEmbeddedObject(property.shapesGraph, nodeShapes, context);

  const inValues = property.get(sh("in")) as Term[];
  if (inValues.length > 0) return termToPlainValue(pickRandom(inValues));

  const annotated = generateFromFakerAnnotation(property, context.fakerSettings);
  if (annotated !== undefined) return annotated;

  return generateDefaultValue(property, context.fakerSettings);
}

function generateEmbeddedObject(
  shapesGraph: RdfStore,
  nodeShapes: Term[],
  context: GenerationContext,
): Record<string, unknown> | undefined {
  if (context.depth >= MAX_EMBED_DEPTH) return undefined;

  const children = childrenForShape(shapesGraph, RdfStore.createDefault(), nodeShapes, factory.blankNode());
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
  const rendered = parts.map((part): FakerValue =>
    part.termType === "Literal"
      ? part.value
      : callFakerGenerator(part.value.slice(FAKER_BASE.length), fakerSettings),
  );

  return rendered.length === 1 ? rendered[0] : rendered.map(String).join("");
}

function callFakerGenerator(dotSeparatedPath: string, options: Record<string, unknown>): FakerValue {
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

// No faker:generator declared at all - fall back to sh:datatype (defaulting to a string, same as
// jsToRdf's own untyped-property fallback) plus, for strings, a keyword guess. A pure resource
// reference (sh:class with neither sh:node, sh:in nor sh:hasValue) has no meaningful value to
// invent and is left unset.
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
