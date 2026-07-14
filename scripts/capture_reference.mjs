import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharedNodeModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10189\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const { chromium } = require(path.join(sharedNodeModules, '.pnpm', 'playwright@1.61.1', 'node_modules', 'playwright'));

const output = path.resolve(import.meta.dirname, '..', 'demo', 'screenshots', 'reference');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  screen: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  colorScheme: 'light'
});
const page = await context.newPage();
await page.goto(process.env.REFERENCE_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
const shot = (name) => page.screenshot({ path: path.join(output, name) });

await shot('iphone16-map-guide.png');
await page.getByRole('tab', { name: '便民服务' }).click();
await page.waitForTimeout(350);
await shot('iphone16-map-service.png');
await page.getByRole('tab', { name: '无障碍服务' }).click();
await page.waitForTimeout(350);
await shot('iphone16-map-accessible.png');
await page.getByRole('tab', { name: '听讲解' }).click();
await page.locator('main[aria-label="示意地图"] + div button').first().click();
await page.waitForTimeout(550);
await shot('iphone16-permission.png');
await page.getByRole('button', { name: '允许定位' }).click();
await page.waitForTimeout(550);
await shot('iphone16-nearest-guide.png');
await page.getByRole('button', { name: '听讲解' }).last().click();
await shot('iphone16-guide-detail.png');
await page.getByRole('button', { name: '完成讲解，查看下一步' }).click();
await page.waitForTimeout(550);
await shot('iphone16-next-steps.png');
await page.getByRole('button', { name: /同源馆坡板/ }).click();
await shot('iphone16-service-detail.png');
await page.getByRole('button', { name: '前往同源馆坡板' }).click();
await shot('iphone16-voice-guidance.png');

await browser.close();
console.log(`Reference screenshots written to ${output}`);
