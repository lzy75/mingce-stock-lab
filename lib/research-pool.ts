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

// This is the transport batch size, never a cap on the user's complete pool.
export const MARKET_BATCH_SIZE = 20;
export function parseCodes(value: unknown): string[] {
  if (value === undefined) return DEFAULT_CODES;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((x) => typeof x !== "string" || !/^\d{6}\.(SH|SZ|BJ)$/.test(x))
  ) {
    const error = new Error(
      "请输入标准A股代码，例如600519.SH；支持逗号、空格或换行分隔。",
    ) as Error & { code: string };
    error.code = "INVALID_CODES";
    throw error;
  }
  return [...new Set(value as string[])];
}
export function parsePoolText(text: string): string[] {
  return parseCodes(
    text
      .toUpperCase()
      .split(/[,，\s]+/)
      .filter(Boolean),
  );
}
