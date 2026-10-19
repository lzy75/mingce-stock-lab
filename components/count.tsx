"use client";
import { useEffect, useRef, useState } from "react";
export default function Count({
  value,
  pad = false,
}: {
  value: number;
  pad?: boolean;
}) {
  const prior = useRef(value),
    [shown, setShown] = useState(value);
  useEffect(() => {
    const from = prior.current;
    prior.current = value;
    if (
      from === value ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "off"
    ) {
      setShown(value);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / 320);
      setShown(Math.round(from + (value - from) * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className="animated-count" aria-label={String(value)}>
      <span aria-hidden="true">
        {pad ? String(shown).padStart(2, "0") : shown}
      </span>
    </span>
  );
}
