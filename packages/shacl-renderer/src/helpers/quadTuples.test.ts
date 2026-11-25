import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Quad, Term } from "@rdfjs/types";
import { encodeTurtle } from "../../build/ttlQuadsPlugin.ts";
import { decodeQuads } from "@/helpers/quadTuples.ts";
import { parseRdf } from "@/helpers/rdf.ts";

const root = path.join(import.meta.dirname, "../..");
const files = [
  "src/scoring/widget-scoring.ttl",
  ...fs.globSync("src/widgets/implementations/*/*/*/{score,meta}.ttl", { cwd: root }).sort(),
];

// Blank node labels differ between parses by design, so they're compared as "_" - everything
// else (IRIs, literal values, languages, datatypes, graphs) must match exactly.
const termSignature = (term: Term): string =>
  term.termType === "BlankNode"
    ? "_"
    : term.termType === "Literal"
      ? JSON.stringify([term.value, term.language, term.datatype.value])
      : `${term.termType}:${term.value}`;
const signature = (quads: Quad[]) =>
  quads.map((q) => [q.subject, q.predicate, q.object, q.graph].map(termSignature).join(" ")).sort();

test.each(files)("build-time quads for %s match a runtime parse", async (file) => {
  const turtle = fs.readFileSync(path.join(root, file), "utf-8");
  const decoded = decodeQuads(JSON.parse(JSON.stringify(encodeTurtle(turtle, "x_"))));
  const parsed = (await parseRdf(turtle, "text/turtle")).getQuads();
  expect(decoded.length).toBeGreaterThan(0);
  expect(signature(decoded)).toEqual(signature(parsed));
});

test("blank node labels are namespaced per file", () => {
  const [a] = decodeQuads(encodeTurtle("<http://e/s> <http://e/p> [] .", "a_"));
  const [b] = decodeQuads(encodeTurtle("<http://e/s> <http://e/p> [] .", "b_"));
  expect(a!.object.equals(b!.object)).toBe(false);
});
