"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, SlidersHorizontal, Check, X } from "lucide-react";
export default function AppearanceMenu() {
  const [open, setOpen] = useState(false),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [density, setDensity] = useState<"compact" | "comfortable">("compact"),
    [motion, setMotion] = useState(true),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("mingce-appearance-v1") ?? "null",
      );
      if (value) {
        if (["light", "dark"].includes(value.theme)) setTheme(value.theme);
        if (["compact", "comfortable"].includes(value.density))
          setDensity(value.density);
        if (typeof value.motion === "boolean") setMotion(value.motion);
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.motion = motion ? "on" : "off";
    try {
      localStorage.setItem(
        "mingce-appearance-v1",
        JSON.stringify({ theme, density, motion }),
      );
    } catch {}
  }, [theme, density, motion, ready]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  return (
    <div className="appearance">
      <button
        className="view-trigger"
        aria-expanded={open}
        aria-label="研究视图设置"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={15} />
        <span>研究视图</span>
      </button>
      {open && (
        <div
          className="appearance-popover"
          role="dialog"
          aria-label="研究视图设置"
        >
          <div className="appearance-title">
            <b>你的研究空间</b>
            <button
              className="icon"
              aria-label="关闭视图设置"
              onClick={() => setOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          <p>只调整呈现，不改变策略与数据。</p>
          <div className="theme-choices">
            <button
              className={theme === "light" ? "active" : ""}
              onClick={() => setTheme("light")}
            >
              <span className="theme-preview light-preview">
                <i />
                <i />
                <i />
              </span>
              <span>
                <Sun size={13} />
                日间研究{theme === "light" && <Check size={12} />}
              </span>
            </button>
            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setTheme("dark")}
            >
              <span className="theme-preview dark-preview">
                <i />
                <i />
                <i />
              </span>
              <span>
                <Moon size={13} />
                夜间专注{theme === "dark" && <Check size={12} />}
              </span>
            </button>
          </div>
          <label>
            信息密度
            <div className="density-choices">
              <button
                className={density === "compact" ? "active" : ""}
                onClick={() => setDensity("compact")}
              >
                紧凑 · 更多数据
              </button>
              <button
                className={density === "comfortable" ? "active" : ""}
                onClick={() => setDensity("comfortable")}
              >
                舒展 · 便于阅读
              </button>
            </div>
          </label>
          <label className="motion-setting">
            <span>
              交互动态<small>遵循系统“减少动态效果”偏好</small>
            </span>
            <input
              aria-label="启用交互动态"
              type="checkbox"
              checked={motion}
              onChange={(e) => setMotion(e.target.checked)}
            />
          </label>
          <small>设置仅保存在当前浏览器。</small>
        </div>
      )}
    </div>
  );
}
