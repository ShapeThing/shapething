import { write } from "@jeswr/pretty-turtle";
import { factory } from "@/helpers/factory.ts";
import { rdf, rdfs, shui, st } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import ontologyTtl from "@/ontology/ontology.ttl?raw";

// Every st widget has a score.ttl (editors, viewers, facets - holding its rdfs:label) or a
// meta.ttl (groups - holding its rdfs:subClassOf sh:PropertyGroup), so together they enumerate them.
const widgetGraphs = import.meta.glob(
  ["/src/widgets/implementations/st/*/*/score.ttl", "/src/widgets/implementations/st/*/*/meta.ttl"],
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

// The widget folder's category ("editors", ...) decides the widget's own rdf:type.
const categoryTypes: Record<string, ReturnType<typeof st>> = {
  editors: shui("Editor"),
  viewers: shui("Viewer"),
  facets: st("Facet"),
  groups: rdfs("Class"),
};

const prefixes = {
  st: "http://shapething.com/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  sh: "http://www.w3.org/ns/shacl#",
  shui: "http://www.w3.org/ns/shacl-ui/",
  dcterms: "http://purl.org/dc/terms/",
};

/**
 * The ShapeThing ontology (http://shapething.com/) as Turtle: the hand-written terms of
 * ontology.ttl plus one term per st widget, typed by its folder's category and carrying what its
 * score.ttl/meta.ttl state about the widget itself - the scores and the shapes they test against
 * are internal to widget scoring and left out. Every term gets rdfs:isDefinedBy st:.
 */
export async function buildOntology(): Promise<string> {
  const store = await parseRdf(ontologyTtl, "text/turtle");

  for (const [path, text] of Object.entries(widgetGraphs)) {
    const [category, folder] = path.split("/").slice(-3, -1);
    const widget = st(folder);
    store.addQuad(factory.quad(widget, rdf("type"), categoryTypes[category]));
    const graph = await parseRdf(text, "text/turtle");
    for (const quad of graph.getQuads(widget)) store.addQuad(quad);
  }

  const ontology = st("");
  for (const quad of store.getQuads()) {
    if (
      quad.subject.termType === "NamedNode" &&
      quad.subject.value.startsWith(ontology.value) &&
      !quad.subject.equals(ontology)
    ) {
      store.addQuad(factory.quad(quad.subject, rdfs("isDefinedBy"), ontology));
    }
  }

  return write(store.getQuads(), { prefixes, ordered: true });
}
