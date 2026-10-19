import { demoSnapshot, examples } from "./fixtures.ts";
import {
  parseIntent,
  validateConditions,
  screen,
  compareRuns,
  type Condition,
  type Run,
  type Snapshot,
} from "./domain.ts";
export type Example = (typeof examples)[number];
export function experiment(id: string) {
  const example = examples.find((x) => x.id === id) ?? examples[0];
  const parsed = parseIntent(example.prompt);
  const conflicts = validateConditions(parsed.conditions);
  const blocked = parsed.blocked || conflicts.length > 0;
  const run = blocked ? null : screen(demoSnapshot, parsed.conditions);
  const reason = parsed.reason ?? conflicts.join("；");
  const expectedBlocked = [
    "conflict",
    "compliance",
    "unsupported",
    "window",
    "injection",
  ].includes(example.id);
  const matched = expectedBlocked
    ? blocked
    : example.id === "empty"
      ? run?.pass.length === 0
      : example.id === "missing"
        ? ["DEMO-09", "DEMO-10", "DEMO-12"].every((code) =>
            run?.unknown.some((s) => s.code === code),
          )
        : !!run;
  return { example, parsed, conflicts, blocked, run, reason, matched };
}
export function sensitivity(pe: number) {
  const base = parseIntent("经营改善、估值合理、走势相对稳定").conditions;
  const conditions = base.map((c) =>
    c.metric === "pe" && c.op === "<=" ? { ...c, value: pe } : c,
  );
  const before = screen(demoSnapshot, base),
    after = screen(demoSnapshot, conditions);
  const curve = Array.from({ length: 36 }, (_, i) => {
    const x = 5 + i;
    return {
      x,
      y: screen(
        demoSnapshot,
        base.map((c) =>
          c.metric === "pe" && c.op === "<=" ? { ...c, value: x } : c,
        ),
      ).pass.length,
    };
  });
  return { before, after, diff: compareRuns(before, after), curve };
}
export type Fault = "missing" | "stale" | "conflict" | "api";
export function injectFault(fault: Fault) {
  const snapshot: Snapshot = structuredClone(demoSnapshot);
  const conditions = parseIntent("经营改善、估值合理、走势相对稳定").conditions;
  const before = screen(demoSnapshot, conditions);
  if (fault === "api")
    return {
      before,
      after: null as Run | null,
      stock: null,
      message:
        "模拟HTTP 429：数据请求失败。筛选未执行；保留上次成功快照并明确提示，不能生成“正常”新结论。",
    };
  const evidence = snapshot.stocks[0].metrics.pe!;
  evidence.quality = fault;
  evidence.note =
    fault === "missing"
      ? "注入：PE原始字段缺失"
      : fault === "stale"
        ? "注入：PE时点早于应有交易日"
        : "注入：同一PE字段存在相互冲突的上游值";
  if (fault === "missing") {
    evidence.value = null;
    evidence.raw = null;
  }
  const after = screen(snapshot, conditions);
  const stock = after.unknown.find((s) => s.code === "DEMO-01") ?? null;
  return {
    before,
    after,
    stock,
    message:
      "对原本入选的样本01注入异常后，它变为无法判断；系统没有补零或默认为满足。",
  };
}
