import type { Decorator } from "@storybook/react-vite";
import { action } from "storybook/actions";
import { addons } from "storybook/preview-api";
import { write } from "@jeswr/pretty-turtle";
import type { DatasetCore, NamedNode, Quad } from "@rdfjs/types";
import { ResourceFetcher } from "@shapething/resource-fetcher";
import { QueryEngine } from "@comunica/query-sparql";
import { RdfStore } from "rdf-stores";
import type { RawEnvironment, SubmitResult } from "@/environment.ts";
import { prefixes } from "@/helpers/namespaces.ts";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { SUBMIT_PREVIEW_EVENT } from "./addons/submit-preview/constants.ts";

// Every story's edit mode form already has an onSubmit slot (see environment.ts) - rather than
// each story wiring its own preview, this injects one globally: a quick "submitted" ping to
// Storybook's built-in Actions panel, and the full turtle-formatted result to the dedicated
// "Submit" panel (see addons/submit-preview) as syntax-highlighted text, since the raw SubmitResult
// (whose dataGraph has a real internal cycle) can't be displayed as-is - see friendlyArgDisplay in
// preview.tsx for the same issue with story args. A story that sets its own onSubmit (e.g. to
// assert on the submitted result in a play() function) still gets called first - this only adds
// the preview on top. Facet mode (see modes/facet/index.tsx) calls this exact same callback with
// its generated filter shape, so it gets this preview for free too, with no facet-specific code
// here at all - "resourceOnly" below is simply never meaningful there (no focusNode to scope to).
const logSubmit = action("onSubmit");

// Scopes dataGraph down to just the resource's own shape-guided description - dataGraph itself may
// hold plenty of triples unrelated to the resource being edited (e.g. autocomplete/search results
// loaded along the way). Passing shapesGraph + shapeIris (rather than a plain CBD walk with no
// shape at all) matters once a nested value's shape declares sh:node: a bare CBD walk only follows
// blank nodes, so it would otherwise stop at a nested value the moment it gets its own identifier
// (e.g. via BlankNodeEditor's "change to node with identifier" button) and make the preview look
// like that value's data silently vanished.
async function resourceOnlyQuads(
  dataGraph: SubmitResult["dataGraph"],
  focusNode: NamedNode,
  shapesGraph: DatasetCore,
  shapeIris: NamedNode[],
): Promise<Quad[]> {
  const engine = new QueryEngine();
  const fetcher = new ResourceFetcher({
    resourceIri: focusNode,
    shapesGraph,
    shapeIris,
    // dataGraph's quads live in the default graph (there's no named-graph structure to a locally
    // parsed/edited store) - unionDefaultGraph makes Comunica's GRAPH ?g pattern (which
    // ResourceFetcher's generated queries always use) see it too, since GRAPH ?g otherwise only
    // matches named graphs and would silently return nothing.
    queryBindings: async (query: string) =>
      (
        await engine.queryBindings(query, { sources: [dataGraph], unionDefaultGraph: true })
      ).toArray(),
  });
  const { results } = await fetcher.execute();
  return results;
}

export const withSubmitPreview: Decorator = (Story, context) => {
  const existingOnSubmit = (context.args as { onSubmit?: (result: SubmitResult) => void }).onSubmit;
  const focusNode = (context.args as { focusNode?: NamedNode }).focusNode;
  const dataGraphSource = (context.args as { dataGraph?: unknown }).dataGraph;
  const storyId = context.id;

  // Most fixtures are fetched from a story's own .ttl file (see argsByTestFile.ts), so their
  // subjects resolve to a long `http://localhost:6006/src/stories/....ttl#foo` IRI - passing that
  // same URL back as baseIri lets pretty-turtle write those back out as `<#foo>`.
  const baseIri = dataGraphSource instanceof URL ? dataGraphSource.href : undefined;
  const writeOptions = { ordered: true, prefixes, baseIri };

  const onSubmit = (result: SubmitResult) => {
    existingOnSubmit?.(result);
    logSubmit(`${result.additions.length} addition(s), ${result.deletions.length} deletion(s)`);

    // The story's own shapesGraph arg is still an unresolved RdfSource (a URL, most commonly) -
    // resolveRdfSources() is the same parsing/default-nodeShapes-detection the real app runs, reused
    // here purely to get shapesGraph/nodeShapes read for the preview. Its resolved dataGraph is
    // discarded: result.dataGraph (the live, already-edited store) is what queries run against.
    // Resource-only is only meaningful once there's a focusNode to scope the description to.
    const resourceOnlyPromise: Promise<Quad[] | undefined> = focusNode
      ? resolveRdfSources({
          ...(context.args as RawEnvironment),
          scoresGraph:
            (context.args as { scoresGraph?: RawEnvironment["scoresGraph"] }).scoresGraph ??
            RdfStore.createDefault(),
        }).then((resolved) =>
          resourceOnlyQuads(
            result.dataGraph,
            focusNode,
            resolved.shapesGraph.asDataset(),
            resolved.nodeShapes.filter((term): term is NamedNode => term.termType === "NamedNode"),
          ),
        )
      : Promise.resolve(undefined);

    Promise.all([
      write(result.dataGraph.getQuads(), writeOptions),
      resourceOnlyPromise.then((quads) => (quads ? write(quads, writeOptions) : undefined)),
      write(result.additions, writeOptions),
      write(result.deletions, writeOptions),
    ]).then(([dataGraph, resourceOnly, additions, deletions]) => {
      addons
        .getChannel()
        .emit(SUBMIT_PREVIEW_EVENT, { storyId, dataGraph, resourceOnly, additions, deletions });
    });
  };

  return Story({ args: { ...context.args, onSubmit } });
};
