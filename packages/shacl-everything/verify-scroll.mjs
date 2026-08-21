import { chromium } from "playwright";

const url =
  "http://localhost:6006/?path=/story/shacl-renderer-shacl-1-2-ui-10-built-in-widgets-10-1-editors-10-1-1-shui-autocompleteeditor--shui-auto-complete-editor-federated-search";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on("console", (msg) => console.log("PAGE:", msg.text()));
page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));

await page.goto(url, { waitUntil: "networkidle" });

// Click the "Turtle" addon panel tab in the manager UI.
const tab = page.getByRole("tab", { name: "Turtle" });
await tab.waitFor({ state: "visible", timeout: 15000 });
await tab.click();

// Wait for the body <pre> to render with our content.
await page.waitForSelector("text=philosopherShape", { timeout: 15000 });

await page.screenshot({ path: "debug-panel.png", fullPage: true });
const panelHtml = await page.locator("pre").last().evaluate((el) => el.outerHTML);
console.log("PANEL HTML:\n", panelHtml);

// Locate the reference link (inside sh:node <#philosopherShape> ;) - should now be an <a>.
const refLink = page.locator("a:has-text('#philosopherShape')").first();
await refLink.waitFor({ state: "visible", timeout: 10000 });

const hrefBefore = await refLink.getAttribute("href");
console.log("ref link href:", hrefBefore);

// Confirm there's a definition anchor target somewhere with a matching id.
const targetId = hrefBefore.replace("#", "");
const targetExists = await page.locator(`#${targetId}`).count();
console.log("target element count for id", targetId, ":", targetExists);

// Get scrollTop of the scrollable <pre> before click.
const pre = page.locator("pre").filter({ hasText: "philosopherShape" }).last();
const scrollBefore = await pre.evaluate((el) => el.scrollTop);
console.log("scrollTop before:", scrollBefore);

await refLink.click();
await page.waitForTimeout(500);

const scrollAfter = await pre.evaluate((el) => el.scrollTop);
console.log("scrollTop after:", scrollAfter);

const bg = await page.locator(`#${targetId}`).evaluate((el) => el.style.backgroundColor);
console.log("definition element background after click (flash):", bg);

await page.screenshot({ path: "/tmp/claude-1000/-home-daniel-Development-ShapeThing-SHACL-renderer/c30d10db-b817-432b-a427-a2a094bd1ce3/scratchpad/after-click.png" });

await browser.close();
