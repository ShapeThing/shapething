import type { BlankNode, NamedNode, Term } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";

export const factory = new DataFactory();

// A node the manager shows on a page of its own: a class, shape, property, constraint, rule...
export type Resource = NamedNode | BlankNode;

export const termKey = (term: Term): string => `${term.termType} ${term.value}`;
