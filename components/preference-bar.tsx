"use client";
import { useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal,
  ArrowUpRight,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  recommend,
  FOCUS_LABELS,
  TOLERANCE_LABELS,
  type Focus,
  type Tolerance,
  type Preference,
} from "@/lib/preferences";
import type { ParsedIntent } from "@/lib/domain";
export default function PreferenceBar({
  onApply,
}: {
  onApply: (parsed: ParsedIntent) => void;
}) {
  const [open, setOpen] = useState(false),
    [preference, setPreference] = useState<Preference>({
      focus: "balanced",
      tolerance: "medium",
    }),
    [saved, setSaved] = useState(false),
    [notice, setNotice] = useState("");
  const suggestion = useMemo(() => recommend(preference), [preference]);
  useEffect(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem("mingce-preference-v1") ?? "null",
      );
      if (p) {
        recommend(p);
        setPreference(p);
        setSaved(true);
      }
    } catch {}
  }, []);
  function save() {
    try {
      localStorage.setItem("mingce-preference-v1", JSON.stringify(preference));
      setSaved(true);
      setNotice("研究偏好已保存在当前浏览器");
    } catch {
      setNotice("本地保存失败，仍可直接应用条件");
    }
  }
  return (
    <section className={`preference-bar ${open ? "open" : ""}`}>
      <button
        className="preference-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <SlidersHorizontal size={14} />
        <b>按我的偏好推荐策略</b>
        <span>
          {saved ? suggestion.title : "主动选择风格，获得可解释的条件模板"}
        </span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="preference-content">
          <div className="preference-controls">
            <label>
              研究重点
              <select
                value={preference.focus}
                onChange={(e) => {
                  setPreference((p) => ({
                    ...p,
                    focus: e.target.value as Focus,
                  }));
                  setSaved(false);
                }}
              >
                {Object.entries(FOCUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              历史波动接受度
              <select
                value={preference.tolerance}
                onChange={(e) => {
                  setPreference((p) => ({
                    ...p,
                    tolerance: e.target.value as Tolerance,
                  }));
                  setSaved(false);
                }}
              >
                {Object.entries(TOLERANCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button className="text-button" onClick={save}>
              <Check size={13} />
              {saved ? "已保存偏好" : "保存我的偏好"}
            </button>
            {notice && <p role="status">{notice}</p>}
          </div>
          <div className="preference-explanation">
            <span className="eyebrow">为什么推荐这组条件</span>
            <h3>{suggestion.title}</h3>
            {suggestion.explanations.map((x, i) => (
              <p key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {x}
              </p>
            ))}
          </div>
          <div className="preference-apply">
            <small>建议模板，非买卖建议</small>
            <p>{suggestion.prompt}</p>
            <button
              className="primary"
              onClick={() => onApply(suggestion.parsed)}
            >
              应用到条件区
              <ArrowUpRight size={15} />
            </button>
            <span>应用后仍需检查并确认，不自动筛选。</span>
          </div>
        </div>
      )}
    </section>
  );
}
