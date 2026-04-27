# Data

Three JSON files, validated at build time by `src/lib/schema.ts`. Break a reference and `pnpm build` fails with a line-precise error. This is intentional — it keeps the dataset honest when an agent (or you) edits it.

## Files

- **`models.json`** — `Model[]`. One entry per LLM.
- **`benchmarks.json`** — `Benchmark[]`. One entry per evaluation, with a `variants[]` array documenting every configuration you plan to record scores under (pass@N, with/without tools, n-shot, etc.).
- **`scores.json`** — `Score[]`. One row per `(modelId, benchmarkId, variant)` tuple.

## Adding a new model

Append an object to `models.json`:

```json
{
  "id": "some-new-model",
  "name": "Some New Model",
  "provider": "Anthropic",
  "releaseDate": "2026-03-01",
  "knowledgeCutoff": "2026-01",
  "contextWindow": 200000,
  "openWeights": false
}
```


Optional Artificial Analysis Intelligence Index benchmark cost / token fields shown in the main dashboard:

- `aaBenchmarkTotalCost` — total USD cost to run the AA Intelligence Index evaluations
- `aaBenchmarkInputCost`, `aaBenchmarkOutputCost`, `aaBenchmarkAnswerCost`, `aaBenchmarkReasoningCost` — cost breakdown
- `aaBenchmarkTotalTokens` — total tokens used to run the AA Intelligence Index evaluations
- `aaBenchmarkInputTokens`, `aaBenchmarkOutputTokens`, `aaBenchmarkAnswerTokens`, `aaBenchmarkReasoningTokens` — token breakdown

If `openWeights` is `true`, you **must** also include `hfLink`, `totalParams`, `activeParams`, and `architecture` (`"dense"` or `"moe"`). MoE models also require `experts`.

```json
{
  "id": "some-open-moe",
  "name": "Some Open MoE",
  "provider": "Alibaba",
  "releaseDate": "2026-03-15",
  "knowledgeCutoff": "2025-12",
  "openWeights": true,
  "hfLink": "https://huggingface.co/org/model",
  "totalParams": 235,
  "activeParams": 22,
  "experts": 128,
  "architecture": "moe"
}
```

`cohortLabel` (optional) overrides the auto-derived cohort when two models share a pretraining run despite differing cutoffs.

## Adding a new benchmark

Append to `benchmarks.json`. Every benchmark needs at least one variant:

```json
{
  "id": "my-custom-bench",
  "name": "My Custom Bench",
  "category": "custom",
  "source": "custom",
  "higherIsBetter": true,
  "unit": "accuracy",
  "description": "Short blurb.",
  "variants": [
    {
      "key": "default",
      "label": "Default",
      "notes": "Describe setup: n-shot, temperature, tools, sampling, grading criterion."
    }
  ]
}
```

## Adding a new variant to an existing benchmark

Append to the benchmark's `variants[]`. Variants exist so you can record **pass@1 vs pass@10**, **with-tools vs no-tools**, **0-shot vs 8-shot CoT**, etc. under the same benchmark without them getting compared as apples-to-apples.

Good `notes` answer: "what's different about this variant, and why can't I directly compare it to the default?"

## Adding a score

Append to `scores.json`:

```json
{
  "modelId": "some-new-model",
  "benchmarkId": "my-custom-bench",
  "variant": "default",
  "value": 0.73,
  "reportedOn": "2026-03-05",
  "sourceUrl": "https://...",
  "notes": "Caveats specific to this one run (e.g. 'temperature 0.2', 'self-reported by vendor')."
}
```

All four key fields (`modelId`, `benchmarkId`, `variant`, `value`) are required. Value encoding:

- `unit: "accuracy"` or `"pass@1"` → decimal `0..1` (e.g. `0.847` for 84.7%)
- `unit: "elo"` → integer rating
- `unit: "index"` → raw index (e.g. AA composite on `0..100`)
- `unit: "score"` → raw numeric score

## Validation rules (enforced on build)

- IDs are kebab-case and unique within their file.
- Open-weight models have HF link + params + architecture; MoE has `experts`.
- Every score's `(benchmarkId, variant)` pair must exist in `benchmarks.json`.
- Every score's `modelId` must exist in `models.json`.

`pnpm build` prints **all** validation errors at once.
