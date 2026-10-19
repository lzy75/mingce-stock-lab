import {
  annualizedVolatility,
  metricValue,
  METRICS,
  type Evidence,
  type Metric,
  type Snapshot,
  type Stock,
} from "./domain.ts";
import {FuyaoMcp,mcpArguments} from './mcp-client.ts';
export const FUYAO_ORIGIN = "https://fuyao.aicubes.cn";
export const DEFAULT_CODES = [
  "600519.SH",
  "000858.SZ",
  "600036.SH",
  "000333.SZ",
  "600900.SH",
  "601318.SH",
  "300750.SZ",
  "600031.SH",
  "600887.SH",
  "002415.SZ",
  "601899.SH",
  "600276.SH",
];
export class DataError extends Error {
  code: string;
  requestId?: string;
  constructor(message: string, code = "UPSTREAM", requestId?: string) {
    super(message);
    this.name = "DataError";
    this.code = code;
    this.requestId = requestId;
  }
}
type Raw = Record<string, unknown>;
export interface Envelope {
  transport?:'MCP'|'REST';
  toolName?:string;
  code: number;
  message?: string;
  request_id?: string;
  data: Record<string, unknown>;
}
export async function fetchFuyao(
  path: string,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<Envelope> {
  if (!key)
    throw new DataError(
      "尚未配置扶摇数据授权；请由项目所有者设置服务端 FUYAO_API_KEY。",
      "NOT_CONFIGURED",
    );
  let response: Response;
  try {
    response = await fetcher(FUYAO_ORIGIN + path, {
      headers: { "X-api-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new DataError("金融数据接口连接失败或超时，请稍后重试。", "NETWORK");
  }
  if (!response.ok)
    throw new DataError(
      response.status === 429
        ? "金融数据接口限流，请稍后重试。"
        : `金融数据接口 HTTP ${response.status}`,
      "HTTP_" + response.status,
    );
  let json: Envelope;
  try {
    json = (await response.json()) as Envelope;
  } catch {
    throw new DataError("金融数据接口未返回有效JSON。", "INVALID_JSON");
  }
  if (typeof json.code !== "number")
    throw new DataError("金融数据响应缺少业务状态码。", "INVALID_SCHEMA");
  if (json.code !== 0)
    throw new DataError(
      [2001, 2003].includes(json.code)
        ? "金融数据授权无效或当前接口权限不足。"
        : `金融数据接口业务失败（${json.code}），请检查数据权限或稍后重试。`,
      String(json.code),
      json.request_id,
    );
  if (!json.data || typeof json.data !== "object")
    throw new DataError(
      "金融数据响应缺少data。",
      "INVALID_SCHEMA",
      json.request_id,
    );
  return json;
}
export function items(envelope: Envelope): Raw[] {
  if (!Array.isArray(envelope.data.item))
    throw new DataError(
      "金融数据响应缺少item数组。",
      "INVALID_SCHEMA",
      envelope.request_id,
    );
  return envelope.data.item.filter((x) => x && typeof x === "object");
}
export function parseCodes(value: unknown): string[] {
  if (value === undefined) return DEFAULT_CODES;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 20 ||
    value.some((x) => typeof x !== "string" || !/^\d{6}\.(SH|SZ|BJ)$/.test(x))
  )
    throw new DataError(
      "研究池需包含1—20个标准A股代码，例如600519.SH。",
      "INVALID_CODES",
    );
  return [...new Set(value)];
}
function iso(value: unknown): string | null {
  const n = metricValue(value);
  return n !== null && n > 0 && n < Date.now() + 86400000
    ? new Date(n).toISOString()
    : null;
}
export function dateShanghai(ms: number): string {
  return new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
}
export function quoteQuality(
  asOf: string | null,
  tradingDates: string[],
  now = Date.now(),
): { quality: Evidence["quality"]; note: string } {
  if (!asOf)
    return {
      quality: "missing",
      note: "上游未提供有效快照时间，无法验证时点。",
    };
  if (!tradingDates.length)
    return { quality: "missing", note: "交易日历不可用，无法验证行情新鲜度。" };
  const local = new Date(now + 8 * 3600000);
  const today = local.toISOString().slice(0, 10);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const latest = tradingDates
    .filter((d) => d <= today && (d < today || minutes >= 9 * 60 + 30))
    .sort()
    .at(-1);
  if (!latest || dateShanghai(Date.parse(asOf)) < latest)
    return {
      quality: "stale",
      note: `快照早于应有交易日${latest ?? "未知"}，不能作为最新数据。`,
    };
  if (dateShanghai(Date.parse(asOf)) > today)
    return { quality: "conflict", note: "快照时间位于未来，无法判断。" };
  const active =
    tradingDates.includes(today) &&
    ((minutes >= 570 && minutes <= 690) || (minutes >= 780 && minutes <= 900));
  const expectedEnd =
    minutes > 690 && minutes < 780
      ? Date.parse(today + "T11:30:00+08:00")
      : minutes > 900
        ? Date.parse(today + "T15:00:00+08:00")
        : null;
  if (
    (active && now - Date.parse(asOf) > 15 * 60000) ||
    (tradingDates.includes(today) &&
      expectedEnd !== null &&
      expectedEnd - Date.parse(asOf) > 15 * 60000)
  )
    return { quality: "stale", note: "快照较应有行情时间滞后超过15分钟。" };
  return {
    quality: "ok",
    note: "使用上游批次最大有效时间；接口不提供逐股成交时间，无法保证每只股票同等新鲜。",
  };
}
function evidence(
  metric: Metric,
  value: number | null,
  raw: unknown,
  envelope: Envelope,
  path: string,
  asOf: string | null,
  extra: Partial<Evidence> = {},
): Evidence {
  return {
    value,
    raw,
    field: metric,
    source: envelope.transport==='MCP'?'扶摇 MCP / 同花顺金融数据 API':'扶摇 REST / 同花顺金融数据 API',
    transport:envelope.transport??'REST',toolName:envelope.toolName,
    asOf,
    unit: METRICS[metric].unit,
    definition: METRICS[metric].definition,
    quality: value === null ? "missing" : "ok",
    requestId: envelope.request_id,
    endpoint: envelope.transport==='MCP'?FUYAO_ORIGIN+'/mcp/a-share':FUYAO_ORIGIN + path,
    fetchedAt: new Date().toISOString(),
    ...extra,
  };
}
export function financialGrowth(
  records: Raw[],
  field: string,
  now = Date.now(),
): {
  value: number | null;
  raw: unknown;
  reportPeriod?: string;
  asOf: string | null;
  note: string;
  quality: Evidence["quality"];
} {
  const sorted = records
    .filter((r) => {
      const end = metricValue(r.period_end_ms);
      const published = metricValue(r.report_date_ms);
      return (
        end !== null && end <= now && published !== null && published <= now
      );
    })
    .sort((a, b) => Number(b.period_end_ms) - Number(a.period_end_ms));
  const latest = sorted[0];
  if (!latest)
    return {
      value: null,
      raw: records,
      asOf: null,
      quality: "missing",
      note: "没有同时具备有效报告期和披露日的已披露记录。",
    };
  const d = new Date(Number(latest.period_end_ms) + 8 * 3600000);
  const previous = sorted.find((r) => {
    const p = new Date(Number(r.period_end_ms) + 8 * 3600000);
    return (
      p.getUTCFullYear() === d.getUTCFullYear() - 1 &&
      p.getUTCMonth() === d.getUTCMonth()
    );
  });
  const a = metricValue(latest[field]),
    b = metricValue(previous?.[field]);
  const asOf = iso(latest.report_date_ms);
  const reportPeriod = dateShanghai(Number(latest.period_end_ms));
  if (a === null || b === null || b <= 0)
    return {
      value: null,
      raw: { current: latest, previous: previous ?? null },
      asOf,
      reportPeriod,
      quality: "missing",
      note: "本期/上年同期字段缺失，或上年同期基数≤0，不能计算普通同比。",
    };
  const stale = now - Number(latest.period_end_ms) > 200 * 86400000;
  return {
    value: (a / b - 1) * 100,
    raw: {
      current: {
        period_end_ms: latest.period_end_ms,
        report_date_ms: latest.report_date_ms,
        [field]: a,
      },
      previous: {
        period_end_ms: previous!.period_end_ms,
        report_date_ms: previous!.report_date_ms,
        [field]: b,
      },
    },
    asOf,
    reportPeriod,
    quality: stale ? "stale" : "ok",
    note: stale
      ? "报告期末距今超过200天，请核查是否缺少新披露报告。"
      : "采用累计报告期同比；披露日来自上游report_date_ms。",
  };
}
async function pool<T, U>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<U>,
): Promise<U[]> {
  const out: U[] = new Array(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const i = cursor++;
        out[i] = await fn(values[i]);
      }
    }),
  );
  return out;
}
const cache = new Map<string, { time: number; value: Envelope }>();
export async function loadMarket(
  key: string,
  codes: string[],
  metrics: Metric[],
  fetcher: typeof fetch = fetch,
  transport:'rest'|'mcp'='rest',
): Promise<Snapshot> {
  if(!key)throw new DataError('尚未配置扶摇数据授权，请设置服务端密钥。','NOT_CONFIGURED');
  const now = Date.now();
  const issues: string[] = [];
  const mcp=transport==='mcp'?new FuyaoMcp(key,fetcher):null;
  const get = async (path: string, ttl: number) => {
    const cacheKey = transport + key + path + (path.includes('calendar/trading-days')?dateShanghai(now):'');
    const prior = cache.get(cacheKey);
    if (prior && now - prior.time < ttl) return prior.value;
    let value:Envelope;
    if(mcp){const {name,args}=mcpArguments(path);const result=await mcp.call(name,args);if(result.code!==0||!result.data||typeof result.data!=='object')throw new DataError(`MCP金融数据业务失败（${result.code??'响应结构无效'}）`,'MCP_BUSINESS',typeof result.request_id==='string'?result.request_id:undefined);value={...result,code:0,data:result.data as Record<string,unknown>,transport:'MCP',toolName:name} as Envelope;}
    else value={...await fetchFuyao(path,key,fetcher),transport:'REST'};
    if (cache.size > 400) cache.clear();
    cache.set(cacheKey, { time: now, value });
    return value;
  };
  const qPath = "/api/a-share/prices/snapshot?thscodes=" + codes.join(",");
  const vPath = "/api/a-share/valuations/snapshot?thscodes=" + codes.join(",");
  const [qResult, vResult, cResult] = await Promise.allSettled([
    get(qPath, 60000),
    get(vPath, 60000),
    get("/api/a-share/calendar/trading-days", 3600000),
  ]);
  if (qResult.status === "rejected" && vResult.status === "rejected")
    throw qResult.reason;
  const quote = qResult.status === "fulfilled" ? qResult.value : null;
  const valuation = vResult.status === "fulfilled" ? vResult.value : null;
  for (const [i, r] of [qResult, vResult, cResult].entries())
    if (r.status === "rejected")
      issues.push(
        `${["行情", "估值", "交易日历"][i]}：${r.reason instanceof Error ? r.reason.message : "调用失败"}`,
      );
  const dates =
    cResult.status === "fulfilled"
      ? items(cResult.value).map((x) =>
          String(x.date).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
        )
      : [];
  const qAsOf = iso(quote?.data.timestamp);
  const vAsOf = iso(valuation?.data.timestamp);
  const qQuality = quoteQuality(qAsOf, dates, now);
  const vQuality = quoteQuality(vAsOf, dates, now);
  const qItems = quote ? items(quote) : [];
  const vItems = valuation ? items(valuation) : [];
  const stocks = await pool(codes, 3, async (code): Promise<Stock> => {
    const q = qItems.find((x) => x.thscode === code);
    const v = vItems.find((x) => x.thscode === code);
    const stock: Stock = {
      code,
      name: typeof v?.name === "string" ? v.name : code,
      metrics: {},
    };
    for (const [m, field] of [
      ["pe", "pe_ttm"],
      ["pb", "pb_mrq"],
    ] as [Metric, string][]) {
      if (valuation)
        stock.metrics[m] = evidence(
          m,
          metricValue(v?.[field]),
          v?.[field] ?? null,
          valuation,
          vPath,
          vAsOf,
          {
            field,
            ...vQuality,
            ...(!v || metricValue(v[field]) === null
              ? {
                  quality: "missing" as const,
                  note: "上游未返回该股票或指标值",
                }
              : {}),
          },
        );
    }
    for (const [m, field] of [
      ["price", "last_price"],
      ["change", "price_change_ratio_pct"],
    ] as [Metric, string][]) {
      if (quote)
        stock.metrics[m] = evidence(
          m,
          metricValue(q?.[field]),
          q?.[field] ?? null,
          quote,
          qPath,
          qAsOf,
          {
            field,
            ...qQuality,
            ...(!q || metricValue(q[field]) === null
              ? {
                  quality: "missing" as const,
                  note: "上游未返回该股票或行情值",
                }
              : {}),
          },
        );
    }
    if (metrics.some((x) => x === "revenueGrowth" || x === "profitGrowth")) {
      const path = `/api/a-share/financials/income-statements?thscode=${code}&period=quarterly&limit=8`;
      try {
        const f = await get(path, 6 * 3600000);
        for (const [m, field] of [
          ["revenueGrowth", "operating_income"],
          ["profitGrowth", "parent_holder_net_profit"],
        ] as [Metric, string][]) {
          const g = financialGrowth(items(f), field, now);
          stock.metrics[m] = evidence(m, g.value, g.raw, f, path, g.asOf, {
            ...g,
            field,
          });
        }
      } catch (err) {
        issues.push(
          `${code} 财务：${err instanceof Error ? err.message : "调用失败"}`,
        );
      }
    }
    if (metrics.includes("volatility")) {
      const historyEnd=Date.parse(dateShanghai(now)+'T00:00:00+08:00');
      const path = `/api/a-share/prices/historical?thscode=${code}&interval=1d&start=${historyEnd - 100 * 86400000}&end=${historyEnd}&adjust=forward`;
      try {
        const h = await get(path, 3600000);
        const today = dateShanghai(now);
        const bars = items(h)
          .filter(
            (b) =>
              typeof b.date_ms === "number" && dateShanghai(b.date_ms) < today,
          )
          .sort((a, b) => Number(a.date_ms) - Number(b.date_ms));
        const selected = bars.slice(-21);
        const expected = dates
          .filter((d) => d < today)
          .sort()
          .slice(-21);
        const observed = selected.map((b) => dateShanghai(Number(b.date_ms)));
        const complete =
          expected.length === 21 &&
          observed.length === 21 &&
          expected.every((d, i) => d === observed[i]);
        const value = complete
          ? annualizedVolatility(selected.map((b) => b.close_price))
          : null;
        stock.history = selected.map((b) => metricValue(b.close_price) ?? 0);
        stock.metrics.volatility = evidence(
          "volatility",
          value,
          selected.map((b) => ({
            date_ms: b.date_ms,
            close_price: b.close_price,
          })),
          h,
          path,
          iso(selected.at(-1)?.date_ms),
          {
            field:
              "close_price → sampleSD(simpleDailyReturns) × sqrt(252) × 100",
            note: complete
              ? "保守排除当日日线，使用此前21个完整交易日；前复权。"
              : "交易日历/历史样本不完整，或有缺失交易日，不能计算20日波动率。",
          },
        );
      } catch (err) {
        issues.push(
          `${code} 历史：${err instanceof Error ? err.message : "调用失败"}`,
        );
      }
    }
    return stock;
  });
  issues.push(
    "研究范围仅限所列股票，不代表全A股；未做ST、停牌、行业或新股排除。",
    "行情与估值时点是各响应批次的最大上游时间，接口未提供逐股时间；不宣称逐股实时。",
  );
  return {
    id: crypto.randomUUID(),
    mode: "live",
    stocks,
    requested: codes.length,
    scope: `自选A股研究池 · ${codes.length}只`,
    asOf: qAsOf,
    fetchedAt: new Date().toISOString(),
    issues,
  };
}
