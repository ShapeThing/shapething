import { QueryEngine } from "@comunica/query-sparql";
import { Bindings } from "@comunica/utils-bindings-factory";

const serializedSource = (value: string) => ({
    type: "serialized",
    value,
    mediaType: "text/turtle",
    baseIRI: "http://example.org/",
});

export const createQueryBindingsComunica = async (input: string): Promise<(query: string) => Promise<Bindings[]>> => {
    const engine = new QueryEngine();
    return async (query: string) => {
        const result = await engine.queryBindings(query, {
            sources: [serializedSource(input)],
            unionDefaultGraph: true,
            baseIRI: "http://example.org/",
        });
        return result.toArray() as unknown as Bindings[];
    }
}