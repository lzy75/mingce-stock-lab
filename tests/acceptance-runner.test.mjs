import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

async function run(script, mock, file) {
  const cwd = await mkdtemp(join(tmpdir(), "mingce-acceptance-"));
  try {
    const { GITHUB_STEP_SUMMARY, ...env } = process.env;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "data:text/javascript," + encodeURIComponent(mock),
        fileURLToPath(new URL("../scripts/" + script, import.meta.url)),
      ],
      {
        cwd,
        env: { ...env, MINGCE_TEST_REPORT: "artifacts/http.json" },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 1, result.stderr);
    return JSON.parse(await readFile(join(cwd, file), "utf8"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("生产验收：合法内容不能覆盖 HTTP 502 失败", async () => {
  const report = await run(
    "verify-production.mjs",
    `
    globalThis.fetch = async url => url.endsWith('/api/status')
      ? Response.json({aiConfigured:true,dataConfigured:true,metricCount:15})
      : Response.json({schema:'mingce-acceptance-v2',verificationId:'test-only',
          cases:Array.from({length:3},()=>({engine:'model',modelRequestId:'test-only',
          counts:{total:4,pass:0,fail:0,unknown:4},stocks:[]}))}, {status:502});
  `,
    "artifacts/production-acceptance.json",
  );
  assert.equal(report.checks[1].passed, false);
  assert.equal(report.passed, false);
});

test("生产验收：上游错误和业务码保留在摘要", async () => {
  const report = await run(
    "verify-production.mjs",
    `
    globalThis.fetch = async url => url.endsWith('/api/status')
      ? Response.json({aiConfigured:true,dataConfigured:true,metricCount:15})
      : Response.json({error:'扶摇MCP HTTP 530',code:'ACCEPTANCE_FAILED'}, {status:502});
  `,
    "artifacts/production-acceptance.json",
  );
  assert.equal(report.checks[1].reason, "扶摇MCP HTTP 530");
  assert.equal(report.checks[1].code, "ACCEPTANCE_FAILED");
});

test("HTTP 检查：响应字段通过不能覆盖错误 HTTP，且可独立创建报告目录", async () => {
  const report = await run(
    "check-web.mjs",
    `
    globalThis.fetch = async () => Response.json({dataConfigured:false,
      aiConfigured:false,error:'上游暂不可用',code:'UPSTREAM'}, {status:502});
  `,
    "artifacts/http.json",
  );
  assert.equal(report.checks[0].passed, false);
  assert.equal(report.checks[0].reason, "上游暂不可用");
  assert.equal(report.passed, false);
});
