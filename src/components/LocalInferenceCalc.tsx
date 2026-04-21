import { useMemo, useState } from "react";

type GPU = {
  id: string;
  name: string;
  tier: "Consumer" | "Datacenter" | "Apple";
  vram: number;
  bandwidth: number;
  fp16Tflops: number;
};

const GPUS: GPU[] = [
  { id: "rtx-3060-12", name: "RTX 3060 12GB", tier: "Consumer", vram: 12, bandwidth: 360, fp16Tflops: 25 },
  { id: "rtx-3090", name: "RTX 3090 24GB", tier: "Consumer", vram: 24, bandwidth: 936, fp16Tflops: 142 },
  { id: "rtx-4070-ti-super", name: "RTX 4070 Ti Super 16GB", tier: "Consumer", vram: 16, bandwidth: 672, fp16Tflops: 88 },
  { id: "rtx-4080-super", name: "RTX 4080 Super 16GB", tier: "Consumer", vram: 16, bandwidth: 736, fp16Tflops: 104 },
  { id: "rtx-4090", name: "RTX 4090 24GB", tier: "Consumer", vram: 24, bandwidth: 1008, fp16Tflops: 165 },
  { id: "rtx-5080", name: "RTX 5080 16GB", tier: "Consumer", vram: 16, bandwidth: 960, fp16Tflops: 112 },
  { id: "rtx-5090", name: "RTX 5090 32GB", tier: "Consumer", vram: 32, bandwidth: 1792, fp16Tflops: 209 },
  { id: "rtx-6000-ada", name: "RTX 6000 Ada 48GB", tier: "Consumer", vram: 48, bandwidth: 960, fp16Tflops: 182 },
  { id: "rtx-pro-6000", name: "RTX Pro 6000 Blackwell 96GB", tier: "Consumer", vram: 96, bandwidth: 1790, fp16Tflops: 252 },

  { id: "a100-40", name: "A100 40GB", tier: "Datacenter", vram: 40, bandwidth: 1555, fp16Tflops: 312 },
  { id: "a100-80", name: "A100 80GB SXM", tier: "Datacenter", vram: 80, bandwidth: 2039, fp16Tflops: 312 },
  { id: "l40s", name: "L40S 48GB", tier: "Datacenter", vram: 48, bandwidth: 864, fp16Tflops: 362 },
  { id: "h100-sxm", name: "H100 80GB SXM", tier: "Datacenter", vram: 80, bandwidth: 3350, fp16Tflops: 989 },
  { id: "h200-sxm", name: "H200 141GB SXM", tier: "Datacenter", vram: 141, bandwidth: 4800, fp16Tflops: 989 },
  { id: "b200", name: "B200 192GB", tier: "Datacenter", vram: 192, bandwidth: 8000, fp16Tflops: 2250 },
  { id: "gb200", name: "GB200 NVL 384GB", tier: "Datacenter", vram: 384, bandwidth: 16000, fp16Tflops: 4500 },
  { id: "mi300x", name: "MI300X 192GB", tier: "Datacenter", vram: 192, bandwidth: 5300, fp16Tflops: 1307 },
  { id: "mi325x", name: "MI325X 256GB", tier: "Datacenter", vram: 256, bandwidth: 6000, fp16Tflops: 1307 },

  { id: "m4-max-64", name: "MacBook Pro M4 Max 64GB", tier: "Apple", vram: 48, bandwidth: 546, fp16Tflops: 18 },
  { id: "m4-max-128", name: "MacBook Pro M4 Max 128GB", tier: "Apple", vram: 100, bandwidth: 546, fp16Tflops: 18 },
  { id: "m3-ultra-192", name: "Mac Studio M3 Ultra 192GB", tier: "Apple", vram: 150, bandwidth: 819, fp16Tflops: 27 },
  { id: "m3-ultra-512", name: "Mac Studio M3 Ultra 512GB", tier: "Apple", vram: 450, bandwidth: 819, fp16Tflops: 28 },
  { id: "dgx-spark", name: "DGX Spark (GB10) 128GB", tier: "Datacenter", vram: 120, bandwidth: 273, fp16Tflops: 500 },
];

type ModelPreset = {
  id: string;
  name: string;
  totalB: number;
  activeB: number;
  kvKBPerTokenFp16: number;
  maxContext: number;
  note?: string;
};

const MODELS: ModelPreset[] = [
  { id: "llama3-8b", name: "Llama 3 / 3.1 8B", totalB: 8, activeB: 8, kvKBPerTokenFp16: 128, maxContext: 128_000 },
  { id: "gemma2-9b", name: "Gemma 2 9B", totalB: 9.2, activeB: 9.2, kvKBPerTokenFp16: 128, maxContext: 8_192 },
  { id: "phi4-14b", name: "Phi-4 14B", totalB: 14, activeB: 14, kvKBPerTokenFp16: 160, maxContext: 16_384 },
  { id: "gemma2-27b", name: "Gemma 2 27B", totalB: 27.2, activeB: 27.2, kvKBPerTokenFp16: 192, maxContext: 8_192 },
  { id: "qwen25-32b", name: "Qwen2.5 32B", totalB: 32.5, activeB: 32.5, kvKBPerTokenFp16: 256, maxContext: 128_000 },
  { id: "llama3-70b", name: "Llama 3.3 70B", totalB: 70, activeB: 70, kvKBPerTokenFp16: 320, maxContext: 128_000 },
  { id: "qwen25-72b", name: "Qwen2.5 72B", totalB: 72.7, activeB: 72.7, kvKBPerTokenFp16: 320, maxContext: 128_000 },
  { id: "mistral-large-2", name: "Mistral Large 2 123B", totalB: 123, activeB: 123, kvKBPerTokenFp16: 352, maxContext: 128_000 },
  { id: "llama4-scout", name: "Llama 4 Scout 109B A17B", totalB: 109, activeB: 17, kvKBPerTokenFp16: 192, maxContext: 10_000_000, note: "MoE" },
  { id: "llama4-maverick", name: "Llama 4 Maverick 400B A17B", totalB: 400, activeB: 17, kvKBPerTokenFp16: 192, maxContext: 1_000_000, note: "MoE" },
  { id: "qwen3-235b", name: "Qwen3 235B A22B", totalB: 235, activeB: 22, kvKBPerTokenFp16: 192, maxContext: 128_000, note: "MoE" },
  { id: "qwen35-122b-a10b", name: "Qwen3.5 122B A10B", totalB: 122, activeB: 10, kvKBPerTokenFp16: 192, maxContext: 128_000, note: "MoE" },
  { id: "qwen35-397b-a17b", name: "Qwen3.5 397B A17B", totalB: 397, activeB: 17, kvKBPerTokenFp16: 192, maxContext: 128_000, note: "MoE" },
  { id: "minimax-m2", name: "MiniMax M2 230B A10B", totalB: 230, activeB: 10, kvKBPerTokenFp16: 320, maxContext: 1_000_000, note: "MoE" },
  { id: "nemotron-3-super", name: "Nemotron 3 Super 120B A12B", totalB: 120, activeB: 12, kvKBPerTokenFp16: 160, maxContext: 128_000, note: "MoE" },
  { id: "glm-5-1", name: "GLM-5.1", totalB: 358, activeB: 32, kvKBPerTokenFp16: 256, maxContext: 128_000, note: "MoE" },
  { id: "deepseek-v3", name: "DeepSeek V3 / V3.1 / V3.2 / R1", totalB: 671, activeB: 37, kvKBPerTokenFp16: 70, maxContext: 128_000, note: "MoE + MLA" },
  { id: "kimi-k2", name: "Kimi K2 / K2.5 / K2 Thinking", totalB: 1000, activeB: 32, kvKBPerTokenFp16: 66, maxContext: 128_000, note: "MoE + MLA" },
  { id: "kimi-k2-6", name: "Kimi K2.6", totalB: 1000, activeB: 32, kvKBPerTokenFp16: 66, maxContext: 256_000, note: "MoE + MLA" },
  { id: "custom", name: "Custom…", totalB: 70, activeB: 70, kvKBPerTokenFp16: 320, maxContext: 128_000 },
];

type Quant = { id: string; label: string; bpw: number };

const QUANTS: Quant[] = [
  { id: "fp16", label: "FP16 / BF16", bpw: 16 },
  { id: "fp8", label: "FP8", bpw: 8 },
  { id: "int8", label: "INT8 / Q8_0", bpw: 8.5 },
  { id: "q6", label: "Q6_K (~6.56 bpw)", bpw: 6.56 },
  { id: "q5", label: "Q5_K_M (~5.5 bpw)", bpw: 5.5 },
  { id: "q4km", label: "Q4_K_M (~4.83 bpw)", bpw: 4.83 },
  { id: "awq4", label: "AWQ / GPTQ 4-bit", bpw: 4.25 },
  { id: "int4", label: "INT4 / Q4_0", bpw: 4 },
  { id: "q3", label: "Q3_K_M (~3.9 bpw)", bpw: 3.9 },
  { id: "q2", label: "Q2_K (~3.0 bpw)", bpw: 3.0 },
];

const KV_QUANTS = [
  { id: "fp16", label: "FP16 KV", scale: 1 },
  { id: "fp8", label: "FP8 KV", scale: 0.5 },
  { id: "q4", label: "4-bit KV", scale: 0.25 },
];

const CONTEXTS = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576];
const BATCHES = [1, 2, 4, 8, 16, 32, 64];

function fmtGB(gb: number) {
  if (!isFinite(gb)) return "—";
  if (gb < 0.01) return `${(gb * 1024).toFixed(0)} MB`;
  if (gb < 10) return `${gb.toFixed(1)} GB`;
  if (gb < 100) return `${gb.toFixed(1)} GB`;
  return `${Math.round(gb)} GB`;
}

function fmtNum(n: number, digits = 1) {
  if (!isFinite(n)) return "—";
  if (n >= 10_000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(digits);
}

function fmtSec(s: number) {
  if (!isFinite(s)) return "—";
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

export default function LocalInferenceCalc() {
  const [modelId, setModelId] = useState("llama3-70b");
  const [customTotal, setCustomTotal] = useState(70);
  const [customActive, setCustomActive] = useState(70);
  const [customKv, setCustomKv] = useState(320);

  const [quantId, setQuantId] = useState("q4km");
  const [kvQuantId, setKvQuantId] = useState("fp16");

  const [gpuId, setGpuId] = useState("rtx-4090");
  const [numGpus, setNumGpus] = useState(1);

  const [contextIdx, setContextIdx] = useState(4);
  const [batch, setBatch] = useState(1);

  const [promptTokens, setPromptTokens] = useState(2000);
  const [outputTokens, setOutputTokens] = useState(500);

  const preset = MODELS.find((m) => m.id === modelId)!;
  const isCustom = modelId === "custom";
  const totalB = isCustom ? customTotal : preset.totalB;
  const activeB = isCustom ? customActive : preset.activeB;
  const kvKB = isCustom ? customKv : preset.kvKBPerTokenFp16;
  const context = CONTEXTS[contextIdx];

  const quant = QUANTS.find((q) => q.id === quantId)!;
  const kvQuant = KV_QUANTS.find((q) => q.id === kvQuantId)!;
  const gpu = GPUS.find((g) => g.id === gpuId)!;

  const result = useMemo(() => {
    const weightsGB = (totalB * quant.bpw) / 8;
    const activeGB = (activeB * quant.bpw) / 8;

    const kvBytesPerTok = kvKB * 1024 * kvQuant.scale;
    const kvGB = (kvBytesPerTok * context * batch) / 1e9;

    const overheadGB = 2 + weightsGB * 0.03;
    const totalGB = weightsGB + kvGB + overheadGB;

    const totalVram = gpu.vram * numGpus;
    const fits = totalGB <= totalVram;
    const headroom = totalVram - totalGB;

    const tpEff = Math.max(0.55, 1 - (numGpus - 1) * 0.08);
    const effectiveBw = gpu.bandwidth * numGpus * tpEff;
    const effectiveTflops = gpu.fp16Tflops * numGpus * tpEff;

    // Memory-bound per forward pass: weights read ONCE (shared), KV read per-user (scales with batch).
    // Per-forward bytes = activeGB + kvGB (kvGB already = per_token × ctx × batch)
    const perForwardBytes = activeGB + kvGB;
    const forwardsPerSecMem = effectiveBw / perForwardBytes;
    const tpsPerUserMemBound = forwardsPerSecMem; // 1 token per user per forward
    const tpsTotalMemBound = forwardsPerSecMem * batch;

    // Compute-bound: 2·active_B FLOPs per output token per user
    const tpsTotalCompute = (effectiveTflops * 1e12) / (2 * activeB * 1e9);
    const tpsPerUserCompute = tpsTotalCompute / batch;

    const tpsTotal = Math.min(tpsTotalMemBound, tpsTotalCompute);
    const tpsPerUser = Math.min(tpsPerUserMemBound, tpsPerUserCompute);
    const bottleneck = tpsTotalMemBound < tpsTotalCompute ? "memory-bound" : "compute-bound";

    const prefillTflopsTokens = (effectiveTflops * 1e12) / (2 * activeB * 1e9);
    const ttftSec = promptTokens / prefillTflopsTokens;

    const genSec = outputTokens / Math.max(tpsPerUser, 1e-6);
    const totalSec = ttftSec + genSec;

    return {
      weightsGB,
      activeGB,
      kvGB,
      overheadGB,
      totalGB,
      totalVram,
      fits,
      headroom,
      tpEff,
      tpsPerUser,
      tpsTotal,
      tpsPerUserMemBound,
      bottleneck,
      ttftSec,
      genSec,
      totalSec,
    };
  }, [totalB, activeB, kvKB, quant, kvQuant, gpu, numGpus, context, batch, promptTokens, outputTokens]);

  const fitBarPct = Math.min(100, (result.totalGB / Math.max(result.totalVram, 1)) * 100);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <Section title="Model">
          <div className="grid gap-2">
            <Select
              label="Preset"
              value={modelId}
              onChange={setModelId}
              options={MODELS.map((m) => ({
                value: m.id,
                label: m.note ? `${m.name} · ${m.note}` : m.name,
              }))}
            />
            {isCustom && (
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Total params (B)" value={customTotal} onChange={setCustomTotal} min={0.1} step={0.5} />
                <NumField label="Active params (B)" value={customActive} onChange={setCustomActive} min={0.1} step={0.5} />
                <NumField label="KV KB/token @ FP16" value={customKv} onChange={setCustomKv} min={1} step={1} />
              </div>
            )}
            {!isCustom && (
              <p className="text-xs text-neutral-500">
                {preset.totalB}B total
                {preset.activeB !== preset.totalB ? ` · ${preset.activeB}B active` : " · dense"}
                {" · "}
                {preset.kvKBPerTokenFp16} KB KV/token @ FP16 · max ctx {fmtTokens(preset.maxContext)}
              </p>
            )}
          </div>
        </Section>

        <Section title="Quantization">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Weights"
              value={quantId}
              onChange={setQuantId}
              options={QUANTS.map((q) => ({ value: q.id, label: q.label }))}
            />
            <Select
              label="KV cache"
              value={kvQuantId}
              onChange={setKvQuantId}
              options={KV_QUANTS.map((q) => ({ value: q.id, label: q.label }))}
            />
          </div>
        </Section>

        <Section title="Hardware">
          <div className="grid gap-2">
            <Select
              label="GPU preset"
              value={gpuId}
              onChange={setGpuId}
              options={GPUS.map((g) => ({
                value: g.id,
                label: `${g.name} · ${g.vram}GB · ${g.bandwidth} GB/s · ${g.fp16Tflops} TFLOPS`,
                group: g.tier,
              }))}
              grouped
            />
            <div className="grid grid-cols-2 gap-2">
              <NumField label="# GPUs (tensor parallel)" value={numGpus} onChange={setNumGpus} min={1} max={16} step={1} />
              <div className="flex flex-col gap-1">
                <label className="text-xs uppercase tracking-wide text-neutral-500">Aggregate VRAM</label>
                <div className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-300">
                  {result.totalVram} GB · {Math.round(result.tpEff * 100)}% TP eff.
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Workload">
          <div className="grid gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label className="text-xs uppercase tracking-wide text-neutral-500">Context window</label>
                <span className="font-mono text-sm text-neutral-300">{fmtTokens(context)} tok</span>
              </div>
              <input
                type="range"
                min={0}
                max={CONTEXTS.length - 1}
                value={contextIdx}
                onChange={(e) => setContextIdx(Number(e.target.value))}
                className="accent-amber-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label className="text-xs uppercase tracking-wide text-neutral-500">Batch size (concurrent users)</label>
                <span className="font-mono text-sm text-neutral-300">{batch}</span>
              </div>
              <div className="flex gap-1">
                {BATCHES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBatch(b)}
                    className={`flex-1 rounded border px-2 py-1 text-xs font-mono ${
                      batch === b
                        ? "border-amber-400 bg-amber-400/10 text-amber-200"
                        : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Prompt tokens" value={promptTokens} onChange={setPromptTokens} min={0} step={100} />
              <NumField label="Output tokens" value={outputTokens} onChange={setOutputTokens} min={1} step={50} />
            </div>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <Section title="VRAM">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-neutral-100">
                {fmtGB(result.totalGB)}
              </span>
              <span className={`text-sm font-mono ${result.fits ? "text-emerald-400" : "text-rose-400"}`}>
                {result.fits
                  ? `fits · ${fmtGB(result.headroom)} free`
                  : `over by ${fmtGB(-result.headroom)}`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-neutral-950">
              <div
                className={`h-full ${result.fits ? "bg-emerald-500/70" : "bg-rose-500/80"}`}
                style={{ width: `${fitBarPct}%` }}
              />
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs font-mono text-neutral-400">
              <Stat label="Weights" value={fmtGB(result.weightsGB)} />
              <Stat label="KV cache" value={fmtGB(result.kvGB)} />
              <Stat label="Overhead" value={fmtGB(result.overheadGB)} />
            </div>
          </div>
        </Section>

        <Section title="Throughput">
          <div className="grid grid-cols-2 gap-3">
            <BigStat
              label="Tokens/sec per user"
              value={fmtNum(result.tpsPerUser, 1)}
              accent={result.tpsPerUser >= 20 ? "emerald" : result.tpsPerUser >= 8 ? "amber" : "rose"}
              hint={batch > 1 ? `of ${fmtNum(result.tpsTotal, 0)} total` : result.bottleneck}
            />
            <BigStat
              label="Aggregate tok/s"
              value={fmtNum(result.tpsTotal, 0)}
              accent="neutral"
              hint={result.bottleneck}
            />
          </div>
          <div className="mt-2 text-xs text-neutral-500 font-mono">
            per-forward read: active {fmtGB(result.activeGB)} + KV {fmtGB(result.kvGB)} ·
            {" "}{fmtNum(gpu.bandwidth * numGpus * result.tpEff, 0)} GB/s
          </div>
        </Section>

        <Section title="Latency (single user)">
          <div className="grid grid-cols-3 gap-3">
            <BigStat
              label="Time to first token"
              value={fmtSec(result.ttftSec)}
              accent="neutral"
              hint={`prefill ${fmtTokens(promptTokens)}`}
            />
            <BigStat
              label="Generation"
              value={fmtSec(result.genSec)}
              accent="neutral"
              hint={`${fmtTokens(outputTokens)} tokens`}
            />
            <BigStat
              label="End-to-end"
              value={fmtSec(result.totalSec)}
              accent="neutral"
              hint={batch > 1 ? `at batch=${batch}` : "batch=1"}
            />
          </div>
        </Section>

        <Section title="Notes">
          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-400">
            <li>
              Decode speed assumes memory-bound autoregressive generation:
              <span className="font-mono text-neutral-300"> tok/s/user ≈ bandwidth ÷ (active_weights + batch · KV)</span>.
              Weights are shared across the batch; KV cache is per-user, so per-user throughput drops at high batch.
            </li>
            <li>
              Compute ceiling uses <span className="font-mono text-neutral-300">TFLOPS ÷ (2 · active_B)</span>.
              Whichever is lower is reported.
            </li>
            <li>
              TP efficiency degrades ~8%/GPU; real numbers depend heavily on interconnect
              (NVLink/InfiniBand &gt; PCIe).
            </li>
            <li>
              Apple / DGX Spark &quot;VRAM&quot; is unified memory usable for weights after OS/driver overhead.
            </li>
            <li>
              KV cache estimates use the model&apos;s architecture (MLA &gt; GQA &gt; MHA) at FP16, scaled by KV quant.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  grouped,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  grouped?: boolean;
}) {
  const groups = grouped
    ? Object.entries(
        options.reduce<Record<string, typeof options>>((acc, o) => {
          const g = o.group ?? "";
          (acc[g] ||= []).push(o);
          return acc;
        }, {}),
      )
    : null;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-neutral-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-200 focus:border-amber-500 focus:outline-none"
      >
        {grouped && groups
          ? groups.map(([g, opts]) => (
              <optgroup key={g} label={g}>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wide text-neutral-500">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-200 focus:border-amber-500 focus:outline-none"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-neutral-200">{value}</div>
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "emerald" | "amber" | "rose" | "neutral";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "amber"
        ? "text-amber-300"
        : accent === "rose"
          ? "text-rose-300"
          : "text-neutral-100";
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`font-mono text-xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-neutral-500">{hint}</div>}
    </div>
  );
}
