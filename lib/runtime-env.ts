import { AsyncLocalStorage } from "node:async_hooks";
const runtime = new AsyncLocalStorage<Record<string, unknown>>();
export function withRuntime<T>(env: Record<string, unknown>, fn: () => T): T {
  return runtime.run(env, fn);
}
export function serverEnv(key: string): string {
  const value = runtime.getStore()?.[key] ?? process.env[key];
  return typeof value === "string" ? value : "";
}
