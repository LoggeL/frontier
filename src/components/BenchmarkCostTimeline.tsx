import { useMemo } from "react";
import type { AaValueHistoryRow } from "../lib/schema";

interface Props {
  models: AaValueHistoryRow[];
}

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: "#d97706",
  OpenAI: "#10b981",
  Google: "#3b82f6",
  Meta: "#8b5cf6",
  Mistral: "#f97316",
  DeepSeek: "#ef4444",
  Alibaba: "#f43f5e",
  xAI: "#a3a3a3",
  "Z AI": "#14b8a6",
  Kimi: "#eab308",
  MiniMax: "#22d3ee",
  NVIDIA: "#84cc16",
  Cohere: "#ec4899",
};

const DEFAULT_COLOR = "#737373";

interface Point {
  id: string;
  name: string;
  provider: string;
  releaseTs: number;
  releaseLabel: string;
  intelligence: number;
  cost: number;
  value: number;
  color: string;
}

export default function BenchmarkCostTimeline({ models }: Props) {
  const {
    points,
    minTs,
    maxTs,
    minCost,
    maxCost,
    yTicks,
    ticks,
    cheapestPoints,
    regression,
    quarterly,
    medianRegression,
    p90Regression,
    cheapestRegression,
    frontier,
  } = useMemo(() => {
    const points = models
      .map((m) => {
        const releaseTs = new Date(`${m.releaseDate}T00:00:00Z`).getTime();
        return {
          id: m.id,
          name: m.name,
          provider: m.provider,
          releaseTs,
          releaseLabel: m.releaseDate,
          intelligence: m.aaIntelligenceIndex,
          cost: m.aaBenchmarkTotalCost,
          value: m.aaBenchmarkValue,
          color: PROVIDER_COLORS[m.provider] ?? DEFAULT_COLOR,
        } satisfies Point;
      })
      .sort((a, b) => a.releaseTs - b.releaseTs);

    const minRelease = Math.min(...points.map((p) => p.releaseTs));
    const maxRelease = Math.max(...points.map((p) => p.releaseTs));
    const pad = 21 * 86_400_000;
    const minTs = minRelease - pad;
    const maxTs = maxRelease + pad;
    const minCost = Math.min(...points.map((p) => p.cost));
    const maxCost = Math.max(...points.map((p) => p.cost));
    const yTicks = makeLogTicks(minCost, maxCost);

    const ticks: { ts: number; label: string }[] = [];
    let year = new Date(minTs).getUTCFullYear();
    for (;;) {
      const ts = Date.UTC(year, 0, 1);
      if (ts > maxTs) break;
      if (ts >= minTs) ticks.push({ ts, label: String(year) });
      year += 1;
    }

    const cheapestPoints = [...points].sort((a, b) => a.cost - b.cost).slice(0, 10);
    const quarterly = computeQuarterlyStats(points);
    const regression = computeLogRegression(points);
    const medianRegression = computeLogRegressionFromSeries(quarterly.map((q) => ({ x: q.ts, y: q.median })));
    const p90Regression = computeLogRegressionFromSeries(quarterly.map((q) => ({ x: q.ts, y: q.p90 })));
    const cheapestRegression = computeLogRegressionFromSeries(quarterly.map((q) => ({ x: q.ts, y: q.best })));
    const frontier = computeFrontier(points);
    return {
      points,
      minTs,
      maxTs,
      minCost,
      maxCost,
      yTicks,
      ticks,
      cheapestPoints,
      regression,
      quarterly,
      medianRegression,
      p90Regression,
      cheapestRegression,
      frontier,
    };
  }, [models]);

  const rangeTs = Math.max(1, maxTs - minTs);
  const minLog = Math.log10(Math.max(1e-9, minCost));
  const maxLog = Math.log10(Math.max(1e-9, maxCost));
  const rangeLog = Math.max(1e-9, maxLog - minLog);
  const xPct = (ts: number) => ((ts - minTs) / rangeTs) * 100;
  const yPct = (value: number) =>
    (1 - (Math.log10(Math.max(1e-9, value)) - minLog) / rangeLog) * 100;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">
            AA benchmark run price over time
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-neutral-500">
            y = dollar cost to run the full Artificial Analysis intelligence benchmark. Log scale; lower is better.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <StatPill label="models" value={String(points.length)} />
          <StatPill
            label="raw"
            value={formatTrend(regression)}
            tone={regression && regression.annualPct > 0 ? "bad" : "good"}
          />
          <StatPill
            label="median qtr"
            value={formatTrend(medianRegression)}
            tone={medianRegression && medianRegression.annualPct > 0 ? "bad" : "good"}
          />
          <StatPill
            label="p90 qtr"
            value={formatTrend(p90Regression)}
            tone={p90Regression && p90Regression.annualPct > 0 ? "bad" : "good"}
          />
        </div>
      </div>

      <div className="mb-4 grid gap-2 text-xs sm:grid-cols-3">
        <InsightCard
          label="Distribution trend"
          value={formatTrend(medianRegression)}
          note="Quarterly median benchmark-run price. Negative trend means the middle of the pack is getting cheaper."
        />
        <InsightCard
          label="Expensive tier"
          value={formatTrend(p90Regression)}
          note="Quarterly 90th percentile price. Answers whether the pricey frontier is getting even pricier."
        />
        <InsightCard
          label="Cheapest seen"
          value={formatTrend(cheapestRegression)}
          note={`${frontier.length} new low-price records over time.`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-x-auto frontier-scroll rounded border border-neutral-800 bg-neutral-950/40">
          <div className="relative h-[360px] min-w-[720px] px-10 py-6 sm:h-[500px] sm:px-12">
            {yTicks.map((value) => {
              const top = yPct(value);
              return (
                <div key={value} className="absolute inset-x-10 sm:inset-x-12" style={{ top: `${top}%` }}>
                  <div className="border-t border-neutral-800" />
                  <div className="absolute -left-8 -translate-y-1/2 text-[10px] text-neutral-500">
                    {formatDollarTick(value)}
                  </div>
                </div>
              );
            })}

            {ticks.map((tick) => (
              <div key={tick.ts} className="absolute inset-y-6" style={{ left: `calc(${xPct(tick.ts)}% + 3rem)` }}>
                <div className="h-full border-l border-neutral-850" />
                <div className="absolute bottom-[-1.25rem] -translate-x-1/2 text-[10px] text-neutral-500">
                  {tick.label}
                </div>
              </div>
            ))}

            <svg className="pointer-events-none absolute inset-x-10 inset-y-6 sm:inset-x-12" preserveAspectRatio="none">
              {quarterly.length > 1 && (
                <>
                  <polyline
                    points={quarterly.map((q) => `${xPct(q.ts)},${yPct(q.median)}`).join(" ")}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={quarterly.map((q) => `${xPct(q.ts)},${yPct(q.p90)}`).join(" ")}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
              {regression && (
                <line
                  x1={`${xPct(regression.startTs)}%`}
                  y1={`${yPct(regression.startValue)}%`}
                  x2={`${xPct(regression.endTs)}%`}
                  y2={`${yPct(regression.endValue)}%`}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="7 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {quarterly.map((q) => (
              <div
                key={q.label}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100 bg-sky-400"
                style={{ left: `calc(${xPct(q.ts)}% + 3rem)`, top: `calc(${yPct(q.median)}% + 1.5rem)` }}
                title={`${q.label} median ${q.median.toFixed(2)} (${q.count} models)`}
              />
            ))}

            {points.map((point) => (
              <div
                key={point.id}
                className="group absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 opacity-40 hover:z-20 hover:h-3 hover:w-3 hover:opacity-100"
                style={{
                  left: `calc(${xPct(point.releaseTs)}% + 3rem)`,
                  top: `calc(${yPct(point.cost)}% + 1.5rem)`,
                  backgroundColor: point.color,
                }}
              >
                <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden w-56 -translate-x-1/2 -translate-y-[110%] rounded border border-neutral-700 bg-neutral-950/95 p-2 text-[11px] text-neutral-200 shadow-xl group-hover:block">
                  <div className="font-medium text-neutral-100">{point.name}</div>
                  <div className="mt-1 text-neutral-400">{point.provider} · {point.releaseLabel}</div>
                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                    <span className="text-neutral-500">Benchmark cost</span><span>${point.cost.toFixed(2)}</span>
                    <span className="text-neutral-500">Intelligence</span><span>{point.intelligence.toFixed(2)}</span>
                    <span className="text-neutral-500">Value</span><span>{point.value.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Legend / cheapest runs</div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-400">
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-sky-400" />quarter median</span>
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 border-t border-dashed border-emerald-400" />quarter p90</span>
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 border-t border-dashed border-amber-400" />raw regression</span>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
            {cheapestPoints.map((point, idx) => (
              <div key={point.id} className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-neutral-200">{idx + 1}. {point.name}</div>
                    <div className="text-[10px] text-neutral-500">{point.provider} · {point.releaseLabel}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-neutral-100">${point.cost.toFixed(2)}</div>
                    <div className="text-[10px] text-neutral-500">AA bench</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const toneClass = tone === "bad" ? "text-red-300" : tone === "good" ? "text-emerald-300" : "text-neutral-100";
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={["font-mono", toneClass].join(" ")}>{value}</div>
    </div>
  );
}

function makeLogTicks(minValue: number, maxValue: number) {
  const minExp = Math.floor(Math.log10(Math.max(1e-9, minValue)));
  const maxExp = Math.ceil(Math.log10(Math.max(1e-9, maxValue)));
  const ticks: number[] = [];
  for (let exp = minExp; exp <= maxExp; exp += 1) {
    for (const multiplier of [1, 2, 5]) {
      const value = multiplier * 10 ** exp;
      if (value >= minValue * 0.95 && value <= maxValue * 1.05) {
        ticks.push(value);
      }
    }
  }
  return ticks;
}

function formatDollarTick(value: number) {
  if (value >= 1000) return `$${Math.round(value)}`;
  if (value >= 100) return `$${value.toFixed(0)}`;
  if (value >= 10) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(1)}`;
  return `$${value.toFixed(2)}`;
}

function InsightCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-neutral-100">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-neutral-500">{note}</div>
    </div>
  );
}

interface RegressionResult {
  startTs: number;
  endTs: number;
  startValue: number;
  endValue: number;
  annualPct: number;
}

function formatTrend(regression?: RegressionResult) {
  if (!regression) return "—";
  return `${regression.annualPct >= 0 ? "+" : ""}${regression.annualPct.toFixed(0)}%/yr`;
}

interface QuarterStat {
  label: string;
  ts: number;
  count: number;
  median: number;
  p90: number;
  best: number;
}

function computeQuarterlyStats(points: Point[]): QuarterStat[] {
  const groups = new Map<string, Point[]>();
  for (const point of points) {
    const d = new Date(point.releaseTs);
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
    const label = `${d.getUTCFullYear()}Q${quarter}`;
    const group = groups.get(label) ?? [];
    group.push(point);
    groups.set(label, group);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, group]) => {
      const year = Number(label.slice(0, 4));
      const quarter = Number(label.slice(-1));
      const values = group.map((p) => p.cost).sort((a, b) => a - b);
      return {
        label,
        ts: Date.UTC(year, (quarter - 1) * 3 + 1, 15),
        count: values.length,
        median: quantile(values, 0.5),
        p90: quantile(values, 0.9),
        best: values[0]!,
      };
    });
}

function computeFrontier(points: Point[]) {
  let best = Number.POSITIVE_INFINITY;
  const frontier: Point[] = [];
  for (const point of [...points].sort((a, b) => a.releaseTs - b.releaseTs)) {
    if (point.cost < best) {
      frontier.push(point);
      best = point.cost;
    }
  }
  return frontier;
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!;
  const pos = (values.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = values[base]!;
  const hi = values[Math.min(base + 1, values.length - 1)]!;
  return lo + (hi - lo) * rest;
}

function computeLogRegressionFromSeries(series: { x: number; y: number }[]): RegressionResult | undefined {
  if (series.length < 2) return undefined;
  const xs = series.map((p) => decimalYear(p.x));
  const ys = series.map((p) => Math.log(p.y));
  const meanX = mean(xs);
  const meanY = mean(ys);
  const sxx = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
  if (sxx === 0) return undefined;
  const slope = xs.reduce((acc, x, i) => acc + (x - meanX) * (ys[i]! - meanY), 0) / sxx;
  const intercept = meanY - slope * meanX;
  const startTs = Math.min(...series.map((p) => p.x));
  const endTs = Math.max(...series.map((p) => p.x));
  const startValue = Math.exp(intercept + slope * decimalYear(startTs));
  const endValue = Math.exp(intercept + slope * decimalYear(endTs));
  return {
    startTs,
    endTs,
    startValue,
    endValue,
    annualPct: (Math.exp(slope) - 1) * 100,
  };
}

function computeLogRegression(points: Point[]) {
  if (points.length < 2) return undefined;
  const xs = points.map((p) => decimalYear(p.releaseTs));
  const ys = points.map((p) => Math.log(p.cost));
  const meanX = mean(xs);
  const meanY = mean(ys);
  const sxx = xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0);
  if (sxx === 0) return undefined;
  const slope = xs.reduce((acc, x, i) => acc + (x - meanX) * (ys[i]! - meanY), 0) / sxx;
  const intercept = meanY - slope * meanX;
  const startTs = Math.min(...points.map((p) => p.releaseTs));
  const endTs = Math.max(...points.map((p) => p.releaseTs));
  const startValue = Math.exp(intercept + slope * decimalYear(startTs));
  const endValue = Math.exp(intercept + slope * decimalYear(endTs));
  return {
    startTs,
    endTs,
    startValue,
    endValue,
    annualPct: (Math.exp(slope) - 1) * 100,
  };
}

function decimalYear(ts: number) {
  const d = new Date(ts);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const end = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  return d.getUTCFullYear() + (ts - start) / (end - start);
}

function mean(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}
