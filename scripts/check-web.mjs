import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
const base = (process.env.MINGCE_TEST_URL || "http://127.0.0.1:5173").replace(
  /\/$/,
  "",
);
const checks = [];
async function call(name, path, body, expected, inspect, headers = {}) {
  const at = new Date().toISOString(),
    start = Date.now();
  try {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined
          ? headers
          : { "Content-Type": "application/json", ...headers },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(90000),
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      checks.push({
        name,
        at,
        ms: Date.now() - start,
        http: r.status,
        passed: expected === 403 && r.status === 403,
        layer:
          expected === 403 && r.status === 403
            ? "request-gate"
            : "access-or-routing",
        reason:
          expected === 403 && r.status === 403
            ? "跨站请求已在应用或框架入口被拒绝"
            : "响应不是JSON；未将入口失败算作应用通过",
      });
      return null;
    }
    const detail = inspect?.(data) ?? {};
    checks.push({
      name,
      at,
      http: r.status,
      ms: Date.now() - start,
      ...detail,
      passed: r.status === expected && detail.passed !== false,
      ...(r.status !== expected && data.error
        ? { reason: data.error, code: data.code }
        : {}),
    });
    return data;
  } catch {
    checks.push({
      name,
      at,
      ms: Date.now() - start,
      passed: false,
      layer: "network",
      reason: "连接失败或超时",
    });
    return null;
  }
}
const status = await call(
  "服务端配置状态",
  "/api/status",
  undefined,
  200,
  (d) => ({
    passed: typeof d.dataConfigured === "boolean",
    dataConfigured: d.dataConfigured,
    aiConfigured: d.aiConfigured,
  }),
);
if (status) {
  await call(
    "语义主链路",
    "/api/parse",
    { intent: "经营改善、估值合理、走势相对稳定" },
    200,
    (d) => ({
      passed:
        !d.blocked &&
        d.conditions?.length === 5 &&
        (!status.aiConfigured || d.engine === "model"),
      engine: d.engine,
      model: d.model,
      conditions: d.conditions?.length,
    }),
  );
  await call(
    "显式阈值模型不增减条件",
    "/api/parse",
    { intent: "市盈率低于25倍，营收同比大于0%" },
    200,
    (d) => ({
      passed:
        !d.blocked &&
        d.conditions?.length === 2 &&
        (!status.aiConfigured || d.engine === "model"),
      engine: d.engine,
      conditions: d.conditions?.length,
    }),
  );
  await call(
    "错单位拦截",
    "/api/parse",
    { intent: "市盈率小于25%" },
    200,
    (d) => ({ passed: d.blocked === true }),
  );
  await call(
    "未支持附加要求不丢弃",
    "/api/parse",
    { intent: "市盈率小于25倍没有负债" },
    200,
    (d) => ({ passed: d.blocked === true }),
  );
  await call("非法JSON", "/api/parse", "{bad", 400, (d) => ({
    passed: !!d.error,
  }));
  await call("非法研究池", "/api/market", { codes: ["bad"] }, 400, (d) => ({
    passed: !!d.error,
  }));
  await call(
    "空指标请求",
    "/api/market",
    { codes: ["600519.SH"], metrics: [] },
    400,
    (d) => ({ passed: !!d.error }),
  );
  await call(
    "跨站请求",
    "/api/parse",
    { intent: "市盈率低于25倍" },
    403,
    (d) => ({ passed: !!d.error }),
    { Origin: "https://untrusted.example" },
  );
  if (status.dataConfigured)
    await call(
      "真实MCP研究池",
      "/api/market",
      {
        codes: ["600519.SH", "000333.SZ"],
        metrics: ["pe", "revenueGrowth", "profitGrowth", "volatility"],
      },
      200,
      (d) => {
        const evidence = (d.stocks ?? []).flatMap((s) =>
          Object.values(s.metrics),
        );
        return {
          passed:
            d.stocks?.length === 2 &&
            evidence.length >= 12 &&
            evidence.every(
              (e) =>
                e.transport === "MCP" && e.quality === "ok" && !!e.requestId,
            ),
          stocks: d.stocks?.length,
          transport: [...new Set(evidence.map((e) => e.transport))],
          tools: [...new Set(evidence.map((e) => e.toolName))],
          requestIds: [...new Set(evidence.map((e) => e.requestId))],
          qualities: [...new Set(evidence.map((e) => e.quality))],
        };
      },
    );
}
const report = {
  at: new Date().toISOString(),
  base,
  passed: checks.every((c) => c.passed),
  checks,
};
const file = process.env.MINGCE_TEST_REPORT || "artifacts/http.json";
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed ? 0 : 1;
