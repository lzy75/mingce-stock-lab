"use client";
import { useState } from "react";
import {
  Play,
  Download,
  ArrowUpRight,
  RefreshCw,
  Check,
  AlertTriangle,
} from "lucide-react";
import { researchScenarios, CASE_CODES } from "@/lib/scenarios";
import { parseIntent, METRICS } from "@/lib/domain";
import type { verifyCase } from "@/lib/verification";
type Report = {
  verificationId: string;
  at: string;
  state: string;
  cached: boolean;
  snapshotId: string;
  snapshotAt: string;
  transport: string[];
  cases: ReturnType<typeof verifyCase>[];
};
const scenes = researchScenarios.filter((s) =>
  ["balanced", "cash", "trend"].includes(s.id),
);
export default function LiveCases({ onUse }: { onUse: (id: string) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [report, setReport] = useState<Report | null>(null);
  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(120000),
      });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw Error(`入口返回HTTP ${response.status}，未进入验收接口`);
      }
      if (!response.ok) throw Error(body.error || "案例验收失败");
      setReport(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "验收失败");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ ...report, origin: location.origin }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mingce-live-cases.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="live-cases" id="live-cases">
      <header>
        <div>
          <span>真实案例验收</span>
          <h2>让同一条链路，跑完三种研究。</h2>
          <p>
            {CASE_CODES.length}只固定A股研究池 · 使用当前部署的 AI
            与金融数据授权
          </p>
        </div>
        <button className="primary" disabled={busy} onClick={() => void run()}>
          {busy ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}{" "}
          {busy ? "正在验证…" : report ? "重新运行验收" : "确认条件并运行"}
        </button>
      </header>
      <div className="live-case-grid">
        {scenes.map((scene) => {
          const result = report?.cases.find((c) => c.caseId === scene.id);
          return (
            <article key={scene.id}>
              <div className="live-case-heading">
                <span>{scene.tone}</span>
                {result && (
                  <b className={result.state}>
                    {result.state === "passed" ? (
                      <Check size={13} />
                    ) : (
                      <AlertTriangle size={13} />
                    )}{" "}
                    {result.state === "passed" ? "通过" : "存在待核"}
                  </b>
                )}
              </div>
              <h3>{scene.title}</h3>
              <p className="case-input">{scene.question}</p>
              <div className="case-conditions">
                {parseIntent(scene.question).conditions.map((c) => (
                  <span key={c.id}>
                    {METRICS[c.metric].label} {c.op} {c.value}
                    {METRICS[c.metric].unit}
                  </span>
                ))}
              </div>
              {result ? (
                <>
                  <div className="case-counts">
                    <div>
                      <b>{result.counts.pass}</b>
                      <span>入选</span>
                    </div>
                    <div>
                      <b>{result.counts.fail}</b>
                      <span>排除</span>
                    </div>
                    <div>
                      <b>{result.counts.unknown}</b>
                      <span>待核</span>
                    </div>
                  </div>
                  <div className="case-stages">
                    {result.stages.map((stage) => (
                      <span key={stage.name} className={stage.state}>
                        {stage.state === "passed" ? (
                          <Check size={11} />
                        ) : (
                          <AlertTriangle size={11} />
                        )}{" "}
                        {stage.name}
                      </span>
                    ))}
                  </div>
                  <details>
                    <summary>
                      {result.gaps
                        ? `核对股票与证据 · ${result.gaps}项待核`
                        : "核对股票与证据"}
                    </summary>
                    <ul>
                      {result.stocks.map((stock) => (
                        <li key={stock.code}>
                          <span>
                            {stock.name}
                            <small>{stock.code}</small>
                          </span>
                          <b>
                            {stock.status === "pass"
                              ? "入选"
                              : stock.status === "fail"
                                ? "排除"
                                : "待核"}
                          </b>
                        </li>
                      ))}
                    </ul>
                    {result.gaps > 0 && (
                      <p className="case-gap">
                        {[
                          ...new Set(
                            result.stocks.flatMap((s) =>
                              s.checks
                                .filter((c) => c.status === "unknown")
                                .map(
                                  (c) =>
                                    `${s.name} · ${METRICS[c.metric].label}：${c.reason}`,
                                ),
                            ),
                          ),
                        ].join("；")}
                        。已确定不满足其他条件的股票仍计入排除组。
                      </p>
                    )}
                    <p>
                      模型 {result.model} · 调用ID {result.modelRequestId}
                    </p>
                  </details>
                </>
              ) : (
                <div className="case-output-placeholder">
                  输出：三态名单 + 逐条件证据 + 调用记录
                </div>
              )}
              <button className="text-button" onClick={() => onUse(scene.id)}>
                在工作台继续
                <ArrowUpRight size={13} />
              </button>
            </article>
          );
        })}
      </div>
      {busy && (
        <div role="status" className="case-progress">
          正在解析条件、读取真实数据并检查筛选证据；结果返回前不显示成功结论。
        </div>
      )}
      {error && (
        <div role="alert" className="case-error">
          {error}
          <button className="text-button" onClick={() => void run()}>
            重试
          </button>
        </div>
      )}
      {report && (
        <footer>
          <span>
            {new Date(report.at).toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
              hour12: false,
            })}{" "}
            · {report.transport.join("/")}{" "}
            {report.cached ? "· 复用60秒内报告" : ""}
          </span>
          <button className="text-button" onClick={download}>
            <Download size={13} />
            下载验收记录
          </button>
          <details>
            <summary>验收标识</summary>
            <p>
              {report.verificationId} / {report.snapshotId}
            </p>
          </details>
        </footer>
      )}
    </section>
  );
}
