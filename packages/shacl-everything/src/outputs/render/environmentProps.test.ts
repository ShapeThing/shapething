import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { identityKey, pickLiveProps } from "@/outputs/render/environmentProps.ts";
import { defaultEnvironment } from "@/environment.ts";

const node = (value: string) => factory.namedNode(`http://example.org/${value}`);

test("identityKey is structural for terms, arrays and plain objects", () => {
  const a = identityKey({ focusNode: node("a"), nodeShapes: [node("s")], widgets: { x: 1 } });
  const b = identityKey({ focusNode: node("a"), nodeShapes: [node("s")], widgets: { x: 1 } });
  expect(a).toBe(b);
  expect(identityKey({ focusNode: node("b"), nodeShapes: [node("s")] })).not.toBe(
    identityKey({ focusNode: node("a"), nodeShapes: [node("s")] }),
  );
});

test("identityKey compares stores by identity", () => {
  const store = RdfStore.createDefault();
  expect(identityKey({ dataGraph: store })).toBe(identityKey({ dataGraph: store }));
  expect(identityKey({ dataGraph: store })).not.toBe(
    identityKey({ dataGraph: RdfStore.createDefault() }),
  );
});

test("identityKey ignores live props and treats every function as equal", () => {
  const base = { focusNode: node("a") };
  expect(identityKey({ ...base, onSubmit: () => {}, enableWidgetSwitching: false })).toBe(
    identityKey({ ...base, onSubmit: () => {}, enableWidgetSwitching: true }),
  );
  expect(identityKey({ ...base, interfaceLocales: { "de-DE": () => Promise.resolve("") } })).toBe(
    identityKey({ ...base, interfaceLocales: { "de-DE": () => Promise.resolve("") } }),
  );
  expect(identityKey({ ...base, mode: "edit" })).not.toBe(identityKey({ ...base, mode: "view" }));
});

test("pickLiveProps falls back to defaults for absent props and leaves onSubmit out", () => {
  const live = pickLiveProps({ enableWidgetSwitching: false, onSubmit: () => {} });
  expect(live.enableWidgetSwitching).toBe(false);
  expect(live.enableUndoRedo).toBe(defaultEnvironment.enableUndoRedo);
  expect("onSubmit" in live).toBe(false);
});
