import { METRICS } from "@/lib/domain";
import { serverEnv } from "@/lib/runtime-env";
import { json } from "@/lib/http";
export async function GET() {
  return json({
    metricCount: Object.keys(METRICS).length,
    capabilities: { marketRead: true, accountWrite: false },
    dataConfigured: !!serverEnv("FUYAO_API_KEY"),
    aiConfigured: !!serverEnv("AI_API_KEY") && !!serverEnv("AI_MODEL"),
    dataTransport: serverEnv("FUYAO_TRANSPORT") === "rest" ? "REST" : "MCP",
    aiKeyPresent: !!serverEnv("AI_API_KEY"),
    aiModel: serverEnv("AI_MODEL") || null,
    provider: "扶摇 / 同花顺",
    scope: "自选研究池，最多20只",
    time: new Date().toISOString(),
  });
}
