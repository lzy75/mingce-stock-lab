"use client";
import { useMemo, useState } from "react";
import {
  X,
  Copy,
  Download,
  ArrowUpRight,
  Check,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  strategySentence,
  supermindScript,
  transferManifest,
} from "@/lib/transfer";
import type { Condition, Run } from "@/lib/domain";
export default function TransferPanel({
  conditions,
  run,
  current,
  onClose,
}: {
  conditions: Condition[];
  run: Run | null;
  current: boolean;
  onClose: () => void;
}) {
  const [section, setSection] = useState<"strategy" | "watchlist">("strategy"),
    [copied, setCopied] = useState(false),
    [message, setMessage] = useState(""),
    [sector, setSector] = useState(
      "明策研究_" +
        new Date()
          .toISOString()
          .replace(/[-:T.]/g, "")
          .slice(0, 14),
    );
  const sentence = useMemo(() => {
    try {
      return strategySentence(conditions);
    } catch (e) {
      return e instanceof Error ? e.message : "条件无效";
    }
  }, [conditions]);
  const canExport =
    !!run && run.mode === "live" && run.pass.length > 0 && current;
  let script = "",
    scriptError = "";
  if (canExport) {
    try {
      script = supermindScript(conditions, run!, sector);
    } catch (e) {
      scriptError = e instanceof Error ? e.message : "无法生成";
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setMessage("已复制，请到同花顺目标环境粘贴并核查。");
    } catch {
      setMessage("浏览器不允许自动复制，请在文本框中手动选择复制。");
    }
  }
  function file(name: string, text: string, type = "text/plain") {
    const u = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
    setMessage("文件已生成，尚未写入同花顺账户。");
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-title"
      >
        <button
          className="close icon"
          aria-label="关闭同花顺接续"
          onClick={onClose}
        >
          <X size={19} />
        </button>

        <h2 id="transfer-title">导出到同花顺</h2>
        <p>复制策略到 i问财，或生成 SuperMind 自选板块脚本。</p>
        <div className="transfer-tabs">
          <button
            className={section === "strategy" ? "active" : ""}
            onClick={() => {
              setSection("strategy");
              setCopied(false);
            }}
          >
            策略条件 → i问财
          </button>
          <button
            className={section === "watchlist" ? "active" : ""}
            onClick={() => {
              setSection("watchlist");
              setCopied(false);
            }}
          >
            候选名单 → SuperMind
          </button>
        </div>
        {section === "strategy" ? (
          <>
            <div className="transfer-step">
              <div>
                <h3>复制本次结构化条件</h3>
                <p>粘贴到 i问财后核对周期、复权与算法口径。</p>
              </div>
            </div>
            <textarea aria-label="同花顺策略表达" readOnly value={sentence} />
            <div className="transfer-actions">
              <button className="primary" onClick={() => void copy(sentence)}>
                {copied ? <Check size={14} /> : <Copy size={14} />}一键复制策略
              </button>
              <a
                className="outline"
                href="https://www.iwencai.com/"
                target="_blank"
                rel="noreferrer"
              >
                打开i问财
                <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="transfer-boundary">
              <ShieldCheck size={15} />
              <p>账户自动同步未开放：当前 MCP 只有数据读取权限。</p>
            </div>
          </>
        ) : (
          <>
            <div className="transfer-step">
              <div>
                <h3>生成官方自选板块接续脚本</h3>
                <p>
                  使用SuperMind官方 custom_sector API
                  新建板块，仅含本次入选代码和策略定义，不含交易指令。
                </p>
              </div>
            </div>
            {!canExport ? (
              <div className="callout amber">
                {run?.mode === "demo"
                  ? "构造样本不能同步到真实自选股，请先执行真实数据筛选。"
                  : !current
                    ? "条件已修改，请重新执行后再生成自选脚本。"
                    : "需要至少一只真实数据入选股票。"}
              </div>
            ) : (
              <>
                <label htmlFor="sector-name">新板块名称</label>
                <input
                  id="sector-name"
                  maxLength={40}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                />
                <div className="transfer-codes">
                  {run!.pass.map((s) => (
                    <span key={s.code}>
                      {s.code} {s.name}
                    </span>
                  ))}
                </div>
                {scriptError ? (
                  <p role="alert" className="negative">
                    {scriptError}
                  </p>
                ) : (
                  <pre className="transfer-script">{script}</pre>
                )}
                <div className="transfer-actions">
                  <button
                    className="primary"
                    disabled={!!scriptError || !script}
                    onClick={() => file("mingce_supermind.py", script)}
                  >
                    <Download size={15} />
                    生成SuperMind脚本
                  </button>
                  <button
                    className="outline"
                    disabled={!!scriptError || !script}
                    onClick={() => void copy(script)}
                  >
                    <Copy size={14} />
                    复制脚本
                  </button>
                </div>
                <p className="transfer-small">
                  在已登录的 SuperMind
                  中检查后运行，再回读板块名称与代码核验。手机/PC
                  自选互通尚未验证。
                </p>
              </>
            )}
          </>
        )}
        {message && (
          <div role="status" className="transfer-message">
            {message}
          </div>
        )}
        <div className="transfer-bottom">
          <button
            className="text-button"
            onClick={() =>
              file(
                "mingce_transfer.json",
                JSON.stringify(transferManifest(conditions, run), null, 2),
                "application/json",
              )
            }
          >
            <Download size={13} />
            下载完整策略定义
          </button>
          <a
            href="https://quant.10jqka.com.cn/view/help/4?from=ifind"
            target="_blank"
            rel="noreferrer"
          >
            同花顺官方API说明
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
