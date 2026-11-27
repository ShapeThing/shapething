import { expect, test } from "vite-plus/test";
import { parseVCards } from "./vcard.ts";

test("reads a version 2.1 export as Android writes it, quoted-printable and soft line breaks", () => {
  const file = [
    "BEGIN:VCARD",
    "VERSION:2.1",
    "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Ren=C3=A9e;Bj=C3=B6rk;;;",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Bj=C3=B6rk Ren=C3=A9e",
    "TEL;CELL:+31 6 12345678",
    "TEL;HOME:020-1234567",
    "TEL;WORK;FAX:020-7654321",
    "EMAIL;HOME:bjork@example.org",
    "ADR;HOME;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;;Keizersgracht 1;Amsterdam;;1015 AA;Nederland",
    "ORG:Sugarcubes",
    "TITLE:Singer",
    "BDAY:1965-11-21",
    "NOTE;ENCODING=QUOTED-PRINTABLE:Met at the=0Aconcert",
    "CATEGORIES:Music,Book club\\, Tuesdays",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:2.1",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C3=89lodie=20Fran=C3=A7oise=20de=20la=20Fontaine=20=",
    "Dupont",
    "EMAIL;INTERNET;QUOTED-PRINTABLE:elodie=40example.org",
    "END:VCARD",
  ].join("\r\n");

  const [bjork, elodie] = parseVCards(file);
  expect(bjork).toMatchObject({
    name: "Björk Renée",
    givenName: "Björk",
    familyName: "Renée",
    emails: ["bjork@example.org"],
    telephones: ["+31 6 12345678", "020-1234567"],
    faxNumbers: ["020-7654321"],
    addresses: [
      {
        street: "Keizersgracht 1",
        locality: "Amsterdam",
        postalCode: "1015 AA",
        country: "Nederland",
      },
    ],
    organizations: ["Sugarcubes"],
    jobTitles: ["Singer"],
    birthDate: "1965-11-21",
    notes: ["Met at the\nconcert"],
    tags: ["Music", "Book club, Tuesdays"],
  });
  expect(elodie).toMatchObject({
    name: "Élodie Françoise de la Fontaine Dupont",
    emails: ["elodie@example.org"],
  });
});

test("reads version 3.0: folded lines, escaped text, grouped properties, the name's parts", () => {
  const file = [
    "﻿BEGIN:VCARD",
    "VERSION:3.0",
    "N:Doe;John;Quincy,Q.;Dr.;Jr.",
    "FN:John Doe\\, Jr.",
    "NICKNAME:Johnny,JD",
    "EMAIL;TYPE=INTERNET,WORK:john@",
    " example.com",
    "item1.TEL;TYPE=CELL:+1 555",
    "\t0100",
    "item2.ADR;TYPE=WORK:PO Box 12;Suite 3;1 Main St\\, Building B;Springfield;IL;62701;USA",
    "ORG:Acme\\, Inc.;Research",
    "URL:www.example.com/john",
    "BDAY:19700101",
    "END:VCARD",
  ].join("\n");

  expect(parseVCards(file)[0]).toMatchObject({
    name: "John Doe, Jr.",
    familyName: "Doe",
    givenName: "John",
    additionalName: "Quincy Q.",
    honorificPrefix: "Dr.",
    honorificSuffix: "Jr.",
    nicknames: ["Johnny", "JD"],
    emails: ["john@example.com"],
    telephones: ["+1 5550100"],
    addresses: [
      {
        postOfficeBox: "PO Box 12",
        street: "1 Main St, Building B, Suite 3",
        locality: "Springfield",
        region: "IL",
        postalCode: "62701",
        country: "USA",
      },
    ],
    organizations: ["Acme, Inc."],
    urls: ["https://www.example.com/john"],
    birthDate: "1970-01-01",
  });
});

test("reads version 4.0, with a number as a tel: URI and quoted parameters", () => {
  const file = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    "FN:Ada Lovelace",
    'TEL;VALUE=uri;TYPE="voice,cell":tel:+44-20-1234-5678',
    'TEL;VALUE=uri;TYPE="fax,work":tel:+44-20-1234-5679',
    "EMAIL;PREF=1:ada@example.org",
    "URL:https://example.org/ada",
    "BDAY:--1210",
    "END:VCARD",
  ].join("\r\n");

  expect(parseVCards(file)[0]).toMatchObject({
    name: "Ada Lovelace",
    telephones: ["+44-20-1234-5678"],
    faxNumbers: ["+44-20-1234-5679"],
    emails: ["ada@example.org"],
    urls: ["https://example.org/ada"],
  });
  // A birthday without a year has no place in the contact shape.
  expect(parseVCards(file)[0].birthDate).toBeUndefined();
});

test("birthdays with a year are kept, those without one or that aren't dates are not", () => {
  const card = (bday: string) =>
    parseVCards(["BEGIN:VCARD", "VERSION:3.0", "FN:X", bday, "END:VCARD"].join("\r\n"))[0]
      .birthDate;
  expect(card("BDAY:1985-04-12T00:00:00Z")).toBe("1985-04-12");
  expect(card("BDAY:19850412")).toBe("1985-04-12");
  expect(card("BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-14")).toBeUndefined();
  expect(card("BDAY:--0314")).toBeUndefined();
  expect(card("BDAY;VALUE=text:circa 1800")).toBeUndefined();
  expect(card("BDAY:1985-13-40")).toBeUndefined();
});

test("keeps only web addresses that are one", () => {
  const urls = (url: string) =>
    parseVCards(["BEGIN:VCARD", "VERSION:3.0", "FN:X", url, "END:VCARD"].join("\r\n"))[0].urls;
  expect(urls("URL:http://example.org")).toEqual(["http://example.org"]);
  expect(urls("URL:example.org")).toEqual(["https://example.org"]);
  expect(urls("URL:not a website")).toEqual([]);
});

test("makes the name from N when a card has no FN, and keeps a card without any name nameless", () => {
  const file = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Turing;Alan;Mathison;;OBE",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:3.0",
    "TEL:112",
    "END:VCARD",
  ].join("\r\n");

  const [alan, nameless] = parseVCards(file);
  expect(alan.name).toBe("Alan Mathison Turing OBE");
  expect(nameless.name).toBeUndefined();
  expect(nameless.telephones).toEqual(["112"]);
});

test("leaves out a card inside a card, and anything outside the cards", () => {
  const file = [
    "Some text before the card",
    "BEGIN:VCARD",
    "VERSION:2.1",
    "FN:Boss",
    "AGENT:",
    "BEGIN:VCARD",
    "VERSION:2.1",
    "FN:Assistant",
    "TEL:555",
    "END:VCARD",
    "EMAIL:boss@example.org",
    "END:VCARD",
  ].join("\r\n");

  const contacts = parseVCards(file);
  expect(contacts).toHaveLength(1);
  expect(contacts[0]).toMatchObject({ name: "Boss", emails: ["boss@example.org"], telephones: [] });
});

test("a file without cards has no contacts", () => {
  expect(parseVCards("")).toEqual([]);
  expect(parseVCards("not a vcard")).toEqual([]);
});
