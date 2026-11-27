import { DataFactory, Store } from "n3";
import { expect, test } from "vite-plus/test";
import { importSummary, personQuads, planImport } from "./importPeople.ts";

const { namedNode } = DataFactory;
const schema = (name: string) => namedNode(`https://schema.org/${name}`);

test("cleans up a picked contact: trimmed, no doubles, no empty values", () => {
  const plan = planImport(
    [
      {
        name: " Grace Hopper ",
        givenName: " Grace",
        familyName: "",
        emails: ["grace@navy.example", " grace@navy.example", ""],
        telephones: ["+1 555 0100"],
        addresses: [{ street: " ", locality: "" }, { locality: " Arlington " }],
      },
      { name: "Alan Turing" },
    ],
    [],
  );
  expect(plan.people[0]).toMatchObject({
    name: "Grace Hopper",
    givenName: "Grace",
    familyName: undefined,
    emails: ["grace@navy.example"],
    telephones: ["+1 555 0100"],
    addresses: [{ locality: "Arlington" }],
  });
  expect(plan.people[1].name).toBe("Alan Turing");
  expect(importSummary(plan)).toBe("Added 2 people.");
});

test("leaves out who is already in the book, added twice, or has no name", () => {
  const plan = planImport(
    [
      { name: "ada lovelace" },
      { name: "Charles Babbage" },
      { name: "Charles Babbage", emails: ["second@example.org"] },
      { emails: ["nameless@example.org"] },
      { name: "  " },
    ],
    ["Ada Lovelace"],
  );
  expect(plan.people.map(({ name }) => name)).toEqual(["Charles Babbage"]);
  expect(plan.existing).toEqual(["ada lovelace", "Charles Babbage"]);
  expect(plan.unnamed).toBe(2);
  expect(importSummary(plan)).toBe(
    "Added 1 person. 2 were already in the book. 2 people without a name were skipped.",
  );
});

test("says when no one was added", () => {
  expect(importSummary(planImport([{ name: "Ada" }], ["Ada"]))).toBe(
    "No one was added. Ada is already in the book.",
  );
});

test("writes a person with the properties of the contact shape", () => {
  const ada = namedNode("file:///book/contacts/ada-lovelace");
  const [person] = planImport(
    [
      {
        name: "Ada Lovelace",
        givenName: "Ada",
        familyName: "Lovelace",
        honorificPrefix: "Countess",
        nicknames: ["Enchantress of Numbers"],
        emails: ["ada@example.org"],
        telephones: ["+44 20 1234 5678"],
        faxNumbers: ["+44 20 1234 5679"],
        urls: ["https://example.org/ada"],
        addresses: [{ street: "12 St James's Square", locality: "London", country: "UK" }],
        organizations: ["Analytical Engine Ltd"],
        jobTitles: ["Mathematician"],
        birthDate: "1815-12-10",
        notes: ["Wrote the first program."],
        tags: ["Family", " Family ", "Mathematics"],
      },
    ],
    [],
  ).people;
  const store = new Store(personQuads(ada, person));
  const value = (subject: Parameters<Store["getObjects"]>[0], property: string) =>
    store.getObjects(subject, schema(property), null).map((term) => term.value);

  expect(
    store.getObjects(ada, namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), null),
  ).toEqual([schema("Person")]);
  expect(value(ada, "name")).toEqual(["Ada Lovelace"]);
  expect(value(ada, "honorificPrefix")).toEqual(["Countess"]);
  expect(value(ada, "alternateName")).toEqual(["Enchantress of Numbers"]);
  expect(value(ada, "faxNumber")).toEqual(["+44 20 1234 5679"]);
  expect(store.getObjects(ada, schema("url"), null)[0].termType).toBe("NamedNode");
  expect(value(ada, "jobTitle")).toEqual(["Mathematician"]);
  expect(value(ada, "description")).toEqual(["Wrote the first program."]);
  expect(value(ada, "keywords")).toEqual(["Family", "Mathematics"]);

  const [birthDate] = store.getObjects(ada, schema("birthDate"), null);
  expect(birthDate.value).toBe("1815-12-10");
  expect(birthDate.termType === "Literal" && birthDate.datatype.value).toBe(
    "http://www.w3.org/2001/XMLSchema#date",
  );

  const [address] = store.getObjects(ada, schema("address"), null);
  expect(address.termType).toBe("BlankNode");
  expect(value(address, "streetAddress")).toEqual(["12 St James's Square"]);
  expect(value(address, "addressLocality")).toEqual(["London"]);
  expect(value(address, "addressCountry")).toEqual(["UK"]);
  expect(value(address, "postalCode")).toEqual([]);

  const [organization] = store.getObjects(ada, schema("worksFor"), null);
  expect(value(organization, "name")).toEqual(["Analytical Engine Ltd"]);
});
