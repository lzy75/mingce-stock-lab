import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchFuyao,
  financialGrowth,
  quoteQuality,
  parseCodes,
  items,
} from "../lib/fuyao.ts";
const response =
  (body, status = 200) =>
  async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
    });
test("未配置Key时不发起上游调用", async () => {
  let called = false;
  await assert.rejects(
    () =>
      fetchFuyao("/x", "", async () => {
        called = true;
      }),
    /尚未配置/,
  );
  assert.equal(called, false);
});
test("HTTP200业务2003和2001都作为授权失败", async () => {
  for (const code of [2001, 2003])
    await assert.rejects(
      () =>
        fetchFuyao(
          "/x",
          "test",
          response({ code, data: null, request_id: "trace" }),
        ),
      /授权/,
    );
});
test("429、网络、非法JSON、缺业务码都明确失败", async () => {
  await assert.rejects(
    () => fetchFuyao("/x", "test", response({}, 429)),
    /限流/,
  );
  await assert.rejects(
    () =>
      fetchFuyao("/x", "test", async () => {
        throw Error("network");
      }),
    /超时/,
  );
  await assert.rejects(
    () => fetchFuyao("/x", "test", response("oops")),
    /JSON/,
  );
  await assert.rejects(
    () => fetchFuyao("/x", "test", response({ data: {} })),
    /状态码/,
  );
});
test("成功响应保留请求ID；item缺失不当作空结果", async () => {
  const r = await fetchFuyao(
    "/x",
    "test",
    response({ code: 0, data: { item: [] }, request_id: "trace" }),
  );
  assert.equal(r.request_id, "trace");
  assert.throws(() => items({ code: 0, data: {} }), /item/);
});
test("代码限制防任意URL/超出配额，且去重", () => {
  assert.deepEqual(parseCodes(["600519.SH", "600519.SH"]), ["600519.SH"]);
  for (const v of [
    [],
    ["http://localhost"],
    Array(21).fill("600519.SH"),
    ["DEMO-01"],
  ])
    assert.throws(() => parseCodes(v));
});
const now = Date.parse("2026-10-19T07:10:00Z");
const records = [
  {
    period_end_ms: Date.parse("2026-06-30T00:00:00+08:00"),
    report_date_ms: Date.parse("2026-08-30T00:00:00+08:00"),
    operating_income: 120,
    parent_holder_net_profit: 24,
  },
  {
    period_end_ms: Date.parse("2025-06-30T00:00:00+08:00"),
    report_date_ms: Date.parse("2025-08-30T00:00:00+08:00"),
    operating_income: 100,
    parent_holder_net_profit: 20,
  },
];
test("同比使用上年同报告期而非相邻季度", () => {
  const r = financialGrowth(records, "operating_income", now);
  assert.ok(Math.abs(r.value - 20) < 1e-9);
  assert.equal(r.reportPeriod, "2026-06-30");
});
test("未来披露财报不能进入当前筛选", () => {
  const future = {
    ...records[0],
    period_end_ms: Date.parse("2026-09-30"),
    report_date_ms: Date.parse("2026-10-30"),
    operating_income: 999,
  };
  assert.ok(
    Math.abs(
      financialGrowth([future, ...records], "operating_income", now).value - 20,
    ) < 1e-9,
  );
});
test("上年同期≤0或缺字段时同比无法判断", () => {
  for (const income of [0, -1, null])
    assert.equal(
      financialGrowth(
        [records[0], { ...records[1], operating_income: income }],
        "operating_income",
        now,
      ).value,
      null,
    );
});
test("没有披露日期不可将报告期末误称披露日", () => {
  assert.equal(
    financialGrowth(
      records.map((r) => ({ ...r, report_date_ms: null })),
      "operating_income",
      now,
    ).value,
    null,
  );
});
test("行情按交易日判断，不将周末正常收盘数据判过期", () => {
  const friday = Date.parse("2026-10-16T07:00:00Z");
  assert.equal(
    quoteQuality(
      new Date(friday).toISOString(),
      ["2026-10-16"],
      Date.parse("2026-10-18T03:00:00Z"),
    ).quality,
    "ok",
  );
});
test("当日已收盘但快照仍为昨日，判过期", () => {
  assert.equal(
    quoteQuality("2026-10-16T07:00:00Z", ["2026-10-16", "2026-10-19"], now)
      .quality,
    "stale",
  );
});
test("午休不把11:30时点因墙钟间隔判过期", () => {
  assert.equal(
    quoteQuality(
      "2026-10-19T03:30:00Z",
      ["2026-10-19"],
      Date.parse("2026-10-19T04:10:00Z"),
    ).quality,
    "ok",
  );
});
test("收盘前快照明显滞后与缺交易日历都无法称最新", () => {
  assert.equal(
    quoteQuality("2026-10-19T05:30:00Z", ["2026-10-19"], now).quality,
    "stale",
  );
  assert.equal(
    quoteQuality("2026-10-19T07:00:00Z", [], now).quality,
    "missing",
  );
});
