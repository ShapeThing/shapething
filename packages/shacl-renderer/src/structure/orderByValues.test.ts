import { expect, test } from "vite-plus/test";
import {
  isWritablePath,
  sortByOrderPath,
  sortForView,
  writeOrder,
} from "@/structure/orderByValues.ts";
import { parsePathNode } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

const prefixes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
`;

// ( ex:meta ex:position ) - a sequence path, so reads and writes go through an intermediate node.
async function sequencePath() {
  const shapesGraph = await parseRdf(
    `${prefixes}\nex:shape ex:orderBy ( ex:meta ex:position ) .`,
    "text/turtle",
  );
  const [quad] = shapesGraph.getQuads(ex("shape"), ex("orderBy"));
  return parsePathNode(quad.object, shapesGraph);
}

test("sortByOrderPath - sorts by each value's position, values without one last in input order", async () => {
  const dataGraph = await parseRdf(
    `${prefixes}
    ex:a ex:meta [ ex:position 3 ] .
    ex:b ex:meta [ ex:position 1 ] .
    ex:c ex:meta [ ex:position 2.5 ] .
    `,
    "text/turtle",
  );
  const path = await sequencePath();
  const values = [ex("none1"), ex("a"), ex("none2"), ex("b"), ex("c")];
  expect(sortByOrderPath(values, path, dataGraph).map((term) => term.value)).toEqual([
    ex("b").value,
    ex("c").value,
    ex("a").value,
    ex("none1").value,
    ex("none2").value,
  ]);
});

test("writeOrder - renumbers 1..n, replacing existing positions and inserting missing ones", async () => {
  const dataGraph = await parseRdf(
    `${prefixes}
    ex:a ex:meta [ ex:position 10 ] .
    ex:b ex:meta [ ex:position 20 ] .
    `,
    "text/turtle",
  );
  const path = await sequencePath();
  writeOrder([ex("b"), ex("c"), ex("a")], path, dataGraph);

  const positions = [ex("a"), ex("b"), ex("c")].map((value) =>
    walkPropertyPath(path, value, dataGraph).map((term) => term.value),
  );
  expect(positions).toEqual([["3"], ["1"], ["2"]]);
});

test("isWritablePath - only predicate, inverse and sequence paths", async () => {
  const shapesGraph = await parseRdf(
    `${prefixes}
    ex:inverse ex:orderBy [ sh:inversePath ex:position ] .
    ex:repeat ex:orderBy [ sh:zeroOrMorePath ex:position ] .
    `,
    "text/turtle",
  );
  const pathOf = (shape: string) =>
    parsePathNode(shapesGraph.getQuads(ex(shape), ex("orderBy"))[0].object, shapesGraph);
  expect(isWritablePath(await sequencePath())).toBe(true);
  expect(isWritablePath(pathOf("inverse"))).toBe(true);
  expect(isWritablePath(pathOf("repeat"))).toBe(false);
});

test("sortForView - without st:orderBy, alphabetically by label, as the locale sorts", async () => {
  const dataGraph = await parseRdf(prefixes, "text/turtle");
  const labels = new Map([
    [ex("a").value, "zebra"],
    [ex("b").value, "Émile"],
    [ex("c").value, "Book 10"],
    [ex("d").value, "Book 2"],
    [ex("e").value, "apple"],
  ]);
  const values = [ex("a"), ex("b"), ex("c"), ex("d"), ex("e")];
  const sorted = sortForView(values, undefined, dataGraph, (term) => labels.get(term.value)!, "en");
  expect(sorted.map((term) => labels.get(term.value))).toEqual([
    "apple",
    "Book 2",
    "Book 10",
    "Émile",
    "zebra",
  ]);
});

test("sortForView - by position first, then alphabetically between equal or missing positions", async () => {
  const dataGraph = await parseRdf(
    `${prefixes}
    ex:late ex:meta [ ex:position 2 ] .
    ex:earlyB ex:meta [ ex:position 1 ] .
    ex:earlyA ex:meta [ ex:position 1 ] .
    `,
    "text/turtle",
  );
  const path = await sequencePath();
  const label = (term: { value: string }) => term.value.replace(ex("").value, "");
  const values = [ex("noneB"), ex("late"), ex("earlyB"), ex("noneA"), ex("earlyA")];
  expect(sortForView(values, path, dataGraph, label, "en").map(label)).toEqual([
    "earlyA",
    "earlyB",
    "late",
    "noneA",
    "noneB",
  ]);
});

test("sortForView - a content language Intl does not know still sorts", async () => {
  const dataGraph = await parseRdf(prefixes, "text/turtle");
  const label = (term: { value: string }) => term.value.replace(ex("").value, "");
  expect(sortForView([ex("b"), ex("a")], undefined, dataGraph, label, "*").map(label)).toEqual([
    "a",
    "b",
  ]);
});
