import fs from "node:fs/promises";
const base = "https://mingce-stock-lab.justslug1.chatgpt.site";
const report = {
  schema: "mingce-production-acceptance-v1",
  at: new Date().toISOString(),
  origin: base,
  runner: process.env.GITHUB_ACTIONS ? "GitHub Actions" : "independent Node",
  checks: [],
};
async function call(name, path, body, inspect) {
  const start = Date.now();
  try {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(120000),
    });
    const value = await r.text();
    let data;
    try {
      data = JSON.parse(value);
    } catch {
      report.checks.push({
        name,
        http: r.status,
        ms: Date.now() - start,
        passed: false,
        layer: "access-or-routing",
        contentType: r.headers.get("content-type"),
        reason: "入口未返回JSON，尚未证明应用执行",
      });
      return null;
    }
    const result = inspect(data);
    report.checks.push({
      name,
      http: r.status,
      ms: Date.now() - start,
      passed: r.ok && result.passed,
      ...result,
    });
    return r.ok ? data : null;
  } catch (e) {
    report.checks.push({
      name,
      passed: false,
      ms: Date.now() - start,
      layer: "network",
      reason: e.name === "TimeoutError" ? "请求超时" : "网络连接失败",
    });
    return null;
  }
}
const status = await call("生产配置与版本能力", "/api/status", null, (d) => ({
  passed:
    d.aiConfigured === true &&
    d.dataConfigured === true &&
    d.metricCount === 15,
  metricCount: d.metricCount,
  aiConfigured: d.aiConfigured,
  dataConfigured: d.dataConfigured,
  accountWrite: d.capabilities?.accountWrite,
}));
if (status && report.checks.at(-1).passed) {
  await call(
    "三场景模型→真实数据→确定性筛选→证据",
    "/api/acceptance",
    {},
    (d) => {
      const cases = d.cases ?? [];
      const valid =
        d.schema === "mingce-acceptance-v2" &&
        !!d.verificationId &&
        cases.length === 3 &&
        cases.every(
          (c) =>
            c.engine === "model" &&
            !!c.modelRequestId &&
            c.counts.total === 4 &&
            c.counts.pass + c.counts.fail + c.counts.unknown === 4 &&
            c.stocks.every((s) =>
              s.checks.every(
                (x) =>
                  x.status !== "pass" ||
                  (x.quality === "ok" && x.requestId && x.asOf),
              ),
            ),
        );
      // A partial evidence report is a valid bounded result, never mislabeled full success.
      report.caseReport = d;
      return {
        passed: valid,
        state: d.state,
        verificationId: d.verificationId,
        cached: d.cached,
        cases: cases.map((c) => ({
          caseId: c.caseId,
          state: c.state,
          counts: c.counts,
          gaps: c.gaps,
          model: c.model,
          modelRequestId: c.modelRequestId,
        })),
      };
    },
  );
}
report.passed =
  report.checks.length === 2 && report.checks.every((c) => c.passed);
report.completedAt = new Date().toISOString();
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile(
  "artifacts/production-acceptance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      ...report,
      caseReport: report.caseReport
        ? {
            verificationId: report.caseReport.verificationId,
            state: report.caseReport.state,
          }
        : undefined,
    },
    null,
    2,
  ),
);
if (process.env.GITHUB_STEP_SUMMARY)
  await fs.appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `生产访问与案例验收：${report.passed ? "通过（字段缺口见报告）" : "未通过"}\n\n` +
      report.checks
        .map(
          (c) =>
            `- ${c.name}: ${c.passed ? "PASS" : "FAIL"} · HTTP ${c.http ?? "network"} · ${c.reason ?? c.state ?? ""}`,
        )
        .join("\n") +
      "\n\n完整元数据见 production-acceptance artifact。\n",
  );
if (!report.passed) process.exitCode = 1;
