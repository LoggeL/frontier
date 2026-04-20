import { useMemo, useState } from "react";
import type { Benchmark, Model, Score } from "../lib/schema";
import {
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
}: Props) {
  const [providerFilter, setProviderFilter] = useState<Set<string>>(
    new Set(Array.from(new Set(models.map((m) => m.provider)))),
  );
  const [openOnly, setOpenOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(
    new Set(ALL_CATEGORIES),
  );
  const [activeVariant, setActiveVariant] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        benchmarks.map((b) => [b.id, b.variants[0]?.key ?? "default"]),
      ),
  );
  const [sort, setSort] = useState<SortState>({
    key: { kind: "benchmark", benchmarkId: "aa-intelligence-index", variant: "default" },
    dir: "desc",
  });
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const matrix = useMemo(() => buildScoreMatrix(scores), [scores]);
  const extents = useMemo(
    () => columnExtents(benchmarks, scores),
    [benchmarks, scores],
  );

  const visibleBenchmarks = useMemo(
    () => benchmarks.filter((b) => categoryFilter.has(b.category)),
    [benchmarks, categoryFilter],
  );

  const visibleModels = useMemo(() => {
    const filtered = models.filter(
      (m) =>
        providerFilter.has(m.provider) && (!openOnly || m.openWeights),
    );
    return [...filtered].sort(comparator(sort, matrix, activeVariant));
  }, [models, providerFilter, openOnly, sort, matrix, activeVariant]);

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
      />

      <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/40">
        <table
          className="w-full text-sm"
          onMouseLeave={() => setHoveredCol(null)}
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
                const isHovered = hoveredCol === colKey;
                return (
                  <Th
                    key={b.id}
                    active={isSorted}
                    dir={sort.dir}
                    hovered={isHovered}
                    onMouseEnter={() => setHoveredCol(colKey)}
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
            {visibleModels.map((m) => (
              <tr
                key={m.id}
                className="border-t border-neutral-800 hover:bg-neutral-900"
              >
                <td className="sticky left-0 bg-neutral-950 px-3 py-2 font-medium text-neutral-100">
                  <a
                    href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/models/${m.id}/`}
                    className="flex flex-col leading-tight hover:text-amber-300"
                  >
                    <span className="inline-flex items-center gap-1">
                      {m.name}
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
                  const isColHovered = hoveredCol === colKey;
                  const cells = matrix.get(m.id)?.get(b.id) ?? [];
                  const cell = cells.find((c) => c.variant === variant);
                  if (!cell) {
                    return (
                      <td
                        key={b.id}
                        className={[
                          "px-3 py-2 text-center text-neutral-700",
                          isColHovered ? "bg-neutral-900" : "",
                        ].join(" ")}
                        onMouseEnter={() => setHoveredCol(colKey)}
                      >
                        —
                      </td>
                    );
                  }
                  const ext = extents.get(colKey);
                  const norm = ext ? normalize(cell.value, ext) : 0.5;
                  const bg = isColHovered ? heatColor(norm) : undefined;
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
                      className="px-3 py-2 text-right transition-colors duration-75"
                      style={bg ? { backgroundColor: bg } : undefined}
                      onMouseEnter={() => setHoveredCol(colKey)}
                      title={tipLines}
                    >
                      <span
                        className={
                          isColHovered
                            ? "font-mono text-sm font-semibold text-neutral-50"
                            : "font-mono text-sm text-neutral-200"
                        }
                      >
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
}: {
  models: Model[];
  providerFilter: Set<string>;
  setProviderFilter: (s: Set<string>) => void;
  openOnly: boolean;
  setOpenOnly: (b: boolean) => void;
  categoryFilter: Set<string>;
  setCategoryFilter: (s: Set<string>) => void;
}) {
  const providers = Array.from(new Set(models.map((m) => m.provider))).sort();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
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
      <span className="ml-4 text-neutral-500">Categories:</span>
      {ALL_CATEGORIES.map((c) => (
        <Pill
          key={c}
          active={categoryFilter.has(c)}
          onClick={() => toggleSet(categoryFilter, setCategoryFilter, c)}
        >
          {c}
        </Pill>
      ))}
      <label className="ml-4 inline-flex items-center gap-1.5 text-neutral-400">
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(e) => setOpenOnly(e.target.checked)}
          className="accent-amber-400"
        />
        open-weight only
      </label>
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
  // red (low) → neutral → green (high); low-saturation for readability
  const clamped = Math.max(0, Math.min(1, norm));
  const hue = 120 * clamped; // 0 red → 120 green
  const sat = 40;
  const light = 18;
  const alpha = 0.35 + clamped * 0.25;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha.toFixed(2)})`;
}
