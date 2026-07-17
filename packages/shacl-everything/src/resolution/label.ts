import { factory } from "@/helpers/factory.ts";
import { sh, shui } from "@/helpers/namespaces.ts";
import language from "@/resolution/language.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Literal, Term } from "@rdfjs/types";

type PropertyLabelOptions = {};
type ValueNodeLabelOptions = {
    term: Term;
    propertyShape: PropertyUIElement;
};

export function propertyLabel({}: PropertyLabelOptions) {
}

// 8.2.2 Value Node Labels
export function valueNodeLabel(
    { term, propertyShape }: ValueNodeLabelOptions,
): Literal {
    const { shapesGraph, dataGraph } = propertyShape;

    //  1. If V is a literal, use its lexical form as the label.
    if (term.termType === "Literal") {
        return term;
    }

    // 2. If the applicable node shape for V contains a property shape whose sh:path is annotated with shui:propertyRole shui:LabelRole,
    // retrieve the values of that path from the data graph for subject V. Select the best matching value using language resolution.
    // If a match is found, use that literal as the label.
    const node = propertyShape.getOne(sh("node"));
    const labelsViaPropertyRoles = shapesGraph.getQuads(
        node,
        sh("property"),
    ).filter(({ object: property }) =>
        shapesGraph.getQuads(
            property,
            shui("propertyRole"),
            shui("LabelRole"),
        ).length > 0
    ).map(({ object: property }) => property)
        .flatMap((property) => {
            const path = parsePropertyPath(
                property,
                shapesGraph,
            );

            if (!path) {
                return [];
            }

            const values = walkPropertyPath(
                path,
                term,
                dataGraph,
            );

            return values;
        }).filter((value): value is Literal => value.termType === "Literal");

    if (labelsViaPropertyRoles.length > 0) {
        return language(labelsViaPropertyRoles);
    }

    return factory.literal(term.value);
}
