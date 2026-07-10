import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { Loading } from "@/helpers/icons.tsx";

test("Loading - renders as an svg icon", () => {
  const html = renderToStaticMarkup(<Loading />);
  expect(html).toContain("<svg");
});

test("Loading - forwards props onto the underlying svg", () => {
  const html = renderToStaticMarkup(<Loading className="spinner" aria-hidden="true" />);
  expect(html).toContain('class="spinner"');
  expect(html).toContain('aria-hidden="true"');
});
