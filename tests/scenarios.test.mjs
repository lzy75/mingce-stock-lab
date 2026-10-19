import test from "node:test";
import assert from "node:assert/strict";
import {
  METRICS,
  parseIntent,
  evaluateStock,
  technicalWindow,
} from "../lib/domain.ts";
test("字典扩展为15项且新单位能正确编译", () => {
  assert.equal(Object.keys(METRICS).length, 15);
  for (const p of [
    "市销率低于3倍，市现率大于0倍",
    "成交额大于5亿元，成交量大于100万股",
    "20日涨幅大于0%，20日最大回撤不超过10%",
    "20日均线偏离不超过8%，振幅不超过5%",
  ])
    assert.equal(parseIntent(p).blocked, false, p);
  assert.equal(parseIntent("成交额大于5亿元").conditions[0].value, 5);
  assert.equal(parseIntent("成交额大于5倍").blocked, true);
});
test("20日趋势指标可手算且不会接入缺失价格", () => {
  const values = Array.from({ length: 21 }, (_, i) => 100 + i);
  const r = technicalWindow(values);
  assert.ok(Math.abs(r.return20 - 20) < 1e-9);
  assert.equal(r.drawdown20, 0);
  assert.ok(Math.abs(r.ma20Deviation - (120 / 110.5 - 1) * 100) < 1e-9);
  assert.equal(technicalWindow([...values.slice(0, 20), null]), null);
});
test("最大回撤来自历史峰值到后续低点，不能用末期涨幅代替", () => {
  const r = technicalWindow([100, 120, 90, ...Array(18).fill(110)]);
  assert.equal(r.drawdown20, 25);
  assert.ok(Math.abs(r.return20 - 10) < 1e-9);
});
test("负PCF不作为低估值证据", () => {
  const result = evaluateStock(
    {
      code: "TEST",
      name: "构造",
      metrics: { pcf: { value: -2, quality: "ok" } },
    },
    [{ id: "x", metric: "pcf", op: "<", value: 20, enabled: true }],
  );
  assert.equal(result.status, "unknown");
});
import { researchScenarios } from "../lib/scenarios.ts";
import { verifyCase } from "../lib/verification.ts";
import { demoSnapshot } from "../lib/fixtures.ts";
test("六种场景均可编译且不会给默认经营场景添加额外条件", () => {
  for (const s of researchScenarios)
    assert.equal(parseIntent(s.question).blocked, false, s.id);
  assert.equal(parseIntent(researchScenarios[0].question).conditions.length, 5);
});
test("真实案例验收要求模型调用与原始证据，未知不能冒充成功", () => {
  const parsed = {
    ...parseIntent("市盈率小于25倍"),
    engine: "model",
    model: "test",
    modelRequestId: "test-model-request",
  };
  const snapshot = {
    ...demoSnapshot,
    mode: "live",
    stocks: demoSnapshot.stocks.map((s, i) => ({
      ...s,
      code: `${String(600000 + i).padStart(6, "0")}.SH`,
      metrics: Object.fromEntries(
        Object.entries(s.metrics).map(([k, e]) => [
          k,
          {
            ...e,
            requestId: "test-data",
            transport: "MCP",
            toolName: "read-only",
          },
        ]),
      ),
    })),
  };
  assert.equal(
    verifyCase("test", "构造验收测试", parsed, snapshot).state,
    "partial",
  );
  assert.throws(() =>
    verifyCase("test", "bad", { ...parsed, engine: "rules" }, snapshot),
  );
  assert.throws(() =>
    verifyCase(
      "test",
      "bad",
      { ...parsed, modelRequestId: undefined },
      snapshot,
    ),
  );
  const bad = {
    ...snapshot,
    stocks: [
      {
        ...snapshot.stocks[0],
        metrics: { pe: { ...snapshot.stocks[0].metrics.pe, raw: undefined } },
      },
    ],
  };
  assert.throws(() => verifyCase("test", "bad", parsed, bad));
});

import { loadMarket, dateShanghai } from "../lib/fuyao.ts";
test("真实适配器换算成交单位并保留原始值，振幅检查每个原始价格冲突", async () => {
  const now = Date.now();
  let conflict = false;
  const fetcher = async (url) =>
    Response.json({
      code: 0,
      request_id: "constructed-adapter-request",
      data: {
        timestamp: now,
        item: String(url).includes("trading-days")
          ? [{ date: dateShanghai(now) }]
          : String(url).includes("valuations")
            ? [
                {
                  thscode: "600519.SH",
                  name: "构造适配器样本",
                  ps_ttm: 2,
                  pcf_ttm: 12,
                },
              ]
            : [
                {
                  thscode: "600519.SH",
                  turnover: 5e8,
                  volume: 2e6,
                  high_price: 110,
                  low_price: 90,
                  prev_price: 100,
                },
                ...(conflict
                  ? [
                      {
                        thscode: "600519.SH",
                        turnover: 5e8,
                        volume: 2e6,
                        high_price: 120,
                        low_price: 90,
                        prev_price: 100,
                      },
                    ]
                  : []),
              ],
      },
    });
  const a = await loadMarket(
    "test-" + crypto.randomUUID(),
    ["600519.SH"],
    ["turnover", "volume", "amplitude", "ps", "pcf"],
    fetcher,
  );
  const m = a.stocks[0].metrics;
  assert.equal(m.turnover.value, 5);
  assert.equal(m.turnover.raw, 5e8);
  assert.equal(m.volume.value, 200);
  assert.equal(m.volume.raw, 2e6);
  assert.equal(m.amplitude.value, 20);
  assert.equal(m.ps.value, 2);
  assert.equal(m.pcf.value, 12);
  conflict = true;
  const b = await loadMarket(
    "test-" + crypto.randomUUID(),
    ["600519.SH"],
    ["amplitude"],
    fetcher,
  );
  assert.equal(b.stocks[0].metrics.amplitude.quality, "conflict");
});
