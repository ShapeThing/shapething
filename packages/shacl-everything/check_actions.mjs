import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:6015/?path=/story/shacl-renderer-functionality-submitting-the-edit-form--submitting-hands-back-the-data-graph-as-a-new-store', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const frame = page.frameLocator('#storybook-preview-iframe');
await frame.getByRole('button', { name: 'Update' }).click({ timeout: 10000 });
await page.waitForTimeout(1500);

await page.locator('[data-key="storybook/actions/panel"]').click({ timeout: 10000, force: true });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'actions-panel.png', fullPage: true });
console.log('done');

await browser.close();
