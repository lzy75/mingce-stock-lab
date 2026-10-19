"use client";
import { ArrowDown, ArrowUpRight, Check, GitBranch } from "lucide-react";
import { METRICS, parseIntent, screen } from "@/lib/domain";
import { demoSnapshot } from "@/lib/fixtures";
import { researchScenarios } from "@/lib/scenarios";
export default function StartGuide({
  intent,
  onIntent,
  onStart,
  onVerify,
  busy,
}: {
  intent: string;
  onIntent: (value: string) => void;
  onStart: () => void;
  onVerify: () => void;
  busy: boolean;
}) {
  const parsed = parseIntent(intent);
  let preview;
  try {
    if (!parsed.blocked) preview = screen(demoSnapshot, parsed.conditions);
  } catch {}
  return (
    <section className="start-guide" aria-label="明策使用导览">
      <div className="guide-content">
        <div className="guide-signature">
          <span />
          让研究有据可循
        </div>
        <h1>
          把选股想法，
          <br />
          <span>变成可核对的名单。</span>
        </h1>
        <p className="guide-lead">说条件、看证据，再把研究带到同花顺。</p>
        <div className="guide-scenarios" aria-label="研究场景">
          {researchScenarios.map((scene) => (
            <button
              key={scene.id}
              className={intent === scene.question ? "active" : ""}
              onClick={() => onIntent(scene.question)}
            >
              {scene.title}
            </button>
          ))}
        </div>
        <label htmlFor="guide-intent">先说说，你想研究什么？</label>
        <textarea
          id="guide-intent"
          aria-label="导览选股描述"
          value={intent}
          onChange={(e) => onIntent(e.target.value)}
          maxLength={2000}
        />
        <div className="guide-actions">
          <button
            className="primary"
            onClick={onStart}
            disabled={busy || !intent.trim()}
          >
            {busy ? "正在拆解…" : "用 AI 拆解我的策略"}
            <ArrowUpRight size={17} />
          </button>
          <button className="guide-secondary" onClick={onVerify}>
            运行真实案例
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="guide-capabilities">
          <span>{Object.keys(METRICS).length}项可用指标</span>
          <span>逐条件证据</span>
          <span>同快照推演</span>
        </div>
      </div>
      <div className="guide-demo">
        <header>
          <span>输入 → 条件 → 名单</span>
          <small>构造示例</small>
        </header>
        <div className="guide-quote">{intent || "描述你的研究条件"}</div>
        <div className="guide-compile-line">
          <i />
          <span>拆成你能修改的条件</span>
          <i />
        </div>
        <div className="guide-rules">
          {parsed.blocked ? (
            <p>{parsed.reason}</p>
          ) : (
            parsed.conditions.map((c) => (
              <div key={c.id}>
                <span>{METRICS[c.metric].label}</span>
                <b>
                  {c.op} {c.value}
                  <small>{METRICS[c.metric].unit}</small>
                </b>
              </div>
            ))
          )}
        </div>
        <div className="guide-preview-result">
          <div>
            <Check size={14} />
            <span>入选 {preview?.pass.length ?? "—"}</span>
            <span>排除 {preview?.fail.length ?? "—"}</span>
            <span>待核 {preview?.unknown.length ?? "—"}</span>
          </div>
          {preview?.pass.slice(0, 2).map((s) => (
            <article key={s.code}>
              <span>
                {s.name}
                <small>{s.code}</small>
              </span>
              <b>满足全部条件</b>
            </article>
          ))}
        </div>
        <div className="guide-proof">
          <GitBranch size={14} />
          <span>改一个阈值，追踪名单为什么变化</span>
        </div>
      </div>
      <a className="guide-scroll" href="#workbench">
        下滑进入研究台
        <ArrowDown size={17} />
      </a>
    </section>
  );
}
