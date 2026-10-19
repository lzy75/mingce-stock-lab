import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const startedAt = new Date().toISOString();
const r = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-reporter=tap",
    "tests/data.test.mjs",
    "tests/domain.test.mjs",
    "tests/features.test.mjs",
  ],
  { encoding: "utf8" },
);
const report = `# Test run started: ${startedAt}\n# Command: node --test tests/*.test.mjs\n${r.stdout}${r.stderr}\n# Exit code: ${r.status}\n# Finished: ${new Date().toISOString()}\n`;
writeFileSync("docs/test-results.tap", report);
process.stdout.write(report);
process.exit(r.status ?? 1);
