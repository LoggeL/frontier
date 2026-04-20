#!/usr/bin/env node
// Playwright scraper for benchmark leaderboards that are JS-rendered.
// Usage: node scripts/scrape.mjs [site]
//   site: simple-bench | swebench | livecodebench | matharena | mmmu | osworld | all
// Output: writes scripts/scraped.json keyed by site.

import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "scripts/scraped.json";

async function withPage(fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function scrapeSimpleBench() {
  return withPage(async (page) => {
    await page.goto("https://simple-bench.com/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("table", { timeout: 20000 });
    const rows = await page.$$eval("table tbody tr", (trs) =>
      trs.map((tr) => {
        const cells = tr.querySelectorAll("td");
        return Array.from(cells).map((c) => c.innerText.trim());
      }),
    );
    return { rows, headers: await page.$$eval("table thead th", (ths) => ths.map((t) => t.innerText.trim())) };
  });
}

async function scrapeSWEBench() {
  return withPage(async (page) => {
    const results = {};
    for (const path of ["/", "/multilingual"]) {
      const url = `https://www.swebench.com${path}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      try {
        await page.waitForSelector("table, [role=\"table\"]", { timeout: 15000 });
      } catch {}
      const text = await page.content();
      const tables = await page.$$eval("table", (ts) =>
        ts.map((t) => {
          const headers = Array.from(t.querySelectorAll("thead th")).map((th) => th.innerText.trim());
          const rows = Array.from(t.querySelectorAll("tbody tr")).map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim()),
          );
          return { headers, rows };
        }),
      );
      results[path] = { tables, contentBytes: text.length };
    }
    return results;
  });
}

async function scrapeLiveCodeBench() {
  return withPage(async (page) => {
    await page.goto("https://livecodebench.github.io/leaderboard.html", { waitUntil: "networkidle", timeout: 60000 });
    try {
      await page.waitForSelector("table", { timeout: 15000 });
    } catch {}
    return {
      tables: await page.$$eval("table", (ts) =>
        ts.map((t) => ({
          headers: Array.from(t.querySelectorAll("thead th, tr:first-child th, tr:first-child td")).map((th) => th.innerText.trim()),
          rows: Array.from(t.querySelectorAll("tbody tr")).map((tr) =>
            Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim()),
          ),
        })),
      ),
    };
  });
}

async function scrapeMathArena() {
  return withPage(async (page) => {
    await page.goto("https://matharena.ai/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3000);
    const results = {};
    const tabs = ["AIME 2025", "HMMT Feb 2025", "HMMT Nov 2025", "AIME 2026", "HMMT Feb 2026", "Apex", "IMO 2025"];
    for (const t of tabs) {
      try {
        const clicked = await page.evaluate((label) => {
          const all = Array.from(document.querySelectorAll("button, a, [role='tab'], [role='button'], .tab, span, div"));
          const el = all.find((e) => e.innerText && e.innerText.trim() === label && e.offsetParent !== null);
          if (el) {
            el.click();
            return true;
          }
          return false;
        }, t);
        if (!clicked) {
          results[t] = { error: "no clickable element" };
          continue;
        }
        await page.waitForTimeout(2500);
        const rows = await page.$$eval("table tbody tr", (trs) =>
          trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim())),
        );
        results[t] = rows;
      } catch (e) {
        results[t] = { error: String(e).slice(0, 120) };
      }
    }
    return { results };
  });
}

async function scrapeMMMU() {
  return withPage(async (page) => {
    await page.goto("https://mmmu-benchmark.github.io/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    const tables = await page.$$eval("table", (ts) =>
      ts.map((t) => ({
        caption: t.querySelector("caption")?.innerText?.trim() || "",
        headers: Array.from(t.querySelectorAll("thead th, tr:first-child th")).map((th) => th.innerText.trim()),
        rows: Array.from(t.querySelectorAll("tbody tr")).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim()),
        ),
      })),
    );
    return { tables };
  });
}

async function scrapeOSWorld() {
  return withPage(async (page) => {
    await page.goto("https://os-world.github.io/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3000);
    const tables = await page.$$eval("table", (ts) =>
      ts.map((t) => ({
        headers: Array.from(t.querySelectorAll("thead th, tr:first-child th, tr:first-child td")).map((th) => th.innerText.trim()),
        rows: Array.from(t.querySelectorAll("tbody tr")).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim()),
        ),
      })),
    );
    return { tables };
  });
}

async function scrapeLMArena() {
  return withPage(async (page) => {
    await page.goto("https://lmarena.ai/leaderboard", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(4000);
    const tables = await page.$$eval("table", (ts) =>
      ts.map((t) => ({
        headers: Array.from(t.querySelectorAll("thead th, tr:first-child th")).map((th) => th.innerText.trim()),
        rows: Array.from(t.querySelectorAll("tbody tr, tr")).slice(0, 200).map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim()),
        ),
      })),
    );
    return { tables };
  });
}

const SITES = {
  "simple-bench": scrapeSimpleBench,
  swebench: scrapeSWEBench,
  livecodebench: scrapeLiveCodeBench,
  matharena: scrapeMathArena,
  mmmu: scrapeMMMU,
  osworld: scrapeOSWorld,
  lmarena: scrapeLMArena,
};

const which = process.argv[2] ?? "all";
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const targets = which === "all" ? Object.keys(SITES) : [which];
for (const t of targets) {
  if (!SITES[t]) {
    console.error(`unknown site: ${t}`);
    continue;
  }
  console.error(`scraping ${t}...`);
  try {
    const data = await SITES[t]();
    out[t] = { fetchedAt: new Date().toISOString(), data };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.error(`  ${t} done`);
  } catch (e) {
    out[t] = { fetchedAt: new Date().toISOString(), error: String(e) };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.error(`  ${t} failed: ${String(e).slice(0, 200)}`);
  }
}
console.log("wrote", OUT);
