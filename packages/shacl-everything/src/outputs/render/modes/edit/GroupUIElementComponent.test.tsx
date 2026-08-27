import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { RdfStore } from "rdf-stores";
import GroupUIElementComponent from "@/outputs/render/modes/edit/GroupUIElementComponent.tsx";
import { GroupUIElement } from "@/structure/GroupUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";
import type { GroupWidgetProps, Widgets } from "@/widgets/types.ts";

test("renders nothing when the group has no resolved widget", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:nameGroup a ex:SomeOtherType .
    `,
    "text/turtle",
  );

  const widgetRegistry: Widgets = { editors: {}, viewers: {}, groups: {} };
  const group = new GroupUIElement({
    shapesGraph,
    dataGraph: RdfStore.createDefault(),
    widgetRegistry,
    focusNode: ex("Alice"),
    node: ex("nameGroup"),
    children: [],
  });

  expect(renderToStaticMarkup(<GroupUIElementComponent group={group} />)).toBe("");
});

test("renders the resolved group widget's Component, passing the group through", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:nameGroup a ex:TestGroup .
    `,
    "text/turtle",
  );

  const StubGroupWidget = ({ group }: GroupWidgetProps) => (
    <div data-testid="stub-group-widget">{group.node.value}</div>
  );

  const widgetRegistry: Widgets = {
    editors: {},
    viewers: {},
    groups: { TestGroup: { widget: ex("TestGroup"), Component: StubGroupWidget } },
  };
  const group = new GroupUIElement({
    shapesGraph,
    dataGraph: RdfStore.createDefault(),
    widgetRegistry,
    focusNode: ex("Alice"),
    node: ex("nameGroup"),
    children: [],
  });

  const html = renderToStaticMarkup(<GroupUIElementComponent group={group} />);
  expect(html).toContain('data-testid="stub-group-widget"');
  expect(html).toContain(ex("nameGroup").value);
});
