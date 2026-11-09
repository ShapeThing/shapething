import type { Term } from "@rdfjs/types";
import { resolveRdfSource } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { describe, expect, test } from "vite-plus/test";
import { factory, inf, rdf, rdfs, sh, shui, st, wd, wdt } from "../rdf/namespaces.ts";
import { compileRoles, targetClasses } from "./compile.ts";

const TURTLE = `
@prefix inf: <https://influence.shapething.com/ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix shui: <http://www.w3.org/ns/shacl-ui/> .
@prefix wd: <http://www.wikidata.org/entity/> .
@prefix wdt: <http://www.wikidata.org/prop/direct/> .

inf:PersonModel a inf:EntityModel ; sh:targetClass wd:Q5 ;
  sh:property [ sh:path rdfs:label ; shui:propertyRole shui:LabelRole ] ;
  sh:property [ sh:path wdt:P569 ; shui:propertyRole inf:StartRole ] .
inf:BandModel a inf:EntityModel ; sh:targetClass wd:Q215380 ;
  sh:property [ sh:path rdfs:label ; shui:propertyRole shui:LabelRole ] ;
  sh:property [ sh:path [ sh:alternativePath ( wdt:P571 wdt:P580 ) ] ; shui:propertyRole inf:StartRole ] .

inf:Teaser sh:property inf:name, inf:start, inf:fixed .
inf:name shui:propertyRole shui:LabelRole .
inf:start shui:propertyRole inf:StartRole .
inf:fixed sh:path rdfs:comment ; shui:propertyRole shui:LabelRole .
inf:list sh:path inf:item ; inf:orderByRole inf:StartRole .
`;

const parse = () => resolveRdfSource(TURTLE, new Map(), undefined);

const object = (store: RdfStore, subject: Term, predicate: Term) =>
  store.getQuads(subject, predicate)[0]?.object;

const list = (store: RdfStore, node: Term | undefined): Term[] => {
  const items: Term[] = [];
  while (node && !node.equals(rdf("nil"))) {
    items.push(object(store, node, rdf("first"))!);
    node = object(store, node, rdf("rest"));
  }
  return items;
};

/** The path of a property: a plain one as it is, an alternative path as its branches. */
const branches = (store: RdfStore, path: Term | undefined) => {
  const alternatives = path && object(store, path, sh("alternativePath"));
  return (alternatives ? list(store, alternatives) : [path]).map((term) => term?.value);
};

describe("compileRoles", () => {
  test("a role shared by every model is one path", async () => {
    const store = await parse();
    compileRoles(store);
    expect(branches(store, object(store, inf("name"), sh("path")))).toEqual([rdfs("label").value]);
  });

  test("a role becomes the alternatives of every model, flattened, in model order", async () => {
    const store = await parse();
    compileRoles(store);
    expect(branches(store, object(store, inf("start"), sh("path")))).toEqual([
      wdt("P569").value,
      wdt("P571").value,
      wdt("P580").value,
    ]);
  });

  test("a property shape with a path of its own keeps it", async () => {
    const store = await parse();
    compileRoles(store);
    expect(store.getQuads(inf("fixed"), sh("path")).map((quad) => quad.object.value)).toEqual([
      rdfs("comment").value,
    ]);
  });

  test("inf:orderByRole becomes st:orderBy", async () => {
    const store = await parse();
    compileRoles(store);
    expect(branches(store, object(store, inf("list"), st("orderBy")))).toHaveLength(3);
  });

  test("a role no model has is an error", async () => {
    const store = await parse();
    store.addQuad(factory.quad(inf("orphan"), shui("propertyRole"), inf("EndRole")));
    expect(() => compileRoles(store)).toThrow(/EndRole/);
  });
});

test("a shape that is not an entity model gives no role paths", async () => {
  const store = await parse();
  store.addQuad(factory.quad(inf("Other"), sh("property"), inf("otherName")));
  store.addQuad(factory.quad(inf("otherName"), sh("path"), rdfs("comment")));
  store.addQuad(factory.quad(inf("otherName"), shui("propertyRole"), shui("LabelRole")));
  compileRoles(store);
  expect(branches(store, object(store, inf("name"), sh("path")))).toEqual([rdfs("label").value]);
});

test("targetClasses", async () => {
  expect(targetClasses(await parse()).map((term) => term.value)).toEqual([
    wd("Q5").value,
    wd("Q215380").value,
  ]);
});
