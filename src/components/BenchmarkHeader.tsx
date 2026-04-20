import type { Benchmark } from "../lib/schema";

interface Props {
  benchmark: Benchmark;
  activeVariant: string;
  onVariantChange: (key: string) => void;
}

export default function BenchmarkHeader({
  benchmark,
  activeVariant,
  onVariantChange,
}: Props) {
  const variant = benchmark.variants.find((v) => v.key === activeVariant);
  const tooltip = [
    benchmark.description ?? benchmark.name,
    variant ? `\n${variant.label}: ${variant.notes}` : "",
  ]
    .filter(Boolean)
    .join("");

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center gap-1 font-medium text-neutral-100"
        title={tooltip}
      >
        {benchmark.name}
        {benchmark.sourceUrl && (
          <a
            href={benchmark.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-neutral-600 text-[9px] font-semibold leading-none text-neutral-400 hover:border-amber-400 hover:text-amber-300"
            aria-label={`About ${benchmark.name}`}
            title={`Open source for ${benchmark.name}`}
          >
            i
          </a>
        )}
      </span>
      {benchmark.variants.length > 1 ? (
        <select
          value={activeVariant}
          onChange={(e) => onVariantChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded bg-neutral-800 px-1 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
          title="Switch variant"
        >
          {benchmark.variants.map((v) => (
            <option key={v.key} value={v.key}>
              {v.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[10px] text-neutral-500">
          {benchmark.variants[0]?.label}
        </span>
      )}
    </div>
  );
}
