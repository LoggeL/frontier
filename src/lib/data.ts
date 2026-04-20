import modelsJson from "../data/models.json";
import benchmarksJson from "../data/benchmarks.json";
import scoresJson from "../data/scores.json";
import {
  benchmarksFileSchema,
  modelsFileSchema,
  scoresFileSchema,
  validateReferences,
  type Benchmark,
  type Model,
  type Score,
} from "./schema";

function parse<T>(label: string, schema: { parse(x: unknown): T }, raw: unknown): T {
  try {
    return schema.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid data in ${label}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export const models: Model[] = parse("models.json", modelsFileSchema, modelsJson);
export const benchmarks: Benchmark[] = parse(
  "benchmarks.json",
  benchmarksFileSchema,
  benchmarksJson,
);
export const scores: Score[] = parse("scores.json", scoresFileSchema, scoresJson);

validateReferences({ models, benchmarks, scores });
