import { expect, test } from "vite-plus/test";
import { resizedImageUrl } from "@/helpers/resizedImageUrl.ts";

const size = { width: 1200, height: 600 };

test("resizes a remote image through wsrv.nl without enlarging it", () => {
  expect(resizedImageUrl("https://example.org/photos/chef.jpg?v=2", size)).toBe(
    "https://wsrv.nl/?url=https%3A%2F%2Fexample.org%2Fphotos%2Fchef.jpg%3Fv%3D2&w=1200&h=600&fit=inside&we=",
  );
});

test("keeps images wsrv.nl can not fetch or would not improve", () => {
  for (const url of [
    "data:image/png;base64,AAAA",
    "blob:https://example.org/1234",
    "http://localhost:6006/hendrik.jpg",
    "http://192.168.1.10/photo.jpg",
    "https://example.org/logo.SVG",
    "https://wsrv.nl/?url=example.org/a.jpg",
    "not a url",
  ]) {
    expect(resizedImageUrl(url, size)).toBe(url);
  }
});

test("resizes to a width alone when no height is given", () => {
  expect(resizedImageUrl("https://example.org/photos/chef.jpg", { width: 240 })).toBe(
    "https://wsrv.nl/?url=https%3A%2F%2Fexample.org%2Fphotos%2Fchef.jpg&w=240&fit=inside&we=",
  );
});

test("asks Wikimedia Commons for its nearest standard thumbnail width that is at least as wide", () => {
  const commons = "http://commons.wikimedia.org/wiki/Special:FilePath/Ada%20Lovelace.jpg";
  expect(resizedImageUrl(commons, { width: 112 })).toBe(
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ada%20Lovelace.jpg?width=120",
  );
  expect(resizedImageUrl(`${commons}?width=50`, { width: 400 })).toBe(
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ada%20Lovelace.jpg?width=500",
  );
  expect(resizedImageUrl(commons, { width: 5000 })).toBe(
    "https://commons.wikimedia.org/wiki/Special:FilePath/Ada%20Lovelace.jpg?width=1920",
  );
});
