
import factory from '@rdfjs/data-model';
import TermMap from "@rdfjs/term-map";
import TermSet from "@rdfjs/term-set";
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
                    const pointers = property.terms.map(term => property.node(term))
                    // We sort the properties by their sh:order value, 
                    // so that we can resolve conflicts in a stable manner.
                    const sortedPointers = pointers.sort(sortShaclItems)

                    const returnPointers: Grapoi[] = []

                    for (const predicate of predicates) {
                        const resolutionFunction = resolutions.get(predicate)
                        let predicatePointers: Grapoi[] = sortedPointers.map(pointer => pointer.out(predicate, objectArgument))
                        if (resolutionFunction) {
                            predicatePointers = [resolutionFunction(predicatePointers, property)]
                        }
                        returnPointers.push(...predicatePointers)
                    }

                    return property.node(returnPointers.map(pointer => pointer.terms).flat())
                }
            }

            return Reflect.get(target, prop, receiver)
        }
    }) as ConflictFreeGrapoi
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
    const terms = pointers.map(pointer => pointer.terms).flat()
    return property.node(terms)
}

const keepIntersection = (pointers: Grapoi[], property: Grapoi) => {
    const termSets = pointers.map(pointer => new TermSet(pointer.terms))
    const intersection = termSets.reduce((acc, set) => {
        return new TermSet([...acc].filter(term => set.has(term)))
    }, termSets[0] || new TermSet())
    return property.node([...intersection])
}

const resolutions = new TermMap<Term, (pointers: Grapoi[], property: Grapoi) => Grapoi>([
    // sh:class
    // sh:datatype
    // sh:nodeKind
    [sh('minCount'), keepHighestInteger],
    [sh('maxCount'), keepLowestInteger],
    // sh:minExclusive
    // sh:minInclusive
    // sh:maxExclusive
    // sh:maxInclusive
    [sh('minLength'), keepHighestInteger],
    [sh('maxLength'), keepLowestInteger],
    // sh:pattern
    // sh:singleLine
    // sh:languageIn
    // sh:uniqueLang
    // sh:memberShape
    // sh:minListLength
    // sh:maxListLength
    // sh:uniqueMembers
    // sh:equals
    // sh:disjoint
    // sh:subsetOf
    // sh:lessThan
    // sh:lessThanOrEquals
    // sh:not
    // sh:and
    // sh:or
    // sh:xone
    // sh:node
    // sh:property
    // sh:someValue
    // sh:qualifiedValueShape, sh:qualifiedMinCount, sh:qualifiedMaxCount
    // sh:reifierShape, sh:reificationRequired
    // sh:closed, sh:ignoredProperties
    // sh:hasValue
    [sh('in'), keepIntersection],
    // sh:rootClass
    // sh:uniqueValuesFor
    [sh('name'), keepFirst],
    [sh('description'), keepAll],
    // sh:intent
    // sh:agentInstruction
    // sh:codeIdentifier
    // sh:unit
    // sh:order
    // sh:group

]);