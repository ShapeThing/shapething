import type { Literal, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { formatYear, yearOf } from "@/helpers/formatYear.ts";
import language from "@/resolution/language.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

export type ComposeAlternativesOptions = {
  // The branches of the sh:alternativePath, in list order: branch n is placeholder {n}.
  branches: PropertyPath[];
  // The node every branch is walked from.
  term: Term;
  dataGraph: RdfStore;
  // Ranked content languages: which language of a branch's literals is used.
  languages: LanguageRange[];
  // The locale a branch with several values is joined in ("a, b and c"), see Intl.ListFormat;
  // "en" when undefined.
  locale: string | undefined;
  // st:mergeTemplate, if any.
  template: string | undefined;
  // The text for a resource value, e.g. its own label (see resolution/label.ts).
  labelOf: (resource: Term) => string;
};

/**
 * st:mergeAlternatives: the text composed from every branch of an sh:alternativePath, instead of
 * sh:alternativePath's own meaning (the values of whichever branches have them). Undefined when
 * the composition is empty.
 *
 * Every value of a branch counts: its literals in the best-matching language (all of them, when
 * several share that language) and its resources as `labelOf` gives them. Several values are
 * joined as a list in `locale` ("theologian, philosopher and poet").
 *
 * Without st:mergeTemplate the branches that have a value are joined with a space. With one, the
 * template says where each goes - see renderTemplate.
 */
export function composeAlternatives(options: ComposeAlternativesOptions): string | undefined {
  const { branches, template } = options;
  const valuesOf = (index: number) => {
    const branch = branches[index];
    return branch ? branchValues(branch, options) : [];
  };
  const textOf = (index: number, modifier?: string) =>
    joinList(
      dedupe(valuesOf(index).map((value) => formatValue(value, modifier, options.labelOf))),
      options.locale,
    );

  const composed =
    template === undefined
      ? branches
          .map((_, index) => textOf(index))
          .filter(Boolean)
          .join(" ")
      : renderTemplate(template, textOf);

  return composed || undefined;
}

/**
 * Fills in st:mergeTemplate:
 * - `{n}` is the text of branch n (counting from 0),
 * - `{n:year}` the same, with xsd date literals as their year ("1813", "384 BCE"),
 * - `[ … ]` is an optional section, left out unless at least one placeholder inside it has text:
 *   "{0}[ ({1:year}–{2:year})]" gives "Søren Kierkegaard (1813–1855)", "Søren Kierkegaard (1950–)",
 *   or just "Søren Kierkegaard" without any dates.
 *
 * Sections do not nest. Whitespace runs collapse to one space and the result is trimmed, so an
 * empty placeholder leaves no stray gap.
 */
export function renderTemplate(
  template: string,
  textOf: (index: number, modifier?: string) => string,
): string {
  const fill = (text: string): { text: string; filled: boolean } => {
    let filled = false;
    const result = text.replace(
      /\{(\d+)(?::([\w-]+))?\}/g,
      (_, index: string, modifier?: string) => {
        const value = textOf(Number(index), modifier);
        if (value) filled = true;
        return value;
      },
    );
    return { text: result, filled };
  };

  const withSections = template.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const { text, filled } = fill(inner);
    return filled ? text : "";
  });

  return fill(withSections).text.replace(/\s+/g, " ").trim();
}

/** A branch's values: its literals in the best language, and its resources. */
function branchValues(
  branch: PropertyPath,
  { term, dataGraph, languages }: ComposeAlternativesOptions,
): Term[] {
  const values = walkPropertyPath(branch, term, dataGraph);
  const literals = values.filter((value): value is Literal => value.termType === "Literal");
  const resources = values.filter((value) => value.termType !== "Literal");
  const best = literals.length > 0 ? language(literals, languages) : undefined;
  const bestLiterals = best ? literals.filter((literal) => literal.language === best.language) : [];
  return [...bestLiterals, ...resources];
}

function formatValue(value: Term, modifier: string | undefined, labelOf: (term: Term) => string) {
  if (value.termType !== "Literal") return labelOf(value);
  if (modifier === "year") {
    const year = yearOf(value);
    if (year !== undefined) return formatYear(year);
  }
  return value.value;
}

function dedupe(texts: string[]): string[] {
  return [...new Set(texts.filter(Boolean))];
}

function joinList(texts: string[], locale: string | undefined): string {
  if (texts.length < 2) return texts[0] ?? "";
  return listFormat(locale).format(texts);
}

function listFormat(locale: string | undefined): Intl.ListFormat {
  // Never the runtime's own locale: the same data and shapes compose the same text everywhere.
  try {
    return new Intl.ListFormat(locale || "en", { type: "conjunction" });
  } catch {
    // Not a valid BCP 47 tag (e.g. "*" from a language preference).
    return new Intl.ListFormat("en", { type: "conjunction" });
  }
}
