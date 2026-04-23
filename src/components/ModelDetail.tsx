import { useMemo, useState } from "react";
import type { Benchmark, Model, Score } from "../lib/schema";
import {
  buildScoreMatrix,
  formatParams,
  formatScore,
  monthsBetween,
  type ScoreMatrix,
} from "../lib/derive";
import ComparisonTable from "./ComparisonTable";

interface Props {
  model: Model;
  models: Model[];
  benchmarks: Benchmark[];
  scores: Score[];
}

type PeerMode = "intelligence" | "cohort" | "release";

export default function ModelDetail({
  model,
  models,
  benchmarks,
  scores,
}: Props) {
  const [peerMode, setPeerMode] = useState<PeerMode>("intelligence");

  const matrix = useMemo(() => buildScoreMatrix(scores), [scores]);

  const intelligenceIndex = lookupValue(matrix, model.id, "aa-intelligence-index");

  const intelligencePeers = useMemo(() => {
    if (intelligenceIndex !== undefined) {
      const band = 7;
      return models.filter((m) => {
        const v = lookupValue(matrix, m.id, "aa-intelligence-index");
        return v !== undefined && Math.abs(v - intelligenceIndex) <= band;
      });
    }
    return computeMetricSimilarityPeers(model, models, benchmarks, matrix);
  }, [intelligenceIndex, model, models, benchmarks, matrix]);

  const peers = useMemo(() => {
    switch (peerMode) {
      case "intelligence": {
        return intelligencePeers;
      }
      case "cohort":
        return models.filter(
          (m) => m.knowledgeCutoff === model.knowledgeCutoff,
        );
      case "release": {
        const t = new Date(`${model.releaseDate}T00:00:00Z`).getTime();
        const windowMs = 90 * 86_400_000;
        return models.filter((m) => {
          const u = new Date(`${m.releaseDate}T00:00:00Z`).getTime();
          return Math.abs(u - t) <= windowMs;
        });
      }
    }
  }, [peerMode, model, models, matrix, intelligencePeers]);

  const frontier = useMemo(
    () => computeFrontier(model, benchmarks, scores, models),
    [model, benchmarks, scores, models],
  );

  return (
    <div className="flex flex-col gap-8">
      <ModelHero
        model={model}
        models={models}
        matrix={matrix}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-neutral-200">
              Peer set
            </h2>
            <p className="text-xs text-neutral-500">
              Models surrounding {model.name} by the selected dimension.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 text-xs">
            <PeerTab
              active={peerMode === "intelligence"}
              onClick={() => setPeerMode("intelligence")}
              label="Intelligence ±7"
            />
            <PeerTab
              active={peerMode === "cohort"}
              onClick={() => setPeerMode("cohort")}
              label="Same cutoff cohort"
            />
            <PeerTab
              active={peerMode === "release"}
              onClick={() => setPeerMode("release")}
              label="Release ±90d"
            />
          </div>
        </div>

        {peers.length <= 1 ? (
          <div className="rounded border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-500">
            No peers found for this dimension.
          </div>
        ) : (
          <ComparisonTable
            models={peers}
            benchmarks={benchmarks}
            scores={scores}
            focusModelId={model.id}
            visibleBenchmarkIds={benchmarks
              .filter((b) => lookupValue(matrix, model.id, b.id) !== undefined)
              .map((b) => b.id)}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-200">
            Frontier per benchmark
          </h2>
          <p className="text-xs text-neutral-500">
            For every benchmark with a score, compared against the current
            frontier model.
          </p>
        </div>
        <FrontierTable rows={frontier} selectedId={model.id} />
      </section>
    </div>
  );
}

function ModelHero({
  model,
  models,
  matrix,
}: {
  model: Model;
  models: Model[];
  matrix: ReturnType<typeof buildScoreMatrix>;
}) {
  const gap = monthsBetween(model.knowledgeCutoff, model.releaseDate);
  const idx = lookupValue(matrix, model.id, "aa-intelligence-index");

  const sorted = models
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-100">
              {model.name}
            </h1>
            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-400">
              {model.provider}
            </span>
            {model.openWeights && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                open weights
              </span>
            )}
          </div>
          <div className="grid gap-x-8 gap-y-1 text-sm text-neutral-300 sm:grid-cols-2 md:grid-cols-4">
            <Meta label="Released" value={model.releaseDate} />
            <Meta
              label="Knowledge cutoff"
              value={`${model.knowledgeCutoff} (${gap}mo lag)`}
            />
            <Meta
              label="Context"
              value={
                model.contextWindow
                  ? `${(model.contextWindow / 1000).toLocaleString()}K tokens`
                  : "—"
              }
            />
            <Meta
              label="Intelligence Index"
              value={
                idx !== undefined ? idx.toFixed(1) : <span className="text-neutral-600">—</span>
              }
            />
            {model.openWeights && (
              <>
                <Meta label="Params" value={formatParams(model)} />
                <Meta
                  label="Architecture"
                  value={model.architecture ?? "—"}
                />
                {model.hfLink && (
                  <Meta
                    label="Hugging Face"
                    value={
                      <a
                        href={model.hfLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:text-amber-300"
                      >
                        {shortHfSlug(model.hfLink)} ↗
                      </a>
                    }
                  />
                )}
                {model.cohortLabel && (
                  <Meta label="Cohort" value={model.cohortLabel} />
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">
            Jump to
          </span>
          <select
            defaultValue={model.id}
            onChange={(e) => {
              const next = e.target.value;
              if (next && next !== model.id) {
                const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                window.location.href = `${base}/models/${next}/`;
              }
            }}
            className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            {sorted.map((id) => {
              const m = models.find((x) => x.id === id)!;
              return (
                <option key={id} value={id}>
                  {m.name}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  );
}

function computeMetricSimilarityPeers(
  model: Model,
  models: Model[],
  benchmarks: Benchmark[],
  matrix: ScoreMatrix,
): Model[] {
  const benchmarkIds = benchmarks.map((b) => b.id);
  const target = benchmarkIds
    .map((bid) => [bid, lookupValue(matrix, model.id, bid)] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== undefined);

  if (target.length === 0) return [model];

  const scored = models
    .map((candidate) => {
      const deltas: number[] = [];
      for (const [bid, value] of target) {
        const peerValue = lookupValue(matrix, candidate.id, bid);
        if (peerValue === undefined) continue;
        deltas.push(Math.abs(peerValue - value));
      }
      if (deltas.length < Math.max(3, Math.ceil(target.length * 0.3))) {
        return null;
      }
      const avgDelta = deltas.reduce((sum, x) => sum + x, 0) / deltas.length;
      return { candidate, avgDelta, overlap: deltas.length };
    })
    .filter((entry): entry is { candidate: Model; avgDelta: number; overlap: number } => entry !== null)
    .sort((a, b) => a.avgDelta - b.avgDelta || b.overlap - a.overlap || a.candidate.name.localeCompare(b.candidate.name));

  const top = scored.slice(0, 12).map((entry) => entry.candidate);
  return top.some((entry) => entry.id === model.id) ? top : [model, ...top].slice(0, 12);
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function PeerTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1 transition-colors",
        active
          ? "bg-amber-400/10 text-amber-200"
          : "text-neutral-400 hover:text-neutral-100",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

interface FrontierRow {
  benchmark: Benchmark;
  variant: string;
  variantLabel: string;
  selected?: number;
  frontierModelId: string;
  frontierModelName: string;
  frontierValue: number;
  isSelectedFrontier: boolean;
  percentileAmongScored: number;
  totalScored: number;
}

function computeFrontier(
  model: Model,
  benchmarks: Benchmark[],
  scores: Score[],
  models: Model[],
): FrontierRow[] {
  const nameById = new Map(models.map((m) => [m.id, m.name]));
  const rows: FrontierRow[] = [];
  for (const b of benchmarks) {
    for (const v of b.variants) {
      const entries = scores.filter(
        (s) => s.benchmarkId === b.id && s.variant === v.key,
      );
      if (entries.length === 0) continue;
      const selected = entries.find((s) => s.modelId === model.id)?.value;
      if (selected === undefined) continue;
      const cmp = (a: number, x: number) =>
        b.higherIsBetter ? a > x : a < x;
      let top = entries[0]!;
      for (const e of entries) {
        if (cmp(e.value, top.value)) top = e;
      }
      const totalScored = entries.length;
      const rank = entries.filter((e) =>
        b.higherIsBetter
          ? e.value < (selected ?? -Infinity)
          : e.value > (selected ?? Infinity),
      ).length;
      const pct =
        selected === undefined ? 0 : Math.round((rank / totalScored) * 100);
      rows.push({
        benchmark: b,
        variant: v.key,
        variantLabel: v.label,
        selected,
        frontierModelId: top.modelId,
        frontierModelName: nameById.get(top.modelId) ?? top.modelId,
        frontierValue: top.value,
        isSelectedFrontier: top.modelId === model.id,
        percentileAmongScored: pct,
        totalScored,
      });
    }
  }
  return rows;
}

function FrontierTable({
  rows,
  selectedId,
}: {
  rows: FrontierRow[];
  selectedId: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-500">
        No benchmark data available.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/40">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-3 py-2">Benchmark</th>
            <th className="px-3 py-2">Variant</th>
            <th className="px-3 py-2 text-right">This model</th>
            <th className="px-3 py-2 text-right">Frontier</th>
            <th className="px-3 py-2">Leader</th>
            <th className="px-3 py-2 text-right">Gap</th>
            <th className="px-3 py-2 text-right w-32">%ile</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gap =
              r.selected === undefined
                ? undefined
                : r.benchmark.higherIsBetter
                  ? r.frontierValue - r.selected
                  : r.selected - r.frontierValue;
            const isFrontier = r.isSelectedFrontier;
            const pct = r.selected === undefined ? null : r.percentileAmongScored;
            const scoreBg = pct === null ? undefined : heatBg(pct / 100);
            const gapBg =
              pct === null
                ? undefined
                : isFrontier
                  ? heatBg(1)
                  : heatBg(pct / 100);
            return (
              <tr
                key={`${r.benchmark.id}::${r.variant}`}
                className={[
                  "border-t border-neutral-800",
                  isFrontier
                    ? "bg-amber-500/5 hover:bg-amber-500/10"
                    : "hover:bg-neutral-900",
                ].join(" ")}
              >
                <td className="px-3 py-2 text-neutral-100">
                  {isFrontier && (
                    <span className="mr-1.5 align-middle text-amber-300">★</span>
                  )}
                  <a
                    href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/benchmarks/${r.benchmark.id}/`}
                    className="hover:text-amber-300"
                  >
                    {r.benchmark.name}
                  </a>
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {r.variantLabel}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono font-semibold"
                  style={scoreBg ? { backgroundColor: scoreBg } : undefined}
                >
                  {r.selected === undefined ? (
                    <span className="text-neutral-700">—</span>
                  ) : (
                    <span className="text-neutral-50">
                      {formatScore(r.selected, r.benchmark.unit)}
                    </span>
                  )}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono text-amber-200"
                  style={{
                    backgroundColor: isFrontier
                      ? "hsla(40, 80%, 50%, 0.18)"
                      : "hsla(40, 60%, 40%, 0.08)",
                  }}
                >
                  {formatScore(r.frontierValue, r.benchmark.unit)}
                </td>
                <td className="px-3 py-2">
                  {isFrontier ? (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
                      this model
                    </span>
                  ) : (
                    <a
                      href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/models/${r.frontierModelId}/`}
                      className="text-amber-300 hover:underline"
                    >
                      {r.frontierModelName}
                    </a>
                  )}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono text-xs"
                  style={gapBg ? { backgroundColor: gapBg } : undefined}
                >
                  {gap === undefined ? (
                    <span className="text-neutral-700">—</span>
                  ) : gap === 0 ? (
                    <span className="font-semibold text-emerald-300">—</span>
                  ) : (
                    <span className="text-neutral-100">
                      {r.benchmark.unit === "accuracy" ||
                      r.benchmark.unit === "pass@1"
                        ? `${(gap * 100).toFixed(1)}pp`
                        : gap.toFixed(1)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {pct === null ? (
                    <div className="text-right text-neutral-700 font-mono text-xs">—</div>
                  ) : (
                    <PercentileBar value={pct} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PercentileBar({ value }: { value: number }) {
  const color = heatColor(value / 100);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 flex-1 rounded bg-neutral-800">
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="w-6 text-right font-mono text-[10px]"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

function heatBg(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  const hue = 120 * clamped;
  return `hsla(${hue}, 65%, 42%, 0.35)`;
}

function heatColor(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  const hue = 120 * clamped;
  return `hsl(${hue}, 75%, 60%)`;
}

function lookupValue(
  matrix: ReturnType<typeof buildScoreMatrix>,
  modelId: string,
  benchmarkId: string,
  variant = "default",
): number | undefined {
  const cell = matrix
    .get(modelId)
    ?.get(benchmarkId)
    ?.find((c) => c.variant === variant);
  return cell?.value;
}

function shortHfSlug(url: string): string {
  const m = /huggingface\.co\/(.+?)\/?$/.exec(url);
  return m ? m[1]! : url;
}
