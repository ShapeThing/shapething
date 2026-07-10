import type { Environment } from "@/environment.ts";

export type Preprocessor = (
    environment: Environment,
) => Environment | Promise<Environment>;

export const runPreprocessors = async (
    environment: Environment,
    preprocessorsToRun: Preprocessor[],
): Promise<Environment> => {
    let result = environment;

    for (const preprocessor of preprocessorsToRun) {
        result = await preprocessor(result);
    }

    return result;
};
