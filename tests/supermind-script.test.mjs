import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseIntent, screen } from "../lib/domain.ts";
import { demoSnapshot } from "../lib/fixtures.ts";
import { supermindScript } from "../lib/transfer.ts";

const conditions = parseIntent("市盈率低于25倍").conditions;
const run = screen(
  {
    ...demoSnapshot,
    mode: "live",
    stocks: [{ ...demoSnapshot.stocks[0], code: "600519.SH" }],
  },
  conditions,
);
const script = supermindScript(conditions, run, "明策单元测试");

async function execute(mode, twice = false) {
  const cwd = await mkdtemp(join(tmpdir(), "mingce-python-"));
  try {
    await writeFile(join(cwd, "exported.py"), script);
    await writeFile(
      join(cwd, "scenario.py"),
      `MODE = ${JSON.stringify(mode)}\n`,
    );
    await writeFile(
      join(cwd, "pandas.py"),
      `
class Series:
    def __init__(self, values=None):
        self.values = values or {}
    @property
    def empty(self):
        return not self.values
    @property
    def index(self):
        return list(self.values)
    def __getitem__(self, key):
        return self.values[key]
class DataFrame:
    pass
`,
    );
    await writeFile(
      join(cwd, "mindgo_api.py"),
      `
from pandas import Series, DataFrame
from scenario import MODE
writes = 0
queries = 0
stored = Series({'name': '明策单元测试', 'symbol': ['000001.SZ']}) if MODE == 'conflict' else Series()
def custom_sector(name=None, action='query', symbol=None):
    global writes, queries, stored
    if action == 'query':
        queries += 1
        if MODE == 'query_error':
            raise RuntimeError('账户查询失败')
        if MODE == 'wrong_type':
            return DataFrame()
        if queries > 1 and MODE == 'mismatch':
            return Series({'name': name, 'symbol': ['000001.SZ']})
        if queries > 1 and MODE == 'empty_readback':
            return Series()
        return stored
    if action == 'insert':
        writes += 1
        stored = Series({'name': name, 'symbol': list(symbol)})
        return MODE != 'write_false'
    raise RuntimeError('Unexpected write action')
`,
    );
    await writeFile(
      join(cwd, "harness.py"),
      `
import json
import exported
import mindgo_api
try:
    exported.main()
    ${twice ? "exported.main()" : "pass"}
finally:
    print(json.dumps({'testWrites': mindgo_api.writes}))
`,
    );
    const result = spawnSync("python3", [join(cwd, "harness.py")], {
      cwd,
      encoding: "utf8",
      timeout: 15000,
    });
    assert.ifError(result.error);
    const lines = result.stdout.split("\n").filter((s) => s.startsWith("{"));
    return { ...result, records: lines.map((s) => JSON.parse(s)) };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("导出脚本：新建成功后必须回读一致才输出verified", async () => {
  const r = await execute("create");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.records[0].state, "created");
  assert.equal(r.records[0].verified, true);
  assert.equal(r.records[0].clientSync, "unverified");
  assert.equal(r.records.at(-1).testWrites, 1);
});
test("导出脚本：重复执行同名单只写入一次", async () => {
  const r = await execute("create", true);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(
    r.records.slice(0, 2).map((s) => s.state),
    ["created", "already_present"],
  );
  assert.equal(r.records.at(-1).testWrites, 1);
});
for (const [mode, writes, reason] of [
  ["conflict", 0, "同名板块已存在且内容不同"],
  ["write_false", 1, "创建未返回True"],
  ["mismatch", 1, "回读与本次名单不一致"],
  ["empty_readback", 1, "回读与本次名单不一致"],
  ["wrong_type", 0, "查询返回类型异常"],
  ["query_error", 0, "账户查询失败"],
])
  test(`导出脚本：${mode}不冒充写入成功`, async () => {
    const r = await execute(mode);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, new RegExp(reason));
    assert.equal(r.records.length, 1);
    assert.equal(r.records[0].testWrites, writes);
  });
