"use client";
import { useState, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Check,
  ShieldCheck,
  GitBranch,
  FlaskConical,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { examples } from "@/lib/fixtures";
import {
  experiment,
  sensitivity,
  injectFault,
  type Example,
  type Fault,
} from "@/lib/experiments";
import { METRICS } from "@/lib/domain";
import Count from "@/components/count";
import type { Diagnostic } from "@/lib/diagnostics";
export default function ExperimentStudio({
  onLoad,
  onVerify,
  checking,
  checks,
  checkedAt,
}: {
  onLoad: (e: Example) => void;
  onVerify: () => void;
  checking: boolean;
  checks: Diagnostic[];
  checkedAt: string;
}) {
  const [selected, setSelected] = useState("balanced"),
    [executed, setExecuted] = useState("balanced"),
    [pe, setPe] = useState(25),
    [fault, setFault] = useState<Fault>("missing"),
    [mode, setMode] = useState<"conditions" | "data">("conditions");
  const chosen = examples.find((e) => e.id === selected)!;
  const result = useMemo(() => experiment(executed), [executed]);
  const counter = useMemo(() => sensitivity(pe), [pe]);
  const robustness = useMemo(() => injectFault(fault), [fault]);
  const pending = selected !== executed;
  const curve = counter.curve
    .map((p) => `${35 + ((p.x - 5) / 35) * 300},${122 - (p.y / 6) * 90}`)
    .join(" ");
  return (
    <section className="content-page experiment-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE COUNTERFACTUAL DESK / 策略推演</div>
          <h1>
            改一个条件，<em>会发生什么？</em>
          </h1>
          <p>对照预期与实际，观察阈值影响，主动给数据制造一个意外。</p>
        </div>
        <div className="sandbox-stamp">
          <FlaskConical size={17} />
          <span>
            固定构造快照<small>不调用真实行情或模型</small>
          </span>
        </div>
      </div>
      <div className="experiment-grid">
        <aside className="scenario-rail">
          <div className="section-title">
            <span>01</span>选择研究场景<small>10 CASES</small>
          </div>
          {examples.map((e, i) => (
            <button
              key={e.id}
              className={selected === e.id ? "active" : ""}
              onClick={() => setSelected(e.id)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <b>{e.label}</b>
                <small>
                  {e.kind === "normal"
                    ? "正常主链路"
                    : e.tag.replace("CORNER", "边界")}
                </small>
              </div>
              <ChevronRight size={13} />
            </button>
          ))}
        </aside>
        <section className="scenario-canvas">
          <div className="scenario-header">
            <span className="eyebrow">02 / EXECUTE & INSPECT</span>
            <span
              className={`result-pill ${pending ? "pending" : result.matched ? "matched" : "failed"}`}
            >
              {pending
                ? "等待执行"
                : result.matched
                  ? "预期与实际一致"
                  : "需要检查"}
            </span>
          </div>
          <h2>{chosen.label}</h2>
          <blockquote>
            <span>用户输入</span>“{chosen.prompt}”
          </blockquote>
          <div className="scenario-expect">
            <small>预期行为</small>
            <p>{chosen.expect}</p>
          </div>
          <div className="scenario-run-actions">
            <button className="primary" onClick={() => setExecuted(selected)}>
              <Play size={13} />
              运行这个场景
              <ArrowRight size={15} />
            </button>
            <button className="text-button" onClick={() => onLoad(chosen)}>
              在示例沙盒继续
              <ArrowUpRight size={14} />
            </button>
          </div>
          {pending ? (
            <div className="scenario-pending">
              <Play size={27} />
              <h3>用同一份数据，验证这个假设。</h3>
              <p>执行后查看实际编译的条件、拦截原因与结果分组。</p>
            </div>
          ) : (
            <>
              <div className="execution-track">
                <span className="complete">
                  <Check size={12} />
                  读取输入
                </span>
                <i />
                <span className="complete">
                  <Check size={12} />
                  编译条件
                </span>
                <i />
                <span className={result.blocked ? "stopped" : "complete"}>
                  {result.blocked ? (
                    <ShieldCheck size={12} />
                  ) : (
                    <Check size={12} />
                  )}{" "}
                  {result.blocked ? "边界拦截" : "确定性执行"}
                </span>
              </div>
              <div className="actual-label">
                实际观察{" "}
                <span>本地规则 + 确定性引擎 / {result.example.id}</span>
              </div>
              {result.blocked ? (
                <div className="blocked-result">
                  <ShieldCheck size={23} />
                  <h3>系统在执行前停下了。</h3>
                  <p>{result.reason}</p>
                  <small>未请求数据 · 未生成候选名单 · 没有静默修改原意</small>
                </div>
              ) : (
                <>
                  <div className="experiment-counts">
                    <div>
                      <small>入选</small>
                      <b>{result.run?.pass.length}</b>
                    </div>
                    <div>
                      <small>明确排除</small>
                      <b>{result.run?.fail.length}</b>
                    </div>
                    <div>
                      <small>无法判断</small>
                      <b>{result.run?.unknown.length}</b>
                    </div>
                    <span>
                      共12个
                      <br />
                      构造样本
                    </span>
                  </div>
                  <div className="compiled-chips">
                    {result.parsed.conditions.map((c) => (
                      <span key={c.id}>
                        {METRICS[c.metric].label} {c.op} {c.value}
                        {METRICS[c.metric].unit}
                      </span>
                    ))}
                  </div>
                  <div className="case-observation">
                    <small>关键证据</small>
                    <p>
                      {result.example.id === "empty"
                        ? "没有任何样本满足全部条件。执行阈值保持原样，未自动放宽。"
                        : result.example.id === "missing"
                          ? "样本09缺少PE，样本10的PE为负，样本12估值过期；三者全部保留在“无法判断”。"
                          : `每个样本被分入一个互斥分组，${result.run!.pass.length}+${result.run!.fail.length}+${result.run!.unknown.length}=12。可在工作台展开逐字段证据。`}
                    </p>
                  </div>
                </>
              )}
              {result.parsed.conditions.length > 0 && result.blocked && (
                <div className="compiled-chips">
                  {result.parsed.conditions.map((c) => (
                    <span key={c.id}>
                      {METRICS[c.metric].label} {c.op} {c.value}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <section className="counterfactual">
        <div className="counter-heading">
          <div>
            <span className="eyebrow">03 / CHANGE ONE THING</span>
            <h2>把“如果”变成一次可观察的实验。</h2>
          </div>
          <div className="experiment-switch">
            <button
              className={mode === "conditions" ? "active" : ""}
              onClick={() => setMode("conditions")}
            >
              <GitBranch size={13} />
              条件敏感性
            </button>
            <button
              className={mode === "data" ? "active" : ""}
              onClick={() => setMode("data")}
            >
              <AlertTriangle size={13} />
              数据异常注入
            </button>
          </div>
        </div>
        {mode === "conditions" ? (
          <div className="sensitivity-grid">
            <div className="slider-panel">
              <span className="eyebrow">只修改一项，其他保持不变</span>
              <h3>市盈率 TTM 上限</h3>
              <div className="slider-number">
                {pe}
                <small>倍</small>
                <span>基准 25 倍</span>
              </div>
              <input
                aria-label="推演PE上限"
                type="range"
                min="5"
                max="40"
                step="1"
                value={pe}
                onChange={(e) => setPe(Number(e.target.value))}
              />
              <div className="slider-scale">
                <span>5倍</span>
                <span>40倍</span>
              </div>
              <p>
                营收同比&gt;0、归母净利润同比&gt;0、PE&gt;0、20日波动率≤30%保持不变；使用同一构造快照。
              </p>
            </div>
            <div className="sensitivity-chart">
              <div>
                <small>入选数量随阈值的变化</small>
                <b>
                  <Count value={counter.after.pass.length} />
                  <span>/ 12</span>
                </b>
              </div>
              <svg
                viewBox="0 0 370 150"
                role="img"
                aria-label="PE阈值与构造样本入选数量曲线"
              >
                <path d="M35 20V122H345" fill="none" stroke="#d2d5db" />
                <path d="M35 62H345" stroke="#e6e8ee" strokeDasharray="3 4" />
                <polyline
                  points={curve}
                  fill="none"
                  stroke="#4965d2"
                  strokeWidth="2.2"
                />
                {counter.curve.map((p) => (
                  <circle
                    key={p.x}
                    cx={35 + ((p.x - 5) / 35) * 300}
                    cy={122 - (p.y / 6) * 90}
                    r="3"
                    fill="#4965d2"
                  />
                ))}
                <circle
                  cx={35 + ((pe - 5) / 35) * 300}
                  cy={122 - (counter.after.pass.length / 6) * 90}
                  r="5"
                  fill="#202735"
                  stroke="white"
                  strokeWidth="2"
                />
                <text x="12" y="126">
                  0
                </text>
                <text x="12" y="36">
                  6
                </text>
                <text x="30" y="144">
                  5倍
                </text>
                <text x="317" y="144">
                  40倍
                </text>
              </svg>
            </div>
            <div className="impact-panel">
              <span className="eyebrow">相对基准25倍</span>
              <div>
                <b>+{counter.diff.added.length}</b>
                <span>新增入选</span>
                <b>−{counter.diff.removed.length}</b>
                <span>移出名单</span>
              </div>
              <p>新增：{counter.diff.added.join("、") || "无"}</p>
              <p>移出：{counter.diff.removed.join("、") || "无"}</p>
              <small>名单变化是条件变化的结果，不是收益预测。</small>
            </div>
          </div>
        ) : (
          <div className="fault-grid">
            <div className="fault-controls">
              <span className="eyebrow">给原本入选的样本01注入异常</span>
              {(
                [
                  { id: "missing", label: "字段缺失", code: "pe_ttm = null" },
                  { id: "stale", label: "估值过期", code: "quality = stale" },
                  {
                    id: "conflict",
                    label: "上游冲突",
                    code: "quality = conflict",
                  },
                  { id: "api", label: "接口限流", code: "HTTP 429" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  className={fault === f.id ? "active" : ""}
                  onClick={() => setFault(f.id)}
                >
                  <b>{f.label}</b>
                  <code>{f.code}</code>
                  <ChevronRight size={13} />
                </button>
              ))}
            </div>
            <div className="fault-outcome">
              <div>
                <span>注入前</span>
                <b>
                  {robustness.before.pass.length} 入选 /{" "}
                  {robustness.before.unknown.length} 无法判断
                </b>
                <ArrowRight size={20} />
                <span>注入后</span>
                <b>
                  {robustness.after
                    ? `${robustness.after.pass.length} 入选 / ${robustness.after.unknown.length} 无法判断`
                    : "停止执行 · 显示错误"}
                </b>
              </div>
              <p>{robustness.message}</p>
              {robustness.stock && (
                <div className="fault-evidence">
                  <span>DEMO-01 · 样本澄芯科技</span>
                  {robustness.stock.checks
                    .filter((c) => c.status === "unknown")
                    .map((c) => (
                      <p key={c.condition.id}>
                        <CircleHelpIcon /> {METRICS[c.condition.metric].label}：
                        {c.reason}
                      </p>
                    ))}
                </div>
              )}
              <small>异常由实验明确注入，不是当前金融接口的真实故障。</small>
            </div>
          </div>
        )}
      </section>
      <details className="verification-fold">
        <summary>
          <span>
            <FlaskConical size={16} />
            工程验证记录
          </span>
          <span>
            {checks.length
              ? `${checks.filter((c) => c.pass).length}/${checks.length}通过`
              : "13项内置检查"}
            <ChevronRight size={15} />
          </span>
        </summary>
        <div>
          <p>
            用于复现主链路、接口错误与合规边界。构造响应不访问真实服务，完整测试在GitHub仓库。
          </p>
          <button className="outline" disabled={checking} onClick={onVerify}>
            {checking ? "正在验证…" : "运行全部检查"}
          </button>
          {checkedAt && (
            <small>
              最近运行：
              {new Date(checkedAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
              })}
            </small>
          )}
          {checks.map((c, i) => (
            <div className="verification-line" key={i}>
              <span>
                {c.pass ? <Check size={13} /> : <AlertTriangle size={13} />}
              </span>
              <b>{c.name}</b>
              <p>{c.detail}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
function CircleHelpIcon() {
  return <span aria-hidden="true">?</span>;
}
