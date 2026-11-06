import type { NamedNode } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";

export const factory = new DataFactory();

const namespace =
  <Base extends string>(base: Base) =>
  <Local extends string>(local: Local): NamedNode<`${Base}${Local}`> =>
    factory.namedNode(`${base}${local}`);

export const wd = namespace("http://www.wikidata.org/entity/");
export const wdt = namespace("http://www.wikidata.org/prop/direct/");
export const rdf = namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
export const sh = namespace("http://www.w3.org/ns/shacl#");
export const shui = namespace("http://www.w3.org/ns/shacl-ui/");
export const st = namespace("http://shapething.com/");
export const rdfs = namespace("http://www.w3.org/2000/01/rdf-schema#");
export const schema = namespace("http://schema.org/");
export const xsd = namespace("http://www.w3.org/2001/XMLSchema#");

/** This app's own terms: what Wikidata does not state itself, and the custom widgets. */
export const inf = namespace("https://influence.shapething.com/ns#");
