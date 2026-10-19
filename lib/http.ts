const requests = new Map<string, { start: number; count: number }>();
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function gate(request: Request, limit = 30): Response | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "仅接受本站请求" }, 403);
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const key = new URL(request.url).pathname + ip;
  const now = Date.now();
  let current = requests.get(key);
  if (!current || now - current.start > 60000) {
    current = { start: now, count: 0 };
    requests.set(key, current);
  }
  if (++current.count > limit)
    return json({ error: "请求过于频繁，请一分钟后重试" }, 429);
  if (requests.size > 1000) requests.clear();
  return null;
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 12000) throw new Error("请求内容过长");
  return JSON.parse(text);
}
