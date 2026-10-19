"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Check,
  ChevronDown,
  RefreshCw,
  Bookmark,
  Download,
  FlaskConical,
  Layers3,
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  CircleHelp,
  Search,
  GitBranch,
  Play,
  LoaderCircle,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  METRICS,
  OPS,
  parseIntent,
  validateConditions,
  screen,
  compareRuns,
  type Metric,
  type Condition,
  type Snapshot,
  type Run,
  type ParsedIntent,
  type EvaluatedStock,
  type Status,
} from "@/lib/domain";
import { demoSnapshot, examples } from "@/lib/fixtures";
import { DEFAULT_CODES, parsePoolText } from "@/lib/research-pool";
import { loadMarketBatches, type BatchProgress } from "@/lib/market-batches";
import type { Diagnostic } from "@/lib/diagnostics";
import ExperimentStudio from "@/components/experiment-studio";
import PreferenceBar from "@/components/preference-bar";
import TransferPanel from "@/components/transfer-panel";
import AppearanceMenu from "@/components/appearance-menu";
import Count from "@/components/count";
import LiveCases from "@/components/live-cases";
import StartGuide from "@/components/start-guide";
import { researchScenarios, METRIC_GROUPS, CASE_CODES } from "@/lib/scenarios";
import ConnectionCheck from "@/components/connection-check";
import ResearchSignals from "@/components/research-signals";
import { evidenceGroups } from "@/lib/research-summary";
type Saved = {
  id: string;
  intent: string;
  conditions: Condition[];
  mode: "demo" | "live";
  createdAt: string;
};
type Tab = "workspace" | "lab" | "methods" | "saved";
const initial = parseIntent(examples[0].prompt),
  labels = { pass: "入选", fail: "排除", unknown: "无法判断" };
function time(s: string | null | undefined) {
  if (!s) return "未提供";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}
function num(n: number | null | undefined, u = "", signed = false) {
  return typeof n === "number" && Number.isFinite(n)
    ? (signed && n > 0 ? "+" : "") +
        n.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        u
    : "—";
}
function download(name: string, value: unknown) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
export default function Home() {
  const [tab, setTab] = useState<Tab>("workspace"),
    [intent, setIntent] = useState<string>(examples[0].prompt),
    [parsed, setParsed] = useState<ParsedIntent>(initial),
    [conditions, setConditions] = useState<Condition[]>(initial.conditions);
  const [mode, setMode] = useState<"demo" | "live">("demo"),
    [snapshot, setSnapshot] = useState<Snapshot | null>(demoSnapshot),
    [run, setRun] = useState<Run | null>(() =>
      screen(demoSnapshot, initial.conditions),
    ),
    [previous, setPrevious] = useState<Run | null>(null);
  const [group, setGroup] = useState<Status>("pass"),
    [selected, setSelected] = useState("DEMO-01"),
    [confirmed, setConfirmed] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [compare, setCompare] = useState<string[]>([]),
    [showCompare, setShowCompare] = useState(false),
    [saved, setSaved] = useState<Saved[]>([]),
    [connection, setConnection] = useState<{
      dataConfigured: boolean;
      aiConfigured: boolean;
    } | null>(null);
  const [checks, setChecks] = useState<Diagnostic[]>([]),
    [checkedAt, setCheckedAt] = useState(""),
    [checking, setChecking] = useState(false),
    [showScope, setShowScope] = useState(false),
    [codes, setCodes] = useState(DEFAULT_CODES.join(", ")),
    [scopeDraft, setScopeDraft] = useState(codes),
    [scopeError, setScopeError] = useState(""),
    [query, setQuery] = useState(""),
    [auto, setAuto] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(
    null,
  );
  const marketAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    marketAbort.current?.abort();
  }, [intent, conditions, mode, codes]);
  useEffect(() => () => marketAbort.current?.abort(), []);
  const [focusedRule, setFocusedRule] = useState<string | null>(null);
  const version = useRef(0),
    scopeRef = useRef<HTMLTextAreaElement>(null),
    dialogRef = useRef<HTMLDivElement>(null);
  const conflicts = useMemo(() => validateConditions(conditions), [conditions]);
  const all = useMemo(
    () => (run ? [...run.pass, ...run.fail, ...run.unknown] : []),
    [run],
  );
  const rows = all.filter(
    (s) =>
      s.status === group &&
      (!focusedRule ||
        s.checks.some(
          (c) => c.condition.id === focusedRule && c.status === "fail",
        )) &&
      (!query ||
        s.name.includes(query) ||
        s.code.toLowerCase().includes(query.toLowerCase())),
  );
  const tableMetrics = [
    ...new Set<Metric>([
      "price",
      "change",
      ...(run?.conditions.filter((c) => c.enabled).map((c) => c.metric) ?? []),
    ]),
  ];
  const chosen = all.find((s) => s.code === selected),
    delta = previous && run ? compareRuns(previous, run) : null;
  useEffect(() => {
    void status();
    try {
      const value = JSON.parse(
        localStorage.getItem("mingce-strategies-v1") ?? "[]",
      );
      if (Array.isArray(value))
        setSaved(
          value.filter(
            (s) =>
              s &&
              typeof s.id === "string" &&
              typeof s.intent === "string" &&
              Array.isArray(s.conditions) &&
              !validateConditions(s.conditions).length,
          ),
        );
    } catch {
      setNotice("本地存储不可用，仍可导出策略。");
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (showScope) scopeRef.current?.focus();
    if (showCompare) dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowScope(false);
        setShowCompare(false);
        setShowTransfer(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showScope, showCompare]);
  async function status() {
    try {
      const r = await fetch("/api/status");
      if (!r.ok) throw Error();
      setConnection(await r.json());
    } catch {
      setConnection(null);
    }
  }
  function edit(id: string, patch: Partial<Condition>) {
    version.current++;
    setBusy("");
    setConditions((cs) =>
      cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    setConfirmed(false);
    setDirty(true);
  }
  function switchMode(next: "demo" | "live") {
    if (next === mode) return;
    version.current++;
    setBusy("");
    setMode(next);
    setSnapshot(next === "demo" ? demoSnapshot : null);
    setRun(null);
    setPrevious(null);
    setCompare([]);
    setConfirmed(false);
    setDirty(true);
    setError("");
    setAuto(false);
  }
  function example(e: (typeof examples)[number]) {
    version.current++;
    setBusy("");
    setIntent(e.prompt);
    const p = parseIntent(e.prompt);
    setParsed(p);
    setConditions(p.conditions);
    setConfirmed(false);
    setDirty(true);
    setPrevious(null);
    setError("");
    setRun(null);
    setTab("workspace");
    setNotice(`已载入“${e.label}”，请确认条件后执行。`);
  }
  async function compile(nextIntent = intent) {
    const v = ++version.current;
    setBusy("parse");
    setError("");
    setConfirmed(false);
    setDirty(true);
    try {
      const r = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: nextIntent }),
      });
      const b = (await r.json()) as ParsedIntent & { error?: string };
      if (v !== version.current) return;
      if (!r.ok) throw Error(b.error);
      setParsed(b);
      setConditions(b.conditions);
      setRun(null);
      setPrevious(null);
    } catch (e) {
      if (v === version.current) {
        setError(e instanceof Error ? e.message : "解析失败");
        setRun(null);
      }
    } finally {
      if (v === version.current) setBusy("");
    }
  }
  async function execute(refresh = false) {
    if (
      conflicts.length ||
      parsed.blocked ||
      intent.trim() !== parsed.intent ||
      (!confirmed && !refresh)
    )
      return;
    const v = ++version.current;
    setBusy("market");
    setError("");
    try {
      let next = snapshot;
      const needs =
        refresh ||
        !next ||
        (mode === "live" &&
          conditions.some(
            (c) => c.enabled && !next!.stocks.some((s) => s.metrics[c.metric]),
          ));
      if (mode === "demo") next = demoSnapshot;
      else if (needs) {
        marketAbort.current?.abort();
        const controller = new AbortController();
        marketAbort.current = controller;
        next = await loadMarketBatches({
          codes: parsePoolText(codes),
          metrics: [
            ...new Set(
              conditions.filter((c) => c.enabled).map((c) => c.metric),
            ),
          ],
          signal: controller.signal,
          isCurrent: () => v === version.current,
          onProgress: (p) => {
            if (v === version.current) setBatchProgress(p);
          },
        });
      }
      if (v !== version.current || !next) return;
      const result = screen(next, conditions);
      setPrevious(run);
      setFocusedRule(null);
      setSnapshot(next);
      setRun(result);
      setDirty(false);
      const first = result.pass[0] ?? result.unknown[0] ?? result.fail[0];
      setSelected(first?.code ?? "");
      setGroup(
        result.pass.length
          ? "pass"
          : result.unknown.length
            ? "unknown"
            : "fail",
      );
      setCompare([]);
      setNotice(
        refresh
          ? "已读取服务端数据；缓存期内可能返回相同时点。"
          : "已按确认条件完成筛选。",
      );
    } catch (e) {
      if (v === version.current) {
        setError(e instanceof Error ? e.message : "读取失败");
        setAuto(false);
      }
    } finally {
      if (v === version.current) {
        setBusy("");
        setBatchProgress(null);
      }
    }
  }
  useEffect(() => {
    if (!auto || mode !== "live") return;
    const t = setInterval(() => {
      if (!document.hidden && !busy && confirmed && !dirty) void execute(true);
    }, 60000);
    return () => clearInterval(t);
  }, [auto, mode, busy, confirmed, dirty, conditions, codes, run]);
  function save() {
    if (conflicts.length || parsed.blocked || intent.trim() !== parsed.intent)
      return;
    const next = [
      {
        id: crypto.randomUUID(),
        intent,
        conditions: structuredClone(conditions),
        mode,
        createdAt: new Date().toISOString(),
      },
      ...saved,
    ].slice(0, 30);
    try {
      localStorage.setItem("mingce-strategies-v1", JSON.stringify(next));
      setSaved(next);
      setNotice("策略已保存在当前浏览器。");
    } catch {
      setNotice("保存失败，请导出策略。");
    }
  }
  function restore(s: Saved) {
    switchMode(s.mode);
    setIntent(s.intent);
    setParsed({
      ...parseIntent(s.intent),
      conditions: s.conditions,
      blocked: false,
      reason: undefined,
    });
    setConditions(s.conditions);
    setRun(null);
    setPrevious(null);
    setDirty(true);
    setConfirmed(false);
    setTab("workspace");
  }
  async function diagnostics() {
    setChecking(true);
    try {
      const r = await fetch("/api/diagnostics");
      if (!r.ok) throw Error("验证接口不可用");
      const b = (await r.json()) as { checks: Diagnostic[]; at: string };
      setChecks(b.checks);
      setCheckedAt(b.at);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "验证失败");
    } finally {
      setChecking(false);
    }
  }
  function applyScope() {
    let value: string[];
    try {
      value = parsePoolText(scopeDraft);
    } catch (e) {
      setScopeError(e instanceof Error ? e.message : "股票代码无效");
      return;
    }
    version.current++;
    marketAbort.current?.abort();
    setBusy("");
    setBatchProgress(null);
    setAuto(false);
    setCompare([]);
    setCodes(value.join(", "));
    setSnapshot(null);
    setRun(null);
    setPrevious(null);
    setDirty(true);
    setConfirmed(false);
    setShowScope(false);
    setScopeError("");
  }
  return (
    <div className="shell">
      <a href="#main" className="skip">
        跳到主要内容
      </a>
      <header className="topbar">
        <a href="/" className="brand">
          <Mark />
          <b>明策</b>
          <span className="brand-en">
            MINGCE<small>STRATEGY STUDIO</small>
          </span>
        </a>
        <nav aria-label="主导航">
          {(
            [
              { id: "workspace", label: "策略工作台", icon: Layers3 },
              { id: "lab", label: "策略推演", icon: FlaskConical },
              { id: "methods", label: "方法与口径", icon: BookOpen },
              {
                id: "saved",
                label: `已保存${saved.length ? " · " + saved.length : ""}`,
                icon: Bookmark,
              },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => {
                setTab(n.id);
                if (n.id === "workspace")
                  requestAnimationFrame(() =>
                    document
                      .getElementById("strategy-input")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  );
              }}
            >
              <n.icon size={15} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="top-status">
          <i />
          {connection?.dataConfigured ? "数据授权已配置" : "等待数据授权"}
          <span>扶摇 MCP</span>
        </div>
        <AppearanceMenu />
      </header>
      <main id="main">
        {tab === "workspace" ? (
          <>
            <StartGuide
              intent={intent}
              onIntent={(value) => {
                version.current++;
                setBusy("");
                setIntent(value);
                setConfirmed(false);
                setDirty(true);
              }}
              busy={busy}
              onStart={() => {
                void compile();
                document
                  .getElementById("workbench")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              onVerify={() => {
                setTab("methods");
                window.scrollTo({ top: 0 });
              }}
            />
            <section className={`data-strip ${mode}`} aria-label="数据模式">
              <div className="mode-switch">
                <button
                  className={mode === "demo" ? "active" : ""}
                  aria-pressed={mode === "demo"}
                  onClick={() => switchMode("demo")}
                >
                  示例沙盒
                </button>
                <button
                  className={mode === "live" ? "active" : ""}
                  aria-pressed={mode === "live"}
                  onClick={() => switchMode("live")}
                >
                  · 真实数据
                </button>
              </div>
              <div className="data-caption">
                <FlaskConical size={14} />
                <b>{mode === "demo" ? "构造测试数据" : "扶摇 MCP / 同花顺"}</b>
                <span>
                  {mode === "demo"
                    ? "12个虚拟样本 · 不代表任何真实股票"
                    : snapshot
                      ? "批次时点 " + time(snapshot.asOf)
                      : "待首次读取 · 需服务端授权"}
                </span>
              </div>
              <button
                className="text-button scope-button"
                disabled={mode === "demo"}
                onClick={() => {
                  setScopeDraft(codes);
                  setShowScope(true);
                }}
              >
                <SlidersHorizontal size={13} />
                {mode === "demo"
                  ? "构造研究池"
                  : `研究池 · ${codes.split(",").length}只`}
                <ChevronDown size={12} />
              </button>
            </section>
            <PreferenceBar
              onApply={(p) => {
                version.current++;
                setBusy("");
                setIntent(p.intent);
                setParsed(p);
                setConditions(p.conditions);
                setConfirmed(false);
                setDirty(true);
                setError("");
                setRun(null);
                setPrevious(null);
                setNotice("已基于主动偏好提出条件，请检查后确认。");
              }}
            />
            <section
              className="panel conditions flow-conditions"
              id="workbench"
              aria-label="条件核对输出"
            >
              <div className="section-title">
                核对筛选条件
                <small>{conditions.length} RULES</small>
              </div>
              <div className="engine">
                ●{" "}
                {parsed.engine === "model"
                  ? `语言模型 · ${parsed.model}`
                  : "本地语义规则"}
                <span>全部条件同时满足</span>
              </div>
              {parsed.blocked ? (
                <div className="callout danger">
                  <ShieldCheck size={18} />
                  <div>
                    <b>这次请求不能直接执行</b>
                    <p>{parsed.reason}</p>
                  </div>
                </div>
              ) : (
                <>
                  {parsed.clarifications.length > 0 && (
                    <details className="clarify">
                      <summary>
                        <CircleHelp size={14} />
                        代理定义与阈值
                        <ChevronDown size={12} />
                      </summary>
                      {parsed.clarifications.map((c, i) => (
                        <p key={i}>{c}</p>
                      ))}
                    </details>
                  )}
                  {intent.trim() !== parsed.intent && (
                    <div className="state-banner">
                      描述已修改，请先重新生成条件。
                    </div>
                  )}
                  <div className="condition-list">
                    {conditions.map((c, i) => (
                      <div
                        key={c.id}
                        className={`condition ${!c.enabled ? "disabled" : ""}`}
                      >
                        <div className="condition-top">
                          <input
                            aria-label={`启用条件${i + 1}`}
                            type="checkbox"
                            checked={c.enabled}
                            onChange={(e) =>
                              edit(c.id, { enabled: e.target.checked })
                            }
                          />
                          <small>{String(i + 1).padStart(2, "0")}</small>
                          <select
                            aria-label={`条件${i + 1}指标`}
                            value={c.metric}
                            onChange={(e) =>
                              edit(c.id, {
                                metric: e.target.value as Metric,
                              })
                            }
                          >
                            {Object.entries(METRICS).map(([k, m]) => (
                              <option key={k} value={k}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="icon"
                            aria-label={`删除条件${i + 1}`}
                            onClick={() => {
                              version.current++;
                              setBusy("");
                              setConditions((cs) =>
                                cs.filter((x) => x.id !== c.id),
                              );
                              setDirty(true);
                              setConfirmed(false);
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="condition-value">
                          <select
                            aria-label={`条件${i + 1}运算符`}
                            value={c.op}
                            onChange={(e) =>
                              edit(c.id, {
                                op: e.target.value as Condition["op"],
                              })
                            }
                          >
                            {OPS.map((op) => (
                              <option key={op}>{op}</option>
                            ))}
                          </select>
                          <input
                            aria-label={`条件${i + 1}阈值`}
                            type="number"
                            step="any"
                            value={Number.isFinite(c.value) ? c.value : ""}
                            onChange={(e) =>
                              edit(c.id, {
                                value:
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                              })
                            }
                          />
                          <span>{METRICS[c.metric].unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="add-condition"
                    disabled={conditions.length >= 20}
                    onClick={() => {
                      version.current++;
                      setBusy("");
                      setConditions((cs) => [
                        ...cs,
                        {
                          id: crypto.randomUUID(),
                          metric: "pb",
                          op: "<=",
                          value: 3,
                          enabled: true,
                        },
                      ]);
                      setDirty(true);
                      setConfirmed(false);
                    }}
                  >
                    <Plus size={13} />
                    添加条件
                  </button>
                  {conflicts.length > 0 && (
                    <div className="callout danger">
                      <AlertTriangle size={16} />
                      <div>
                        {conflicts.map((x, i) => (
                          <p key={i}>{x}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className="confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    我已检查指标、阈值与研究范围
                  </label>
                  <button
                    className="primary full"
                    disabled={
                      !!busy ||
                      !confirmed ||
                      !!conflicts.length ||
                      intent.trim() !== parsed.intent
                    }
                    onClick={() => void execute()}
                  >
                    {busy === "market" ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    确认并筛选
                    <ArrowRight size={15} />
                  </button>
                </>
              )}
              <p className="fineprint">
                代理阈值可修改；数据口径可在结果证据中核对。
              </p>
            </section>
            {busy === "market" && batchProgress && (
              <div className="batch-progress" role="status">
                <div>
                  <b>
                    {batchProgress.retryAfter
                      ? `接口限流，${batchProgress.retryAfter}秒后重试当前批次`
                      : `正在读取第${Math.min(batchProgress.completed + 1, batchProgress.total)}/${batchProgress.total}批`}
                  </b>
                  <span>
                    已核查 {batchProgress.stocksDone}/
                    {batchProgress.stocksTotal}只 · 全部批次完成后输出名单
                  </span>
                  <progress
                    max={batchProgress.stocksTotal}
                    value={batchProgress.stocksDone}
                  />
                </div>
                <button
                  className="outline"
                  onClick={() => {
                    version.current++;
                    marketAbort.current?.abort();
                    setBusy("");
                    setBatchProgress(null);
                    setNotice("已停止读取，本次部分批次不会生成新名单。");
                  }}
                >
                  停止读取
                </button>
              </div>
            )}
            <div className="workspace research-output">
              <section className="results">
                <div className="result-heading">
                  <div>
                    <div className="eyebrow tiny">候选与排除</div>
                    <h2>
                      筛选结果
                      <span>{run ? String(run.pass.length) : "—"}</span>
                    </h2>
                  </div>
                  <div className="actions">
                    <button
                      className="icon"
                      aria-label="保存当前策略"
                      disabled={
                        !!conflicts.length ||
                        parsed.blocked ||
                        intent.trim() !== parsed.intent
                      }
                      onClick={save}
                    >
                      <Bookmark size={16} />
                    </button>
                    <button
                      className="icon"
                      aria-label="导出条件结果与证据"
                      onClick={() =>
                        download("mingce-research.json", {
                          exportedAt: new Date().toISOString(),
                          intent,
                          conditions,
                          snapshot,
                          run,
                          executionState: dirty
                            ? "当前草稿未执行，run为上次结果"
                            : "当前条件已执行",
                          executedConditions: run?.conditions ?? null,
                          boundary: "研究用途，非投资建议",
                        })
                      }
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="outline"
                      disabled={
                        mode === "demo" ||
                        !confirmed ||
                        !!conflicts.length ||
                        !!busy ||
                        parsed.blocked ||
                        intent.trim() !== parsed.intent
                      }
                      onClick={() => void execute(true)}
                    >
                      <RefreshCw size={12} />
                      读取最新
                    </button>
                  </div>
                </div>
                <div className="result-context">
                  <span>{snapshot?.scope ?? "尚未取得研究池数据"}</span>
                  <span>
                    {mode === "demo"
                      ? "示例结果"
                      : snapshot
                        ? "获取于 " + time(snapshot.fetchedAt)
                        : "真实数据未读取"}
                  </span>
                </div>
                {mode === "live" && (
                  <label className="auto">
                    <input
                      type="checkbox"
                      checked={auto}
                      disabled={!confirmed || dirty || !snapshot}
                      onChange={(e) => setAuto(e.target.checked)}
                    />
                    每60秒刷新 · 以上游时点为准
                  </label>
                )}
                {dirty && run && (
                  <div className="state-banner">
                    ● 当前条件待执行，以下保留上次结果。
                  </div>
                )}
                {error && (
                  <div role="alert" className="callout danger">
                    <AlertTriangle size={18} />
                    <div>
                      <b>本次操作未完成</b>
                      <p>{error}</p>
                      {run && <p>以下是上次成功结果，没有被替换。</p>}
                    </div>
                  </div>
                )}
                {mode === "live" && !connection?.dataConfigured && (
                  <div className="callout amber">
                    <CircleHelp size={18} />
                    <div>
                      <b>等待扶摇数据授权</b>
                      <p>
                        需项目所有者配置服务端Key。示例沙盒可验证流程，但不代表真实行情。
                      </p>
                      <button
                        className="text-button"
                        onClick={() => void status()}
                      >
                        重新检查授权
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                )}
                {run ? (
                  <>
                    <div className="summary-cards">
                      {(["pass", "fail", "unknown"] as Status[]).map((s, i) => (
                        <button
                          key={s}
                          className={`summary-card ${s} ${group === s ? "selected" : ""}`}
                          onClick={() => {
                            setGroup(s);
                            setQuery("");
                            setFocusedRule(null);
                          }}
                        >
                          <span>
                            {i === 0 ? (
                              <Check size={14} />
                            ) : i === 1 ? (
                              <GitBranch size={14} />
                            ) : (
                              <CircleHelp size={14} />
                            )}{" "}
                            {
                              [
                                "满足全部条件",
                                "明确不满足",
                                "数据不足 / 不适用",
                              ][i]
                            }
                          </span>
                          <strong>
                            <Count value={run[s].length} />
                            <ArrowUpRight size={17} />
                          </strong>
                          <small>
                            {`${Math.round((run[s].length / Math.max(1, all.length)) * 100)}% · 共${all.length}只`}
                          </small>
                        </button>
                      ))}
                    </div>
                    <ResearchSignals
                      run={run}
                      focused={focusedRule}
                      onFocus={(id) => {
                        setFocusedRule(id);
                        setGroup("fail");
                        setQuery("");
                        const first = run.fail.find(
                          (s) =>
                            !id ||
                            s.checks.some(
                              (c) =>
                                c.condition.id === id && c.status === "fail",
                            ),
                        );
                        if (first) setSelected(first.code);
                      }}
                    />
                    {focusedRule && (
                      <div className="focused-filter">
                        只看不满足所选条件的股票
                        <button onClick={() => setFocusedRule(null)}>
                          显示全部 <X size={12} />
                        </button>
                      </div>
                    )}
                    {delta && (
                      <div className="delta">
                        <GitBranch size={14} />
                        {delta.comparable ? (
                          <div>
                            同一快照，条件变化：<b>新增 {delta.added.length}</b>{" "}
                            · 移出 {delta.removed.length}
                            <details>
                              <summary>查看代码与条件差异</summary>
                              <p>
                                新增：{delta.added.join("、") || "无"}；移出：
                                {delta.removed.join("、") || "无"}
                              </p>
                              <p>
                                前：
                                {previous?.conditions
                                  .filter((c) => c.enabled)
                                  .map(
                                    (c) =>
                                      `${METRICS[c.metric].label}${c.op}${c.value}`,
                                  )
                                  .join("；")}
                              </p>
                              <p>
                                后：
                                {run.conditions
                                  .filter((c) => c.enabled)
                                  .map(
                                    (c) =>
                                      `${METRICS[c.metric].label}${c.op}${c.value}`,
                                  )
                                  .join("；")}
                              </p>
                            </details>
                          </div>
                        ) : (
                          <p>数据快照已变更，差异不能仅归因于条件修改。</p>
                        )}
                      </div>
                    )}
                    <div className="table-toolbar">
                      <div
                        role="tablist"
                        aria-label="结果分组"
                        className="tabs"
                      >
                        {(["pass", "fail", "unknown"] as Status[]).map((s) => (
                          <button
                            key={s}
                            role="tab"
                            aria-selected={group === s}
                            className={group === s ? "active" : ""}
                            onClick={() => {
                              setGroup(s);
                              setQuery("");
                              setFocusedRule(null);
                            }}
                          >
                            {labels[s]}
                            <span>{run[s].length}</span>
                          </button>
                        ))}
                      </div>
                      <label className="table-search">
                        <Search size={13} />
                        <input
                          aria-label="搜索结果"
                          placeholder="搜索结果"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="table-wrap">
                      <table className="stock-table">
                        <thead>
                          <tr>
                            <th>
                              <span className="sr-only">比较</span>
                            </th>
                            <th>名称 / 代码</th>
                            {tableMetrics.map((m) => (
                              <th key={m}>
                                {METRICS[m].label}
                                <small> {METRICS[m].unit}</small>
                              </th>
                            ))}
                            <th>
                              <span className="sr-only">证据</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => (
                            <tr
                              key={s.code}
                              className={selected === s.code ? "selected" : ""}
                            >
                              <td>
                                <input
                                  aria-label={`比较${s.name}`}
                                  type="checkbox"
                                  checked={compare.includes(s.code)}
                                  disabled={
                                    compare.length >= 4 &&
                                    !compare.includes(s.code)
                                  }
                                  onChange={() =>
                                    setCompare((cs) =>
                                      cs.includes(s.code)
                                        ? cs.filter((c) => c !== s.code)
                                        : [...cs, s.code],
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  className="stock-name"
                                  onClick={() => setSelected(s.code)}
                                >
                                  <b>{s.name}</b>
                                  <span>{s.code}</span>
                                </button>
                              </td>
                              {tableMetrics.map((m) => (
                                <td
                                  key={m}
                                  className={
                                    s.metrics[m]?.quality !== "ok"
                                      ? "muted"
                                      : m === "revenueGrowth"
                                        ? (s.metrics[m]?.value ?? 0) > 0
                                          ? "positive"
                                          : "negative"
                                        : ""
                                  }
                                >
                                  {num(s.metrics[m]?.value, "")}
                                  {s.metrics[m]?.value != null &&
                                    s.metrics[m]?.quality !== "ok" && (
                                      <sup>!</sup>
                                    )}
                                </td>
                              ))}
                              <td>
                                <button
                                  className="icon"
                                  aria-label={`查看${s.name}证据`}
                                  onClick={() => setSelected(s.code)}
                                >
                                  <ArrowUpRight size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!rows.length && (
                        <div className="empty">
                          <Search size={25} />
                          <h3>
                            {query
                              ? "没有匹配结果"
                              : group === "pass"
                                ? "没有股票满足全部条件"
                                : "这个分组暂无股票"}
                          </h3>
                          <p>请检查条件与筛选漏斗；系统不会自动放宽阈值。</p>
                        </div>
                      )}
                    </div>
                    <div className="table-footer">
                      <span>按代码顺序展示 · 不构成推荐排名</span>
                      <button
                        className="text-button"
                        disabled={compare.length < 2}
                        onClick={() => setShowCompare(true)}
                      >
                        <Layers3 size={13} />
                        比较 {compare.length}/4
                        <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="platform-action">
                      <div>
                        <span className="platform-icon">同</span>
                        <p>
                          <b>在同花顺继续研究</b>
                          <small>策略表达 / 自选板块接续 / 口径留痕</small>
                        </p>
                      </div>
                      <button
                        className="outline"
                        disabled={
                          !!conflicts.length ||
                          parsed.blocked ||
                          intent.trim() !== parsed.intent
                        }
                        onClick={() => setShowTransfer(true)}
                      >
                        导出到同花顺
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                    <section className="funnel">
                      <div className="section-title">
                        <span>↳</span>按执行顺序逐步缩小范围
                        <small>筛选漏斗</small>
                      </div>
                      <div className="funnel-row">
                        <span>研究池</span>
                        <div>
                          <i style={{ width: "100%" }} />
                        </div>
                        <b>{snapshot?.stocks.length}</b>
                        <small />
                      </div>
                      {run.funnel.map((f, i) => (
                        <div className="funnel-row" key={i}>
                          <span title={f.label}>{f.label}</span>
                          <div>
                            <i
                              style={{
                                width: `${(f.remaining / (snapshot?.stocks.length || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <b>{f.remaining}</b>
                          <small>{f.unknown ? "? " + f.unknown : ""}</small>
                        </div>
                      ))}
                      <p>
                        数字为截至该步可确定满足全部已用条件的数量；“?”为无法判断。明确排除优先于缺失，详情保留全部判断。
                      </p>
                    </section>
                  </>
                ) : (
                  <div className="waiting">
                    <div className="orbit">
                      <Mark />
                    </div>
                    <div className="eyebrow tiny">
                      DEFINE → VERIFY → EXPLORE
                    </div>
                    <h2>
                      {busy === "market"
                        ? "正在读取并核查数据"
                        : "先确认条件，再查看结果"}
                    </h2>
                    <p>在上方核对条件并确认执行，结果与证据会显示在这里。</p>
                    <button
                      className="text-button"
                      onClick={() => setTab("lab")}
                    >
                      查看示例与边界用例
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                )}
              </section>
              <aside className="evidence">
                <div className="evidence-title">
                  <span>条件判断与原始证据</span>
                  <BookOpen size={15} />
                </div>
                {chosen ? (
                  <EvidencePanel
                    stock={chosen}
                    snapshot={snapshot}
                    current={!dirty}
                  />
                ) : (
                  <div className="evidence-placeholder">
                    <span>↗</span>
                    <h3>
                      结论的背后，
                      <br />
                      应该有证据。
                    </h3>
                    <p>执行后点击股票，逐项检查实际值、条件与原始字段。</p>
                  </div>
                )}
                <div className="evidence-bottom">
                  <b>!</b>
                  <p>
                    事实来自数据；入选是条件判断；代理指标属于推断。缺失与过期信息始终保留。
                  </p>
                </div>
              </aside>
            </div>
          </>
        ) : tab === "lab" ? (
          <ExperimentStudio
            onLoad={(e) => {
              switchMode("demo");
              example(e);
            }}
            onVerify={() => void diagnostics()}
            checking={checking}
            checks={checks}
            checkedAt={checkedAt}
          />
        ) : tab === "methods" ? (
          <section className="content-page">
            <h1>方法与接入</h1>
            <p className="description">
              先验证连接，再核对数据时点与计算口径。
            </p>
            <LiveCases
              onUse={(id) => {
                const scene = researchScenarios.find((s) => s.id === id);
                if (!scene) return;
                switchMode("live");
                setCodes(CASE_CODES.join(","));
                setSnapshot(null);
                setRun(null);
                setPrevious(null);
                setCompare([]);
                setAuto(false);
                setIntent(scene.question);
                setConfirmed(false);
                setDirty(true);
                setTab("workspace");
                void compile(scene.question);
                requestAnimationFrame(() =>
                  document
                    .getElementById("workbench")
                    ?.scrollIntoView({ behavior: "smooth" }),
                );
              }}
            />
            <details className="individual-checks">
              <summary>单独排查 AI / 金融数据连接</summary>
              <ConnectionCheck />
            </details>
            <div className="method-grid">
              {[
                [
                  "01",
                  "谁负责哪一步",
                  "AI或本地语义规则提出条件与澄清，没有模型授权时明确显示本地规则。确定性引擎校验字段、识别区间冲突、执行AND筛选和三态判断。金融工具提供真实数据与追踪ID。AI不编造数字，不替用户确认阈值。",
                ],
                [
                  "02",
                  "“最新”需要时间证据",
                  "行情与估值时间戳是批次中最大有效时间，并非逐股时间；页面保留获取时间。交易日历校验应有日期与15分钟滞后阈值。财报只使用当前已披露记录，缺披露日、上年同报告期或正基数时无法计算同比。",
                ],
                [
                  "03",
                  "明确范围，不扩大结论",
                  "默认12只A股起步研究池，可粘贴更多代码；整体不设20只上限，自动分批读取，不代表全市场。首版不支持行业、ST、停牌、新股、资金、新闻、预测与回测。行情/估值缓存60秒，财报6小时、日线和日历1小时。读取最新不保证产生新时点。",
                ],
                [
                  "04",
                  "保存、比较与使用边界",
                  "比较最多4只股票，统一指标并保留各自时点，不提供推荐排名。策略只保存在当前浏览器，不跨设备。真实数据导出应在授权允许范围内使用。密钥仅在服务端，不采集持仓或画像，研究工具 · 非买卖建议。",
                ],
              ].map(([no, title, body]) => (
                <article className="method-card" key={no}>
                  <h2>{title}</h2>
                  <details>
                    <summary>查看职责与限制</summary>
                    <p>{body}</p>
                  </details>
                </article>
              ))}
            </div>
            <section className="definitions metric-dictionary">
              <h2>
                指标工具箱 <small>{Object.keys(METRICS).length}项已接入</small>
              </h2>
              {METRIC_GROUPS.map((category) => (
                <div className="dictionary-category" key={category.title}>
                  <h3>{category.title}</h3>
                  {category.metrics.map((k) => (
                    <details key={k}>
                      <summary>
                        <span>{METRICS[k].label}</span>
                        <small>{METRICS[k].unit}</small>
                      </summary>
                      <p>{METRICS[k].definition}</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          version.current++;
                          setBusy("");
                          setTab("workspace");
                          setConditions((cs) => [
                            ...cs,
                            {
                              id: "c" + Date.now(),
                              metric: k,
                              op: "<" as const,
                              value:
                                k === "turnover"
                                  ? 5
                                  : k === "volume"
                                    ? 100
                                    : 20,
                              enabled: true,
                            },
                          ]);
                          setConfirmed(false);
                          setDirty(true);
                          requestAnimationFrame(() =>
                            document
                              .getElementById("workbench")
                              ?.scrollIntoView({ behavior: "smooth" }),
                          );
                        }}
                      >
                        加入我的条件 <Plus size={12} />
                      </button>
                    </details>
                  ))}
                </div>
              ))}
            </section>
            <div className="source-links">
              <a
                href="https://fuyao.aicubes.cn/docs/"
                target="_blank"
                rel="noreferrer"
              >
                扶摇官方接口文档 ↗
              </a>
              <a
                href="https://mcp.51ifind.com/"
                target="_blank"
                rel="noreferrer"
              >
                iFinD MCP · 首版未接入 ↗
              </a>
            </div>
          </section>
        ) : (
          <section className="content-page">
            <h1>
              留下条件，<em>继续验证。</em>
            </h1>
            <p className="description">
              保存在当前浏览器。重新打开需确认条件，结果以重新执行时的数据为准。
            </p>
            {!saved.length ? (
              <div className="saved-empty">
                <Bookmark size={30} />
                <h2>还没有保存的策略</h2>
                <p>在工作台点击书签按钮，保存当前条件。</p>
                <button className="primary" onClick={() => setTab("workspace")}>
                  回到工作台
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="saved-grid">
                {saved.map((s) => (
                  <article className="saved-card" key={s.id}>
                    <small>
                      {s.mode === "demo" ? "示例策略" : "真实数据策略"}
                    </small>
                    <h3>{s.intent.slice(0, 40)}</h3>
                    <p>
                      {time(s.createdAt)} ·{" "}
                      {s.conditions.filter((c) => c.enabled).length}条条件
                    </p>
                    <div className="saved-chips">
                      {s.conditions
                        .filter((c) => c.enabled)
                        .map((c) => (
                          <span key={c.id}>
                            {METRICS[c.metric].label} {c.op} {c.value}
                          </span>
                        ))}
                    </div>
                    <div className="saved-actions">
                      <button
                        className="text-button"
                        onClick={() => restore(s)}
                      >
                        重新打开
                        <ArrowUpRight size={14} />
                      </button>
                      <button
                        className="icon"
                        aria-label="导出保存的策略"
                        onClick={() => download("mingce-strategy.json", s)}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        className="icon"
                        aria-label="删除保存的策略"
                        onClick={() => {
                          const next = saved.filter((x) => x.id !== s.id);
                          try {
                            localStorage.setItem(
                              "mingce-strategies-v1",
                              JSON.stringify(next),
                            );
                            setSaved(next);
                          } catch {
                            setNotice("本地存储不可用，删除失败。");
                          }
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="footer">
        <div>
          <Mark />
          <b>明策 MINGCE</b>
          <span>让研究过程可检查。</span>
        </div>
        <span>
          事实 / 推断 / 不确定性，分别呈现。
          <i />
          研究工具 · 非投资建议
        </span>
        <button onClick={() => setTab("lab")}>
          示例与边界测试
          <ArrowUpRight size={12} />
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
          <button
            className="icon"
            aria-label="关闭提示"
            onClick={() => setNotice("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {showTransfer && (
        <TransferPanel
          conditions={conditions}
          run={run}
          current={!dirty && intent.trim() === parsed.intent}
          onClose={() => setShowTransfer(false)}
        />
      )}
      {showScope && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowScope(false);
          }}
        >
          <div
            className="modal scope-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scope-title"
          >
            <button
              className="close icon"
              aria-label="关闭研究池设置"
              onClick={() => setShowScope(false)}
            >
              <X size={19} />
            </button>

            <h2 id="scope-title">定义你的研究范围</h2>
            <p>
              粘贴A股代码，支持逗号、空格或换行。自动去重、分批读取；不设20只总量上限。
            </p>
            <label htmlFor="scope">股票代码，例如600519.SH</label>
            <textarea
              id="scope"
              rows={8}
              placeholder="600519.SH，000333.SZ\n600036.SH，000858.SZ"
              ref={scopeRef}
              value={scopeDraft}
              onChange={(e) => setScopeDraft(e.target.value)}
            />
            {scopeError && (
              <p role="alert" className="negative">
                {scopeError}
              </p>
            )}
            <button className="primary full" onClick={applyScope}>
              应用研究池
              <Check size={15} />
            </button>
          </div>
        </div>
      )}
      {showCompare && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCompare(false);
          }}
        >
          <div
            className="modal compare-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-title"
            tabIndex={-1}
            ref={dialogRef}
          >
            <button
              className="close icon"
              aria-label="关闭比较"
              onClick={() => setShowCompare(false)}
            >
              <X size={19} />
            </button>

            <h2 id="compare-title">把差异放在一起看</h2>
            <p>
              {mode === "demo"
                ? "构造样本，不对应真实公司。"
                : "同一研究快照，财报披露时点仍需分别检查。"}
              不提供推荐排名。
            </p>
            <div className="compare-scroll">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>指标 / 口径</th>
                    {compare.map((code) => (
                      <th key={code}>
                        {all.find((s) => s.code === code)?.name}
                        <small>{code}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(METRICS).map(([k, m]) => (
                    <tr key={k}>
                      <th title={m.definition}>
                        {m.label}
                        <small>{m.unit}</small>
                      </th>
                      {compare.map((code) => {
                        const ev = all.find((s) => s.code === code)?.metrics[
                          k as Metric
                        ];
                        return (
                          <td key={code}>
                            {num(ev?.value, m.unit)}
                            <small>
                              {ev?.quality === "ok"
                                ? time(ev.asOf)
                                : (ev?.note ?? "未获取 / 缺失")}
                            </small>
                            {ev?.reportPeriod && (
                              <small>报告期 {ev.reportPeriod}</small>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function EvidencePanel({
  stock,
  snapshot,
  current,
}: {
  stock: EvaluatedStock;
  snapshot: Snapshot | null;
  current: boolean;
}) {
  return (
    <>
      <div className="evidence-stock">
        <span className={`status-tag ${stock.status}`}>
          {labels[stock.status]}
        </span>
        <h2>{stock.name}</h2>
        <small>{stock.code}</small>
        <p>
          {stock.status === "pass"
            ? "已取得的证据满足本次执行条件。"
            : stock.status === "fail"
              ? "至少一条条件明确不满足，保留全部判断。"
              : "没有明确失败项，但部分条件缺乏可用证据。"}
        </p>
        {!current && (
          <div className="state-banner">上次结果，当前条件尚未重算</div>
        )}
      </div>
      <div className="evidence-facts">
        <div>
          <span>最新价格</span>
          <b>{num(stock.metrics.price?.value, " 元")}</b>
        </div>
        <div>
          <span>当日涨跌幅</span>
          <b>{num(stock.metrics.change?.value, "%", true)}</b>
        </div>
      </div>
      <div className="evidence-checks">
        {evidenceGroups(stock.checks).map((g, i) => {
          const c = g.checks[0];
          return (
            <article className={`evidence-check ${g.status}`} key={g.metric}>
              <div className="check-title">
                <span>
                  {g.status === "pass" ? (
                    <Check size={12} />
                  ) : g.status === "fail" ? (
                    <X size={12} />
                  ) : (
                    <CircleHelp size={12} />
                  )}
                </span>
                <b>{METRICS[c.condition.metric].label}</b>
                <small>{String(i + 1).padStart(2, "0")}</small>
              </div>
              <div className="evidence-number">
                {num(c.evidence?.value)}
                <small>{METRICS[c.condition.metric].unit}</small>
              </div>
              <div className="criterion-verdicts">
                {g.checks.map((check) => (
                  <div key={check.condition.id} className={check.status}>
                    <span>
                      {check.status === "pass"
                        ? "满足"
                        : check.status === "fail"
                          ? "不满足"
                          : "待核"}
                    </span>
                    <b>
                      {check.condition.op} {check.condition.value}
                      {METRICS[g.metric].unit}
                    </b>
                  </div>
                ))}
              </div>
              {g.checks.some((check) => check.status === "unknown") && (
                <p className="quality-reason">
                  {g.checks.find((check) => check.status === "unknown")?.reason}
                </p>
              )}
              <div className="evidence-period">
                {g.evidence?.reportPeriod
                  ? `报告期 ${g.evidence.reportPeriod}`
                  : time(g.evidence?.asOf)}
              </div>
              <details>
                <summary>
                  字段与原始证据
                  <ChevronDown size={12} />
                </summary>
                <div className="raw">
                  <p>
                    <b>口径</b>
                    {METRICS[c.condition.metric].definition}
                  </p>
                  <p>
                    <b>字段</b>
                    <code>{c.evidence?.field ?? "未取得"}</code>
                  </p>
                  <p>
                    <b>来源</b>
                    {c.evidence?.source ?? "未取得"}
                  </p>
                  <p>
                    <b>时点</b>
                    {time(c.evidence?.asOf)}
                  </p>
                  {c.evidence?.reportPeriod && (
                    <p>
                      <b>报告期</b>
                      {c.evidence.reportPeriod}
                    </p>
                  )}
                  {c.evidence?.note && (
                    <p>
                      <b>备注</b>
                      {c.evidence.note}
                    </p>
                  )}
                  {c.evidence?.toolName && (
                    <p>
                      <b>MCP工具</b>
                      <code>{c.evidence.toolName}</code>
                    </p>
                  )}
                  {c.evidence?.requestId && (
                    <p>
                      <b>请求ID</b>
                      <code>{c.evidence.requestId}</code>
                    </p>
                  )}
                  {c.evidence?.endpoint && (
                    <p>
                      <b>接口</b>
                      <code>{c.evidence.endpoint}</code>
                    </p>
                  )}
                  <pre>{JSON.stringify(c.evidence?.raw ?? null, null, 2)}</pre>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <div className="snapshot-meta">
        <small>
          SNAPSHOT / {snapshot?.mode === "demo" ? "CONSTRUCTED" : "LIVE SOURCE"}
        </small>
        <p>获取：{time(snapshot?.fetchedAt)}</p>
        <p>批次：{time(snapshot?.asOf)}</p>
        <details>
          <summary>
            数据范围与异常说明
            <ChevronDown size={12} />
          </summary>
          {snapshot?.issues.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </details>
      </div>
    </>
  );
}
