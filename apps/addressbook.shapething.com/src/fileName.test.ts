import { expect, test } from "vite-plus/test";
import { fileNameFor, freeFileName } from "./fileName.ts";

test("names a file after the person, readable and safe", () => {
  expect(fileNameFor("Ada Lovelace")).toBe("ada-lovelace");
  expect(fileNameFor("Björk Renée")).toBe("bjork-renee");
  expect(fileNameFor("Dr. Tyrell Stark Jr.")).toBe("dr-tyrell-stark-jr");
  expect(fileNameFor("Aisha O'Connell")).toBe("aisha-o-connell");
  expect(fileNameFor("  Jean-Luc   Picard ")).toBe("jean-luc-picard");
  expect(fileNameFor('a/b\\c:d*e?f"g<h>i|j')).toBe("a-b-c-d-e-f-g-h-i-j");
  expect(fileNameFor("Ǆoković")).toBe("dzokovic");
});

test("keeps letters of other scripts", () => {
  expect(fileNameFor("Лев Толстой")).toBe("лев-толстой");
  expect(fileNameFor("王小明")).toBe("王小明");
  expect(fileNameFor("अमिताभ बच्चन")).toBe("अमिताभ-बच्चन");
});

test("is empty when nothing of the name can be in a file name", () => {
  expect(fileNameFor("🙂🙂")).toBe("");
  expect(fileNameFor("--")).toBe("");
});

test("cuts a long name at a word", () => {
  const name = fileNameFor(
    "Maria Anna Sophia Cecilia Josepha Walburga Theresia Gertrudis Augusta Wilhelmina",
  );
  expect(name).toBe("maria-anna-sophia-cecilia-josepha-walburga-theresia");
  expect(name.length).toBeLessThanOrEqual(60);
});

test("numbers a name that is taken, and skips names Windows reserves", async () => {
  const taken = new Set(["ada-lovelace", "ada-lovelace-2"]);
  const isTaken = async (fileName: string) => taken.has(fileName);
  expect(await freeFileName("grace-hopper", isTaken)).toBe("grace-hopper");
  expect(await freeFileName("ada-lovelace", isTaken)).toBe("ada-lovelace-3");
  expect(await freeFileName("con", isTaken)).toBe("con-2");
  expect(await freeFileName("", isTaken)).toBe("person");
});
