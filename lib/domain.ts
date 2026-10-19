export type Metric =
  | "pe"
  | "pb"
  | "revenueGrowth"
  | "profitGrowth"
  | "volatility"
  | "change"
  | "price";
export type Operator = ">" | ">=" | "<" | "<=" | "=";
export type Status = "pass" | "fail" | "unknown";
export interface Condition {
  id: string;
  metric: Metric;
  op: Operator;
  value: number;
  enabled: boolean;
}
export interface Evidence {
  transport?:'MCP'|'REST';toolName?:string;
  value: number | null;
  raw: unknown;
  field: string;
  source: string;
  asOf: string | null;
  unit: string;
  definition: string;
  quality: "ok" | "missing" | "stale" | "conflict";
  note?: string;
  requestId?: string;
  endpoint?: string;
  reportPeriod?: string;
  fetchedAt?: string;
}
export interface Stock {
  code: string;
  name: string;
  sector?: string;
  metrics: Partial<Record<Metric, Evidence>>;
  history?: number[];
}
export interface Snapshot {
  id: string;
  mode: "demo" | "live";
  stocks: Stock[];
  fetchedAt: string;
  asOf: string | null;
  scope: string;
  requested: number;
  issues: string[];
}
export interface Check {
  condition: Condition;
  status: Status;
  evidence?: Evidence;
  reason: string;
}
export interface EvaluatedStock extends Stock {
  status: Status;
  checks: Check[];
}
export interface Run {
  snapshotId: string;
  mode: "demo" | "live";
  conditions: Condition[];
  pass: EvaluatedStock[];
  fail: EvaluatedStock[];
  unknown: EvaluatedStock[];
  funnel: { label: string; remaining: number; unknown: number }[];
}
export interface ParsedIntent {
  intent: string;
  conditions: Condition[];
  clarifications: string[];
  warnings: string[];
  blocked: boolean;
  reason?: string;
  engine: "rules" | "model";
  model?: string;
}

export const METRICS: Record<
  Metric,
  { label: string; unit: string; definition: string }
> = {
  pe: {
    label: "市盈率 TTM",
    unit: "倍",
    definition:
      "股价相对于过去12个月盈利的倍数。非正值不能作为正PE估值筛选的依据；不等同于行业相对低估。",
  },
  pb: {
    label: "市净率 MRQ",
    unit: "倍",
    definition: "股价相对于最近报告期每股净资产的倍数。",
  },
  revenueGrowth: {
    label: "营收同比",
    unit: "%",
    definition:
      "最新可取得累计报告期营业收入 / 上年同一累计报告期营业收入 − 1，乘100；不是单季度环比。上年基数≤0时无法判断。",
  },
  profitGrowth: {
    label: "归母净利润同比",
    unit: "%",
    definition:
      "最新可取得累计报告期归母净利润 / 上年同一累计报告期归母净利润 − 1，乘100。上年基数≤0时无法判断。",
  },
  volatility: {
    label: "20日年化波动率",
    unit: "%",
    definition:
      "最近21个完整交易日的前复权收盘价产生20个简单日收益率；样本标准差 × √252 × 100。仅描述历史波动。",
  },
  change: {
    label: "当日涨跌幅",
    unit: "%",
    definition: "相对于前收盘价的涨跌幅，百分数值。不是未来涨跌预测。",
  },
  price: {
    label: "最新价格",
    unit: "元",
    definition:
      "行情快照中的最新成交价，人民币；数据源快照时点不等于当前时间。",
  },
};
export const OPS: Operator[] = [">", ">=", "<", "<=", "="];
export function metricValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim().replace(/%$/, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function validateConditions(conditions: Condition[]): string[] {
  if (!Array.isArray(conditions) || conditions.length > 20)
    return ["条件格式无效或超过20条"];
  const errors: string[] = [];
  const ids = new Set();
  for (const c of conditions) {
    if (!c || typeof c.id !== "string" || ids.has(c.id))
      errors.push("条件ID缺失或重复");
    ids.add(c?.id);
    if (
      !c ||
      !Object.hasOwn(METRICS, c.metric) ||
      !OPS.includes(c.op) ||
      typeof c.value !== "number" ||
      !Number.isFinite(c.value) ||
      typeof c.enabled !== "boolean"
    )
      errors.push("存在未知指标、无效运算符或无效数值");
  }
  if (errors.length) return [...new Set(errors)];
  if (!conditions.some((c) => c.enabled)) errors.push("请至少启用一条筛选条件");
  for (const metric of Object.keys(METRICS) as Metric[]) {
    let lo = -Infinity,
      hi = Infinity,
      loOpen = false,
      hiOpen = false;
    for (const c of conditions.filter(
      (c) => c.enabled && c.metric === metric,
    )) {
      if (c.op === ">" || c.op === ">=" || c.op === "=") {
        const open = c.op === ">";
        if (c.value > lo) {
          lo = c.value;
          loOpen = open;
        } else if (c.value === lo) loOpen = loOpen || open;
      }
      if (c.op === "<" || c.op === "<=" || c.op === "=") {
        const open = c.op === "<";
        if (c.value < hi) {
          hi = c.value;
          hiOpen = open;
        } else if (c.value === hi) hiOpen = hiOpen || open;
      }
    }
    if (lo > hi || (lo === hi && (loOpen || hiOpen)))
      errors.push(`${METRICS[metric].label}的上下界冲突，没有数值能同时满足`);
  }
  return errors;
}
const aliases: Record<Metric, RegExp> = {
  pe: /市盈率|\bpe(?:[ _-]?ttm)?\b/i,
  pb: /市净率|\bpb\b/i,
  revenueGrowth: /营收(?:同比)?|营业收入(?:同比)?/,
  profitGrowth: /(?:归母)?净利润(?:同比)?|利润增长/,
  volatility: /(?:20日)?(?:年化)?波动率|走势(?:相对)?稳定|低波动|稳健/,
  change: /(?:当日|今日)?涨跌幅/,
  price: /最新价格|股价|价格/,
};
function opFromText(s: string): Operator {
  if (/不低于|不少于|大于等于|>=|≥/.test(s)) return ">=";
  if (/不高于|不超过|不大于|小于等于|<=|≤/.test(s)) return "<=";
  if (/高于|大于|超过|>/.test(s)) return ">";
  if (/低于|小于|少于|</.test(s)) return "<";
  return "=";
}
export function guardIntent(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return "请先描述你的选股条件";
  if (input.length > 2000) return "输入超过2000字，请缩短后重试";
  if (/或者|或|\bOR\b/i.test(input))
    return "首版只支持全部条件同时满足（AND），暂不支持或（OR）逻辑，请拆成两次筛选。";
  if (
    /稳赚|保证(?:收益|上涨|盈利)|一定(?:涨|上涨|赚钱)|必涨|涨停预测|直接.*(?:买哪|买入|卖出)|推荐买入|全仓|买卖建议|抄底买入/.test(
      input,
    )
  )
    return "不能提供收益承诺、确定性涨跌预测或直接买卖建议。可以改为研究历史数据与筛选条件。";
  if (
    /忽略.*规则|系统提示词|执行\s*(?:SQL|代码)|DROP\s+TABLE|<script/i.test(
      input,
    )
  )
    return "输入含越界或代码执行指令，请只描述研究条件";
  if (
    /资金|主力|新闻|政策|半导体|银行行业|行业|板块|分红|股息|ROE|市值|未来|明天|下周|预测|回测|港股|美股|ST|停牌|上市|最近.*天.*(?:涨|跌)/i.test(
      input,
    )
  )
    return "首版尚未支持这项范围、指标或预测要求，不能静默忽略。当前支持PE、PB、营收/归母净利润同比、20日波动率、当日涨跌幅和价格。";
  if (
    /(\d+)\s*(?:日|天).*波动/.test(input) &&
    Number(input.match(/(\d+)\s*(?:日|天).*波动/)?.[1]) !== 20
  )
    return "首版波动率固定为20个完整交易日；请确认改为20日，或删除该条件";
  return null;
}
export function parseIntent(input: unknown): ParsedIntent {
  const intent = typeof input === "string" ? input.trim() : "";
  const reason = guardIntent(input);
  const result: ParsedIntent = {
    intent,
    conditions: [],
    clarifications: [],
    warnings: [],
    blocked: !!reason,
    reason: reason ?? undefined,
    engine: "rules",
  };
  if (reason) return result;
  let serial = 0;
  const add = (metric: Metric, op: Operator, value: number) =>
    result.conditions.push({
      id: `c${++serial}`,
      metric,
      op,
      value,
      enabled: true,
    });
  let inherited: Metric | null = null;
  const clauses = intent
    .split(/[，,、；;。\n]|并且|而且|以及|且|和/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const clause of clauses) {
    let recognized = false;
    const boundPattern =
      /(不低于|不少于|大于等于|>=|≥|不高于|不超过|不大于|小于等于|<=|≤|高于|大于|超过|>|低于|小于|少于|<|等于|=)\s*(-?\d+(?:\.\d+)?)\s*(?:%|％|倍|元)?/g;
    let metric =
      (Object.entries(aliases).find(([, re]) => re.test(clause))?.[0] as
        Metric | undefined) ?? null;
    if (!metric && /^(?:高于|低于|大于|小于|不超过|不低于|[<>])/.test(clause))
      metric = inherited;
    const bounds = [...clause.matchAll(boundPattern)];
    const namedMetrics = Object.values(aliases).filter((re) =>
      re.test(clause),
    ).length;
    if (namedMetrics > 1) {
      result.blocked = true;
      result.reason =
        "同一句中包含多个指标，请用逗号分开每条条件，避免把阈值分配给错误字段。";
      continue;
    }
    if (metric && !bounds.length && /\d/.test(clause.replace(/20日/, ""))) {
      result.blocked = true;
      result.reason =
        "数字条件尚未明确运算符，请改为“大于/低于/不超过”等可检查的表达。";
      continue;
    }
    if (metric && bounds.length) {
      for (const b of bounds) add(metric, opFromText(b[1]), Number(b[2]));
      recognized = true;
      inherited = metric;
    }
    if (!recognized && /经营改善|基本面改善|业绩改善/.test(clause)) {
      add("revenueGrowth", ">", 0);
      add("profitGrowth", ">", 0);
      result.clarifications.push(
        "“经营改善”暂用同一累计报告期营收同比>0、归母净利润同比>0代理，不代表经营质量的完整评价。",
      );
      recognized = true;
    }
    if (!recognized && /估值合理|低估值|便宜/.test(clause)) {
      add("pe", ">", 0);
      add("pe", "<=", 25);
      result.clarifications.push(
        "“估值合理”暂用0<PE TTM≤25倍代理。25倍是可修改的示例阈值，不是行业低估结论。",
      );
      recognized = true;
    }
    if (!recognized && metric === "volatility") {
      add("volatility", "<=", 30);
      result.clarifications.push(
        "“走势稳定”暂用20日年化波动率≤30%代理。30%为示例阈值，过去稳定不代表未来风险低。",
      );
      recognized = true;
    }
    if (!recognized && metric) {
      const defaults: Record<Metric, number> = {
        pe: 25,
        pb: 3,
        revenueGrowth: 0,
        profitGrowth: 0,
        volatility: 30,
        change: 0,
        price: 50,
      };
      add(
        metric,
        ["revenueGrowth", "profitGrowth", "change"].includes(metric)
          ? ">"
          : "<=",
        defaults[metric],
      );
      result.clarifications.push(
        `${METRICS[metric].label}没有明确阈值，已提出可修改的示例条件，请确认。`,
      );
      recognized = true;
    }
    if (
      !recognized &&
      !/^(?:帮我|请|找|筛选|选|一些|符合条件的|的|股票|公司|A股|a股|在|中|看看|一下|我想要|寻找|沪深A股|研究|满足|同时|选出|只|满足条件|筛选股票|帮我找)+$/.test(
        clause.replace(/\s/g, ""),
      )
    ) {
      result.blocked = true;
      result.reason = `尚不能可靠解释“${clause.slice(0, 60)}”，请改用支持的指标或拆分描述，避免遗漏条件。`;
    }
  }
  if (!result.conditions.length) {
    result.blocked = true;
    result.reason =
      "没有识别到可执行条件。可试试“市盈率低于25倍，营收同比大于0%”。";
  }
  result.warnings.push(...validateConditions(result.conditions));
  return result;
}
export function annualizedVolatility(prices: unknown[]): number | null {
  if (prices.length < 21) return null;
  const p = prices.slice(-21).map(metricValue);
  if (p.some((x) => x === null || x <= 0)) return null;
  const returns = p.slice(1).map((v, i) => v! / p[i]! - 1);
  const mean = returns.reduce((a, b) => a + b, 0) / 20;
  return (
    Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / 19) *
    Math.sqrt(252) *
    100
  );
}
export function evaluateStock(
  stock: Stock,
  conditions: Condition[],
): EvaluatedStock {
  const checks: Check[] = conditions
    .filter((c) => c.enabled)
    .map((condition) => {
      const evidence = stock.metrics[condition.metric];
      const value = metricValue(evidence?.value);
      if (!evidence || value === null || evidence.quality !== "ok")
        return {
          condition,
          evidence,
          status: "unknown",
          reason:
            evidence?.note ||
            (!evidence || value === null
              ? "数据缺失，无法验证"
              : evidence.quality === "stale"
                ? "数据时点过期，无法验证"
                : "数据口径冲突，无法验证"),
        };
      if (condition.metric === "pe" && value <= 0)
        return {
          condition,
          evidence,
          status: "unknown",
          reason: "PE非正，不能用于正PE估值筛选",
        };
      const pass =
        condition.op === ">"
          ? value > condition.value
          : condition.op === ">="
            ? value >= condition.value
            : condition.op === "<"
              ? value < condition.value
              : condition.op === "<="
                ? value <= condition.value
                : value === condition.value;
      return {
        condition,
        evidence,
        status: pass ? "pass" : "fail",
        reason: `实际${value.toFixed(2)}${METRICS[condition.metric].unit}，${pass ? "满足" : "不满足"} ${condition.op} ${condition.value}${METRICS[condition.metric].unit}`,
      };
    });
  return {
    ...stock,
    checks,
    status: checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "unknown")
        ? "unknown"
        : "pass",
  };
}
export function screen(snapshot: Snapshot, conditions: Condition[]): Run {
  const errors = validateConditions(conditions);
  if (errors.length) throw new Error(errors.join("；"));
  const stocks = snapshot.stocks
    .map((s) => evaluateStock(s, conditions))
    .sort((a, b) => a.code.localeCompare(b.code));
  const funnel = conditions
    .filter((c) => c.enabled)
    .map((c, i) => {
      const evaluated = snapshot.stocks.map((s) =>
        evaluateStock(s, conditions.filter((x) => x.enabled).slice(0, i + 1)),
      );
      return {
        label: `${METRICS[c.metric].label} ${c.op} ${c.value}`,
        remaining: evaluated.filter((s) => s.status === "pass").length,
        unknown: evaluated.filter((s) => s.status === "unknown").length,
      };
    });
  return {
    snapshotId: snapshot.id,
    mode: snapshot.mode,
    conditions: structuredClone(conditions),
    pass: stocks.filter((s) => s.status === "pass"),
    fail: stocks.filter((s) => s.status === "fail"),
    unknown: stocks.filter((s) => s.status === "unknown"),
    funnel,
  };
}
export function compareRuns(before: Run, after: Run) {
  if (before.snapshotId !== after.snapshotId)
    return {
      comparable: false,
      added: [] as string[],
      removed: [] as string[],
      unknown: [] as string[],
    };
  const a = new Set(before.pass.map((s) => s.code));
  const b = new Set(after.pass.map((s) => s.code));
  return {
    comparable: true,
    added: [...b].filter((x) => !a.has(x)),
    removed: [...a].filter((x) => !b.has(x)),
    unknown: after.unknown.map((s) => s.code),
  };
}
