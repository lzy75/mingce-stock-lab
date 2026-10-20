import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fetchFuyao, loadMarket, DEFAULT_CODES } from "../lib/fuyao.ts";
const vars = parseEnv(await readFile(".dev.vars", "utf8"));
const startedAt = new Date().toISOString();
const key = vars.FUYAO_API_KEY;
if (!key) throw Error("Missing local server key");
const paths = [
  "/api/a-share/prices/snapshot?thscodes=600519.SH,000333.SZ",
  "/api/a-share/valuations/snapshot?thscodes=600519.SH,000333.SZ",
  "/api/a-share/financials/income-statements?thscode=600519.SH&period=quarterly&limit=8",
  "/api/a-share/calendar/trading-days",
];
const probes = [];
for (const path of paths) {
  try {
    const r = await fetchFuyao(path, key);
    const entries = r.data.item;
    probes.push({
      path,
      ok: true,
      code: r.code,
      requestId: r.request_id,
      asOf: r.data.timestamp ?? null,
      count: Array.isArray(entries) ? entries.length : null,
      fields:
        Array.isArray(entries) && entries[0] ? Object.keys(entries[0]) : [],
    });
  } catch (e) {
    probes.push({ path, ok: false, error: e.message, code: e.code });
  }
}
let snapshotSummary;
try {
  const s = await loadMarket(key, DEFAULT_CODES.slice(0, 2), [
    "pe",
    "revenueGrowth",
    "profitGrowth",
    "volatility",
  ]);
  snapshotSummary = {
    ok: true,
    asOf: s.asOf,
    fetchedAt: s.fetchedAt,
    count: s.stocks.length,
    stocks: s.stocks.map((x) => ({
      code: x.code,
      name: x.name,
      metrics: Object.fromEntries(
        Object.entries(x.metrics).map(([k, v]) => [
          k,
          {
            value: v.value,
            quality: v.quality,
            asOf: v.asOf,
            reportPeriod: v.reportPeriod,
            note: v.note,
          },
        ]),
      ),
    })),
    issues: s.issues,
  };
} catch (e) {
  snapshotSummary = { ok: false, error: e.message };
}
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  probes,
  snapshotSummary,
  note: "No credentials or full licensed raw responses are stored. Only integration-validation metadata and selected derived values.",
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/data.local.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
