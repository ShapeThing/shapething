import factory from '@rdfjs/data-model'
import type { Term } from '@rdfjs/types'

const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'

/**
 * A literal typed rdf:langString must carry a language tag. Older versions of this store (on N3 1.x)
 * wrote such literals without one as `"..."^^rdf:langString`, which N3 2.x refuses to parse. This
 * drops that datatype so the literal reads as a plain string again.
 */
export const repairLangStrings = (turtle: string) =>
  turtle.replace(
    /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')\^\^(?:rdf:langString|<http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#langString>)/g,
    '$1'
  )

/** Turns a language-less rdf:langString literal into a plain string, so it is never written out. */
export const withValidLangString = <T extends Term>(term: T): T =>
  term.termType === 'Literal' && !term.language && term.datatype.value === RDF_LANG_STRING
    ? (factory.literal(term.value) as unknown as T)
    : term
