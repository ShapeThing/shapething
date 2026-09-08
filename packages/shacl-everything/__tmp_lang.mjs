import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const url = `http://localhost:6006/iframe.html?id=showcases--recipes-and-chefs&viewMode=story`;
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const selects = await page.locator("select").all();
console.log("select count", selects.length);
// second select should be Content language
await page.selectOption("select >> nth=1", { label: "Dutch" }).catch(async (e) => {
  console.log("label Dutch failed, trying nl-NL", e.message);
  await page.selectOption("select >> nth=1", { value: "nl-NL" });
});
await page.waitForTimeout(800);
await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close();
