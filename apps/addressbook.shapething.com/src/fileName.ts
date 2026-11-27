// A person's file is named after them when they're added: Ada Lovelace is contacts/ada-lovelace.ttl.
// The name is also part of their IRI, so it stays the same when they are renamed later.

// Names Windows keeps for devices, with or without an extension: con.ttl can't be a file there.
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;

const MAX_LENGTH = 60;

/**
 * The file name (without .ttl) for a person's name: lowercase, accents dropped (Björk is bjork),
 * words joined by hyphens. Letters of any script stay, so a name in Cyrillic or Chinese stays
 * readable too. Empty when nothing of the name is left, such as for a name of only emoji.
 */
export function fileNameFor(name: string): string {
  const slug = name
    .normalize("NFKD")
    // Accents on Latin letters, split off by NFKD. In other scripts a mark is part of the letter
    // (the breve of й, the vowel signs of Devanagari), so it stays.
    .replace(/(?<=\p{Script=Latin})\p{M}+/gu, "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= MAX_LENGTH) return slug;
  // Long names are cut at a word, when there is one in reach.
  const cut = slug.slice(0, MAX_LENGTH);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > MAX_LENGTH / 2 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "");
}

/**
 * The first of name, name-2, name-3, ... that isn't taken, for a file name from fileNameFor.
 * `isTaken` says whether a file of that name is already there.
 */
export async function freeFileName(
  base: string,
  isTaken: (fileName: string) => Promise<boolean>,
): Promise<string> {
  const start = base || "person";
  for (let number = 1; ; number++) {
    const candidate = number === 1 ? start : `${start}-${number}`;
    if (!RESERVED.test(candidate) && !(await isTaken(candidate))) return candidate;
  }
}
