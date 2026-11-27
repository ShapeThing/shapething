import { DataFactory } from "n3";
import { expect, test } from "vite-plus/test";
import { findDuplicates, nameKey, telephoneKey, type DuplicateRow } from "./duplicates.ts";

const { namedNode, literal } = DataFactory;

const rows = (id: string, values: { name?: string; email?: string; telephone?: string }[]) =>
  values.map(({ name, email, telephone }): DuplicateRow => ({
    graph: namedNode(`file:///book/contacts/${id}`),
    contact: namedNode(`file:///book/contacts/${id}`),
    name: name ? literal(name) : undefined,
    email: email ? literal(email) : undefined,
    telephone: telephone ? literal(telephone) : undefined,
  }));

const ids = (groups: ReturnType<typeof findDuplicates>) =>
  groups.map(({ people }) => people.map(({ graph }) => graph.value.split("/").pop()));

test("a name is the same name whatever its case, accents and order", () => {
  expect(nameKey("Doe, John")).toBe(nameKey("john dóe"));
  expect(nameKey("Jo Doe")).not.toBe(nameKey("John Doe"));
});

test("a phone number is the same number with or without its country code", () => {
  expect(telephoneKey("+31 6 12345678")).toBe(telephoneKey("06-12345678"));
  expect(telephoneKey("0031612345678")).toBe(telephoneKey("06 1234 5678"));
  expect(telephoneKey("112")).toBeUndefined();
});

test("groups people by name, email address or phone number, joined through each other", () => {
  const groups = findDuplicates([
    ...rows("a", [{ name: "Ada Lovelace", email: "ada@example.org" }]),
    ...rows("b", [{ name: "Lovelace, Ada" }]),
    ...rows("c", [{ name: "Countess", email: "ADA@example.org", telephone: "+44 20 1234 5678" }]),
    ...rows("d", [{ name: "Someone", telephone: "020 1234 5678" }]),
    ...rows("e", [{ name: "Charles Babbage", telephone: "112" }]),
    ...rows("f", [{ name: "Someone else", telephone: "112" }]),
  ]);
  // c has the most to say, so the others are merged into them; b, with nothing but a name, last.
  expect(ids(groups)).toEqual([["c", "a", "d", "b"]]);
  expect(groups[0].reasons).toEqual([
    "The same name, Ada Lovelace",
    "The same email address, ada@example.org",
    "The same phone number, +44 20 1234 5678",
  ]);
  expect(groups[0].key).toBe(
    ["a", "b", "c", "d"].map((id) => `file:///book/contacts/${id}`).join(" "),
  );
});

test("one person with a name and two addresses is no one's duplicate", () => {
  expect(
    findDuplicates(
      rows("a", [
        { name: "Ada", email: "a@x.org" },
        { name: "Ada", email: "b@x.org" },
      ]),
    ),
  ).toEqual([]);
});
