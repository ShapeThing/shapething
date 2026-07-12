import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { Loading, Minus, Plus } from "@/helpers/icons.tsx";

test("Loading - renders as an svg icon", () => {
  const html = renderToStaticMarkup(<Loading />);
  expect(html).toContain("<svg");
});

test("Loading - forwards props onto the underlying svg", () => {
  const html = renderToStaticMarkup(<Loading className="spinner" aria-hidden="true" />);
  expect(html).toContain('class="spinner"');
  expect(html).toContain('aria-hidden="true"');
});

test("Plus - renders as an svg icon", () => {
  const html = renderToStaticMarkup(<Plus />);
  expect(html).toContain("<svg");
});

test("Plus - forwards props onto the underlying svg", () => {
  const html = renderToStaticMarkup(<Plus className="add-icon" aria-hidden="true" />);
  expect(html).toContain('class="add-icon"');
  expect(html).toContain('aria-hidden="true"');
});

test("Minus - renders as an svg icon", () => {
  const html = renderToStaticMarkup(<Minus />);
  expect(html).toContain("<svg");
});

test("Minus - forwards props onto the underlying svg", () => {
  const html = renderToStaticMarkup(<Minus className="remove-icon" aria-hidden="true" />);
  expect(html).toContain('class="remove-icon"');
  expect(html).toContain('aria-hidden="true"');
});
