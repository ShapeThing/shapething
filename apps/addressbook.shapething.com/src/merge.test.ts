import { DataFactory } from "n3";
import { expect, test } from "vite-plus/test";
import { withoutDoubleBlankNodes } from "./addressBook.ts";

const { namedNode, blankNode, literal, quad } = DataFactory;
const schema = (name: string) => namedNode(`https://schema.org/${name}`);
const ada = namedNode("file:///book/contacts/ada");

const address = (node: string, street: string) => [
  quad(ada, schema("address"), blankNode(node)),
  quad(blankNode(node), schema("streetAddress"), literal(street)),
];

test("two people's identical address, merged, is one address", () => {
  const quads = [
    ...address("a1", "Main Street 1"),
    ...address("merged0_a1", "Main Street 1"),
    ...address("merged0_a2", "Side Street 2"),
  ];
  const kept = withoutDoubleBlankNodes(quads, ada);
  expect(kept.filter(({ predicate }) => predicate.equals(schema("address")))).toHaveLength(2);
  expect(kept.map(({ object }) => object.value)).not.toContain("merged0_a1");
});
