import type { Run } from "@/lib/domain";
import { conditionImpacts } from "@/lib/research-summary";
export default function ResearchSignals({
  run,
  focused,
  onFocus,
}: {
  run: Run;
  focused: string | null;
  onFocus: (id: string | null) => void;
}) {
  const impacts = conditionImpacts(run);
  return (
    <section className="research-signals" aria-label="条件排除分析">
      <header>
        <h3>名单主要卡在哪里</h3>
        <span>全研究池 · 逐条件核查</span>
      </header>
      <div className="impact-rows">
        {impacts.slice(0, 3).map((item) => (
          <button
            key={item.condition.id}
            className={focused === item.condition.id ? "active" : ""}
            disabled={!item.fail}
            onClick={() =>
              onFocus(focused === item.condition.id ? null : item.condition.id)
            }
            aria-label={`定位${item.label}的${item.fail}只排除股票`}
          >
            <span className="impact-label">{item.label}</span>
            <span className="impact-track">
              <i
                style={{
                  width: `${item.total ? (item.fail / item.total) * 100 : 0}%`,
                }}
              />
            </span>
            <b>
              {item.fail}
              <small>排除</small>
            </b>
            <em>{item.unknown ? `${item.unknown}项待核` : "证据齐全"}</em>
          </button>
        ))}
      </div>
      <details>
        <summary>统计口径</summary>
        <p>
          每项单独检查全部{impacts[0]?.total ?? 0}
          只股票；同一股票可不满足多项，数量不能相加。“待核”包括缺失、过期、冲突或不适用；点击有排除项的条件定位股票。
        </p>
      </details>
    </section>
  );
}
