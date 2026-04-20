import { useMemo, useState } from "react";
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

interface Row {
  model: Model;
  cutoffTs: number;
  releaseTs: number;
  cutoffLabel: string;
  releaseLabel: string;
  days: number;
  color: string;
}

export default function CohortBars({ models }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { rows, minTs, maxTs, ticks, todayTs, totalModels } = useMemo(() => {
    const todayTs = Date.now();
    const YEAR_MS = 365 * 86_400_000;

    const allRows: Row[] = models.map((m) => {
      const cutoffTs = Date.UTC(
        Number(m.knowledgeCutoff.slice(0, 4)),
        Number(m.knowledgeCutoff.slice(5, 7)) - 1,
        1,
      );
      const releaseTs = new Date(`${m.releaseDate}T00:00:00Z`).getTime();
      return {
        model: m,
        cutoffTs,
        releaseTs,
        cutoffLabel: formatMonth(cutoffTs),
        releaseLabel: formatMonth(releaseTs),
        days: Math.max(
          1,
          Math.round((releaseTs - cutoffTs) / 86_400_000),
        ),
        color: PROVIDER_COLORS[m.provider] ?? DEFAULT_COLOR,
      };
    });

    let rows: Row[];
    let minTs: number;
    let maxTs: number;

    if (expanded) {
      rows = [...allRows].sort((a, b) => {
        if (a.cutoffTs !== b.cutoffTs) return b.cutoffTs - a.cutoffTs;
        return b.releaseTs - a.releaseTs;
      });
      const minCutoff = Math.min(...rows.map((r) => r.cutoffTs));
      const maxRelease = Math.max(...rows.map((r) => r.releaseTs));
      const pad = 30 * 86_400_000;
      minTs = minCutoff - pad;
      maxTs = maxRelease + pad;
    } else {
      rows = [...allRows]
        .sort((a, b) => b.releaseTs - a.releaseTs)
        .slice(0, 10)
        .sort((a, b) => {
          if (a.cutoffTs !== b.cutoffTs) return b.cutoffTs - a.cutoffTs;
          return b.releaseTs - a.releaseTs;
        });
      const pad = 30 * 86_400_000;
      minTs = todayTs - YEAR_MS - pad;
      maxTs = todayTs + pad;
    }

    const ticks: { ts: number; label: string }[] = [];
    const start = new Date(minTs);
    let year = start.getUTCFullYear();
    let month = start.getUTCMonth();
    month = Math.floor(month / 3) * 3;
    while (true) {
      const ts = Date.UTC(year, month, 1);
      if (ts > maxTs) break;
      if (ts >= minTs) ticks.push({ ts, label: formatMonth(ts) });
      month += 3;
      if (month >= 12) {
        month -= 12;
        year += 1;
      }
    }

    return {
      rows,
      minTs,
      maxTs,
      ticks,
      todayTs,
      totalModels: allRows.length,
    };
  }, [models, expanded]);

  const range = maxTs - minTs;
  const xPct = (ts: number) => ((ts - minTs) / range) * 100;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <div>
          Each bar spans from a model's knowledge cutoff
          <span className="mx-1 inline-block h-2 w-2 rounded-full bg-neutral-400 align-middle" />
          to its public release
          <span className="mx-1 inline-block h-2 w-2 bg-neutral-400 align-middle" />.
          Bars starting on the same date likely share a pretraining run.
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:border-amber-400 hover:text-amber-300"
        >
          {expanded
            ? `Show recent (${Math.min(10, totalModels)} / past year)`
            : `Show all ${totalModels} models`}
        </button>
      </div>

      <div
        className="grid items-stretch overflow-y-auto"
        style={{
          gridTemplateColumns: "13rem 1fr",
          maxHeight: expanded ? "70vh" : undefined,
        }}
      >
        {rows.map((row) => {
          const leftPct = xPct(row.cutoffTs);
          const rightPct = xPct(row.releaseTs);
          const widthPct = Math.max(rightPct - leftPct, 0.5);
          const showInlineDays = widthPct > 6;
          return (
            <RowView
              key={row.model.id}
              row={row}
              leftPct={leftPct}
              widthPct={widthPct}
              showInlineDays={showInlineDays}
            />
          );
        })}

        <div />
        <div className="relative mt-1 h-6 border-t border-neutral-800">
          {ticks.map((t) => {
            const left = xPct(t.ts);
            return (
              <div
                key={t.ts}
                className="absolute top-0 -translate-x-1/2 text-[10px] text-neutral-500"
                style={{ left: `${left}%` }}
              >
                <div className="h-1.5 w-px bg-neutral-700" />
                <div className="pt-0.5 whitespace-nowrap">{t.label}</div>
              </div>
            );
          })}
          {todayTs > minTs && todayTs < maxTs && (
            <div
              className="absolute top-0 h-4 w-px bg-red-500/60"
              style={{ left: `${xPct(todayTs)}%` }}
              title="today"
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-neutral-300 bg-neutral-200" />
          Knowledge cutoff
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 border border-neutral-300 bg-neutral-200" />
          Public release
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-px bg-red-500/60" />
          today
        </span>
        <span className="ml-2 text-neutral-600">·</span>
        {Object.entries(PROVIDER_COLORS)
          .filter(([name]) => models.some((m) => m.provider === name))
          .map(([name, color]) => (
            <span key={name} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {name}
            </span>
          ))}
      </div>
    </div>
  );
}

function RowView({
  row,
  leftPct,
  widthPct,
  showInlineDays,
}: {
  row: Row;
  leftPct: number;
  widthPct: number;
  showInlineDays: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-4 py-1">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-sm font-medium text-neutral-100">
            {row.model.name}
          </span>
          <span className="text-[10px] text-neutral-500">
            {row.model.provider}
          </span>
        </div>
      </div>
      <div className="relative py-3">
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-sm"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            height: 14,
            backgroundColor: `${row.color}40`,
            border: `1px solid ${row.color}`,
          }}
          title={`${row.model.name} — ${row.cutoffLabel} cutoff → ${row.releaseLabel} release (${row.days} days)`}
        >
          {showInlineDays && (
            <div className="flex h-full items-center justify-center">
              <span className="text-[9px] font-mono text-neutral-300">
                {row.days}d
              </span>
            </div>
          )}
        </div>
        <div
          className="absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            left: `${leftPct}%`,
            backgroundColor: row.color,
            borderColor: "#fafafa",
          }}
        />
        <div
          className="absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border"
          style={{
            left: `${xPct2(leftPct, widthPct)}%`,
            backgroundColor: row.color,
            borderColor: "#fafafa",
          }}
        />
        <div
          className="absolute -translate-x-1/2 -translate-y-[14px] text-[9px] font-mono text-neutral-400"
          style={{ left: `${leftPct}%` }}
        >
          {row.cutoffLabel}
        </div>
        <div
          className="absolute -translate-x-1/2 translate-y-[10px] text-[9px] font-mono text-neutral-300"
          style={{ left: `${xPct2(leftPct, widthPct)}%` }}
        >
          {row.releaseLabel}
        </div>
      </div>
    </>
  );
}

function xPct2(left: number, width: number): number {
  return left + width;
}

function formatMonth(ts: number): string {
  const d = new Date(ts);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
