import { useMemo, useState } from "react";
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
  | { kind: "cost" }
  | { kind: "tokens" }
  | { kind: "benchmark"; benchmarkId: string; variant: string };

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

interface ModelGroup {
  key: string;
  provider: string;
  label: string;
  models: Model[];
  selectedModel: Model;
  sortModel: Model;
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
  const [selectedModelByGroup, setSelectedModelByGroup] = useState<Record<string, string>>({});

  const matrix = useMemo(() => buildScoreMatrix(scores), [scores]);
  const extents = useMemo(
    () => columnExtents(benchmarks, scores),
    [benchmarks, scores],
  );
  const searchTerms = useMemo(
    () => search.toLowerCase().trim().split(/\s+/).filter(Boolean),
    [search],
  );

  const visibleBenchmarks = useMemo(
    () => benchmarks.filter(
      (b) => categoryFilter.has(b.category) && (!visibleBenchmarkIds || visibleBenchmarkIds.includes(b.id)),
    ),
    [benchmarks, categoryFilter, visibleBenchmarkIds],
  );

  const visibleModelGroups = useMemo(() => {
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
        reasoningFamilyLabel(m),
        m.openWeights ? "open open-weight open-weights" : "closed",
      ]
        .join(" ")
        .toLowerCase();
      return searchTerms.every((term) => haystack.includes(term));
    });

    const grouped = groupModels(filtered, selectedModelByGroup);
    const sorted = [...grouped].sort(groupComparator(sort, matrix, activeVariant));
    if (!focusModelId) return sorted;
    const idx = sorted.findIndex((g) => g.models.some((m) => m.id === focusModelId));
    if (idx <= 0) return sorted;
    const focus = sorted[idx]!;
    const without = sorted.filter((g) => g.key !== focus.key);
    const middle = Math.floor(without.length / 2);
    return [...without.slice(0, middle), focus, ...without.slice(middle)];
  }, [models, providerFilter, openOnly, searchTerms, selectedModelByGroup, sort, matrix, activeVariant, focusModelId]);

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
        resultCount={visibleModelGroups.length}
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
              <Th
                active={sort.key.kind === "cost"}
                dir={sort.dir}
                onClick={() => toggleSort(setSort, sort, { kind: "cost" })}
              >
                <span title="Artificial Analysis cost to run Intelligence Index benchmarks">
                  AA bench $
                </span>
              </Th>
              <Th
                active={sort.key.kind === "tokens"}
                dir={sort.dir}
                onClick={() => toggleSort(setSort, sort, { kind: "tokens" })}
              >
                <span title="Artificial Analysis tokens used to run Intelligence Index benchmarks">
                  AA bench tok
                </span>
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
            {visibleModelGroups.map((group) => {
              const m = group.selectedModel;
              const isFocus = group.models.some((model) => model.id === focusModelId);
              const selectorValue = m.id;
              const showReasoningSelect = group.models.length > 1;
              return (
                <tr
                  key={group.key}
                  className={[
                    "border-t border-neutral-800 hover:bg-neutral-900",
                    isFocus ? "bg-amber-500/8" : "",
                  ].join(" ")}
                >
                  <td className={[
                    "sticky left-0 px-3 py-2 font-medium text-neutral-100",
                    isFocus ? "bg-amber-950/40" : "bg-neutral-950",
                  ].join(" ")}>
                    <div className="flex flex-col gap-1 leading-tight">
                      <a
                        href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/models/${m.id}/`}
                        className="flex flex-col hover:text-amber-300"
                      >
                        <span className="inline-flex items-center gap-1">
                          {group.label}
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
                      {showReasoningSelect && (
                        <select
                          value={selectorValue}
                          onChange={(e) =>
                            setSelectedModelByGroup((prev) => ({
                              ...prev,
                              [group.key]: e.target.value,
                            }))
                          }
                          className="w-fit rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-300 focus:border-amber-400 focus:outline-none"
                          aria-label={`Reasoning effort for ${group.label}`}
                        >
                          {group.models.map((option) => (
                            <option key={option.id} value={option.id}>
                              {reasoningEffortLabel(option) ?? option.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-400">{m.provider}</td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                    {m.releaseDate}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                    {m.knowledgeCutoff}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono text-xs text-neutral-300"
                    title={formatBenchmarkCostTitle(m)}
                  >
                    {formatBenchmarkCost(m.aaBenchmarkTotalCost)}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono text-xs text-neutral-300"
                    title={formatBenchmarkTokensTitle(m)}
                  >
                    {formatTokenCount(m.aaBenchmarkTotalTokens)}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function groupModels(
  models: Model[],
  selectedModelByGroup: Record<string, string>,
): ModelGroup[] {
  const groups = new Map<string, Model[]>();
  for (const model of models) {
    const key = reasoningFamilyKey(model);
    const arr = groups.get(key) ?? [];
    arr.push(model);
    groups.set(key, arr);
  }

  return Array.from(groups.entries()).map(([key, groupModels]) => {
    const sortedModels = [...groupModels].sort(compareReasoningVariants);
    const selectedId = selectedModelByGroup[key];
    const selectedModel =
      sortedModels.find((model) => model.id === selectedId) ?? sortedModels[0]!;
    return {
      key,
      provider: selectedModel.provider,
      label: reasoningFamilyLabel(selectedModel),
      models: sortedModels,
      selectedModel,
      sortModel: selectedModel,
    };
  });
}

function reasoningFamilyKey(model: Model): string {
  const label = reasoningFamilyLabel(model).toLowerCase();
  return `${model.provider}::${label}`;
}

function reasoningFamilyLabel(model: Model): string {
  return model.name
    .replace(/\s*\((?:Non-reasoning|xhigh|high|medium|low)\)$/i, "")
    .replace(/\s*\((?:Reasoning|Reasoning,\s*Max Effort|Reasoning,\s*High Effort)\)$/i, "")
    .trim();
}

function reasoningEffortLabel(model: Model): string | null {
  const name = model.name;
  const paren = name.match(/\((Non-reasoning|xhigh|high|medium|low|Reasoning|Reasoning,\s*Max Effort|Reasoning,\s*High Effort)\)$/i)?.[1];
  if (paren) {
    const normalized = paren.toLowerCase();
    if (normalized === "reasoning") return "reasoning";
    if (normalized === "reasoning, max effort") return "max";
    if (normalized === "reasoning, high effort") return "high";
    return normalized;
  }
  if (/\bthinking\b/i.test(name)) return "reasoning";
  return null;
}

function reasoningEffortRank(model: Model): number {
  switch (reasoningEffortLabel(model)?.toLowerCase()) {
    case "non-reasoning":
      return 0;
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "reasoning":
      return 4;
    case "xhigh":
    case "max":
      return 5;
    default:
      return 5;
  }
}

function compareReasoningVariants(a: Model, b: Model): number {
  const rankDiff = reasoningEffortRank(b) - reasoningEffortRank(a);
  if (rankDiff !== 0) return rankDiff;
  return b.releaseDate.localeCompare(a.releaseDate) || a.name.localeCompare(b.name);
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
}) {
  const providers = Array.from(new Set(models.map((m) => m.provider))).sort();

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

function groupComparator(
  sort: SortState,
  matrix: ReturnType<typeof buildScoreMatrix>,
  activeVariant: Record<string, string>,
): (a: ModelGroup, b: ModelGroup) => number {
  const dir = sort.dir === "asc" ? 1 : -1;
  return (a, b) => {
    const va = getSortValue(a.sortModel, sort.key, matrix, activeVariant);
    const vb = getSortValue(b.sortModel, sort.key, matrix, activeVariant);
    if (va === undefined && vb === undefined) return a.label.localeCompare(b.label);
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    const cmp = String(va).localeCompare(String(vb)) * dir;
    return cmp || a.label.localeCompare(b.label);
  };
}

function getSortValue(
  m: Model,
  key: SortKey,
  matrix: ReturnType<typeof buildScoreMatrix>,
  activeVariant: Record<string, string>,
): number | string | undefined {
  if (key.kind === "model") return reasoningFamilyLabel(m);
  if (key.kind === "release") return m.releaseDate;
  if (key.kind === "cutoff") return m.knowledgeCutoff;
  if (key.kind === "cost") return m.aaBenchmarkTotalCost;
  if (key.kind === "tokens") return m.aaBenchmarkTotalTokens;
  const cells = matrix.get(m.id)?.get(key.benchmarkId);
  if (!cells) return undefined;
  const wanted = activeVariant[key.benchmarkId] ?? key.variant;
  const cell = cells.find((c) => c.variant === wanted);
  return cell?.value;
}

function formatBenchmarkCost(value?: number): string {
  if (value === undefined) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 10 ? 2 : 0,
    maximumFractionDigits: value < 10 ? 2 : 0,
  })}`;
}

function formatTokenCount(value?: number): string {
  if (value === undefined || value === 0) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatBenchmarkCostTitle(model: Model): string {
  if (model.aaBenchmarkTotalCost === undefined) {
    return "No Artificial Analysis benchmark cost data";
  }
  return [
    "Artificial Analysis Intelligence Index benchmark cost",
    `Total: ${formatBenchmarkCost(model.aaBenchmarkTotalCost)}`,
    `Input: ${formatBenchmarkCost(model.aaBenchmarkInputCost)}`,
    `Output: ${formatBenchmarkCost(model.aaBenchmarkOutputCost)}`,
    `Answer: ${formatBenchmarkCost(model.aaBenchmarkAnswerCost)}`,
    `Reasoning: ${formatBenchmarkCost(model.aaBenchmarkReasoningCost)}`,
  ].join("\n");
}

function formatBenchmarkTokensTitle(model: Model): string {
  if (model.aaBenchmarkTotalTokens === undefined) {
    return "No Artificial Analysis benchmark token usage data";
  }
  return [
    "Artificial Analysis Intelligence Index tokens used",
    `Total: ${formatTokenCount(model.aaBenchmarkTotalTokens)}`,
    `Input: ${formatTokenCount(model.aaBenchmarkInputTokens)}`,
    `Output: ${formatTokenCount(model.aaBenchmarkOutputTokens)}`,
    `Answer: ${formatTokenCount(model.aaBenchmarkAnswerTokens)}`,
    `Reasoning: ${formatTokenCount(model.aaBenchmarkReasoningTokens)}`,
  ].join("\n");
}

function heatColor(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  const hue = 120 * clamped;
  const sat = 40;
  const light = 18;
  const alpha = 0.35 + clamped * 0.25;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha.toFixed(2)})`;
}
