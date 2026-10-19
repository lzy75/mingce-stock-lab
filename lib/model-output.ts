import {
  validateConditions,
  type ParsedIntent,
  type Condition,
} from "./domain.ts";
export function validateModelOutput(
  value: unknown,
  local: ParsedIntent,
): {
  conditions: Condition[];
  clarifications: string[];
  warnings: string[];
  blocked: boolean;
  reason?: string;
} {
  if (!value || typeof value !== "object") throw Error("模型响应结构无效");
  const p = value as Record<string, unknown>;
  if (
    !Array.isArray(p.conditions) ||
    typeof p.blocked !== "boolean" ||
    !Array.isArray(p.clarifications) ||
    !Array.isArray(p.warnings) ||
    [...p.clarifications, ...p.warnings].some(
      (s) => typeof s !== "string" || s.length > 1200,
    ) ||
    p.clarifications.length > 20 ||
    p.warnings.length > 20
  )
    throw Error("模型响应不符合条件结构");
  const conditions = p.conditions as Condition[];
  const errors = validateConditions(conditions);
  if (errors.some((e) => !e.includes("上下界冲突") && !e.includes("至少启用")))
    throw Error("模型返回非法指标或条件");
  if (!p.blocked) {
    if (conditions.some((c) => !c.enabled)) throw Error("模型禁用了用户约束");
    for (const c of local.conditions.filter((c) => c.enabled))
      if (
        !conditions.some(
          (m) => m.metric === c.metric && m.op === c.op && m.value === c.value,
        )
      )
        throw Error("模型遗漏或改写了已识别约束");
    if (
      conditions.some(
        (m) =>
          !local.conditions.some(
            (c) =>
              c.metric === m.metric && c.op === m.op && c.value === m.value,
          ),
      )
    )
      throw Error("模型加入了未经确认的额外条件");
  }
  return {
    conditions,
    clarifications: p.clarifications as string[],
    warnings: [...(p.warnings as string[]), ...errors],
    blocked: p.blocked || !conditions.length,
    reason: typeof p.reason === "string" ? p.reason : undefined,
  };
}
