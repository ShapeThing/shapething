import factory from "@rdfjs/data-model";
import type { Quad, Term } from "@rdfjs/types";
import { write } from "@jeswr/pretty-turtle";

const FILE = "file://";

// Relative IRIs ending on .ttl are read as the graph of that file (see fileReferences.ts), so an
// IRI of a .ttl file is kept absolute: written relative it would come back as another IRI.
const TTL_FILE = /^[^?#]*\.ttl(?:[?#]|$)/;

const mapTerm = <T extends Term>(term: T, map: (iri: string) => string): T => {
  switch (term.termType) {
    case "NamedNode": {
      const iri = map(term.value);
      return iri === term.value ? term : (factory.namedNode(iri) as unknown as T);
    }
    case "Literal": {
      // Compared by IRI: N3 gives a new datatype term on every read. A language-tagged literal's
      // datatype is rdf:langString, which is never mapped, so its language is never lost here.
      const datatype = map(term.datatype.value);
      return datatype === term.datatype.value
        ? term
        : (factory.literal(term.value, factory.namedNode(datatype)) as unknown as T);
    }
    case "Quad":
      return mapQuad(term as unknown as Quad, map) as unknown as T;
    default:
      return term;
  }
};

const mapQuad = (quad: Quad, map: (iri: string) => string): Quad =>
  factory.quad(
    mapTerm(quad.subject, map),
    mapTerm(quad.predicate, map),
    mapTerm(quad.object, map),
    mapTerm(quad.graph, map),
  );

/**
 * Writes the quads of one graph as pretty Turtle, with IRIs relative to the graph's own IRI where
 * they can be: the graph itself is <>, a fragment of it <#name>, a neighbouring file <other>.
 *
 * The Turtle writer leaves this to N3's BaseIRI, which supports no file: IRIs - the base the store
 * names its graphs with until a folder sets its own. So for a file: graph every file: IRI is
 * written under a stand-in https: origin, unique to this write, and turned back afterwards: the
 * writer then relativizes them the way it does for an https: base.
 */
export async function writeTurtle(
  quads: Quad[],
  baseIri: string | undefined,
  prefixes: Record<string, string>,
): Promise<string> {
  if (!baseIri?.startsWith(FILE)) return write(quads, { baseIri, prefixes });

  // Nothing else in the file can hold it: a fresh UUID under the reserved .invalid top level domain.
  const standIn = `https://${crypto.randomUUID()}.invalid`;
  const toStandIn = (iri: string) =>
    iri.startsWith(FILE) && !TTL_FILE.test(iri) ? standIn + iri.slice(FILE.length) : iri;

  const turtle = await write(
    quads.map((quad) => mapQuad(quad, toStandIn)),
    {
      baseIri: toStandIn(baseIri),
      prefixes: Object.fromEntries(
        Object.entries(prefixes).map(([prefix, namespace]) => [prefix, toStandIn(namespace)]),
      ),
    },
  );
  // What could not be written relative, such as an IRI of another folder, is written in full.
  return turtle.split(standIn).join(FILE);
}
