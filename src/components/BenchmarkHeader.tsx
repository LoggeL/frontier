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
      <a
        href={benchmark.sourceUrl ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-neutral-100 hover:underline"
        title={tooltip}
      >
        {benchmark.name}
      </a>
      {benchmark.variants.length > 1 ? (
        <select
          value={activeVariant}
          onChange={(e) => onVariantChange(e.target.value)}
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
