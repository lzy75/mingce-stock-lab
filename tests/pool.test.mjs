import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePoolText,
  parseCodes,
  MARKET_BATCH_SIZE,
} from "../lib/research-pool.ts";
import { loadMarketBatches } from "../lib/market-batches.ts";
const codes = Array.from({ length: 45 }, (_, i) => `${600000 + i}.SH`);
const snapshot = (cs, n = 0) => ({
  id: `batch-${n}`,
  mode: "live",
  requested: cs.length,
  stocks: cs.map((code) => ({ code, name: "构造批处理测试", metrics: {} })),
  asOf: `2026-10-19T07:0${n}:00Z`,
  fetchedAt: "2026-10-19T07:10:00Z",
  scope: "测试",
  issues: [],
});
test("研究池超过20只仍可完整导入，支持换行中文逗号并去重", () => {
  assert.equal(parseCodes(codes).length, 45);
  assert.deepEqual(parsePoolText("600519.sh，000333.sz\n600519.SH"), [
    "600519.SH",
    "000333.SZ",
  ]);
  assert.equal(parseCodes(Array(500).fill("600519.SH")).length, 1);
  assert.throws(() => parsePoolText("600519.SH,http://localhost"));
});
test("45只研究池自动分三批，合并后覆盖完整且保留最早批次时点", async () => {
  const sizes = [],
    progress = [];
  const result = await loadMarketBatches({
    codes,
    metrics: ["pe"],
    onProgress: (p) => progress.push(p),
    fetcher: async (_, opts) => {
      const cs = JSON.parse(opts.body).codes;
      sizes.push(cs.length);
      return Response.json(snapshot(cs, sizes.length));
    },
  });
  assert.deepEqual(sizes, [20, 20, 5]);
  assert.equal(result.stocks.length, 45);
  assert.equal(result.requested, 45);
  assert.equal(new Set(result.stocks.map((s) => s.code)).size, 45);
  assert.equal(result.asOf, "2026-10-19T07:01:00Z");
  assert.equal(progress.at(-1).completed, 3);
  assert.equal(progress.at(-1).stocksDone, 45);
  assert.match(result.issues.join(""), /分批/);
});
test("中途批次失败时不返回部分名单，错误保留批次定位", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      loadMarketBatches({
        codes,
        metrics: ["pe"],
        fetcher: async (_, o) =>
          ++calls === 1
            ? Response.json(snapshot(JSON.parse(o.body).codes))
            : Response.json(
                { error: "上游失败", requestId: "test-trace" },
                { status: 502 },
              ),
      }),
    /第2.*test-trace/,
  );
  assert.equal(calls, 2);
});
test("缺股、重复代码或构造快照不能冒充完整真实研究池", async () => {
  for (const kind of ["missing", "duplicate", "demo"]) {
    await assert.rejects(
      () =>
        loadMarketBatches({
          codes: codes.slice(0, 3),
          metrics: ["pe"],
          fetcher: async () => {
            const s = snapshot(codes.slice(0, 3));
            if (kind === "missing") s.stocks.pop();
            if (kind === "duplicate") s.stocks[1] = s.stocks[0];
            if (kind === "demo") s.mode = "demo";
            return Response.json(s);
          },
        }),
      /批次.*结构|批次.*范围/,
    );
  }
});
test("限流按Retry-After等待后只重试一次，不丢失当前批次", async () => {
  let calls = 0;
  const waits = [];
  const r = await loadMarketBatches({
    codes: codes.slice(0, 1),
    metrics: ["pe"],
    wait: async (ms) => {
      waits.push(ms);
    },
    fetcher: async (_, o) =>
      ++calls === 1
        ? Response.json(
            { error: "限流" },
            { status: 429, headers: { "Retry-After": "2" } },
          )
        : Response.json(snapshot(JSON.parse(o.body).codes)),
  });
  assert.equal(calls, 2);
  assert.equal(waits[0], 2000);
  assert.equal(r.stocks.length, 1);
});
test("已取消或条件版本变化时停止后续批次，不生成旧条件结果", async () => {
  let calls = 0,
    current = true;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() =>
    loadMarketBatches({
      codes,
      metrics: ["pe"],
      signal: controller.signal,
      fetcher: async () => {
        calls++;
        return Response.json({});
      },
    }),
  );
  assert.equal(calls, 0);
  await assert.rejects(() =>
    loadMarketBatches({
      codes,
      metrics: ["pe"],
      isCurrent: () => current,
      fetcher: async (_, o) => {
        calls++;
        current = false;
        return Response.json(snapshot(JSON.parse(o.body).codes));
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(MARKET_BATCH_SIZE, 20);
});
