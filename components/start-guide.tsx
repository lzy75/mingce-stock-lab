"use client";
import { ArrowDown, ArrowUpRight, LoaderCircle } from "lucide-react";
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
  busy: string;
}) {
  return (
    <section
      className="strategy-composer"
      id="strategy-input"
      aria-label="策略输入"
    >
      <div className="composer-heading">
        <div>
          <h1>先说想法，再看名单。</h1>
          <p>
            不用先想好指标。描述你的选股偏好，AI 帮你拆成能核对、能修改的条件。
          </p>
        </div>
        <a href="#workbench">
          查看下方输出 <ArrowDown size={14} />
        </a>
      </div>
      <div className="composer-field">
        <label htmlFor="intent">你想找什么样的股票？</label>
        <textarea
          id="intent"
          aria-label="自然语言选股需求"
          value={intent}
          onChange={(e) => onIntent(e.target.value)}
          maxLength={2000}
          placeholder="例如：经营改善、估值合理、走势相对稳定。也可以写出明确条件，如市盈率低于25倍、营收同比大于10%。"
        />
        <div className="composer-field-footer">
          <span>先说偏好，或写出具体阈值</span>
          <span>{intent.length}/2000</span>
        </div>
      </div>
      <div className="composer-bottom">
        <div className="composer-scenarios" aria-label="研究场景">
          <span>试一个方向</span>
          {researchScenarios.map((s) => (
            <button
              key={s.id}
              className={intent === s.question ? "active" : ""}
              onClick={() => onIntent(s.question)}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="composer-actions">
          <button className="text-button" onClick={onVerify}>
            运行真实案例 <ArrowUpRight size={13} />
          </button>
          <button
            className="primary"
            disabled={!!busy || !intent.trim()}
            onClick={onStart}
          >
            {busy === "parse" ? (
              <LoaderCircle className="spin" size={16} />
            ) : null}
            {busy === "parse" ? "正在拆解条件…" : "用 AI 拆解我的策略"}
            <ArrowDown size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
