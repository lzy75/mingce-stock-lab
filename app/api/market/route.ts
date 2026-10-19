import { loadMarket, parseCodes, DataError } from "@/lib/fuyao";
import { MARKET_BATCH_SIZE } from "@/lib/research-pool";
import { METRICS, type Metric } from "@/lib/domain";
import { serverEnv } from "@/lib/runtime-env";
import { gate, json, readBody, RequestError } from "@/lib/http";
export async function POST(request: Request) {
  const blocked = gate(request, 30);
  if (blocked) return blocked;
  try {
    const body = await readBody(request);
    const codes = parseCodes(body.codes);
    if (codes.length > MARKET_BATCH_SIZE)
      return json(
        {
          error: `单批最多${MARKET_BATCH_SIZE}只；网页将自动分批读取完整研究池。`,
        },
        400,
      );
    const metrics = body.metrics ?? Object.keys(METRICS);
    if (
      !Array.isArray(metrics) ||
      !metrics.length ||
      metrics.length > Object.keys(METRICS).length ||
      metrics.some((m) => typeof m !== "string" || !Object.hasOwn(METRICS, m))
    )
      return json({ error: "存在未知指标" }, 400);
    return json(
      await loadMarket(
        serverEnv("FUYAO_API_KEY"),
        codes,
        metrics as Metric[],
        fetch,
        serverEnv("FUYAO_TRANSPORT") === "rest" ? "rest" : "mcp",
      ),
    );
  } catch (error) {
    if (error instanceof RequestError)
      return json({ error: error.message }, error.status);
    const err = error as DataError;
    return json(
      {
        error: err.message || "读取数据失败",
        code: err.code ?? "INVALID_REQUEST",
        requestId: err.requestId ?? null,
      },
      err.code === "NOT_CONFIGURED"
        ? 503
        : err.code === "INVALID_CODES"
          ? 400
          : err instanceof SyntaxError
            ? 400
            : 502,
    );
  }
}
