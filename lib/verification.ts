import {
  screen,
  validateConditions,
  type ParsedIntent,
  type Snapshot,
} from "./domain.ts";
export function verifyCase(
  caseId: string,
  title: string,
  parsed: ParsedIntent,
  snapshot: Snapshot,
) {
  if (
    parsed.engine !== "model" ||
    !parsed.modelRequestId ||
    parsed.blocked ||
    validateConditions(parsed.conditions).length
  )
    throw Error("案例没有得到有效模型条件");
  if (
    snapshot.mode !== "live" ||
    !snapshot.stocks.length ||
    snapshot.stocks.some((s) => !/^\d{6}\.(SH|SZ|BJ)$/.test(s.code))
  )
    throw Error("真实案例必须使用真实股票数据快照");
  const run = screen(snapshot, parsed.conditions);
  const stocks = [...run.pass, ...run.fail, ...run.unknown];
  if (stocks.length !== snapshot.stocks.length)
    throw Error("筛选结果计数不守恒");
  for (const stock of stocks)
    for (const check of stock.checks)
      if (
        check.status === "pass" &&
        (!check.evidence ||
          check.evidence.quality !== "ok" ||
          check.evidence.raw === undefined ||
          !check.evidence.requestId ||
          !check.evidence.asOf ||
          !["MCP", "REST"].includes(check.evidence.transport ?? ""))
      )
        throw Error("入选依据缺少可追踪的原始证据");
  const gaps = stocks.flatMap((s) =>
    s.checks.filter((c) => c.status === "unknown"),
  ).length;
  return {
    caseId,
    title,
    state: gaps ? "partial" : "passed",
    engine: parsed.engine,
    model: parsed.model,
    modelRequestId: parsed.modelRequestId,
    conditions: parsed.conditions,
    counts: {
      pass: run.pass.length,
      fail: run.fail.length,
      unknown: run.unknown.length,
      total: stocks.length,
    },
    gaps,
    stocks: stocks.map((s) => ({
      code: s.code,
      name: s.name,
      status: s.status,
      checks: s.checks.map((c) => ({
        metric: c.condition.metric,
        status: c.status,
        reason: c.status === "unknown" ? c.reason : undefined,
        field: c.evidence?.field ?? null,
        asOf: c.evidence?.asOf ?? null,
        unit: c.evidence?.unit,
        quality: c.evidence?.quality ?? "missing",
        requestId: c.evidence?.requestId ?? null,
        tool: c.evidence?.toolName ?? null,
      })),
    })),
    stages: [
      { name: "AI解析", state: "passed" },
      { name: "金融数据", state: "passed" },
      { name: "确定性筛选", state: "passed" },
      { name: "证据核查", state: gaps ? "partial" : "passed" },
    ],
  };
}
