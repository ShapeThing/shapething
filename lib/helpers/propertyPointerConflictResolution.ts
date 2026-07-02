
import factory from '@rdfjs/data-model';
import TermMap from "@rdfjs/term-map";
import { Term } from '@rdfjs/types';
import { sh, xsd } from '../core/namespaces';
import Grapoi from "../Grapoi";
import { sortShaclItems } from './sortShaclItems';

export type ConflictFreeGrapoi = Grapoi & { ConflictFreeGrapoi: 'Returns one term where multiple terms exist' }

export default function resolvePropertyPointerConflicts(property: Grapoi): ConflictFreeGrapoi {
    return new Proxy(property, {
        get(target, prop, receiver) {
            if (prop === 'out') {
                return (predicateArgument: Term | Term[], objectArgument?: Term | Term[]) => {
                    const predicates = Array.isArray(predicateArgument) ? predicateArgument : [predicateArgument]

                    const terms: Term[] = []
                    for (const predicate of predicates) {
                        const pointers = property.terms.map(term => property.node(term))
                        // We sort the properties by their sh:order value, 
                        // so that we can resolve conflicts in a stable manner.
                        const sortedPointers = pointers.sort(sortShaclItems)

                        let pointerTerms: Term[] = []
                        for (const pointer of sortedPointers) {
                            pointerTerms.push(...pointer.out(predicate, objectArgument).terms)
                        }

                        const resolutionFunction = resolutions.get(predicate)
                        if (resolutionFunction) {
                            pointerTerms = resolutionFunction(pointerTerms)
                        }
                        terms.push(...pointerTerms)
                    }
                    return property.node(terms)
                }
            }

            return Reflect.get(target, prop, receiver)
        }
    }) as ConflictFreeGrapoi
}

const resolutions = new TermMap<Term, (values: Term[]) => Term[]>([
    // Merges sh:description of all property shapes.
    [sh('description'), (terms: Term[]) => {
        const value = terms.map(term => term.value).join(', ')
        return [factory.literal(value)]
    }],

    // Returns the maximum of all sh:minCount values of all property shapes.
    [sh('minCount'), (terms: Term[]) => {
        const minCountValues = terms.map(term => parseInt(term.value))
        const maxMinCount = Math.max(...minCountValues)
        return [factory.literal(maxMinCount.toString(), xsd('integer'))]
    }],

    // Returns the minimum of all sh:maxCount values of all property shapes.
    [sh('maxCount'), (terms: Term[]) => {
        const maxCountValues = terms.map(term => parseInt(term.value))
        const minMaxCount = Math.min(...maxCountValues)
        return [factory.literal(minMaxCount.toString(), xsd('integer'))]
    }],

    // Lets pick the first name
    [sh('name'), (terms: Term[]) => [terms[0]]],

    // Intersection of sh:in
    [sh('in'), (terms: Term[]) => {
        const allValues = terms.map(term => term.value)
        const intersection = allValues.filter(value => allValues.every(v => v === value))
        return intersection.map(value => factory.literal(value))
    }],
]);