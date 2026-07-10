import type { Environment } from "@/environment.ts";
import type { Preprocessor } from "@/preprocess/index.ts";

export const addMissingShapes: Preprocessor = (
    environment: Environment,
): Environment => {
    // TODO search for classes and predicates that do not have node and property shapes and add them to the shapes graph.
    return environment;
};
