import { readFile, readdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";
let vars = {};
try {
  vars = parseEnv(await readFile(".dev.vars", "utf8"));
} catch {}
const secrets = Object.entries(vars)
  .filter(([k, v]) => /KEY|TOKEN|SECRET/.test(k) && v.length > 12)
  .map(([, v]) => v);
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const files = [...tracked];
async function walk(dir) {
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = dir + "/" + e.name;
      if (e.isDirectory()) await walk(p);
      else files.push(p);
    }
  } catch {}
}
await walk("dist/client");
const hits = [];
for (const file of files) {
  try {
    const text = await readFile(file, "utf8");
    if (secrets.some((s) => text.includes(s))) hits.push(file);
  } catch {}
}
const envTracked = tracked.filter((x) =>
  /^\.dev\.vars|^\.env(?!\.example$)|\.local\.json$/.test(x),
);
if (hits.length || envTracked.length) {
  console.error("Secret/config leak detected in files:", [
    ...new Set([...hits, ...envTracked]),
  ]);
  process.exit(1);
}
console.log(
  `PASS: scanned ${files.length} tracked/client files; no configured secrets or local data reports included.`,
);
