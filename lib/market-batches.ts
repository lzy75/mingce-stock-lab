import { MARKET_BATCH_SIZE, parseCodes } from "./research-pool.ts";
import type { Metric, Snapshot } from "./domain.ts";
export interface BatchProgress {
  completed: number;
  total: number;
  stocksDone: number;
  stocksTotal: number;
  retryAfter?: number;
}
type Options = {
  codes: string[];
  metrics: Metric[];
  onProgress?: (progress: BatchProgress) => void;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  fetcher?: typeof fetch;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
};
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("已取消", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("已取消", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function loadMarketBatches(options: Options): Promise<Snapshot> {
  const codes = parseCodes(options.codes),
    total = Math.ceil(codes.length / MARKET_BATCH_SIZE),
    snapshots: Snapshot[] = [];
  const fetcher = options.fetcher ?? fetch;
  const check = () => {
    if (options.signal?.aborted || options.isCurrent?.() === false)
      throw new DOMException("研究条件已变更或读取已取消", "AbortError");
  };
  const progress = (
    completed: number,
    stocksDone: number,
    retryAfter?: number,
  ) =>
    options.onProgress?.({
      completed,
      total,
      stocksDone,
      stocksTotal: codes.length,
      ...(retryAfter ? { retryAfter } : {}),
    });
  check();
  progress(0, 0);
  for (let index = 0; index < codes.length; index += MARKET_BATCH_SIZE) {
    check();
    const batch = codes.slice(index, index + MARKET_BATCH_SIZE),
      number = snapshots.length + 1;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      check();
      try {
        response = await fetcher("/api/market", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes: batch, metrics: options.metrics }),
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)])
            : AbortSignal.timeout(120000),
        });
      } catch (error) {
        check();
        throw Error(`第${number}/${total}批读取失败或超时，本次未生成新名单。`);
      }
      if (response.status !== 429 || attempt === 1) break;
      const seconds = Number(response.headers.get("retry-after") ?? 60);
      const delay = Number.isFinite(seconds)
        ? Math.max(1, Math.min(60, seconds))
        : 60;
      progress(snapshots.length, index, delay);
      await (options.wait ?? wait)(delay * 1000, options.signal);
    }
    check();
    let body: Snapshot & { error?: string; requestId?: string };
    try {
      body = (await response!.json()) as typeof body;
    } catch {
      throw Error(
        `第${number}/${total}批返回HTTP ${response!.status}非JSON响应，本次未生成新名单。`,
      );
    }
    if (!response!.ok)
      throw Error(
        `第${number}/${total}批：${body.error ?? `HTTP ${response!.status}`}${body.requestId ? ` · 请求ID ${body.requestId}` : ""}；本次未生成新名单。`,
      );
    if (
      body.mode !== "live" ||
      !Array.isArray(body.stocks) ||
      body.stocks.length !== batch.length ||
      body.requested !== batch.length ||
      typeof body.id !== "string" ||
      !body.fetchedAt
    )
      throw Error(`第${number}批次响应结构不完整，本次未生成新名单。`);
    const received = new Set(body.stocks.map((s) => s.code));
    if (
      received.size !== batch.length ||
      batch.some((code) => !received.has(code))
    )
      throw Error(`第${number}批次股票范围不一致，本次未生成新名单。`);
    snapshots.push(body);
    progress(snapshots.length, index + batch.length);
  }
  check();
  if (snapshots.length === 1) return snapshots[0];
  const stocks = new Map(
    snapshots.flatMap((s) => s.stocks).map((s) => [s.code, s]),
  );
  const times = snapshots
    .map((s) => s.asOf)
    .filter((s): s is string => !!s && Number.isFinite(Date.parse(s)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    id: crypto.randomUUID(),
    mode: "live",
    requested: codes.length,
    stocks: codes.map((code) => stocks.get(code)!),
    asOf: times[0] ?? null,
    fetchedAt: new Date().toISOString(),
    scope: `自选A股研究池 · ${codes.length}只 · ${total}批`,
    issues: [
      ...new Set(snapshots.flatMap((s) => s.issues ?? [])),
      `研究池分批读取（${total}批），批次时点可能不同；每项证据保留自身来源和时点。全部批次完成后才生成名单。`,
    ],
  };
}
