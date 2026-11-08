import { expect, test } from "vite-plus/test";
import { frontCoverUrl, releaseGroupUrl } from "./coverArtArchive.ts";

test("an album is looked up by its release group", () => {
  expect(releaseGroupUrl("9162580e-5df4-32de-80cc-f45a8d8a9b1d")).toBe(
    "https://coverartarchive.org/release-group/9162580e-5df4-32de-80cc-f45a8d8a9b1d",
  );
});

test("the front cover at 500px, over https, also from an older listing", () => {
  expect(
    frontCoverUrl([
      { front: false, thumbnails: { "500": "http://coverartarchive.org/back-500.jpg" } },
      { front: true, thumbnails: { "500": "http://coverartarchive.org/front-500.jpg" } },
    ]),
  ).toBe("https://coverartarchive.org/front-500.jpg");
  expect(
    frontCoverUrl([
      { front: true, thumbnails: { large: "http://coverartarchive.org/front-l.jpg" } },
    ]),
  ).toBe("https://coverartarchive.org/front-l.jpg");
});

test("without a front cover there is none", () => {
  expect(frontCoverUrl([{ front: false, image: "http://coverartarchive.org/back.jpg" }])).toBe(
    undefined,
  );
  expect(frontCoverUrl([])).toBe(undefined);
});
