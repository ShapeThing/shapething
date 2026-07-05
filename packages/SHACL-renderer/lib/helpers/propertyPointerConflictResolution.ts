
import factory from '@rdfjs/data-model';
import datasetFactory from '@rdfjs/dataset';
import TermMap from "@rdfjs/term-map";
import TermSet from "@rdfjs/term-set";
import type { Literal, Term } from '@rdfjs/types';
import grapoi from 'grapoi';
import { fromRdf } from 'rdf-literal';
import { rdfs, sh, xsd } from '../core/namespaces';
import Grapoi from "../Grapoi";
import { sortShaclItems } from './sortShaclItems';

export type ConflictFreeGrapoi = Grapoi & { ConflictFreeGrapoi: 'Returns one term where multiple terms exist' }

export default function resolvePropertyPointerConflicts(property: Grapoi): ConflictFreeGrapoi {
    return new Proxy(property, {
        get(target, prop, receiver) {
            if (prop === 'out') {
                return (predicateArgument: Term | Term[], objectArgument?: Term | Term[]) => {
                    const predicates = Array.isArray(predicateArgument) ? predicateArgument : [predicateArgument]
                    const pointers = property.terms.map(term => property.node(term))
                    // We sort the properties by their sh:order value, 
                    // so that we can resolve conflicts in a stable manner.
                    const sortedPointers = pointers.sort(sortShaclItems)

                    const returnPointers: Grapoi[] = []

                    for (const predicate of predicates) {
                        const resolutionFunction = resolutions.get(predicate)
                        let predicatePointers: Grapoi[] = sortedPointers.map(pointer => pointer.out(predicate, objectArgument))
                        if (resolutionFunction) {
                            predicatePointers = [resolutionFunction(predicatePointers, property, predicate)]
                        }
                        returnPointers.push(...predicatePointers)
                    }

                    // Some resolution functions (e.g. keepAllListItems) build their result in a
                    // throwaway dataset instead of mutating the shapes graph. property.node() would
                    // rebind the returned terms to property's own dataset and lose that list's
                    // rdf:first/rdf:rest triples, so we carry the pointers over as-is.
                    return property.clone({ ptrs: returnPointers.flatMap(pointer => pointer.ptrs) })
                }
            }

            return Reflect.get(target, prop, receiver)
        }
    }) as ConflictFreeGrapoi
}

type ResolutionFunction = (pointers: Grapoi[], property: Grapoi, predicate: Term) => Grapoi

const getListItemsOrTermFromPointers = (pointers: Grapoi[], combinationsMapping?: TermMap<Term, TermSet>): TermSet[] => {
    return pointers.map(pointer => {
        if (pointer.isList()) {
            return new TermSet([...pointer.list()].map(pointer => pointer.terms).flat().filter(Boolean))
        }
        else {
            return new TermSet([pointer.term].filter(Boolean))
        }
    }).filter(termSet => termSet.size > 0).map(termSet => {
        if (!combinationsMapping) return termSet

        const expandedTerms = new TermSet<Term>()
        for (const term of termSet) {
            const combination = combinationsMapping.get(term)
            if (combination) {
                for (const expandedTerm of combination) {
                    expandedTerms.add(expandedTerm)
                }
            }
            else {
                expandedTerms.add(term)
            }
        }
        return expandedTerms
    })
}

const keepHighestLiteral = (pointers: Grapoi[]) => {
    return pointers.reduce((highest, pointer) => fromRdf(pointer.term as Literal) > fromRdf(highest.term as Literal) ? pointer : highest)
}

const keepLowestLiteral = (pointers: Grapoi[]) => {
    return pointers.reduce((lowest, pointer) => fromRdf(pointer.term as Literal) < fromRdf(lowest.term as Literal) ? pointer : lowest)
}

const keepHighestInteger = (pointers: Grapoi[], property: Grapoi) => {
    const integers = pointers.map(pointer => parseInt(pointer.value))
    const highestInteger = Math.max(...integers)
    return property.node(factory.literal(highestInteger.toString(), xsd('integer')))
}

const keepLowestInteger = (pointers: Grapoi[], property: Grapoi) => {
    const integers = pointers.map(pointer => parseInt(pointer.value))
    const lowestInteger = Math.min(...integers)
    return property.node(factory.literal(lowestInteger.toString(), xsd('integer')))
}

const keepFirst = (pointers: Grapoi[], property: Grapoi) => {
    return pointers?.[0] ?? property.node()
}

const keepAll = (pointers: Grapoi[], property: Grapoi) => {
    const terms = new TermSet(pointers.map(pointer => pointer.terms).flat())
    return property.node([...terms])
}

const keepAllListItems = (pointers: Grapoi[], _property: Grapoi, predicate: Term) => {
    const termSets = getListItemsOrTermFromPointers(pointers)
    const allTerms = new TermSet([...termSets].map(termSet => [...termSet]).flat())
    return asShaclList([...allTerms], predicate)
}

// Builds an rdf:List for the resolved items in a small dataset of its own, rather than
// writing new triples into the (shared, immutable) shapes graph.
const asShaclList = (items: Term[], predicate: Term): Grapoi => {
    const container = grapoi({ dataset: datasetFactory.dataset(), factory, term: factory.blankNode() })
    container.addList(predicate, items)
    return container.out(predicate)
}

// SHACL applies sh:pattern conjunctively across property shapes, so a value must match every
// pattern. We fold that into a single regex using lookaheads rather than returning multiple terms,
// since consumers expect one pattern string (e.g. for an <input pattern> attribute).
const combinePatterns = (pointers: Grapoi[], property: Grapoi) => {
    const patterns = new TermSet(pointers.map(pointer => pointer.term))
    if (patterns.size === 1) {
        return property.node([...patterns])
    }
    const combined = [...patterns].map(pattern => `(?=.*(?:${pattern.value}))`).join('')
    return property.node(factory.literal(combined, xsd('string')))
}

const keepListIntersection = (pointers: Grapoi[], _property: Grapoi, predicate: Term) => {
    const termSets = getListItemsOrTermFromPointers(pointers)
    const intersection = termSets.reduce((acc, set) => {
        return new TermSet([...acc].filter(term => set.has(term)))
    }, termSets[0] || new TermSet())
    return asShaclList([...intersection], predicate)
}

const enforceSame = (pointers: Grapoi[], property: Grapoi, predicate: Term) => {
    const terms = pointers.map(pointer => pointer.terms).flat()
    const uniqueTerms = new TermSet(terms)
    if (uniqueTerms.size > 1) {
        throw new Error(`Conflicting values for property ${predicate.value}: ${[...uniqueTerms].map(term => term.value).join(', ')}`)
    }
    return property.node([...uniqueTerms])
}

const nodeKindIntersection = (pointers: Grapoi[], property: Grapoi) => {
    const combinationsMapping = new TermMap<Term, TermSet>([
        [sh('BlankNode'), new TermSet([sh('BlankNode')])],
        [sh('IRI'), new TermSet([sh('IRI')])],
        [sh('Literal'), new TermSet([sh('Literal')])],
        [sh('BlankNodeOrIRI'), new TermSet([sh('BlankNode'), sh('IRI')])],
        [sh('BlankNodeOrLiteral'), new TermSet([sh('BlankNode'), sh('Literal')])],
        [sh('IRIOrLiteral'), new TermSet([sh('IRI'), sh('Literal')])],
        [sh('TripleTerm'), new TermSet([sh('TripleTerm')])]
    ])

    const pointersNodeKinds = getListItemsOrTermFromPointers(pointers, combinationsMapping)

    if (pointersNodeKinds.length === 0) {
        return property.node()
    }

    const intersection = pointersNodeKinds.reduce((acc, nodeKinds) => {
        return new TermSet([...acc].filter(nodeKind => nodeKinds.has(nodeKind)))
    }, pointersNodeKinds[0] || new TermSet())

    if (intersection.size === 0) {
        throw new Error(`No intersection found for sh:nodeKind: ${pointersNodeKinds.map(nodeKinds => [...nodeKinds].map(nodeKind => nodeKind.value.split('#').pop()).join(', ')).join(' | ')}`)
    }

    return property.node([...intersection])
}

const keepMostSpecificClasses = (pointers: Grapoi[], property: Grapoi) => {
    // sh:class ex:Dog, ex:Cat means it must be a DogCat. 
    // This is valid, if we have two shapes that are matched because of sh:targetClass then the intersection of those must 'true',
    // meaning that when we find two property shapes for one property, both sh:class must be true, so a valid use case could be data with multiple classes:
    // eg: ex:Professor, lorem:Professor should match a Resource with both those classes.

    // sh:class ex:Dog, ex:Animal means it must be a Dog, because Dog is a subclass of Animal.

    // We can never throw as we do not know if resources of certain combinations of classes exist, eg: <> a ex:Boxer, ex:Cat.

    const classes = [...new TermSet(getListItemsOrTermFromPointers(pointers).flatMap(termSet => [...termSet]))]

    const classAncestryMap = new TermMap<Term, Term[]>()

    for (const classEntry of classes) {
        let pointer = property.node(classEntry)
        const parents = []
        while (pointer.terms.length) {
            pointer = pointer.out(rdfs('subClassOf'))
            for (const parent of pointer.terms) {
                parents.push(parent)
            }
        }
        classAncestryMap.set(classEntry, parents.toReversed())
    }

    const mostSpecificClasses = classes.filter(classEntry => {
        const foundAsParent = classes.some(otherClass => {
            if (classEntry.equals(otherClass)) return false
            const parents = classAncestryMap.get(otherClass)
            return parents?.some(parent => parent.equals(classEntry))
        })
        return !foundAsParent
    })

    return property.node(mostSpecificClasses)
}

const enforceSingular = (fn: ResolutionFunction): ResolutionFunction => {
    return (pointers: Grapoi[], property: Grapoi, predicate: Term) => {
        const result = fn(pointers, property, predicate)
        if (result.terms.length > 1) {
            throw new Error(`Expected a singular value for ${predicate.value.split('#').pop()} but found disjoint values: ${result.terms.map(term => term.value.split(/\/|#/g).pop()).join(', ')}`)
        }
        return result
    }
}

const resolveBooleans = (pointers: Grapoi[], property: Grapoi) => {
    const booleanValues = new Set(pointers.map(pointer => pointer.value))
    if (booleanValues.has('true')) {
        return property.node(factory.literal('true', xsd('boolean')))
    }
    else {
        return property.node(factory.literal('false', xsd('boolean')))
    }
}

const resolutions = new TermMap<Term, ResolutionFunction>([
    [sh('class'), keepMostSpecificClasses],
    [sh('datatype'), enforceSingular(keepMostSpecificClasses)],
    [sh('nodeKind'), nodeKindIntersection],
    [sh('minCount'), keepHighestInteger],
    [sh('maxCount'), keepLowestInteger],
    [sh('minExclusive'), keepHighestLiteral],
    [sh('minInclusive'), keepHighestLiteral],
    [sh('maxExclusive'), keepLowestLiteral],
    [sh('maxInclusive'), keepLowestLiteral],
    [sh('minLength'), keepHighestInteger],
    [sh('maxLength'), keepLowestInteger],
    [sh('pattern'), combinePatterns],
    [sh('singleLine'), resolveBooleans],
    [sh('languageIn'), keepListIntersection],
    [sh('uniqueLang'), resolveBooleans],
    [sh('memberShape'), keepAll],
    [sh('minListLength'), keepHighestInteger],
    [sh('maxListLength'), keepLowestInteger],
    [sh('uniqueMembers'), resolveBooleans],
    [sh('equals'), enforceSame],
    [sh('disjoint'), keepAll],
    [sh('subsetOf'), keepAll],
    [sh('lessThan'), keepAll],
    [sh('lessThanOrEquals'), keepAll],
    [sh('not'), keepAll],
    [sh('and'), keepAll],
    [sh('or'), keepAll],
    [sh('xone'), keepAll],
    [sh('node'), keepAll],
    [sh('property'), keepAll],
    [sh('someValue'), keepAll],
    [sh('qualifiedValueShape'), keepAll],
    [sh('qualifiedMinCount'), keepHighestInteger],
    [sh('qualifiedMaxCount'), keepLowestInteger],
    [sh('reificationRequired'), resolveBooleans],
    [sh('closed'), resolveBooleans],
    [sh('ignoredProperties'), keepAllListItems],
    [sh('hasValue'), enforceSingular(keepAll)],
    [sh('in'), keepListIntersection],
    [sh('rootClass'), keepMostSpecificClasses],
    [sh('uniqueValuesFor'), keepAllListItems],
    [sh('name'), keepFirst],
    [sh('description'), keepAll],
    [sh('intent'), keepAll],
    [sh('agentInstruction'), keepAll],
    [sh('codeIdentifier'), keepFirst],
    [sh('unit'), keepAll],
    [sh('order'), keepLowestInteger],
    [sh('group'), keepFirst],
]);