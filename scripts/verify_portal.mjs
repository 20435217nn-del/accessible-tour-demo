import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';


const require = createRequire(import.meta.url);
const sharedNodeModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10189\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const { chromium } = require(path.join(sharedNodeModules, '.pnpm', 'playwright@1.61.1', 'node_modules', 'playwright'));

const root = path.resolve(import.meta.dirname, '..');
const target = pathToFileURL(path.join(root, 'index.html')).href;
const screenshotDir = path.join(root, 'output', 'html', 'screenshots');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

fs.mkdirSync(screenshotDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('request', (request) => {
  if (!request.url().startsWith('file:') && !request.url().startsWith('data:')) {
    errors.push(`network request: ${request.url()}`);
  }
});
page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`));

const viewports = [
  { width: 1440, height: 900, name: 'desktop', columns: 2 },
  { width: 768, height: 1024, name: 'tablet', columns: 1 },
  { width: 393, height: 852, name: 'mobile', columns: 1 },
  { width: 320, height: 700, name: 'narrow', columns: 1 }
];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(target, { waitUntil: 'load' });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    h1Count: document.querySelectorAll('h1').length,
    cardCount: document.querySelectorAll('.entry-card').length,
    cardBoxes: [...document.querySelectorAll('.entry-card')].map((card) => {
      const box = card.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }),
    imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    remoteResources: [...document.querySelectorAll('[src], [href]')]
      .map((node) => node.getAttribute('src') || node.getAttribute('href'))
      .filter((value) => /^https?:/i.test(value || '')),
    linkTargets: [...document.querySelectorAll('.entry-card')].map((link) => link.getAttribute('target'))
  }));

  check(metrics.scrollWidth <= metrics.clientWidth + 1, `${viewport.name} has horizontal overflow`);
  check(metrics.h1Count === 1, `${viewport.name} must contain exactly one H1`);
  check(metrics.cardCount === 2, `${viewport.name} must contain two entry cards`);
  check(metrics.imagesLoaded, `${viewport.name} has an unloaded preview image`);
  check(metrics.remoteResources.length === 0, `${viewport.name} contains a remote resource`);
  check(metrics.linkTargets.every((value) => !value), `${viewport.name} entry cards must navigate in the current tab`);

  const [demoBox, prdBox] = metrics.cardBoxes;
  if (viewport.columns === 2) {
    check(Math.abs(demoBox.y - prdBox.y) <= 1 && demoBox.x < prdBox.x, 'desktop cards must be arranged Demo-left and PRD-right');
  } else {
    check(demoBox.y < prdBox.y, `${viewport.name} cards must stack Demo before PRD`);
  }

  for (const entry of ['demo', 'prd']) {
    const card = page.locator(`.entry-card[data-entry="${entry}"]`);
    await card.focus();
    check(await card.evaluate((element) => element === document.activeElement), `${viewport.name} ${entry} card cannot receive keyboard focus`);
    const box = await card.boundingBox();
    check(box && box.width >= 44 && box.height >= 44, `${viewport.name} ${entry} card target is smaller than 44px`);
  }

  if (viewport.name === 'desktop') {
    await page.evaluate(() => document.activeElement?.blur());
    await page.screenshot({ path: path.join(screenshotDir, 'project-portal-desktop.png'), fullPage: false, scale: 'css' });
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(target, { waitUntil: 'load' });

const demoHref = await page.locator('.entry-card[data-entry="demo"]').getAttribute('href');
const prdHref = await page.locator('.entry-card[data-entry="prd"]').getAttribute('href');
check(demoHref === 'demo/index.html', `Demo href is incorrect: ${demoHref}`);
check(prdHref === 'output/html/零里说-无障碍在线导览-PRD.html', `PRD href is incorrect: ${prdHref}`);
check(await page.locator('.entry-card[data-entry="demo"] img').getAttribute('src') === 'demo/screenshots/iphone16-next-guide-transition.png', 'Demo card must preview the next-guide map transition');
check((await page.locator('#demo-description').textContent()).includes('回到地图选择下一站'), 'Demo card must explain the next-guide map transition');
check((await page.locator('.delivery-note').textContent()).includes('下一站按演示顺序推荐'), 'portal delivery boundary must distinguish the Demo sequence from a live recommendation');

await page.locator('.entry-card[data-entry="demo"]').click();
await page.waitForSelector('.map-area');
check(decodeURIComponent(new URL(page.url()).pathname).endsWith('/demo/index.html'), 'Demo card did not open the Demo HTML');
const demoHome = page.locator('.project-home-link');
check(await demoHome.count() === 1, 'Demo is missing the project home control');
check(await demoHome.getAttribute('href') === '../index.html', 'Demo project home href is incorrect');
const demoHomeBox = await demoHome.boundingBox();
check(demoHomeBox && demoHomeBox.width >= 44 && demoHomeBox.height >= 44, 'Demo project home target is smaller than 44px');
await demoHome.click();
await page.waitForSelector('.entry-grid');
check(decodeURIComponent(new URL(page.url()).pathname).endsWith('/index.html'), 'Demo project home control did not return to the portal');

await page.locator('.entry-card[data-entry="prd"]').click();
await page.waitForSelector('.document-shell');
check(decodeURIComponent(new URL(page.url()).pathname).endsWith('/output/html/零里说-无障碍在线导览-PRD.html'), 'PRD card did not open the PRD HTML');
const prdHome = page.locator('.project-home-link');
check(await prdHome.count() === 1, 'PRD is missing the project home control');
check(await prdHome.getAttribute('href') === '../../index.html', 'PRD project home href is incorrect');
const prdHomeBox = await prdHome.boundingBox();
check(prdHomeBox && prdHomeBox.width >= 44 && prdHomeBox.height >= 44, 'PRD project home target is smaller than 44px');
await prdHome.click();
await page.waitForSelector('.entry-grid');
check(decodeURIComponent(new URL(page.url()).pathname).endsWith('/index.html'), 'PRD project home control did not return to the portal');

await browser.close();

if (errors.length) {
  console.error(`Portal verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Portal verification passed (${viewports.length} viewports, two complete navigation loops).`);
console.log(`Screenshot: ${path.join(screenshotDir, 'project-portal-desktop.png')}`);
