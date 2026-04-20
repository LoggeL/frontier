# Frontier

Static, JSON-backed page comparing frontier and open-weight LLMs across Artificial Analysis benchmarks, with a training-to-release timeline that surfaces shared pretraining cohorts and per-model detail pages that pivot to peers + per-benchmark frontier leaders.

## Quickstart

```bash
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # static site to ./dist
```

## Adding data

All content is in `src/data/*.json`. See `src/data/README.md` for the agent-maintainable guide — adding a model, a benchmark, a new variant (pass@N / with-tools / n-shot), or a score.

Validation runs on every build via Zod schemas in `src/lib/schema.ts`. Invalid JSON (unknown `modelId`, orphan `variant`, missing HF link on an open-weight model) fails the build with a line-precise error.

## Pages

- `/` — comparison table (primary benchmarks only) + cutoff-to-release timeline
- `/models/{id}/` — per-model page with peer set (intelligence ±7 / same cohort / ±90d release) and every benchmark against the current frontier

## Stack

- Astro 5 (static output, `output: "static"`, one pre-rendered page per model)
- React islands for the table and the detail view
- Tailwind CSS · Zod validation · Recharts not used (timeline is pure CSS)

## Deploy

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml`.
