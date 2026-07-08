import { rdfParser } from "rdf-parse";
import str from "string-to-stream";
import { RdfStore } from "rdf-stores";
import type { Stream } from "@rdfjs/types";
import { Effect } from "effect";

export function parseRdf(content: string, contentType: string): Effect.Effect<RdfStore, Error> {
    if (!content || content.trim().length === 0) {
        return Effect.succeed(RdfStore.createDefault());
    }

    return Effect.gen(function* () {
        const textStream = str(content);
        const quadStream = yield* Effect.try({
            try: () => rdfParser.parse(textStream, { contentType }),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        return yield* streamToStore(quadStream);
    });
}

function streamToStore(stream: Stream): Effect.Effect<RdfStore, Error> {
    const store = RdfStore.createDefault();
    return Effect.async<RdfStore, Error>((resume) => {
        store.import(stream)
            .on("end", () => resume(Effect.succeed(store)))
            .on("error", (error) => resume(Effect.fail(error)));
    });
}
