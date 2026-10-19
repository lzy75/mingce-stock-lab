"use client";
import { useState } from "react";
import { Check, RefreshCw, AlertTriangle, Download } from "lucide-react";
type Result = {
  kind: "data" | "ai";
  at: string;
  http?: number;
  ms: number;
  state: "passed" | "unconfigured" | "failed";
  message: string;
  transport?: string[];
  tools?: string[];
  requestIds?: string[];
  qualities?: string[];
  engine?: string;
  model?: string;
  count?: number;
};
async function requestJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(
      `HTTP ${response.status} · 入口未返回JSON，需检查托管访问层或网络。`,
    );
  }
  if (!response.ok)
    throw Error(`HTTP ${response.status} · ${data.error || "接口调用失败"}`);
  return { data, http: response.status };
}
export default function ConnectionCheck() {
  const [busy, setBusy] = useState<string | null>(null),
    [results, setResults] = useState<Result[]>([]);
  async function run(kind: "data" | "ai") {
    setBusy(kind);
    const start = performance.now();
    let result: Result;
    try {
      const { data, http } = await requestJson(
        kind === "data" ? "/api/market" : "/api/parse",
        kind === "data"
          ? {
              codes: ["600519.SH", "000333.SZ"],
              metrics: ["pe", "revenueGrowth", "profitGrowth", "volatility"],
            }
          : { intent: "经营改善、估值合理、走势相对稳定" },
      );
      if (kind === "data") {
        if (!Array.isArray(data.stocks) || data.stocks.length !== 2)
          throw Error("快照结构或研究池数量无效");
        const evidence = data.stocks.flatMap(
          (s: { metrics: Record<string, unknown> }) =>
            ["pe", "revenueGrowth", "profitGrowth", "volatility"].map(
              (m) => s.metrics[m] ?? { quality: "missing" },
            ),
        ) as {
          transport?: string;
          toolName?: string;
          requestId?: string;
          quality?: string;
        }[];
        const gaps = evidence.filter((e) => e.quality !== "ok").length;
        result = {
          kind,
          at: new Date().toISOString(),
          http,
          ms: Math.round(performance.now() - start),
          state: gaps ? "failed" : "passed",
          message: gaps
            ? `请求已到达数据服务，但有${gaps}个字段质量缺口，需要核查`
            : "2只研究池读取成功；字段、质量、工具与追踪ID均可检查",
          count: data.stocks.length,
          transport: [
            ...new Set(evidence.map((e) => e.transport).filter(Boolean)),
          ] as string[],
          tools: [
            ...new Set(evidence.map((e) => e.toolName).filter(Boolean)),
          ] as string[],
          requestIds: [
            ...new Set(evidence.map((e) => e.requestId).filter(Boolean)),
          ] as string[],
          qualities: [
            ...new Set(evidence.map((e) => e.quality).filter(Boolean)),
          ] as string[],
        };
      } else {
        result = {
          kind,
          at: new Date().toISOString(),
          http,
          ms: Math.round(performance.now() - start),
          state:
            data.engine === "model" && !data.blocked
              ? "passed"
              : data.engine === "rules"
                ? "unconfigured"
                : "failed",
          message:
            data.engine === "model" && !data.blocked
              ? `模型返回${data.conditions?.length ?? 0}条可检查条件，筛选仍由确定性引擎执行`
              : data.engine === "rules"
                ? "当前返回本地规则结果，不能记作模型接口通过"
                : "模型阻止了本次解析，请检查返回原因",
          engine: data.engine,
          model: data.model,
          count: data.conditions?.length,
        };
      }
    } catch (e) {
      result = {
        kind,
        at: new Date().toISOString(),
        ms: Math.round(performance.now() - start),
        state: "failed",
        message: e instanceof Error ? e.message : "连接失败",
      };
    }
    setResults((previous) => [result, ...previous].slice(0, 8));
    setBusy(null);
  }
  function exportReport() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              schema: "mingce-connection-check-v1",
              origin: location.origin,
              results,
              boundary: "只含测试元数据，不含密钥和真实行情原始值",
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mingce-connection-check.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="connection-check">
      <header>
        <div>
          <h2>接入检查</h2>
          <p>在当前部署实际发起请求，配置状态与调用成功分开判断。</p>
        </div>
        <button
          className="text-button"
          disabled={!results.length}
          onClick={exportReport}
        >
          <Download size={13} />
          导出记录
        </button>
      </header>
      <div className="connection-actions">
        <button
          className="outline"
          disabled={!!busy}
          onClick={() => void run("data")}
        >
          <RefreshCw size={14} className={busy === "data" ? "spin" : ""} />
          {busy === "data" ? "读取中…" : "验证金融数据"}
        </button>
        <button
          className="outline"
          disabled={!!busy}
          onClick={() => void run("ai")}
        >
          <RefreshCw size={14} className={busy === "ai" ? "spin" : ""} />
          {busy === "ai" ? "解析中…" : "验证 AI 解析"}
        </button>
        <span>金融数据测试使用2只固定样本，消耗服务端接口配额。</span>
      </div>
      <div className="connection-results" aria-live="polite">
        {!results.length ? (
          <p className="connection-idle">
            尚未执行检查。金融数据验证需要实际返回字段；AI 验证需要返回 model
            引擎。
          </p>
        ) : (
          results.map((result, i) => (
            <article key={i} className={result.state}>
              <div>
                {result.state === "passed" ? (
                  <Check size={15} />
                ) : (
                  <AlertTriangle size={15} />
                )}
                <b>{result.kind === "data" ? "金融数据" : "AI解析"}</b>
                <span>
                  {result.state === "passed"
                    ? "调用通过"
                    : result.state === "unconfigured"
                      ? "尚未接入模型"
                      : "未通过"}
                </span>
                <small>
                  {result.ms.toLocaleString()} ms ·{" "}
                  {new Date(result.at).toLocaleTimeString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    hour12: false,
                  })}
                </small>
              </div>
              <p>{result.message}</p>
              {(result.transport || result.model) && (
                <p>{result.transport?.join(" / ") || result.model}</p>
              )}
              {!!result.requestIds?.length && (
                <details>
                  <summary>
                    {result.requestIds.length}个追踪ID · 查看工具与质量
                  </summary>
                  <dl>
                    <dt>工具</dt>
                    <dd>{result.tools?.join("、")}</dd>
                    <dt>质量</dt>
                    <dd>{result.qualities?.join("、")}</dd>
                    <dt>请求ID</dt>
                    <dd>{result.requestIds.join("、")}</dd>
                  </dl>
                </details>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
