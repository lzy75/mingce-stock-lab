const ORIGIN = "https://fuyao.aicubes.cn";
type Rpc = {
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string };
  id?: number;
};
export class McpHttpError extends Error {
  code: string;
  requestId?: string;
  constructor(status: number, requestId?: string, edgeCode?: string) {
    const hint =
      status === 530
        ? `，上游域名解析异常${edgeCode ? `（${edgeCode}）` : ""}，请稍后重试`
        : status === 429
          ? "，请稍后重试"
          : "";
    super(`扶摇MCP HTTP ${status}${hint}`);
    this.name = "McpHttpError";
    this.code = "MCP_HTTP_" + status;
    this.requestId = requestId;
  }
}
export function decodeRpc(text: string): Rpc {
  if (text.trim().startsWith("{")) return JSON.parse(text);
  for (const event of text.split(/\r?\n\r?\n/).reverse()) {
    const body = event
      .split(/\r?\n/)
      .filter((x) => x.startsWith("data:"))
      .map((x) => x.slice(5).trim())
      .join("\n");
    if (body) {
      try {
        const value = JSON.parse(body);
        if (value.result || value.error) return value;
      } catch {}
    }
  }
  throw new Error("MCP响应不是有效JSON-RPC或SSE消息");
}
export class FuyaoMcp {
  key: string;
  fetcher: typeof fetch;
  session: string | null = null;
  protocol = "2025-03-26";
  serial = 0;
  tools: string[] = [];
  ready: Promise<void> | null = null;
  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }
  async rpc(
    method: string,
    params: Record<string, unknown>,
    notification = false,
  ) {
    const response = await this.fetcher(ORIGIN + "/mcp/a-share", {
      method: "POST",
      headers: {
        "X-api-key": this.key,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(this.session ? { "Mcp-Session-Id": this.session } : {}),
        ...(method !== "initialize"
          ? { "MCP-Protocol-Version": this.protocol }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        ...(notification ? {} : { id: ++this.serial }),
        method,
        params,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      // Keep only diagnostic codes; never return upstream HTML, headers or credentials.
      let edgeCode: string | undefined;
      if (response.status === 530) {
        const body = await response.text();
        edgeCode = /\b(?:error code:\s*|Error\s+)(1\d{3})\b/i.exec(body)?.[1];
      }
      throw new McpHttpError(
        response.status,
        response.headers.get("cf-ray") ?? undefined,
        edgeCode,
      );
    }
    const session = response.headers.get("mcp-session-id");
    if (session) this.session = session;
    if (notification) return {};
    const rpc = decodeRpc(await response.text());
    if (rpc.error)
      throw new Error(`MCP工具调用失败（${rpc.error.code ?? "未知"}）`);
    if (!rpc.result) throw new Error("MCP未返回result");
    return rpc.result;
  }
  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (!this.key) throw new Error("尚未配置扶摇MCP授权");
      const initialized = await this.rpc("initialize", {
        protocolVersion: this.protocol,
        capabilities: {},
        clientInfo: { name: "mingce-stock-lab", version: "1.0.0" },
      });
      if (typeof initialized.protocolVersion === "string")
        this.protocol = initialized.protocolVersion;
      await this.rpc("notifications/initialized", {}, true);
      const listed = await this.rpc("tools/list", {});
      if (!Array.isArray(listed.tools)) throw new Error("MCP工具列表结构无效");
      this.tools = listed.tools.map((t) => (t as { name: string }).name);
    })();
    try {
      await this.ready;
    } catch (e) {
      this.ready = null;
      throw e;
    }
  }
  async call(name: string, args: Record<string, unknown>) {
    await this.init();
    if (!this.tools.includes(name))
      throw new Error("MCP未公开所需数据工具：" + name);
    const result = await this.rpc("tools/call", { name, arguments: args });
    if (result.isError) throw new Error("MCP工具返回业务错误");
    const structured = result.structuredContent;
    if (structured && typeof structured === "object")
      return structured as Record<string, unknown>;
    if (Array.isArray(result.content)) {
      for (const content of result.content) {
        const c = content as { type?: string; text?: string };
        if (c.type === "text" && typeof c.text === "string") {
          try {
            return JSON.parse(c.text) as Record<string, unknown>;
          } catch {}
        }
      }
    }
    throw new Error("MCP工具响应未包含可解析的结构化数据");
  }
}
export const MCP_TOOLS: Record<string, string> = {
  "/api/a-share/prices/snapshot": "get_a_share_prices_snapshot",
  "/api/a-share/valuations/snapshot": "get_a_share_valuations_snapshot",
  "/api/a-share/financials/income-statements":
    "get_a_share_financials_income_statements",
  "/api/a-share/calendar/trading-days": "get_a_share_calendar_trading_days",
  "/api/a-share/prices/historical": "get_a_share_prices_historical",
};
export function mcpArguments(path: string) {
  const url = new URL(path, ORIGIN);
  const name = MCP_TOOLS[url.pathname];
  if (!name) throw new Error("不允许调用此MCP工具");
  const args: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams)
    args[k] = ["start", "end", "limit", "offset"].includes(k) ? Number(v) : v;
  return { name, args };
}
