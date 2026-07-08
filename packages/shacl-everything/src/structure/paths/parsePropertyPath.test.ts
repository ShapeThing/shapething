import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "./parsePropertyPath.ts";
import { parseRdf } from "../../helpers/rdf.ts";
import { Effect } from "effect";
import { ex } from "../../helpers/namespaces.ts";

function parse(turtle: string) {
    return Effect.runPromise(
        parseRdf(
            `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ${turtle}
    `,
            "text/turtle",
        ),
    );
}

// 4.1 Predicate Paths
test("parsePropertyPath - 4.1 Predicate Paths", async () => {
    const shapesGraph = await parse(`
        ex:ingredientShape a sh:PropertyShape ;
            sh:path ex:ingredient ;
            sh:minCount 2 ;
        .
    `);

    const path = parsePropertyPath(ex("ingredientShape"), shapesGraph);
    expect(path).toEqual({ type: "predicate", predicate: ex("ingredient") });
});

// 4.2 Sequence Paths
test("parsePropertyPath - 4.2 Sequence Paths", async () => {
    const shapesGraph = await parse(`
        ex:spouseFatherShape a sh:PropertyShape ;
            sh:path ( ex:spouse ex:father ) ;
        .
    `);

    const path = parsePropertyPath(ex("spouseFatherShape"), shapesGraph);
    expect(path).toEqual({
        type: "sequence",
        items: [
            { type: "predicate", predicate: ex("spouse") },
            { type: "predicate", predicate: ex("father") },
        ],
    });
});

test("parsePropertyPath - 4.2 Sequence Paths with more than two items", async () => {
    const shapesGraph = await parse(`
        ex:threeStepShape a sh:PropertyShape ;
            sh:path ( ex:spouse ex:father ex:name ) ;
        .
    `);

    const path = parsePropertyPath(ex("threeStepShape"), shapesGraph);
    expect(path).toEqual({
        type: "sequence",
        items: [
            { type: "predicate", predicate: ex("spouse") },
            { type: "predicate", predicate: ex("father") },
            { type: "predicate", predicate: ex("name") },
        ],
    });
});

// 4.3 Alternative Paths
test("parsePropertyPath - 4.3 Alternative Paths", async () => {
    const shapesGraph = await parse(`
        ex:parentShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( ex:father ex:mother ) ] ;
        .
    `);

    const path = parsePropertyPath(ex("parentShape"), shapesGraph);
    expect(path).toEqual({
        type: "alternative",
        items: [
            { type: "predicate", predicate: ex("father") },
            { type: "predicate", predicate: ex("mother") },
        ],
    });
});

test("parsePropertyPath - 4.3 Alternative Paths with more than two options", async () => {
    const shapesGraph = await parse(`
        ex:caregiverShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( ex:father ex:mother ex:guardian ) ] ;
        .
    `);

    const path = parsePropertyPath(ex("caregiverShape"), shapesGraph);
    expect(path).toEqual({
        type: "alternative",
        items: [
            { type: "predicate", predicate: ex("father") },
            { type: "predicate", predicate: ex("mother") },
            { type: "predicate", predicate: ex("guardian") },
        ],
    });
});

// 4.4 Inverse Paths
test("parsePropertyPath - 4.4 Inverse Paths", async () => {
    const shapesGraph = await parse(`
        ex:childShape a sh:PropertyShape ;
            sh:path [ sh:inversePath ex:parent ] ;
        .
    `);

    const path = parsePropertyPath(ex("childShape"), shapesGraph);
    expect(path).toEqual({
        type: "inverse",
        path: { type: "predicate", predicate: ex("parent") },
    });
});

// 4.5 Zero-Or-More Paths
test("parsePropertyPath - 4.5 Zero-Or-More Paths", async () => {
    const shapesGraph = await parse(`
        ex:ancestorShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrMorePath ex:parent ] ;
        .
    `);

    const path = parsePropertyPath(ex("ancestorShape"), shapesGraph);
    expect(path).toEqual({
        type: "zeroOrMore",
        path: { type: "predicate", predicate: ex("parent") },
    });
});

// 4.6 One-Or-More Paths
test("parsePropertyPath - 4.6 One-Or-More Paths", async () => {
    const shapesGraph = await parse(`
        ex:strictAncestorShape a sh:PropertyShape ;
            sh:path [ sh:oneOrMorePath ex:parent ] ;
        .
    `);

    const path = parsePropertyPath(ex("strictAncestorShape"), shapesGraph);
    expect(path).toEqual({
        type: "oneOrMore",
        path: { type: "predicate", predicate: ex("parent") },
    });
});

// 4.7 Zero-Or-One Paths
test("parsePropertyPath - 4.7 Zero-Or-One Paths", async () => {
    const shapesGraph = await parse(`
        ex:selfOrParentShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrOnePath ex:parent ] ;
        .
    `);

    const path = parsePropertyPath(ex("selfOrParentShape"), shapesGraph);
    expect(path).toEqual({
        type: "zeroOrOne",
        path: { type: "predicate", predicate: ex("parent") },
    });
});

// No sh:path present
test("parsePropertyPath - returns null when no sh:path is present", async () => {
    const shapesGraph = await parse(`
        ex:pathlessShape a sh:PropertyShape ;
            sh:minCount 1 ;
        .
    `);

    const path = parsePropertyPath(ex("pathlessShape"), shapesGraph);
    expect(path).toEqual(null);
});

// Deeply nested combinations - the tree representation is lossless, so
// arbitrary nesting always parses; whether it can be executed is a separate
// concern handled by toGrapoi (see toGrapoi.test.ts).

test("parsePropertyPath - alternative of two sequences", async () => {
    const shapesGraph = await parse(`
        ex:byMotherOrFatherShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath (
                ( ex:mother ex:name )
                ( ex:father ex:name )
            ) ] ;
        .
    `);

    const path = parsePropertyPath(ex("byMotherOrFatherShape"), shapesGraph);
    expect(path).toEqual({
        type: "alternative",
        items: [
            {
                type: "sequence",
                items: [
                    { type: "predicate", predicate: ex("mother") },
                    { type: "predicate", predicate: ex("name") },
                ],
            },
            {
                type: "sequence",
                items: [
                    { type: "predicate", predicate: ex("father") },
                    { type: "predicate", predicate: ex("name") },
                ],
            },
        ],
    });
});

test("parsePropertyPath - alternative mixing a predicate and an inverse path", async () => {
    const shapesGraph = await parse(`
        ex:relatedShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath (
                ex:father
                [ sh:inversePath ex:child ]
            ) ] ;
        .
    `);

    const path = parsePropertyPath(ex("relatedShape"), shapesGraph);
    expect(path).toEqual({
        type: "alternative",
        items: [
            { type: "predicate", predicate: ex("father") },
            {
                type: "inverse",
                path: { type: "predicate", predicate: ex("child") },
            },
        ],
    });
});

test("parsePropertyPath - inverse of a sequence", async () => {
    const shapesGraph = await parse(`
        ex:inverseSequenceShape a sh:PropertyShape ;
            sh:path [ sh:inversePath ( ex:father ex:mother ) ] ;
        .
    `);

    const path = parsePropertyPath(ex("inverseSequenceShape"), shapesGraph);
    expect(path).toEqual({
        type: "inverse",
        path: {
            type: "sequence",
            items: [
                { type: "predicate", predicate: ex("father") },
                { type: "predicate", predicate: ex("mother") },
            ],
        },
    });
});

test("parsePropertyPath - zero-or-more over a sequence", async () => {
    const shapesGraph = await parse(`
        ex:zeroOrMoreSequenceShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrMorePath ( ex:parent ex:sibling ) ] ;
        .
    `);

    const path = parsePropertyPath(ex("zeroOrMoreSequenceShape"), shapesGraph);
    expect(path).toEqual({
        type: "zeroOrMore",
        path: {
            type: "sequence",
            items: [
                { type: "predicate", predicate: ex("parent") },
                { type: "predicate", predicate: ex("sibling") },
            ],
        },
    });
});

test("parsePropertyPath - one-or-more of an inverse path", async () => {
    const shapesGraph = await parse(`
        ex:strictDescendantShape a sh:PropertyShape ;
            sh:path [ sh:oneOrMorePath [ sh:inversePath ex:parent ] ] ;
        .
    `);

    const path = parsePropertyPath(ex("strictDescendantShape"), shapesGraph);
    expect(path).toEqual({
        type: "oneOrMore",
        path: {
            type: "inverse",
            path: { type: "predicate", predicate: ex("parent") },
        },
    });
});

test("parsePropertyPath - sequence containing an alternative", async () => {
    const shapesGraph = await parse(`
        ex:parentThenNameShape a sh:PropertyShape ;
            sh:path (
                [ sh:alternativePath ( ex:father ex:mother ) ]
                ex:name
            ) ;
        .
    `);

    const path = parsePropertyPath(ex("parentThenNameShape"), shapesGraph);
    expect(path).toEqual({
        type: "sequence",
        items: [
            {
                type: "alternative",
                items: [
                    { type: "predicate", predicate: ex("father") },
                    { type: "predicate", predicate: ex("mother") },
                ],
            },
            { type: "predicate", predicate: ex("name") },
        ],
    });
});

test("parsePropertyPath - zero-or-one wrapping a one-or-more path", async () => {
    const shapesGraph = await parse(`
        ex:maybeAncestorShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrOnePath [ sh:oneOrMorePath ex:parent ] ] ;
        .
    `);

    const path = parsePropertyPath(ex("maybeAncestorShape"), shapesGraph);
    expect(path).toEqual({
        type: "zeroOrOne",
        path: {
            type: "oneOrMore",
            path: { type: "predicate", predicate: ex("parent") },
        },
    });
});
