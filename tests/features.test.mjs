import test from "node:test";
import assert from "node:assert/strict";
import { FuyaoMcp, decodeRpc, mcpArguments } from "../lib/mcp-client.ts";
import { experiment, sensitivity, injectFault } from "../lib/experiments.ts";
import { recommend } from "../lib/preferences.ts";
import {
  strategySentence,
  supermindScript,
  transferManifest,
} from "../lib/transfer.ts";
import { parseIntent, screen } from "../lib/domain.ts";
import { demoSnapshot } from "../lib/fixtures.ts";
test("MCP JSON与SSE响应均可解析", () => {
  assert.deepEqual(decodeRpc('{"result":{"x":1}}').result, { x: 1 });
  assert.deepEqual(
    decodeRpc('event: message\ndata: {"jsonrpc":"2.0","result":{"x":2}}\n\n')
      .result,
    { x: 2 },
  );
  assert.throws(() => decodeRpc("garbage"));
});
test("MCP路径映射白名单和数值参数转换", () => {
  const r = mcpArguments(
    "/api/a-share/prices/historical?thscode=600519.SH&start=1&end=2&interval=1d",
  );
  assert.equal(r.name, "get_a_share_prices_historical");
  assert.equal(r.args.start, 1);
  assert.equal(r.args.thscode, "600519.SH");
  assert.throws(() => mcpArguments("https://evil.example/admin"));
});
test("MCP真实协议顺序、工具发现和结构化结果", async () => {
  const calls = [];
  const f = async (url, init) => {
    const b = JSON.parse(init.body);
    calls.push(b.method);
    const result =
      b.method === "initialize"
        ? { protocolVersion: "2025-03-26" }
        : b.method === "tools/list"
          ? { tools: [{ name: "get_a_share_prices_snapshot" }] }
          : b.method === "tools/call"
            ? {
                structuredContent: {
                  code: 0,
                  data: { item: [] },
                  request_id: "trace-mcp",
                },
              }
            : {};
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: b.id, result }), {
      headers: { "mcp-session-id": "test-session" },
    });
  };
  const client = new FuyaoMcp("test-only", f);
  const result = await client.call("get_a_share_prices_snapshot", {});
  assert.deepEqual(calls, [
    "initialize",
    "notifications/initialized",
    "tools/list",
    "tools/call",
  ]);
  assert.equal(result.request_id, "trace-mcp");
  assert.equal(client.session, "test-session");
});
test("MCP未公开写工具不能被调用", async () => {
  const f = async (url, init) => {
    const b = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        result:
          b.method === "tools/list"
            ? { tools: [] }
            : { protocolVersion: "2025-03-26" },
      }),
    );
  };
  await assert.rejects(
    () => new FuyaoMcp("test", f).call("write_watchlist", {}),
    /未公开/,
  );
});
test("MCP业务错误不会伪装成成功", async () => {
  const client = new FuyaoMcp(
    "test",
    async () =>
      new Response(
        JSON.stringify({ error: { code: -32603, message: "hidden" } }),
      ),
  );
  await assert.rejects(() => client.init(), /失败/);
});
test("所有推演示例的预期与实际一致", () => {
  for (const id of [
    "balanced",
    "explicit",
    "value",
    "conflict",
    "empty",
    "missing",
    "compliance",
    "unsupported",
    "window",
    "injection",
  ])
    assert.equal(experiment(id).matched, true, id);
});
test("敏感性滑块保留其他约束，15倍比25倍少2个样本", () => {
  const r = sensitivity(15);
  assert.equal(r.after.pass.length, 2);
  assert.equal(r.diff.removed.length, 2);
  assert.equal(r.curve.length, 36);
  assert.equal(r.before.snapshotId, r.after.snapshotId);
});
test("三类字段异常均使原本入选的样本变为无法判断", () => {
  for (const kind of ["missing", "stale", "conflict"]) {
    const r = injectFault(kind);
    assert.equal(r.before.pass.length, 4);
    assert.equal(r.after.pass.length, 3);
    assert.equal(r.after.unknown.length, 4);
    assert.equal(r.stock.code, "DEMO-01");
  }
});
test("接口异常注入不生成新筛选结果", () =>
  assert.equal(injectFault("api").after, null));
test("偏好推荐可解释且不自动执行或删除既有约束", () => {
  for (const focus of ["balanced", "value", "growth"])
    for (const tolerance of ["low", "medium", "high"]) {
      const r = recommend({ focus, tolerance });
      assert.equal(r.parsed.blocked, false);
      assert.ok(r.parsed.conditions.length >= 5);
      assert.ok(r.parsed.clarifications[0].includes("主动选择"));
    }
});
test("低历史波动模板采用20%阈值，成长模板提高增长门槛", () => {
  const r = recommend({ focus: "growth", tolerance: "low" });
  assert.equal(
    r.parsed.conditions.find((c) => c.metric === "volatility").value,
    20,
  );
  assert.equal(
    r.parsed.conditions.find((c) => c.metric === "revenueGrowth").value,
    10,
  );
  assert.equal(
    r.parsed.conditions.find((c) => c.metric === "profitGrowth").value,
    15,
  );
});
test("偏好未知枚举不可注入条件", () =>
  assert.throws(() =>
    recommend({ focus: "promise-profit", tolerance: "low" }),
  ));
const conditions = parseIntent("市盈率低于25倍").conditions;
test("策略表达保留指标口径、运算符和阈值", () =>
  assert.ok(strategySentence(conditions).includes("市盈率 TTM小于25倍")));
test("构造数据绝不进入真实自选股脚本", () =>
  assert.throws(
    () => supermindScript(conditions, screen(demoSnapshot, conditions), "测试"),
    /构造/,
  ));
test("SuperMind脚本仅新建自选板块、不含交易指令且可追溯", () => {
  const run = screen(
    {
      ...demoSnapshot,
      mode: "live",
      stocks: [
        {
          ...demoSnapshot.stocks[0],
          code: "600519.SH",
          name: "真实接口测试占位",
        },
      ],
    },
    conditions,
  );
  const s = supermindScript(conditions, run, "明策测试");
  assert.ok(s.includes("action='insert'"));
  assert.ok(s.includes("600519.SH"));
  assert.ok(s.includes("snapshotId"));
  assert.ok(!/\border\s*\(|\bbuy\s*\(|\bsell\s*\(/.test(s));
});
test("导出不伪称已经同步，不泄漏构造代码到真实名单", () => {
  const r = transferManifest(conditions, screen(demoSnapshot, conditions));
  assert.equal(r.codes.length, 0);
  assert.equal(r.capabilities.accountSync, "未授权 / 未执行");
});

test("修改条件后不能把旧候选名单作为新策略导出", () => {
  const run = screen(
    {
      ...demoSnapshot,
      mode: "live",
      stocks: [{ ...demoSnapshot.stocks[0], code: "600519.SH" }],
    },
    conditions,
  );
  const changed = conditions.map((c) => ({ ...c, value: 15 }));
  assert.throws(() => supermindScript(changed, run, "新策略"), /条件已修改/);
  const manifest = transferManifest(changed, run);
  assert.equal(manifest.snapshotId, null);
  assert.deepEqual(manifest.codes, []);
});
