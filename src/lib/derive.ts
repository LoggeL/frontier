import type { Benchmark, Model, Score } from "./schema";

export interface ScoreCell {
  value: number;
  variant: string;
  notes?: string;
  sourceUrl?: string;
}

export type ScoreMatrix = Map<string, Map<string, ScoreCell[]>>;

/** matrix[modelId][benchmarkId] = all variant cells for that pair */
export function buildScoreMatrix(scores: Score[]): ScoreMatrix {
  const m: ScoreMatrix = new Map();
  for (const s of scores) {
    let row = m.get(s.modelId);
    if (!row) {
      row = new Map();
      m.set(s.modelId, row);
    }
    const arr = row.get(s.benchmarkId) ?? [];
    arr.push({
      value: s.value,
      variant: s.variant,
      notes: s.notes,
      sourceUrl: s.sourceUrl,
    });
    row.set(s.benchmarkId, arr);
  }
  return m;
}

export interface ColumnExtent {
  min: number;
  max: number;
  higherIsBetter: boolean;
}

/** Per-benchmark (per-variant) min/max, used for color scaling. */
export function columnExtents(
  benchmarks: Benchmark[],
  scores: Score[],
): Map<string, ColumnExtent> {
  const out = new Map<string, ColumnExtent>();
  for (const b of benchmarks) {
    for (const v of b.variants) {
      const key = `${b.id}::${v.key}`;
      const vals = scores
        .filter((s) => s.benchmarkId === b.id && s.variant === v.key)
        .map((s) => s.value);
      if (vals.length === 0) continue;
      out.set(key, {
        min: Math.min(...vals),
        max: Math.max(...vals),
        higherIsBetter: b.higherIsBetter,
      });
    }
  }
  return out;
}

/** 0 = worst, 1 = best. Respects higherIsBetter. */
export function normalize(value: number, extent: ColumnExtent): number {
  const { min, max, higherIsBetter } = extent;
  if (max === min) return 0.5;
  const n = (value - min) / (max - min);
  return higherIsBetter ? n : 1 - n;
}

/** Group models by their knowledgeCutoff (YYYY-MM) for scatter Y-axis banding. */
export function cohortsByCutoff(models: Model[]): Map<string, Model[]> {
  const m = new Map<string, Model[]>();
  for (const model of models) {
    const arr = m.get(model.knowledgeCutoff) ?? [];
    arr.push(model);
    m.set(model.knowledgeCutoff, arr);
  }
  return m;
}

const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000;

export function monthsBetween(cutoff: string, release: string): number {
  const c = new Date(`${cutoff}-01T00:00:00Z`).getTime();
  const r = new Date(`${release}T00:00:00Z`).getTime();
  return Math.round((r - c) / MS_PER_MONTH);
}

export function formatParams(model: Model): string {
  if (!model.openWeights || model.totalParams === undefined) return "—";
  if (model.architecture === "moe") {
    const e = model.experts ?? 0;
    return `${fmtB(model.totalParams)} / ${fmtB(model.activeParams ?? model.totalParams)} · ${e}E`;
  }
  return fmtB(model.totalParams);
}

function fmtB(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}T`;
  if (n >= 10) return `${Math.round(n)}B`;
  return `${n.toFixed(1)}B`;
}

export function formatScore(value: number, unit: Benchmark["unit"]): string {
  switch (unit) {
    case "accuracy":
    case "pass@1":
      return `${(value * 100).toFixed(1)}%`;
    case "elo":
      return Math.round(value).toString();
    case "index":
      return value.toFixed(1);
    case "score":
    default:
      return value.toFixed(2);
  }
}
