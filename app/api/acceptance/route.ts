import { POST as parsePost } from "../parse/route";
import { gate, json, readBody, RequestError } from "@/lib/http";
import { serverEnv } from "@/lib/runtime-env";
import { loadMarket } from "@/lib/fuyao";
import { METRICS, type Metric, type ParsedIntent } from "@/lib/domain";
import { researchScenarios, CASE_CODES } from "@/lib/scenarios";
import { verifyCase } from "@/lib/verification";
let cache: { at: number; value: Record<string, unknown> } | null = null;
export async function POST(request: Request) {
  const denied = gate(request, 3);
  if (denied) return denied;
  try {
    await readBody(request);
    if (
      !serverEnv("AI_API_KEY") ||
      !serverEnv("AI_MODEL") ||
      !serverEnv("FUYAO_API_KEY")
    )
      return json(
        { error: "需先配置模型与金融数据服务端授权", code: "NOT_CONFIGURED" },
        503,
      );
    if (cache && Date.now() - cache.at < 60000)
      return json({ ...cache.value, cached: true });
    const verificationId = crypto.randomUUID(),
      at = new Date().toISOString();
    const scenes = researchScenarios.filter((s) =>
      ["balanced", "cash", "trend"].includes(s.id),
    );
    const parsed: ParsedIntent[] = [];
    for (const scene of scenes) {
      const response = await parsePost(
        new Request(new URL("/api/parse", request.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(request.headers.get("cf-connecting-ip")
              ? { "cf-connecting-ip": request.headers.get("cf-connecting-ip")! }
              : {}),
          },
          body: JSON.stringify({ intent: scene.question }),
        }),
      );
      const body = (await response.json()) as ParsedIntent & { error?: string };
      if (!response.ok) throw Error(body.error || "模型解析失败");
      parsed.push(body as ParsedIntent);
    }
    const snapshot = await loadMarket(
      serverEnv("FUYAO_API_KEY"),
      CASE_CODES,
      Object.keys(METRICS) as Metric[],
      fetch,
      serverEnv("FUYAO_TRANSPORT") === "rest" ? "rest" : "mcp",
    );
    const cases = scenes.map((scene, i) =>
      verifyCase(scene.id, scene.title, parsed[i], snapshot),
    );
    const value = {
      schema: "mingce-acceptance-v2",
      verificationId,
      at,
      completedAt: new Date().toISOString(),
      state: cases.some((c) => c.state === "partial") ? "partial" : "passed",
      metricCount: Object.keys(METRICS).length,
      snapshotId: snapshot.id,
      snapshotAt: snapshot.asOf,
      fetchedAt: snapshot.fetchedAt,
      transport: [
        ...new Set(
          snapshot.stocks.flatMap((s) =>
            Object.values(s.metrics).map((e) => e?.transport),
          ),
        ),
      ],
      cases,
      accountSync: {
        state: "unavailable",
        reason: "当前授权仅支持金融数据读取，缺少目标账户写入及回读接口",
      },
    };
    cache = { at: Date.now(), value };
    console.info(
      JSON.stringify({
        event: "mingce_acceptance",
        verificationId,
        state: value.state,
        cases: cases.map((c) => ({
          id: c.caseId,
          counts: c.counts,
          engine: c.engine,
          model: c.model,
        })),
      }),
    );
    return json({ ...value, cached: false });
  } catch (error) {
    if (error instanceof RequestError)
      return json({ error: error.message }, error.status);
    return json(
      {
        error: error instanceof Error ? error.message : "真实案例验收失败",
        code: "ACCEPTANCE_FAILED",
      },
      502,
    );
  }
}
