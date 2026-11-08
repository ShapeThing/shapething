import { expect, test } from "vite-plus/test";
import { coverUrl, recordUrl, searchUrl } from "./openLibrary.ts";

test("a work and an edition ID have a record with covers, an author ID has not", () => {
  expect(recordUrl("OL71164W")).toBe("https://openlibrary.org/works/OL71164W.json");
  expect(recordUrl("OL7173547M")).toBe("https://openlibrary.org/books/OL7173547M.json");
  expect(recordUrl("OL31574A")).toBeUndefined();
  expect(recordUrl("nonsense")).toBeUndefined();
});

test("the search has the title and the author", () => {
  const url = new URL(searchUrl("The Pilgrim's Regress", "C. S. Lewis"));
  expect(url.searchParams.get("title")).toBe("The Pilgrim's Regress");
  expect(url.searchParams.get("author")).toBe("C. S. Lewis");
});

test("a cover ID is the large cover image", () => {
  expect(coverUrl(6934110)).toBe("https://covers.openlibrary.org/b/id/6934110-L.jpg");
});
