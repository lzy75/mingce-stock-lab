import { spawnSync } from "node:child_process";
import { writeFileSync, readdirSync, mkdirSync } from "node:fs";
const startedAt = new Date().toISOString();
const r = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-reporter=tap",
    ...readdirSync("tests")
      .filter((name) => name.endsWith(".test.mjs"))
      .map((name) => "tests/" + name),
  ],
  { encoding: "utf8" },
);
const report = `# Test run started: ${startedAt}\n# Command: node --test tests/*.test.mjs\n${r.stdout}${r.stderr}\n# Exit code: ${r.status}\n# Finished: ${new Date().toISOString()}\n`;
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/test-results.tap", report);
process.stdout.write(report);
process.exit(r.status ?? 1);
