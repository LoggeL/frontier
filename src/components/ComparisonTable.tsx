import { useEffect, useMemo, useState } from "react";
import type { Benchmark, Model, Score } from "../lib/schema";
import {
  baselineNormalize,
  buildScoreMatrix,
  columnExtents,
  formatScore,
  normalize,
} from "../lib/derive";
import BenchmarkHeader from "./BenchmarkHeader";

interface Props {
  models: Model[];
  benchmarks: Benchmark[];
  scores: Score[];
  focusModelId?: string;
  visibleBenchmarkIds?: string[];
}

type SortKey =
  | { kind: "model" }
  | { kind: "release" }
  | { kind: "cutoff" }
  | { kind: "benchmark"; benchmarkId: string; variant: string };

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const ALL_CATEGORIES: Benchmark["category"][] = [
  "composite",
  "reasoning",
  "math",
  "code",
  "multimodal",
  "agentic",
  "custom",
];

export default function ComparisonTable({
  models,
  benchmarks,
  scores,
  focusModelId,
  visibleBenchmarkIds,
}: Props) {
  const [providerFilter, setProviderFilter] = useState<Set<string>>(
    new Set(Array.from(new Set(models.map((m) => m.provider)))),
  );
  const [openOnly, setOpenOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(
    new Set(ALL_CATEGORIES),
  );
  const [search, setSearch] = useState("");
  const [activeVariant, setActiveVariant] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        benchmarks.map((b) => [b.id, b.variants[0]?.key ?? "default"]),
      ),
  );
  const [sort, setSort] = useState<SortState>({
    key: { kind: "release" },
    dir: "desc",
  });
  const [hoverCell, setHoverCell] = useState<{
    col: string;
    value: number;
  } | null>(null);
  const effortGroups = useMemo(() => buildReasoningEffortGroups(models), [models]);
  const [effortGroupId, setEffortGroupId] = useState(() =>
    effortGroups[0]?.baseId ?? "",
  );
  const [effortModelIds, setEffortModelIds] = useState<Set<string>>(() =>
    new Set(effortGroups[0]?.models.map((m) => m.id) ?? []),
  );

  const matrix = useMemo(() => buildScoreMatrix(scores), [scores]);
  const extents = useMemo(
    () => columnExtents(benchmarks, scores),
    [benchmarks, scores],
  );
  const searchTerms = useMemo(
    () => search.toLowerCase().trim().split(/\s+/).filter(Boolean),
    [search],
  );

  useEffect(() => {
    if (effortGroups.length === 0) return;
    const current = effortGroups.find((g) => g.baseId === effortGroupId);
    if (!current) {
      const first = effortGroups[0]!;
      setEffortGroupId(first.baseId);
      setEffortModelIds(new Set(first.models.map((m) => m.id)));
    }
  }, [effortGroups, effortGroupId]);

  const selectedEffortModels = useMemo(() => {
    const group = effortGroups.find((g) => g.baseId === effortGroupId);
    if (!group) return [];
    return group.models.filter((m) => effortModelIds.has(m.id));
  }, [effortGroups, effortGroupId, effortModelIds]);

  const visibleBenchmarks = useMemo(
    () => benchmarks.filter(
      (b) => categoryFilter.has(b.category) && (!visibleBenchmarkIds || visibleBenchmarkIds.includes(b.id)),
    ),
    [benchmarks, categoryFilter, visibleBenchmarkIds],
  );

  const visibleModels = useMemo(() => {
    const filtered = models.filter((m) => {
      if (!providerFilter.has(m.provider)) return false;
      if (openOnly && !m.openWeights) return false;
      if (searchTerms.length === 0) return true;
      const haystack = [
        m.name,
        m.id,
        m.provider,
        m.knowledgeCutoff,
        m.releaseDate,
        m.cohortLabel ?? "",
        m.openWeights ? "open open-weight open-weights" : "closed",
      ]
        .join(" ")
        .toLowerCase();
      return searchTerms.every((term) => haystack.includes(term));
    });
    const sorted = [...filtered].sort(comparator(sort, matrix, activeVariant));
    if (!focusModelId) return sorted;
    const idx = sorted.findIndex((m) => m.id === focusModelId);
    if (idx <= 0) return sorted;
    const focus = sorted[idx]!;
    const without = sorted.filter((m) => m.id !== focusModelId);
    const middle = Math.floor(without.length / 2);
    return [...without.slice(0, middle), focus, ...without.slice(middle)];
  }, [models, providerFilter, openOnly, searchTerms, sort, matrix, activeVariant, focusModelId]);

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        models={models}
        providerFilter={providerFilter}
        setProviderFilter={setProviderFilter}
        openOnly={openOnly}
        setOpenOnly={setOpenOnly}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        search={search}
        setSearch={setSearch}
        resultCount={visibleModels.length}
        effortGroups={effortGroups}
        effortGroupId={effortGroupId}
        setEffortGroupId={setEffortGroupId}
        effortModelIds={effortModelIds}
        setEffortModelIds={setEffortModelIds}
      />

      <ReasoningEffortCompare
        models={selectedEffortModels}
        benchmarks={visibleBenchmarks}
        matrix={matrix}
        activeVariant={activeVariant}
      />

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/40">
        <table
          className="w-full text-sm"
          onMouseLeave={() => setHoverCell(null)}
        >
          <thead className="sticky top-0 bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <Th
                sticky
                active={sort.key.kind === "model"}
                dir={sort.dir}
                onClick={() => toggleSort(setSort, sort, { kind: "model" })}
              >
                Model
              </Th>
              <Th>Provider</Th>
              <Th
                active={sort.key.kind === "release"}
                dir={sort.dir}
                onClick={() => toggleSort(setSort, sort, { kind: "release" })}
              >
                Release
              </Th>
              <Th
                active={sort.key.kind === "cutoff"}
                dir={sort.dir}
                onClick={() => toggleSort(setSort, sort, { kind: "cutoff" })}
              >
                Cutoff
              </Th>
              {visibleBenchmarks.map((b) => {
                const variant = activeVariant[b.id] ?? b.variants[0]!.key;
                const colKey = `${b.id}::${variant}`;
                const isSorted =
                  sort.key.kind === "benchmark" &&
                  sort.key.benchmarkId === b.id &&
                  sort.key.variant === variant;
                const isHovered = hoverCell?.col === colKey;
                return (
                  <Th
                    key={b.id}
                    active={isSorted}
                    dir={sort.dir}
                    hovered={isHovered}
                    onClick={() =>
                      toggleSort(setSort, sort, {
                        kind: "benchmark",
                        benchmarkId: b.id,
                        variant,
                      })
                    }
                  >
                    <BenchmarkHeader
                      benchmark={b}
                      activeVariant={variant}
                      onVariantChange={(k) =>
                        setActiveVariant((prev) => ({ ...prev, [b.id]: k }))
                      }
                    />
                  </Th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleModels.map((m) => {
              const isFocus = m.id === focusModelId;
              return (
              <tr
                key={m.id}
                className={[
                  "border-t border-neutral-800 hover:bg-neutral-900",
                  isFocus ? "bg-amber-500/8" : "",
                ].join(" ")}
              >
                <td className={[
                  "sticky left-0 px-3 py-2 font-medium text-neutral-100",
                  isFocus ? "bg-amber-950/40" : "bg-neutral-950",
                ].join(" ")}>
                  <a
                    href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/models/${m.id}/`}
                    className="flex flex-col leading-tight hover:text-amber-300"
                  >
                    <span className="inline-flex items-center gap-1">
                      {m.name}
                      {isFocus && (
                        <span className="rounded bg-amber-400/20 px-1 text-[9px] uppercase tracking-wider text-amber-200">
                          target
                        </span>
                      )}
                      {m.openWeights && (
                        <span
                          className="rounded bg-amber-500/15 px-1 text-[9px] uppercase tracking-wider text-amber-300"
                          title="open weights"
                        >
                          open
                        </span>
                      )}
                    </span>
                    {m.cohortLabel && (
                      <span
                        className="text-[10px] text-amber-400"
                        title={`Cohort: ${m.cohortLabel}`}
                      >
                        {m.cohortLabel}
                      </span>
                    )}
                  </a>
                </td>
                <td className="px-3 py-2 text-neutral-400">{m.provider}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                  {m.releaseDate}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                  {m.knowledgeCutoff}
                </td>
                {visibleBenchmarks.map((b) => {
                  const variant = activeVariant[b.id] ?? b.variants[0]!.key;
                  const colKey = `${b.id}::${variant}`;
                  const isHoveredCol = hoverCell?.col === colKey;
                  const cells = matrix.get(m.id)?.get(b.id) ?? [];
                  const cell = cells.find((c) => c.variant === variant);
                  if (!cell) {
                    return (
                      <td
                        key={b.id}
                        className="px-3 py-2 text-center text-neutral-700"
                      >
                        —
                      </td>
                    );
                  }
                  const ext = extents.get(colKey);
                  const baseline =
                    isHoveredCol && hoverCell ? hoverCell.value : undefined;
                  const norm = ext
                    ? baseline !== undefined
                      ? baselineNormalize(cell.value, baseline, ext)
                      : normalize(cell.value, ext)
                    : 0.5;
                  const bg = ext ? heatColor(norm) : undefined;
                  const isBaselineCell =
                    baseline !== undefined && cell.value === baseline;
                  const variantMeta = b.variants.find(
                    (v) => v.key === variant,
                  );
                  const tipLines = [
                    `${b.name} — ${variantMeta?.label ?? variant}`,
                    variantMeta?.notes,
                    cell.notes ? `\nNote: ${cell.notes}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");
                  return (
                    <td
                      key={b.id}
                      className={[
                        "px-3 py-2 text-right transition-colors duration-75",
                        isBaselineCell ? "ring-1 ring-inset ring-neutral-200" : "",
                      ].join(" ")}
                      style={bg ? { backgroundColor: bg } : undefined}
                      onMouseEnter={() =>
                        setHoverCell({ col: colKey, value: cell.value })
                      }
                      title={tipLines}
                    >
                      <span className="font-mono text-sm text-neutral-100">
                        {formatScore(cell.value, b.unit)}
                      </span>
                      {variant !== "default" && (
                        <span className="ml-1 rounded bg-neutral-800 px-1 text-[9px] uppercase tracking-wide text-neutral-300">
                          {variant}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ReasoningEffortGroup {
  baseId: string;
  label: string;
  models: Model[];
}

function buildReasoningEffortGroups(models: Model[]): ReasoningEffortGroup[] {
  const groups = new Map<string, Model[]>();
  for (const model of models) {
    const effort = reasoningEffortLabel(model);
    if (!effort) continue;
    const baseId = model.id
      .replace(/-non-reasoning$/, "")
      .replace(/-(?:xhigh|high|medium|low)$/, "");
    const arr = groups.get(baseId) ?? [];
    arr.push(model);
    groups.set(baseId, arr);
  }

  return Array.from(groups.entries())
    .map(([baseId, groupModels]) => ({
      baseId,
      label: baseModelLabel(groupModels[0]!),
      models: groupModels.sort(
        (a, b) => reasoningEffortRank(a) - reasoningEffortRank(b),
      ),
    }))
    .filter((g) => g.models.length > 1)
    .sort((a, b) => b.models.length - a.models.length || a.label.localeCompare(b.label));
}

function baseModelLabel(model: Model): string {
  return model.name.replace(/\s*\((?:Non-reasoning|xhigh|high|medium|low)\)$/, "");
}

function reasoningEffortLabel(model: Model): string | null {
  const m = model.name.match(/\((Non-reasoning|xhigh|high|medium|low)\)$/i);
  return m?.[1] ?? null;
}

function reasoningEffortRank(model: Model): number {
  const label = reasoningEffortLabel(model)?.toLowerCase();
  switch (label) {
    case "non-reasoning":
      return 0;
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "xhigh":
      return 4;
    default:
      return 99;
  }
}

function ReasoningEffortCompare({
  models,
  benchmarks,
  matrix,
  activeVariant,
}: {
  models: Model[];
  benchmarks: Benchmark[];
  matrix: ReturnType<typeof buildScoreMatrix>;
  activeVariant: Record<string, string>;
}) {
  if (models.length < 2) return null;
  const usableBenchmarks = benchmarks.filter((b) =>
    models.some((m) => {
      const variant = activeVariant[b.id] ?? b.variants[0]?.key ?? "default";
      return matrix
        .get(m.id)
        ?.get(b.id)
        ?.some((c) => c.variant === variant);
    }),
  );
  if (usableBenchmarks.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-amber-400/20 bg-amber-400/5">
      <table className="w-full text-xs">
        <thead className="bg-neutral-950/80 text-left uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2 text-neutral-300">Effort compare</th>
            {models.map((m) => (
              <th key={m.id} className="px-3 py-2 text-right text-neutral-300">
                <a
                  href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/models/${m.id}/`}
                  className="hover:text-amber-300"
                >
                  {reasoningEffortLabel(m)}
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usableBenchmarks.map((b) => {
            const variant = activeVariant[b.id] ?? b.variants[0]?.key ?? "default";
            const values = models.map((m) =>
              matrix
                .get(m.id)
                ?.get(b.id)
                ?.find((c) => c.variant === variant),
            );
            const numeric = values.filter((v): v is NonNullable<typeof v> => Boolean(v));
            const best = numeric.length
              ? numeric.reduce((a, bCell) =>
                  b.higherIsBetter
                    ? bCell.value > a.value
                      ? bCell
                      : a
                    : bCell.value < a.value
                      ? bCell
                      : a,
                )
              : undefined;
            return (
              <tr key={b.id} className="border-t border-neutral-800/80">
                <td className="px-3 py-2 text-neutral-400">
                  {b.name}
                  {variant !== "default" && (
                    <span className="ml-1 text-neutral-600">· {variant}</span>
                  )}
                </td>
                {values.map((cell, idx) => {
                  const isBest = best && cell?.value === best.value;
                  const previous = idx > 0 ? values[idx - 1] : undefined;
                  const delta = cell && previous ? cell.value - previous.value : undefined;
                  return (
                    <td key={models[idx]!.id} className="px-3 py-2 text-right">
                      {cell ? (
                        <span className={isBest ? "font-semibold text-amber-200" : "font-mono text-neutral-200"}>
                          {formatScore(cell.value, b.unit)}
                        </span>
                      ) : (
                        <span className="text-neutral-700">—</span>
                      )}
                      {delta !== undefined && Math.abs(delta) > 0 && (
                        <span className={[
                          "ml-1 font-mono text-[10px]",
                          delta > 0 ? "text-emerald-300" : "text-red-300",
                        ].join(" ")}>
                          {delta > 0 ? "+" : ""}{formatDelta(delta, b.unit)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDelta(delta: number, unit: Benchmark["unit"]): string {
  switch (unit) {
    case "accuracy":
    case "pass@1":
      return `${(delta * 100).toFixed(1)}pp`;
    case "elo":
      return Math.round(delta).toString();
    case "index":
      return delta.toFixed(1);
    case "score":
    default:
      return delta.toFixed(2);
  }
}

function Th({
  children,
  onClick,
  onMouseEnter,
  active,
  dir,
  sticky,
  hovered,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  sticky?: boolean;
  hovered?: boolean;
}) {
  const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={[
        "px-3 py-2 align-bottom transition-colors",
        sticky ? "sticky left-0 bg-neutral-900 z-10" : "",
        onClick ? "cursor-pointer select-none" : "",
        active ? "text-amber-400" : "",
        hovered ? "bg-neutral-800 text-neutral-100" : "hover:text-neutral-100",
      ].join(" ")}
    >
      <span className="whitespace-nowrap">
        {children}
        {arrow}
      </span>
    </th>
  );
}

function Toolbar({
  models,
  providerFilter,
  setProviderFilter,
  openOnly,
  setOpenOnly,
  categoryFilter,
  setCategoryFilter,
  search,
  setSearch,
  resultCount,
  effortGroups,
  effortGroupId,
  setEffortGroupId,
  effortModelIds,
  setEffortModelIds,
}: {
  models: Model[];
  providerFilter: Set<string>;
  setProviderFilter: (s: Set<string>) => void;
  openOnly: boolean;
  setOpenOnly: (b: boolean) => void;
  categoryFilter: Set<string>;
  setCategoryFilter: (s: Set<string>) => void;
  search: string;
  setSearch: (s: string) => void;
  resultCount: number;
  effortGroups: ReasoningEffortGroup[];
  effortGroupId: string;
  setEffortGroupId: (id: string) => void;
  effortModelIds: Set<string>;
  setEffortModelIds: (s: Set<string>) => void;
}) {
  const providers = Array.from(new Set(models.map((m) => m.provider))).sort();
  const activeEffortGroup = effortGroups.find((g) => g.baseId === effortGroupId);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search model, provider, id, cutoff..."
          className="min-w-[240px] flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none"
        />
        <span className="text-neutral-500">{resultCount} shown</span>
        <label className="ml-2 inline-flex items-center gap-1.5 text-neutral-400">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="accent-amber-400"
          />
          open-weight only
        </label>
      </div>
      {effortGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/70 p-2">
          <span className="text-neutral-500">Reasoning efforts:</span>
          <select
            value={effortGroupId}
            onChange={(e) => {
              const id = e.target.value;
              const group = effortGroups.find((g) => g.baseId === id);
              setEffortGroupId(id);
              setEffortModelIds(new Set(group?.models.map((m) => m.id) ?? []));
            }}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-neutral-200 focus:border-amber-400 focus:outline-none"
          >
            {effortGroups.map((g) => (
              <option key={g.baseId} value={g.baseId}>
                {g.label}
              </option>
            ))}
          </select>
          {activeEffortGroup?.models.map((m) => (
            <label key={m.id} className="inline-flex items-center gap-1.5 text-neutral-400">
              <input
                type="checkbox"
                checked={effortModelIds.has(m.id)}
                onChange={() => toggleSet(effortModelIds, setEffortModelIds, m.id)}
                className="accent-amber-400"
              />
              {reasoningEffortLabel(m)}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-neutral-500">Providers:</span>
        {providers.map((p) => (
          <Pill
            key={p}
            active={providerFilter.has(p)}
            onClick={() => toggleSet(providerFilter, setProviderFilter, p)}
          >
            {p}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-neutral-500">Categories:</span>
        {ALL_CATEGORIES.map((c) => (
          <Pill
            key={c}
            active={categoryFilter.has(c)}
            onClick={() => toggleSet(categoryFilter, setCategoryFilter, c)}
          >
            {c}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
          : "border-neutral-800 bg-neutral-900 text-neutral-500 hover:border-neutral-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function toggleSet(
  set: Set<string>,
  setter: (s: Set<string>) => void,
  value: string,
) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function toggleSort(
  setSort: (s: SortState) => void,
  current: SortState,
  key: SortKey,
) {
  const same = sortKeyEquals(current.key, key);
  setSort({
    key,
    dir: same && current.dir === "desc" ? "asc" : "desc",
  });
}

function sortKeyEquals(a: SortKey, b: SortKey): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "benchmark" && b.kind === "benchmark") {
    return a.benchmarkId === b.benchmarkId && a.variant === b.variant;
  }
  return true;
}

function comparator(
  sort: SortState,
  matrix: ReturnType<typeof buildScoreMatrix>,
  activeVariant: Record<string, string>,
): (a: Model, b: Model) => number {
  const dir = sort.dir === "asc" ? 1 : -1;
  return (a, b) => {
    const va = getSortValue(a, sort.key, matrix, activeVariant);
    const vb = getSortValue(b, sort.key, matrix, activeVariant);
    if (va === undefined && vb === undefined) return 0;
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    if (typeof va === "number" && typeof vb === "number")
      return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  };
}

function getSortValue(
  m: Model,
  key: SortKey,
  matrix: ReturnType<typeof buildScoreMatrix>,
  activeVariant: Record<string, string>,
): number | string | undefined {
  if (key.kind === "model") return m.name;
  if (key.kind === "release") return m.releaseDate;
  if (key.kind === "cutoff") return m.knowledgeCutoff;
  const cells = matrix.get(m.id)?.get(key.benchmarkId);
  if (!cells) return undefined;
  const wanted = activeVariant[key.benchmarkId] ?? key.variant;
  const cell = cells.find((c) => c.variant === wanted);
  return cell?.value;
}

function heatColor(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  const hue = 120 * clamped;
  const sat = 40;
  const light = 18;
  const alpha = 0.35 + clamped * 0.25;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha.toFixed(2)})`;
}
