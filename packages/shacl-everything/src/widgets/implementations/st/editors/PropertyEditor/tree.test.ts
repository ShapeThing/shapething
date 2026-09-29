import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { factory } from "@/helpers/factory.ts";
import {
  canMoveInto,
  deleteGroup,
  getProjection,
  moveIntoGroup,
  moveItem,
  nextOrder,
  readTree,
  removeChildrenOf,
  shapesUsingGroup,
  type TreeItem,
} from "@/widgets/implementations/st/editors/PropertyEditor/tree.ts";

const prefixes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
`;

// name (in ex:general) before email, general's nested ex:naming holds given/family name.
const shape = `${prefixes}
    ex:shape sh:property ex:email, ex:gender, ex:givenName, ex:familyName .
    ex:email sh:group ex:general ; sh:order 2 .
    ex:gender sh:group ex:general ; sh:order 1 .
    ex:givenName sh:group ex:naming ; sh:order 1 .
    ex:familyName sh:group ex:naming ; sh:order 2 .
    ex:general a sh:PropertyGroup ; sh:order 1 .
    ex:naming a sh:PropertyGroup ; sh:group ex:general ; sh:order 3 .
    ex:unused a sh:PropertyGroup .
`;

const properties = [ex("email"), ex("gender"), ex("givenName"), ex("familyName")];

const summary = (items: TreeItem[]) =>
  items.map((item) => `${"  ".repeat(item.depth)}${item.term.value.replace(ex("").value, "")}`);

const idOf = (name: string) => termKey(ex(name));

test("readTree - nests properties and groups by sh:group, each level sorted by sh:order", async () => {
  const dataGraph = await parseRdf(shape, "text/turtle");
  const { items, unusedGroups } = readTree(properties, dataGraph);
  expect(summary(items)).toEqual([
    "general",
    "  gender",
    "  email",
    "  naming",
    "    givenName",
    "    familyName",
  ]);
  expect(items.find((item) => item.term.equals(ex("naming")))?.kind).toBe("group");
  expect(unusedGroups.map((group) => group.value)).toEqual([ex("unused").value]);
});

test("readTree - an unused group typed only with a subclass of sh:PropertyGroup is listed too", async () => {
  const dataGraph = await parseRdf(`${prefixes}
    @prefix st: <http://shapething.com/> .
    ex:drawer a st:DrawerPropertyGroup .
  `, "text/turtle");
  // The subclass link lives in the renderer's own shapes graph (see addGroupTypeHierarchy).
  const shapesGraph = await parseRdf(`${prefixes}
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix st: <http://shapething.com/> .
    st:DrawerPropertyGroup rdfs:subClassOf sh:PropertyGroup .
  `, "text/turtle");
  expect(readTree([], dataGraph).unusedGroups).toEqual([]);
  expect(readTree([], dataGraph, shapesGraph).unusedGroups.map((group) => group.value)).toEqual([
    ex("drawer").value,
  ]);
});

test("readTree - a group in a sh:group cycle is shown top level instead of looping", async () => {
  const dataGraph = await parseRdf(
    `${prefixes}
    ex:a sh:group ex:g1 .
    ex:g1 sh:group ex:g2 .
    ex:g2 sh:group ex:g1 .
    `,
    "text/turtle",
  );
  const { items, unusedGroups } = readTree([ex("a")], dataGraph);
  expect(summary(items)).toEqual(["g1", "  a"]);
  expect(unusedGroups.map((group) => group.value)).toEqual([ex("g2").value]);
});

test("removeChildrenOf - drops a group's whole subtree", async () => {
  const dataGraph = await parseRdf(shape, "text/turtle");
  const { items } = readTree(properties, dataGraph);
  expect(summary(removeChildrenOf(items, idOf("general")))).toEqual(["general"]);
  expect(summary(removeChildrenOf(items, idOf("naming")))).toEqual([
    "general",
    "  gender",
    "  email",
    "  naming",
  ]);
});

test("getProjection - can only nest under a group, and never above the row after it", async () => {
  const dataGraph = await parseRdf(shape, "text/turtle");
  const { items } = readTree(properties, dataGraph);
  const flat = removeChildrenOf(items, idOf("familyName"));

  // Onto givenName: the row above (naming's child givenName ends up above) is a property, so no
  // deeper than it however far right it's dragged.
  expect(getProjection(flat, idOf("familyName"), idOf("givenName"), 500, 20)).toEqual({
    depth: 2,
    parentId: idOf("naming"),
  });

  // email dragged onto gender: previous row is general (a group) - one step right nests in it.
  const emailFlat = removeChildrenOf(items, idOf("email"));
  expect(getProjection(emailFlat, idOf("email"), idOf("gender"), 0, 20)).toEqual({
    depth: 1,
    parentId: idOf("general"),
  });
  // Dragged far left, it still can't go above gender, which follows it inside general.
  expect(getProjection(emailFlat, idOf("email"), idOf("gender"), -500, 20)?.depth).toBe(1);

  // familyName dragged to the very end, far left: out of every group.
  expect(getProjection(flat, idOf("familyName"), idOf("familyName"), -500, 20)).toEqual({
    depth: 0,
    parentId: null,
  });
});

test("moveItem - writes the new sh:group and renumbers the new siblings", async () => {
  const dataGraph = await parseRdf(shape, "text/turtle");
  const { items } = readTree(properties, dataGraph);

  // familyName out of every group, to the top level after general.
  moveItem(items, idOf("familyName"), idOf("familyName"), { depth: 0, parentId: null }, dataGraph);
  expect(dataGraph.getQuads(ex("familyName"), sh("group"))).toHaveLength(0);

  const next = readTree(properties, dataGraph).items;
  expect(summary(next)).toEqual([
    "general",
    "  gender",
    "  email",
    "  naming",
    "    givenName",
    "familyName",
  ]);
  expect(dataGraph.getQuads(ex("general"), sh("order"))[0].object.value).toBe("1");
  expect(dataGraph.getQuads(ex("familyName"), sh("order"))[0].object.value).toBe("2");

  // And email before gender, inside general.
  moveItem(next, idOf("email"), idOf("gender"), { depth: 1, parentId: idOf("general") }, dataGraph);
  expect(summary(readTree(properties, dataGraph).items).slice(0, 3)).toEqual([
    "general",
    "  email",
    "  gender",
  ]);
});

test("moveIntoGroup - starts using an unused group, but never makes a group contain itself", async () => {
  const dataGraph = await parseRdf(shape, "text/turtle");
  moveIntoGroup(ex("email"), ex("unused"), dataGraph);
  expect(dataGraph.getQuads(ex("email"), sh("group"))[0].object.value).toBe(ex("unused").value);

  expect(canMoveInto(ex("general"), ex("naming"), dataGraph)).toBe(false);
  moveIntoGroup(ex("general"), ex("naming"), dataGraph);
  expect(dataGraph.getQuads(ex("general"), sh("group"))).toHaveLength(0);
});

test("nextOrder - one past the highest sh:order among the siblings", async () => {
  const dataGraph = await parseRdf(shape, "text/turtle");
  expect(nextOrder([ex("email"), ex("gender"), ex("naming")], dataGraph)).toBe(4);
  expect(nextOrder([], dataGraph)).toBe(1);
});

test("deleteGroup - removes the group and every sh:group statement using it", async () => {
  const dataGraph = await parseRdf(
    `${shape}
    @prefix st: <http://shapething.com/> .
    ex:general st:color [ st:hue 17 ] .
    `,
    "text/turtle",
  );
  deleteGroup(ex("general"), dataGraph);

  expect(dataGraph.getQuads(ex("general"))).toHaveLength(0);
  expect(dataGraph.getQuads(null, sh("group"), ex("general"))).toHaveLength(0);
  // Its st:color blank node went with it.
  expect(dataGraph.getQuads(null, factory.namedNode("http://shapething.com/hue"))).toHaveLength(0);
  // What was in it is now top level; naming keeps its own contents.
  expect(summary(readTree(properties, dataGraph).items)).toEqual([
    "gender",
    "email",
    "naming",
    "  givenName",
    "  familyName",
  ]);
});

test("shapesUsingGroup - other shapes with a property in the group, or in a group nested in it", async () => {
  const dataGraph = await parseRdf(
    `${shape}
    ex:otherShape sh:property ex:nickname .
    ex:nickname sh:group ex:naming .
    ex:thirdShape sh:property ex:unrelated .
    `,
    "text/turtle",
  );
  expect(shapesUsingGroup(ex("general"), dataGraph, ex("shape")).map((s) => s.value)).toEqual([
    ex("otherShape").value,
  ]);
  expect(shapesUsingGroup(ex("unused"), dataGraph, ex("shape"))).toEqual([]);
});
