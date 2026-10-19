import { runDiagnostics } from "@/lib/diagnostics";
import { json } from "@/lib/http";
export async function GET() {
  return json(await runDiagnostics());
}
