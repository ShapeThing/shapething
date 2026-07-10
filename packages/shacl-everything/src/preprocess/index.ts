import type { Environment } from "@/environment.ts";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { addMissingShapes } from "@/preprocess/shapes.ts";
import { assertValidEnvironment } from "@/preprocess/configuration.ts";

export type Preprocessor<TIn = Environment, TOut = TIn> = (
  environment: TIn,
) => TOut | Promise<TOut>;

// The input type expected by the first stage of a preprocessor chain.
export type PipelineInput<Steps extends readonly Preprocessor<any, any>[]> =
  Steps extends readonly [Preprocessor<infer TIn, any>, ...any[]] ? TIn : never;

export type PreprocessorChain<
  In,
  Steps extends readonly Preprocessor<any, any>[],
> = Steps extends readonly [infer Head, ...infer Tail]
  ? Head extends Preprocessor<infer HIn, infer HOut>
    ? In extends HIn
      ? Tail extends readonly Preprocessor<any, any>[]
        ? PreprocessorChain<HOut, Tail>
      : HOut
    : {
      __chainError:
        "Preprocessor chain type mismatch: this stage's input does not match the previous stage's output";
      expected: HIn;
      received: In;
    }
  : never
  : In;

export type RequireValidChain<Steps extends readonly Preprocessor<any, any>[]> =
  PreprocessorChain<PipelineInput<Steps>, Steps> extends Environment ? {}
    : { __chainError: PreprocessorChain<PipelineInput<Steps>, Steps> };

export const runPreprocessors = async <
  const Steps extends readonly Preprocessor<any, any>[],
>(
  raw: PipelineInput<Steps>,
  steps: Steps,
): Promise<PreprocessorChain<PipelineInput<Steps>, Steps>> => {
  let result: any = raw;

  for (const step of steps) {
    result = await step(result);
  }

  return result;
};

export const defaultPreprocessors = [
  resolveRdfSources,
  addMissingShapes,
  assertValidEnvironment,
] as const;

export type DefaultPreprocessors = typeof defaultPreprocessors;
