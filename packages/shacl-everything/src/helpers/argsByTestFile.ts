import { factory } from "@/helpers/factory.ts";

export const argsByTestFile = (filename: string, cwd: string) => {
    return {
        shapesGraph: new URL(filename, cwd),
        nodeShape: factory.namedNode(
            new URL(`${filename}#shape`, cwd).href,
        ),
        dataGraph: new URL(filename, cwd),
        focusNode: factory.namedNode(
            new URL(`${filename}#data`, cwd).href,
        ),
    };
};
