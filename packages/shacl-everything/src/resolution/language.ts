import type { Literal, Term } from "@rdfjs/types";

export default function language(terms: Literal[]): Literal {
    return terms[0];
}
