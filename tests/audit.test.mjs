import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent, evaluateStock } from "../lib/domain.ts";
import { quoteQuality, financialGrowth } from "../lib/fuyao.ts";
const c = (metric) => [{ id: "a", metric, op: "<", value: 20, enabled: true }];
test("错误单位不能被静默改写", () => {
  for (const p of [
    "市盈率低于25%",
    "最新价格低于25倍",
    "营收同比大于8元",
    "市盈率低于2万倍",
  ])
    assert.equal(parseIntent(p).blocked, true, p);
});
test("已知指标后附加未知要求也不能丢弃", () => {
  for (const p of [
    "市盈率小于25倍没有负债",
    "经营改善现金充裕",
    "市盈率低于25倍不要亏损股",
  ])
    assert.equal(parseIntent(p).blocked, true, p);
});
test("正常带修饰语的表达仍可编译", () => {
  for (const p of [
    "帮我找市盈率低于25倍的股票",
    "营收同比大于8%，净利润同比大于12%",
    "经营改善、估值合理、走势相对稳定",
  ])
    assert.equal(parseIntent(p).blocked, false, p);
});
test("PB非正和非正价格不能误入候选名单", () => {
  for (const metric of ["pb", "price"]) {
    const stock = {
      code: "TEST",
      name: "构造",
      metrics: { [metric]: { value: -1, quality: "ok", raw: -1 } },
    };
    assert.equal(evaluateStock(stock, c(metric)).status, "unknown");
  }
});
test("同日未来行情与无效时间均无法作为正常数据", () => {
  const now = Date.parse("2026-10-19T10:00:00+08:00");
  assert.equal(
    quoteQuality("2026-10-19T11:00:00+08:00", ["2026-10-19"], now).quality,
    "conflict",
  );
  assert.notEqual(quoteQuality("bad", ["2026-10-19"], now).quality, "ok");
});
test("同披露日相同报告期冲突财报不能任选一个值", () => {
  const period_end_ms = Date.parse("2026-06-30T00:00:00+08:00"),
    report_date_ms = Date.parse("2026-08-30T00:00:00+08:00");
  const records = [
    { period_end_ms, report_date_ms, operating_income: 120 },
    { period_end_ms, report_date_ms, operating_income: 130 },
    {
      period_end_ms: Date.parse("2025-06-30T00:00:00+08:00"),
      report_date_ms: Date.parse("2025-08-30T00:00:00+08:00"),
      operating_income: 100,
    },
  ];
  assert.equal(
    financialGrowth(records, "operating_income", Date.parse("2026-10-19"))
      .quality,
    "conflict",
  );
});
import { validateModelOutput } from "../lib/model-output.ts";
test("模型不能遗漏、禁用、改写或新增用户约束", () => {
  const local = parseIntent("市盈率低于25倍，营收同比大于0%");
  const p = {
    conditions: local.conditions,
    clarifications: [],
    warnings: [],
    blocked: false,
  };
  assert.equal(validateModelOutput(p, local).blocked, false);
  for (const conditions of [
    p.conditions.slice(0, 1),
    p.conditions.map((c) => ({ ...c, enabled: false })),
    p.conditions.map((c) => ({ ...c, value: 99 })),
    [
      ...p.conditions,
      { id: "extra", metric: "pb", op: "<", value: 2, enabled: true },
    ],
  ])
    assert.throws(() => validateModelOutput({ ...p, conditions }, local));
});
test("模型未知字段和非法结构均被阻止", () => {
  const local = parseIntent("市盈率低于25倍");
  for (const p of [
    null,
    {},
    {
      conditions: [
        { id: "x", metric: "magic", op: "<", value: 1, enabled: true },
      ],
      clarifications: [],
      warnings: [],
      blocked: false,
    },
  ])
    assert.throws(() => validateModelOutput(p, local));
});
import { readBody, gate, RequestError } from "../lib/http.ts";
import { conditionImpacts, evidenceGroups } from "../lib/research-summary.ts";
import { demoSnapshot } from "../lib/fixtures.ts";
import { screen } from "../lib/domain.ts";
test("接口请求空、数组、非法JSON与超长均明确拒绝", async () => {
  for (const body of ["null", "[]", "{bad", "x".repeat(12001)])
    await assert.rejects(
      () =>
        readBody(
          new Request("https://example.test/api", { method: "POST", body }),
        ),
      (e) => e instanceof RequestError && [400, 413].includes(e.status),
    );
});
test("跨站请求拒绝，同站请求允许", () => {
  assert.equal(
    gate(
      new Request("https://example.test/api", {
        headers: { Origin: "https://other.test" },
      }),
    ).status,
    403,
  );
  assert.equal(
    gate(
      new Request("https://example.test/api", {
        headers: { Origin: "https://example.test" },
      }),
    ),
    null,
  );
});
test("排除分析来自逐条件结果且证据按指标合并不丢条件", () => {
  const run = screen(
    demoSnapshot,
    parseIntent("经营改善、估值合理、走势相对稳定").conditions,
  );
  const impacts = conditionImpacts(run);
  assert.equal(impacts[0].condition.metric, "volatility");
  assert.equal(impacts[0].fail, 3);
  const groups = evidenceGroups(run.pass[0].checks);
  assert.equal(groups.length, 4);
  assert.equal(groups.find((g) => g.metric === "pe").checks.length, 2);
  assert.equal(groups.flatMap((g) => g.checks).length, 5);
});

test("错误原因保留具体单位，不被空条件提示覆盖", () =>
  assert.match(parseIntent("市盈率低于25%").reason, /单位/));

import { loadMarket, dateShanghai } from "../lib/fuyao.ts";
test("同批次重复股票的冲突行情与估值均无法成为正常证据", async () => {
  const now = Date.now();
  const fetcher = async (url) => {
    const item = String(url).includes("trading-days")
      ? [{ date: dateShanghai(now) }]
      : String(url).includes("valuations")
        ? [
            { thscode: "600519.SH", name: "测试", pe_ttm: 10, pb_mrq: 1 },
            { thscode: "600519.SH", name: "测试", pe_ttm: 12, pb_mrq: 1 },
          ]
        : [
            { thscode: "600519.SH", last_price: 10, price_change_ratio_pct: 1 },
            { thscode: "600519.SH", last_price: 11, price_change_ratio_pct: 1 },
          ];
    return Response.json({
      code: 0,
      data: { timestamp: now, item },
      request_id: "audit-duplicate",
    });
  };
  const data = await loadMarket(
    "audit-" + crypto.randomUUID(),
    ["600519.SH"],
    ["pe"],
    fetcher,
  );
  assert.equal(data.stocks[0].metrics.pe.quality, "conflict");
  assert.equal(data.stocks[0].metrics.price.quality, "conflict");
});
