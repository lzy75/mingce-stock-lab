import { parseIntent, type Condition } from "./domain.ts";
export type Focus = "balanced" | "value" | "growth";
export type Tolerance = "low" | "medium" | "high";
export interface Preference {
  focus: Focus;
  tolerance: Tolerance;
}
export const FOCUS_LABELS = {
  balanced: "均衡研究",
  value: "估值优先",
  growth: "成长优先",
};
export const TOLERANCE_LABELS = {
  low: "较低历史波动",
  medium: "中等历史波动",
  high: "较高历史波动",
};
export function recommend(preference: Preference) {
  if (
    !Object.hasOwn(FOCUS_LABELS, preference.focus) ||
    !Object.hasOwn(TOLERANCE_LABELS, preference.tolerance)
  )
    throw Error("未知研究偏好");
  const pe = { balanced: 25, value: 15, growth: 35 }[preference.focus],
    vol = { low: 20, medium: 30, high: 40 }[preference.tolerance];
  const prompt = `营收同比大于${preference.focus === "growth" ? 10 : 0}%，归母净利润同比大于${preference.focus === "growth" ? 15 : 0}%，市盈率大于0倍，市盈率不超过${pe}倍，20日波动率不超过${vol}%${preference.focus === "value" ? "，市净率不超过2倍" : ""}`;
  const parsed = parseIntent(prompt);
  parsed.clarifications = [
    `基于你主动选择的“${FOCUS_LABELS[preference.focus]} / ${TOLERANCE_LABELS[preference.tolerance]}”推荐研究条件，阈值为可编辑的产品模板，不是收益最优参数。`,
  ];
  return {
    title: `${FOCUS_LABELS[preference.focus]} · ${TOLERANCE_LABELS[preference.tolerance]}`,
    prompt,
    parsed,
    explanations: [
      `PE上限${pe}倍${preference.focus === "value" ? "并要求PB≤2倍，用于聚焦正盈利、较低绝对估值的样本" : preference.focus === "growth" ? "：允许更宽估值范围，同时提高营收与利润增长门槛" : "：同时观察估值与经营代理指标"}`,
      `20日年化波动率≤${vol}%，仅描述历史波动，不是未来风险保证`,
      "不使用持仓或个人财务信息；仅在当前浏览器保存你的主动偏好。",
    ],
  };
}
