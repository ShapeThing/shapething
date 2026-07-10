import type { Preprocessor } from "@/preprocess/index.ts";
import type { Environment } from "@/environment.ts";

export const assertValidEnvironment: Preprocessor = (
    environment: Environment,
) => {
    return environment;
};
