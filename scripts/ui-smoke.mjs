import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "app/page.tsx",
    includes: ["home-hero", "hero-card", "segmented", "tx-row"],
  },
  {
    file: "app/history/page.tsx",
    includes: ["history-toolbar", "segmented", "tx-row", "history-footer"],
  },
  {
    file: "app/pools/page.tsx",
    includes: ["metric-grid", "metric-card", "metric-details", "metric-helper"],
  },
  {
    file: "app/rules/page.tsx",
    includes: ["rules-hero", "hero-card", "metric-card", "form-grid"],
  },
  {
    file: "app/fixed-costs/page.tsx",
    includes: ["fixed-row", "fixed-list", "segmented", "hero-card"],
  },
  {
    file: "app/globals.css",
    includes: [
      ".hero-card",
      ".metric-card",
      ".tx-row",
      ".pill",
      ".segmented",
      ".alert-error",
    ],
  },
];

const failures = [];

for (const { file, includes } of checks) {
  const fullPath = path.join(root, file);
  const content = fs.readFileSync(fullPath, "utf8");
  for (const needle of includes) {
    if (!content.includes(needle)) {
      failures.push(`${file} missing "${needle}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("UI smoke check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("UI smoke check passed.");
