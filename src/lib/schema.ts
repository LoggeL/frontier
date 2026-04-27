import { z } from "zod";

// Provider is an open string — AA tracks dozens of creators and the set grows
// quickly. Keep it permissive; the table filters by whatever values appear.
export const providerSchema = z.string().min(1);
export type Provider = z.infer<typeof providerSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected ISO YYYY-MM-DD");

const isoMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "expected ISO YYYY-MM");

export const modelSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-.]*$/, "kebab-case id"),
    name: z.string().min(1),
    provider: providerSchema,
    releaseDate: isoDate,
    knowledgeCutoff: isoMonth,
    contextWindow: z.number().int().positive().optional(),
    openWeights: z.boolean(),
    aaBenchmarkInputTokens: z.number().nonnegative().optional(),
    aaBenchmarkAnswerTokens: z.number().nonnegative().optional(),
    aaBenchmarkOutputTokens: z.number().nonnegative().optional(),
    aaBenchmarkReasoningTokens: z.number().nonnegative().optional(),
    aaBenchmarkTotalTokens: z.number().nonnegative().optional(),
    aaBenchmarkTotalCost: z.number().nonnegative().optional(),
    aaBenchmarkInputCost: z.number().nonnegative().optional(),
    aaBenchmarkOutputCost: z.number().nonnegative().optional(),
    aaBenchmarkAnswerCost: z.number().nonnegative().optional(),
    aaBenchmarkReasoningCost: z.number().nonnegative().optional(),
    hfLink: z.string().url().optional(),
    totalParams: z.number().positive().optional(),
    activeParams: z.number().positive().optional(),
    experts: z.number().int().positive().optional(),
    architecture: z.enum(["dense", "moe"]).optional(),
    cohortLabel: z.string().optional(),
  })
  .refine(
    (m) =>
      !m.openWeights ||
      (m.hfLink !== undefined &&
        m.totalParams !== undefined &&
        m.activeParams !== undefined &&
        m.architecture !== undefined),
    {
      message:
        "open-weight model requires hfLink, totalParams, activeParams, architecture",
    },
  )
  .refine((m) => m.architecture !== "moe" || m.experts !== undefined, {
    message: "MoE models require `experts`",
  });
export type Model = z.infer<typeof modelSchema>;

export const benchmarkVariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case variant key"),
  label: z.string().min(1),
  notes: z.string().min(1),
});
export type BenchmarkVariant = z.infer<typeof benchmarkVariantSchema>;

export const benchmarkSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-.]*$/, "kebab-case id"),
  name: z.string().min(1),
  category: z.enum([
    "reasoning",
    "math",
    "code",
    "multimodal",
    "agentic",
    "composite",
    "custom",
  ]),
  source: z.enum(["aa", "custom"]),
  higherIsBetter: z.boolean(),
  unit: z.enum(["accuracy", "elo", "pass@1", "score", "index"]),
  // primary = shown in the main comparison table. Non-primary only surfaces
  // on per-model detail pages.
  primary: z.boolean(),
  description: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  variants: z.array(benchmarkVariantSchema).min(1),
});
export type Benchmark = z.infer<typeof benchmarkSchema>;

export const scoreSchema = z.object({
  modelId: z.string(),
  benchmarkId: z.string(),
  variant: z.string(),
  value: z.number().finite(),
  reportedOn: isoDate.optional(),
  sourceUrl: z.string().url().optional(),
  notes: z.string().optional(),
});
export type Score = z.infer<typeof scoreSchema>;

export const modelsFileSchema = z.array(modelSchema);
export const benchmarksFileSchema = z.array(benchmarkSchema);
export const scoresFileSchema = z.array(scoreSchema);

export interface ValidatedData {
  models: Model[];
  benchmarks: Benchmark[];
  scores: Score[];
}

/**
 * Cross-file referential validation. Throws a build-time error with all
 * problems at once so an agent editing JSON can see every issue in one pass.
 */
export function validateReferences(data: ValidatedData): void {
  const modelIds = new Set(data.models.map((m) => m.id));
  const benchmarkById = new Map(data.benchmarks.map((b) => [b.id, b]));

  const problems: string[] = [];
  const seenModels = new Set<string>();
  for (const m of data.models) {
    if (seenModels.has(m.id)) problems.push(`duplicate model id: ${m.id}`);
    seenModels.add(m.id);
  }
  const seenBench = new Set<string>();
  for (const b of data.benchmarks) {
    if (seenBench.has(b.id)) problems.push(`duplicate benchmark id: ${b.id}`);
    seenBench.add(b.id);
    const variantKeys = new Set<string>();
    for (const v of b.variants) {
      if (variantKeys.has(v.key))
        problems.push(`${b.id}: duplicate variant key "${v.key}"`);
      variantKeys.add(v.key);
    }
  }

  for (const s of data.scores) {
    if (!modelIds.has(s.modelId))
      problems.push(`score references unknown modelId "${s.modelId}"`);
    const bench = benchmarkById.get(s.benchmarkId);
    if (!bench) {
      problems.push(`score references unknown benchmarkId "${s.benchmarkId}"`);
      continue;
    }
    if (!bench.variants.some((v) => v.key === s.variant)) {
      problems.push(
        `score (${s.modelId} × ${s.benchmarkId}) uses variant "${s.variant}" ` +
          `which is not declared on benchmark "${bench.id}"`,
      );
    }
  }

  if (problems.length) {
    throw new Error(
      `Data validation failed:\n  - ${problems.join("\n  - ")}`,
    );
  }
}
