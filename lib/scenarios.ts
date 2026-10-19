import type { Metric } from "./domain.ts";
export const researchScenarios = [
  {
    id: "balanced",
    title: "经营与估值",
    question: "经营改善、估值合理、走势相对稳定",
    focus: "兼顾经营增长、估值与历史波动",
    tone: "均衡",
  },
  {
    id: "value",
    title: "低估值观察",
    question: "市盈率大于0倍，市盈率低于15倍，市净率不超过2倍",
    focus: "用正盈利和绝对估值缩小研究范围",
    tone: "估值",
  },
  {
    id: "cash",
    title: "现金流估值",
    question: "市销率不超过3倍，市现率大于0倍，市现率不超过20倍",
    focus: "交叉观察收入与现金流估值",
    tone: "质量",
  },
  {
    id: "liquidity",
    title: "成交活跃度",
    question: "成交额大于5亿元，成交量大于100万股，振幅不超过6%",
    focus: "核对成交规模与当日价格振幅",
    tone: "流动性",
  },
  {
    id: "trend",
    title: "趋势与回撤",
    question:
      "20日涨幅大于0%，20日最大回撤不超过10%，20日均线偏离大于0%，20日均线偏离不超过8%",
    focus: "把上涨幅度、回撤与均线位置一起看",
    tone: "趋势",
  },
  {
    id: "growth",
    title: "增长质量",
    question: "营收同比大于10%，归母净利润同比大于15%，20日波动率不超过30%",
    focus: "以明确阈值研究经营增长与历史波动",
    tone: "成长",
  },
] as const;
export const METRIC_GROUPS: { title: string; metrics: Metric[] }[] = [
  { title: "估值", metrics: ["pe", "pb", "ps", "pcf"] },
  { title: "经营增长", metrics: ["revenueGrowth", "profitGrowth"] },
  {
    title: "成交与行情",
    metrics: ["price", "change", "turnover", "volume", "amplitude"],
  },
  {
    title: "趋势与风险",
    metrics: ["volatility", "return20", "drawdown20", "ma20Deviation"],
  },
];
export const CASE_CODES = ["600519.SH", "000333.SZ", "600036.SH", "000858.SZ"];
