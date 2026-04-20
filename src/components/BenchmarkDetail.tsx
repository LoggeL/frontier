import { useMemo, useState } from "react";
import type { Benchmark, Model, Score } from "../lib/schema";
import { formatScore } from "../lib/derive";

interface Props {
  benchmark: Benchmark;
  benchmarks: Benchmark[];
  models: Model[];
  scores: Score[];
}

interface Row {
  model: Model;
  value: number;
  notes?: string;
}

export default function BenchmarkDetail({
  benchmark,
  benchmarks,
  models,
  scores,
}: Props) {
  const [activeVariant, setActiveVariant] = useState<string>(
    benchmark.variants[0]!.key,
  );

  const rows = useMemo(() => {
    const modelsById = new Map(models.map((m) => [m.id, m]));
    const out: Row[] = [];
    for (const s of scores) {
      if (s.benchmarkId !== benchmark.id || s.variant !== activeVariant) continue;
      const m = modelsById.get(s.modelId);
      if (!m) continue;
      out.push({ model: m, value: s.value, notes: s.notes });
    }
    out.sort((a, b) =>
      benchmark.higherIsBetter ? b.value - a.value : a.value - b.value,
    );
    return out;
  }, [benchmark, scores, models, activeVariant]);

  const { min, max } = useMemo(() => {
    if (rows.length === 0) return { min: 0, max: 1 };
    const values = rows.map((r) => r.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [rows]);

  const activeVariantMeta = benchmark.variants.find(
    (v) => v.key === activeVariant,
  );

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-100">
                {benchmark.name}
              </h1>
              <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-400 capitalize">
                {benchmark.category}
              </span>
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-xs",
                  benchmark.source === "aa"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-neutral-700 bg-neutral-900 text-neutral-400",
                ].join(" ")}
              >
                {benchmark.source === "aa" ? "Artificial Analysis" : "custom"}
              </span>
              {benchmark.primary && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                  primary
                </span>
              )}
            </div>
            {benchmark.description && (
              <p className="max-w-3xl text-sm text-neutral-300">
                {benchmark.description}
              </p>
            )}
            {benchmark.sourceUrl && (
              <a
                href={benchmark.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-amber-300 hover:underline"
              >
                {benchmark.sourceUrl} ↗
              </a>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">
              Jump to
            </span>
            <select
              defaultValue={benchmark.id}
              onChange={(e) => {
                const next = e.target.value;
                if (next && next !== benchmark.id) {
                  window.location.href = `${base}/benchmarks/${next}/`;
                }
              }}
              className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              {[...benchmarks]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {benchmark.variants.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 text-xs w-fit">
          {benchmark.variants.map((v) => (
            <button
              key={v.key}
              onClick={() => setActiveVariant(v.key)}
              className={[
                "rounded-md px-3 py-1 transition-colors",
                activeVariant === v.key
                  ? "bg-amber-400/10 text-amber-200"
                  : "text-neutral-400 hover:text-neutral-100",
              ].join(" ")}
              title={v.notes}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {activeVariantMeta && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-400">
          <span className="font-semibold uppercase tracking-wide text-neutral-500">
            {activeVariantMeta.label} —{" "}
          </span>
          {activeVariantMeta.notes}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-200">
            Leaderboard
          </h2>
          <span className="text-xs text-neutral-500">
            {rows.length} {rows.length === 1 ? "model" : "models"} ·{" "}
            {benchmark.higherIsBetter ? "higher is better" : "lower is better"}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-500">
            No scores recorded for this variant.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/40">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2 text-right w-12">#</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2 font-mono">Release</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 w-64">Relative</th>
                  <th className="px-3 py-2 text-right">Δ top</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const normalized =
                    max === min
                      ? 0.5
                      : (r.value - min) / (max - min);
                  const color = heatColor(
                    benchmark.higherIsBetter ? normalized : 1 - normalized,
                  );
                  const top = rows[0]!.value;
                  const delta = benchmark.higherIsBetter
                    ? top - r.value
                    : r.value - top;
                  const isTop = i === 0;
                  return (
                    <tr
                      key={r.model.id}
                      className={[
                        "border-t border-neutral-800 transition-colors",
                        isTop ? "bg-amber-500/5" : "hover:bg-neutral-900",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2 text-right font-mono text-xs text-neutral-500">
                        {isTop ? (
                          <span className="text-amber-300">★ {i + 1}</span>
                        ) : (
                          i + 1
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`${base}/models/${r.model.id}/`}
                          className="font-medium text-neutral-100 hover:text-amber-300"
                          title={r.notes}
                        >
                          {r.model.name}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-neutral-400">
                        {r.model.provider}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                        {r.model.releaseDate}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-neutral-50">
                        {formatScore(r.value, benchmark.unit)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative h-2 rounded bg-neutral-800">
                          <div
                            className="absolute inset-y-0 left-0 rounded"
                            style={{
                              width: `${Math.max(4, normalized * 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {isTop ? (
                          <span className="text-emerald-300">—</span>
                        ) : (
                          <span className="text-neutral-400">
                            {benchmark.unit === "accuracy" ||
                            benchmark.unit === "pass@1"
                              ? `${(delta * 100).toFixed(1)}pp`
                              : delta.toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function heatColor(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  const hue = 120 * clamped;
  return `hsl(${hue}, 75%, 55%)`;
}
