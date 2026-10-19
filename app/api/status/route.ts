import { serverEnv } from "@/lib/runtime-env";
import { json } from "@/lib/http";
export async function GET() {
  return json({
    dataConfigured: !!serverEnv("FUYAO_API_KEY"),
    aiConfigured: !!serverEnv("AI_API_KEY"),
    aiModel: serverEnv("AI_MODEL") || null,
    provider: "扶摇 / 同花顺",
    scope: "自选研究池，最多20只",
    time: new Date().toISOString(),
  });
}
