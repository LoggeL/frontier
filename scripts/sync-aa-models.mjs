#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.AA_API_KEY;
if (!apiKey) {
  console.error("AA_API_KEY is required");
  process.exit(1);
}

const root = new URL("..", import.meta.url);
const apiModelsPath = new URL("../src/data/aa-models-api.json", import.meta.url);
const valueHistoryPath = new URL("../src/data/aa-value-history.json", import.meta.url);

const res = await fetch("https://artificialanalysis.ai/api/v2/data/llms/models", {
  headers: { "x-api-key": apiKey },
});

if (!res.ok) {
  throw new Error(`Artificial Analysis API failed: ${res.status} ${res.statusText}`);
}

const payload = await res.json();
const data = Array.isArray(payload?.data) ? payload.data : [];

const apiModels = data
  .map((m) => ({
    id: m.slug,
    aaApiId: m.id,
    name: m.name,
    provider: m.model_creator?.name ?? "Unknown",
    providerSlug: m.model_creator?.slug ?? null,
    releaseDate: m.release_date,
    aaIntelligenceIndex: m.evaluations?.artificial_analysis_intelligence_index ?? null,
    aaCodingIndex: m.evaluations?.artificial_analysis_coding_index ?? null,
    aaMathIndex: m.evaluations?.artificial_analysis_math_index ?? null,
    gpqa: m.evaluations?.gpqa ?? null,
    hle: m.evaluations?.hle ?? null,
    livecodebench: m.evaluations?.livecodebench ?? null,
    scicode: m.evaluations?.scicode ?? null,
    math500: m.evaluations?.math_500 ?? null,
    aime25: m.evaluations?.aime_25 ?? null,
    ifbench: m.evaluations?.ifbench ?? null,
    lcr: m.evaluations?.lcr ?? null,
    terminalBenchHard: m.evaluations?.terminalbench_hard ?? null,
    tau2: m.evaluations?.tau2 ?? null,
    price1mBlended3to1: m.pricing?.price_1m_blended_3_to_1 ?? null,
    price1mInputTokens: m.pricing?.price_1m_input_tokens ?? null,
    price1mOutputTokens: m.pricing?.price_1m_output_tokens ?? null,
    medianOutputTokensPerSecond: m.median_output_tokens_per_second ?? null,
    medianTimeToFirstTokenSeconds: m.median_time_to_first_token_seconds ?? null,
    medianTimeToFirstAnswerToken: m.median_time_to_first_answer_token ?? null,
  }))
  .sort(
    (a, b) =>
      (a.releaseDate ?? "9999-99-99").localeCompare(b.releaseDate ?? "9999-99-99") ||
      a.name.localeCompare(b.name),
  );

const currentValueHistory = JSON.parse(await fs.readFile(valueHistoryPath, "utf8"));
const valueHistoryById = new Map(currentValueHistory.map((row) => [row.id, row]));

const nextValueHistory = apiModels
  .map((m) => {
    const existing = valueHistoryById.get(m.id);
    if (!existing) return null;
    return {
      id: m.id,
      name: m.name,
      provider: m.provider,
      releaseDate: m.releaseDate,
      aaIntelligenceIndex: existing.aaIntelligenceIndex,
      aaBenchmarkTotalCost: existing.aaBenchmarkTotalCost,
      aaBenchmarkValue: existing.aaBenchmarkValue,
    };
  })
  .filter(Boolean);

await fs.writeFile(apiModelsPath, `${JSON.stringify(apiModels, null, 2)}\n`);
await fs.writeFile(valueHistoryPath, `${JSON.stringify(nextValueHistory, null, 2)}\n`);

console.log(`Wrote ${apiModels.length} API models to ${path.relative(process.cwd(), apiModelsPath.pathname)}`);
console.log(`Preserved ${nextValueHistory.length} benchmark-cost rows in ${path.relative(process.cwd(), valueHistoryPath.pathname)}`);
