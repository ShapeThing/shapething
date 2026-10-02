import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";
import {
  isTabbedPropertyGroup,
  tabbedGroupPanelId,
  tabbedGroupTabId,
} from "@/structure/tabbedGroups.ts";

test("isTabbedPropertyGroup is true only for a node typed st:TabbedPropertyGroup", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix st: <http://shapething.com/> .

        ex:step a sh:PropertyGroup, st:TabbedPropertyGroup .
        ex:plainGroup a sh:PropertyGroup .
    `,
    "text/turtle",
  );

  expect(isTabbedPropertyGroup(ex("step"), shapesGraph)).toBe(true);
  expect(isTabbedPropertyGroup(ex("plainGroup"), shapesGraph)).toBe(false);
});

test("tab/panel ids are stable and distinct per node", () => {
  const stepOneTabId = tabbedGroupTabId(ex("step1"));
  const stepTwoTabId = tabbedGroupTabId(ex("step2"));
  expect(stepOneTabId).not.toEqual(stepTwoTabId);
  expect(tabbedGroupTabId(ex("step1"))).toEqual(stepOneTabId);
  expect(tabbedGroupPanelId(ex("step1"))).not.toEqual(stepOneTabId);
});
