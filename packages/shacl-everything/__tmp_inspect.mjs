import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const url = `http://localhost:6006/iframe.html?id=showcases--recipes-and-chefs&viewMode=story`;
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const html = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll(".st-form-element"));
  const match = labels.find((el) => el.textContent?.includes("Prep time"));
  return match ? match.outerHTML : "NOT FOUND";
});
console.log(html);
await browser.close();
