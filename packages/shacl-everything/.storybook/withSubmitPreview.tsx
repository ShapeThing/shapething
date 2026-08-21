import type { Decorator } from "@storybook/react-vite";
import { action } from "storybook/actions";
import { addons } from "storybook/preview-api";
import { write } from "@jeswr/pretty-turtle";
import type { NamedNode, Quad } from "@rdfjs/types";
import { ResourceFetcher } from "@shapething/resource-fetcher";
import { QueryEngine } from "@comunica/query-sparql";
import type { SubmitResult } from "@/environment.ts";
import { prefixes } from "@/helpers/namespaces.ts";
import { SUBMIT_PREVIEW_EVENT } from "./addons/submit-preview/constants.ts";

// Every story's edit mode form already has an onSubmit slot (see environment.ts) - rather than
// each story wiring its own preview, this injects one globally: a quick "submitted" ping to
// Storybook's built-in Actions panel, and the full turtle-formatted result to the dedicated
// "Submit" panel (see addons/submit-preview) as syntax-highlighted text, since the raw SubmitResult
// (whose dataGraph has a real internal cycle) can't be displayed as-is - see friendlyArgDisplay in
// preview.tsx for the same issue with story args. A story that sets its own onSubmit (e.g. to
// assert on the submitted result in a play() function) still gets called first - this only adds
// the preview on top.
const logSubmit = action("onSubmit");

// Scopes dataGraph down to just the triples reachable from focusNode (following blank nodes, the
// Concise Bounded Description this package extends - see resource-fetcher's README) purely so the
// preview is readable - dataGraph itself may hold plenty of triples unrelated to the resource being
// edited (e.g. autocomplete/search results loaded along the way). No shapesPointer is passed: this
// is a display convenience, not part of the actual submit contract, so a plain CBD walk from
// focusNode is enough - no need to parse the story's shapesGraph args here too.
async function resourceOnlyQuads(
  dataGraph: SubmitResult["dataGraph"],
  focusNode: NamedNode,
): Promise<Quad[]> {
  const engine = new QueryEngine();
  const fetcher = new ResourceFetcher({
    resourceIri: focusNode,
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

    const resourceQuads = focusNode
      ? resourceOnlyQuads(result.dataGraph, focusNode)
      : Promise.resolve(result.dataGraph.getQuads());

    resourceQuads
      .then((quads) =>
        Promise.all([
          write(quads, writeOptions),
          write(result.additions, writeOptions),
          write(result.deletions, writeOptions),
        ]),
      )
      .then(([dataGraph, additions, deletions]) => {
        addons
          .getChannel()
          .emit(SUBMIT_PREVIEW_EVENT, { storyId, dataGraph, additions, deletions });
      });
  };

  return Story({ args: { ...context.args, onSubmit } });
};
