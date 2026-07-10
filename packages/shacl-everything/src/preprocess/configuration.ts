import type { Preprocessor } from "@/preprocess/index.ts";
import type { Environment } from "@/environment.ts";

export const assertValidEnvironment: Preprocessor = (
    environment: Environment,
) => {
    return environment;
};

type DereferencableEnvironment = {
    shapesGraph: Environment["shapesGraph"] | URL;
    dataGraph: Environment["dataGraph"] | URL;
};

export const dereferenceUrlsToRdf: Preprocessor = (
    environment: DereferencableEnvironment,
) => {
    // TODO dereference all URLs in the shapes and data graphs to RDF and add them to the respective graphs.
    return environment;
};
