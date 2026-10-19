import { METRICS, type Run, type Metric, type Check } from "./domain.ts";
export function conditionImpacts(run: Run) {
  const stocks = [...run.pass, ...run.fail, ...run.unknown];
  return run.conditions
    .filter((c) => c.enabled)
    .map((condition) => ({
      condition,
      label: `${METRICS[condition.metric].label} ${condition.op} ${condition.value}${METRICS[condition.metric].unit}`,
      fail: stocks.filter((s) =>
        s.checks.some(
          (c) => c.condition.id === condition.id && c.status === "fail",
        ),
      ).length,
      unknown: stocks.filter((s) =>
        s.checks.some(
          (c) => c.condition.id === condition.id && c.status === "unknown",
        ),
      ).length,
      total: stocks.length,
    }))
    .sort((a, b) => b.fail - a.fail || b.unknown - a.unknown);
}
export function evidenceGroups(checks: Check[]) {
  const groups = new Map<Metric, Check[]>();
  for (const c of checks)
    groups.set(c.condition.metric, [
      ...(groups.get(c.condition.metric) ?? []),
      c,
    ]);
  return [...groups.entries()].map(([metric, checks]) => ({
    metric,
    checks,
    evidence: checks[0]?.evidence,
    status: checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "unknown")
        ? "unknown"
        : "pass",
  }));
}
