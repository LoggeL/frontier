import { useMemo } from "react";
import type { Model } from "../lib/schema";

interface Props {
  models: Model[];
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

export default function BenchmarkValueTimeline({ models }: Props) {
  const { points, minTs, maxTs, minValue, maxValue, ticks, topPoints } = useMemo(() => {
    const points = models
      .filter((m) => m.aaBenchmarkValue !== undefined && m.aaBenchmarkTotalCost !== undefined && m.aaIntelligenceIndex !== undefined)
      .map((m) => {
        const releaseTs = new Date(`${m.releaseDate}T00:00:00Z`).getTime();
        return {
          id: m.id,
          name: m.name,
          provider: m.provider,
          releaseTs,
          releaseLabel: m.releaseDate,
          intelligence: m.aaIntelligenceIndex!,
          cost: m.aaBenchmarkTotalCost!,
          value: m.aaBenchmarkValue!,
          color: PROVIDER_COLORS[m.provider] ?? DEFAULT_COLOR,
        } satisfies Point;
      })
      .sort((a, b) => a.releaseTs - b.releaseTs);

    const minRelease = Math.min(...points.map((p) => p.releaseTs));
    const maxRelease = Math.max(...points.map((p) => p.releaseTs));
    const pad = 21 * 86_400_000;
    const minTs = minRelease - pad;
    const maxTs = maxRelease + pad;
    const minValue = Math.min(...points.map((p) => p.value));
    const maxValue = Math.max(...points.map((p) => p.value));

    const ticks: { ts: number; label: string }[] = [];
    let year = new Date(minTs).getUTCFullYear();
    for (;;) {
      const ts = Date.UTC(year, 0, 1);
      if (ts > maxTs) break;
      if (ts >= minTs) ticks.push({ ts, label: String(year) });
      year += 1;
    }

    const topPoints = [...points].sort((a, b) => b.value - a.value).slice(0, 10);
    return { points, minTs, maxTs, minValue, maxValue, ticks, topPoints };
  }, [models]);

  const rangeTs = Math.max(1, maxTs - minTs);
  const rangeValue = Math.max(1e-9, maxValue - minValue);
  const xPct = (ts: number) => ((ts - minTs) / rangeTs) * 100;
  const yPct = (value: number) => (1 - (value - minValue) / rangeValue) * 100;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">
            Intelligence per benchmark-dollar
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            y = Artificial Analysis intelligence index / cost to run the full AA benchmark. Higher is better.
          </p>
        </div>
        <span className="text-xs text-neutral-500">{points.length} models with AA cost + intelligence data</span>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="relative h-[460px] rounded border border-neutral-800 bg-neutral-950/40 px-10 py-6">
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => {
            const value = minValue + (maxValue - minValue) * f;
            const top = yPct(value);
            return (
              <div key={f} className="absolute inset-x-10" style={{ top: `${top}%` }}>
                <div className="border-t border-neutral-800" />
                <div className="absolute -left-9 -translate-y-1/2 text-[10px] text-neutral-500">
                  {value.toFixed(1)}
                </div>
              </div>
            );
          })}

          {ticks.map((tick) => (
            <div key={tick.ts} className="absolute inset-y-6" style={{ left: `calc(${xPct(tick.ts)}% + 2.5rem)` }}>
              <div className="h-full border-l border-neutral-850" />
              <div className="absolute bottom-[-1.25rem] -translate-x-1/2 text-[10px] text-neutral-500">
                {tick.label}
              </div>
            </div>
          ))}

          {points.map((point) => (
            <div
              key={point.id}
              className="group absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
              style={{
                left: `calc(${xPct(point.releaseTs)}% + 2.5rem)`,
                top: `calc(${yPct(point.value)}% + 1.5rem)`,
                backgroundColor: point.color,
              }}
            >
              <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden w-56 -translate-x-1/2 -translate-y-[110%] rounded border border-neutral-700 bg-neutral-950/95 p-2 text-[11px] text-neutral-200 shadow-xl group-hover:block">
                <div className="font-medium text-neutral-100">{point.name}</div>
                <div className="mt-1 text-neutral-400">{point.provider} · {point.releaseLabel}</div>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  <span className="text-neutral-500">Intelligence</span><span>{point.intelligence.toFixed(2)}</span>
                  <span className="text-neutral-500">Benchmark cost</span><span>${point.cost.toFixed(2)}</span>
                  <span className="text-neutral-500">Value</span><span>{point.value.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="w-72 rounded border border-neutral-800 bg-neutral-950/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Top value models</div>
          <div className="mt-3 flex flex-col gap-2 text-xs">
            {topPoints.map((point, idx) => (
              <div key={point.id} className="rounded border border-neutral-800 bg-neutral-900/70 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-neutral-200">{idx + 1}. {point.name}</div>
                    <div className="text-[10px] text-neutral-500">{point.provider} · {point.releaseLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-neutral-100">{point.value.toFixed(2)}</div>
                    <div className="text-[10px] text-neutral-500">idx / $bench</div>
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
