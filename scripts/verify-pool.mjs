import fs from "node:fs/promises";
import { loadMarketBatches } from "../lib/market-batches.ts";
import { DEFAULT_CODES } from "../lib/research-pool.ts";
import { parseIntent, screen } from "../lib/domain.ts";
const origin =
  process.env.MINGCE_POOL_URL ??
  "https://mingce-stock-lab.justslug1.chatgpt.site";
const output =
  process.env.MINGCE_POOL_REPORT ?? "artifacts/production-pool.json";
const codes = [
  ...new Set([
    ...DEFAULT_CODES,
    "600000.SH",
    "600004.SH",
    "600009.SH",
    "600010.SH",
    "600011.SH",
    "600015.SH",
    "600016.SH",
    "600018.SH",
    "600019.SH",
    "600025.SH",
    "600028.SH",
    "600029.SH",
  ]),
];
const report = {
  at: new Date().toISOString(),
  origin,
  requested: codes.length,
  passed: false,
  progress: [],
};
try {
  const snapshot = await loadMarketBatches({
    codes,
    metrics: ["pe"],
    onProgress: (p) => report.progress.push(p),
    fetcher: (url, options) => fetch(new URL(url, origin), options),
  });
  const run = screen(
    snapshot,
    parseIntent("市盈率大于0倍，市盈率不超过25倍").conditions,
  );
  report.received = snapshot.stocks.length;
  report.batches = report.progress.at(-1).total;
  report.counts = {
    pass: run.pass.length,
    fail: run.fail.length,
    unknown: run.unknown.length,
  };
  report.trace = snapshot.stocks.map((s) => ({
    code: s.code,
    name: s.name,
    quality: s.metrics.pe?.quality,
    asOf: s.metrics.pe?.asOf,
    transport: s.metrics.pe?.transport,
    tool: s.metrics.pe?.toolName,
    requestId: s.metrics.pe?.requestId,
  }));
  report.passed =
    report.received === codes.length &&
    report.batches === 2 &&
    Object.values(report.counts).reduce((a, b) => a + b, 0) === codes.length &&
    run.pass.every((s) =>
      s.checks.every(
        (c) =>
          c.status === "pass" &&
          c.evidence?.quality === "ok" &&
          c.evidence?.requestId,
      ),
    );
} catch (error) {
  report.error = error.message;
}
await fs.mkdir(output.substring(0, output.lastIndexOf("/")) || ".", {
  recursive: true,
});
await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      origin,
      requested: report.requested,
      received: report.received,
      batches: report.batches,
      counts: report.counts,
      passed: report.passed,
      error: report.error,
    },
    null,
    2,
  ),
);
if (!report.passed) process.exitCode = 1;
