import { chromium } from "playwright";

const ids = [
  "shacl-renderer-shacl-1-2-core-6-validation-and-graphs-6-7-validation-report-6-7-2-validation-result-6-7-2-8-sh-resultseverity--sh-severity-a",
  "shacl-renderer-shacl-1-2-core-6-validation-and-graphs-6-7-validation-report-6-7-2-validation-result-6-7-2-8-sh-resultseverity--sh-severity-b",
  "shacl-renderer-shacl-1-2-core-6-validation-and-graphs-6-7-validation-report-6-7-2-validation-result-6-7-2-8-sh-resultseverity--sh-severity-c",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 400 } });

for (const id of ids) {
  await page.goto(`http://localhost:6006/iframe.html?id=${id}&viewMode=story`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `/tmp/claude-1000/-home-daniel-Development-ShapeThing-SHACL-renderer/9a3f5717-67cb-4441-97b8-ca4f613e2e45/scratchpad/tint-${id.split("--")[1]}.png`,
  });
}

await browser.close();
console.log("done");
