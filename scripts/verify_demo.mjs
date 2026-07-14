import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharedNodeModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10189\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const { chromium } = require(path.join(sharedNodeModules, '.pnpm', 'playwright@1.61.1', 'node_modules', 'playwright'));

const root = path.resolve(import.meta.dirname, '..');
const target = pathToFileURL(path.join(root, 'demo', 'index.html')).href;
const screenshotDir = path.join(root, 'demo', 'screenshots');
const sourceAssets = 'C:\\Users\\10189\\Downloads\\无障碍在线导览界面设计\\src\\imports';
const demoAssets = path.join(root, 'demo', 'assets', 'figma-make');
fs.mkdirSync(screenshotDir, { recursive: true });

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const sourceFiles = fs.readdirSync(sourceAssets).filter((name) => name.endsWith('.png')).sort();
const copiedFiles = fs.readdirSync(demoAssets).filter((name) => name.endsWith('.png')).sort();
check(sourceFiles.length === 17, `reference must contain 17 PNG files, got ${sourceFiles.length}`);
check(JSON.stringify(sourceFiles) === JSON.stringify(copiedFiles), 'copied PNG filename set differs from reference');
for (const file of sourceFiles) {
  check(digest(path.join(sourceAssets, file)) === digest(path.join(demoAssets, file)), `asset hash mismatch: ${file}`);
}

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
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('request', (request) => {
  if (!request.url().startsWith('file:') && !request.url().startsWith('data:')) errors.push(`network request: ${request.url()}`);
});

const shot = async (name, options = {}, targetPage = page) => {
  await targetPage.waitForTimeout(520);
  const homeLink = targetPage.locator('.project-home-link');
  if (await homeLink.count()) await homeLink.evaluate((element) => { element.style.visibility = 'hidden'; });
  const buffer = await targetPage.screenshot(options);
  if (await homeLink.count()) await homeLink.evaluate((element) => { element.style.removeProperty('visibility'); });
  const output = path.join(screenshotDir, name);
  try {
    fs.writeFileSync(output, buffer);
  } catch (error) {
    const fallback = path.join(screenshotDir, name.replace('.png', `-${Date.now()}.png`));
    fs.writeFileSync(fallback, buffer);
    console.warn(`Screenshot was locked; wrote ${fallback} instead (${error.code}).`);
  }
};

await page.goto(target, { waitUntil: 'load' });
await page.waitForSelector('.map-area');
const projectHome = page.locator('.project-home-link');
check(await projectHome.count() === 1, 'Demo must expose one project home control');
check(await projectHome.getAttribute('href') === '../index.html', 'Demo project home href is incorrect');
const projectHomeBox = await projectHome.boundingBox();
check(projectHomeBox && projectHomeBox.width >= 44 && projectHomeBox.height >= 44, 'Demo project home target must be at least 44px');
check(await page.locator('.phone-shell').count() === 1, 'expected one phone interface');
check((await page.locator('.phone-shell').boundingBox())?.width === 393, 'main artboard must be 393 CSS px wide');
check((await page.locator('.phone-shell').boundingBox())?.height === 852, 'main artboard must be 852 CSS px high');
check((await page.locator('.device-frame').boundingBox())?.width === 393, 'mobile frame must match the 393px viewport');
check(await page.locator('.device-frame').evaluate((el) => getComputedStyle(el).borderRadius === '0px'), 'mobile viewport must not show the desktop device frame');
check(await page.locator('.device-overlay').evaluate((el) => getComputedStyle(el).display === 'none'), 'mobile viewport must hide the simulated device chrome');
check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'horizontal overflow at 393px');
check(!(await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)), 'vertical overflow at 393x852');
check(await page.evaluate(() => window.ZERO_MILE_DATA.nearbyFacilities.map((point) => point.id).join('|')) === 's3|s1|r5', 'nearby facility Demo path is wrong');
check(await page.evaluate(() => window.ZERO_MILE_DATA.guideSequence.join('|')) === Array.from({ length: 15 }, (_, index) => `g${index + 1}`).join('|'), 'guide presentation sequence is wrong');
check(await page.evaluate(() => window.ZERO_MILE_DATA.guides.find((guide) => guide.id === 'g6')?.nextGuideId) === 'g7', 'South Gate product data must map to 书院广场');
check(await page.evaluate(() => window.ZERO_MILE_DATA.guides.find((guide) => guide.id === 'g15')?.nextGuideId) === 'g1', 'guide product data must wrap from g15 to g1');
check((await page.locator('.filter-tab').allTextContents()).join('|') === '讲解点|便民服务|无障碍服务', 'filter labels do not match the Demo flow');
check(await page.locator('.marker-guide').count() === 15, 'guide filter must show 15 guide icons');
for (let index = 1; index <= 15; index += 1) {
  check((await page.locator(`[data-id="g${index}"] img`).getAttribute('src')) === `assets/figma-make/___${index}.png`, `g${index} icon mapping is wrong`);
}
await page.locator('[data-id="g1"]').click();
check(await page.locator('.map-view').count() === 1, 'first guide marker click must stay on the map');
check((await page.locator('[data-id="g1"] .marker-tooltip').textContent()).trim() === '县衙', 'first guide marker click must reveal its place name');
check(await page.locator('[data-id="g1"]').getAttribute('aria-pressed') === 'true', 'first guide marker click must expose selected state');
await page.locator('[data-id="g1"]').click();
await page.waitForSelector('.detail-view');
check((await page.locator('.detail-header h1').textContent()).trim() === '县衙', 'second guide marker click must open its detail');
await page.locator('[data-action="back-map"]').click();
check(await page.locator('[data-id="g1"]').evaluate((el) => el === document.activeElement), 'return must restore guide marker focus');

const locateButton = page.locator('[data-action="locate"]');
await locateButton.click();
check(await locateButton.getAttribute('aria-busy') === 'true', 'locate must expose aria-busy while resolving');
check((await locateButton.textContent()).trim() === '定位中', 'locate must expose a clear pending label');
await locateButton.dispatchEvent('click');
check(await page.locator('.location-marker').count() === 0, 'duplicate locate clicks must not complete early');
await page.waitForSelector('.location-marker');
check((await page.locator('.toast').textContent()).includes('已定位到当前位置'), 'locate completion toast is missing');
check(await locateButton.evaluate((el) => el === document.activeElement), 'locate completion must preserve button focus');
await shot('iphone16-map-guide.png');

await page.locator('[data-filter="service"]').click();
await page.waitForTimeout(350);
check(await page.locator('.marker-service').count() === 2, 'service filter must show 2 service markers');
check(await page.locator('.marker-wc').count() === 3, 'service filter must show 3 WC markers');
check((await page.locator('.map-legend').textContent()).includes('行李寄存位置确认中'), 'luggage pending note is missing');
await shot('iphone16-map-service.png');

await page.locator('[data-id="s3"]').click();
check(await page.locator('.service-detail').count() === 0, 'first service marker click must stay on the map');
check((await page.locator('[data-id="s3"] .marker-tooltip').textContent()).trim() === '南门洗手间', 'first service marker click must reveal its place name');
check(await page.locator('[data-id="s3"]').getAttribute('aria-pressed') === 'true', 'first service marker click must expose selected state');
await page.locator('[data-id="s3"]').click();
await page.waitForSelector('.service-detail');
await page.locator('[data-action="back-map"]').click();
check(await page.locator('[data-filter="service"]').getAttribute('aria-selected') === 'true', 'return must preserve service filter');
check(await page.locator('[data-id="s3"]').getAttribute('aria-pressed') === 'true', 'return must preserve selected point');
check(await page.locator('[data-id="s3"]').evaluate((el) => el === document.activeElement), 'return must restore point focus');

await page.locator('[data-filter="accessible"]').click();
await page.waitForTimeout(350);
check(await page.locator('.marker-wc').count() === 3, 'accessible filter must show 3 WC markers');
check(await page.locator('.marker-ramp').count() === 5, 'accessible filter must show 5 ramp markers');
check(await page.locator('.nearby-facility-sheet.is-open').count() === 0, 'top accessible filter must not open nearby facilities');
await shot('iphone16-map-accessible.png');

await page.locator('[data-filter="guide"]').click();
const nearbyButton = page.locator('[data-action="nearby-facilities"]');
check((await nearbyButton.textContent()).trim() === '附近设施', 'bottom shortcut must be named 附近设施');
check(await nearbyButton.locator('svg').count() === 1, 'nearby facilities must keep the accessibility icon');
await nearbyButton.click();
check(await nearbyButton.getAttribute('aria-busy') === 'true', 'nearby facilities must expose aria-busy while searching');
check((await nearbyButton.textContent()).trim() === '正在查找', 'nearby facilities must expose a clear pending label');
await nearbyButton.dispatchEvent('click');
check(await page.locator('.nearby-facility-sheet.is-open').count() === 0, 'duplicate nearby clicks must not bypass the pending state');
await page.waitForSelector('.nearby-facility-sheet.is-open');
check(await page.locator('[data-filter="guide"]').getAttribute('aria-selected') === 'true', 'nearby facilities must not change the active top filter');
check(await page.locator('.nearby-facility-sheet.is-open').count() === 1, 'nearby facilities must open its own sheet');
check(await page.locator('.location-marker').count() === 1, 'nearby facilities must show the simulated current location');
check((await page.locator('#nearby-facility-title').textContent()).trim() === '南门洗手间', 'nearby facilities must start at 南门洗手间');
check((await page.locator('.nearby-facility-sheet .media-summary').textContent()).includes('无障碍卫生间'), 'South Gate facility type is wrong');
check(await page.locator('[data-id="s3"]').getAttribute('aria-pressed') === 'true', 'recommended facility must be visible and selected outside the active filter');
check(await page.locator('.nearby-facility-sheet [data-action="close-sheet"]').evaluate((el) => el === document.activeElement), 'opening nearby facilities must move focus into the dialog');
await page.locator('.nearby-facility-sheet [data-action="close-sheet"]').click();
await page.waitForSelector('.nearby-facility-sheet.is-open', { state: 'detached' });
check(await nearbyButton.evaluate((el) => el === document.activeElement), 'closing nearby facilities must restore shortcut focus');
await nearbyButton.click();
await page.waitForSelector('.nearby-facility-sheet.is-open');
await shot('iphone16-nearby-facility.png');

await page.locator('[data-action="skip-facility"]').click();
check((await page.locator('#nearby-facility-title').textContent()).trim() === '党群中心服务', 'first facility skip must recommend 党群中心服务');
check((await page.locator('.nearby-facility-sheet .media-summary').textContent()).includes('便民服务'), 'convenience service type is wrong');
check(await page.locator('[data-id="s1"]').getAttribute('aria-pressed') === 'true', 'convenience service marker must be visible and selected');
check(await page.locator('[data-action="skip-facility"]').evaluate((el) => el === document.activeElement), 'facility skip must preserve dialog focus');
await shot('iphone16-nearby-facility-next.png');

await page.locator('[data-action="skip-facility"]').click();
check((await page.locator('#nearby-facility-title').textContent()).trim() === '同源馆坡板', 'second facility skip must recommend 同源馆坡板');
check((await page.locator('.nearby-facility-sheet .media-summary').textContent()).includes('可提供坡板'), 'ramp facility type is wrong');
await page.locator('[data-action="skip-facility"]').click();
check((await page.locator('#nearby-facility-title').textContent()).trim() === '南门洗手间', 'facility sequence must wrap to 南门洗手间');
await page.locator('[data-action="skip-facility"]').click();
await page.locator('[data-action="skip-facility"]').click();
check((await page.locator('#nearby-facility-title').textContent()).trim() === '同源馆坡板', 'facility navigation target must be 同源馆坡板');
await page.locator('.nearby-facility-sheet [data-action="start-nav"]').click();
const sheetNavButton = page.locator('.nearby-facility-sheet [data-action="start-nav"]');
check(await sheetNavButton.getAttribute('aria-busy') === 'true', 'facility navigation must expose aria-busy while starting');
check((await sheetNavButton.textContent()).trim() === '正在启动', 'facility navigation must expose a clear pending label');
await sheetNavButton.dispatchEvent('click');
check(await page.locator('.voice-panel').count() === 0, 'duplicate navigation clicks must not complete early');
await page.waitForSelector('.voice-panel');
check(await page.locator('.service-detail').count() === 0, 'nearby facility navigation must not open service detail');
check(await page.locator('[data-filter="guide"]').getAttribute('aria-selected') === 'true', 'facility navigation must preserve the top filter');
check(await page.locator('[data-id="r5"]').getAttribute('aria-pressed') === 'true', 'navigation target marker must remain visible and selected');
check(await page.locator('.nav-path line').getAttribute('x2') === '50%', 'facility navigation path x target is wrong');
check(await page.locator('.nav-path line').getAttribute('y2') === '65%', 'facility navigation path y target is wrong');
await shot('iphone16-nearby-facility-guidance.png');
await page.locator('[data-action="end-nav"]').click();

const listenButton = page.locator('[data-action="listen"]');
await listenButton.click();
check(await listenButton.getAttribute('aria-busy') === 'true', 'listen must expose aria-busy while finding a guide');
check((await listenButton.textContent()).trim() === '正在查找', 'listen must expose a clear pending label');
await listenButton.dispatchEvent('click');
check(await page.locator('.nearest-sheet.is-open').count() === 0, 'duplicate listen clicks must not bypass the pending state');
await page.waitForSelector('.nearest-sheet.is-open');
check(await page.locator('.permission-sheet').count() === 0, 'Demo must not show the retired location permission sheet');
check(await page.locator('.nearest-sheet.is-open').count() === 1, 'listen must directly open the nearest guide sheet');
check(await page.locator('.location-marker').count() === 1, 'listen must show the simulated current location');
check((await page.locator('#nearest-title').textContent()).trim() === '南门', 'nearest guide must be 南门');
check(await page.locator('[data-id="g6"]').getAttribute('aria-pressed') === 'true', 'South Gate must be the selected simulated nearest guide');
await shot('iphone16-nearest-guide.png');

await page.locator('[data-action="skip-guide"]').click();
check(await page.locator('.nearest-sheet.is-open').count() === 1, 'skip must keep the nearest guide sheet open');
check((await page.locator('#nearest-title').textContent()).trim() === '书院广场', 'skip after South Gate must recommend 书院广场');
check(await page.locator('[data-id="g7"]').getAttribute('aria-pressed') === 'true', 'skip must select the next guide marker');
check(await page.locator('[data-action="skip-guide"]').evaluate((el) => el === document.activeElement), 'skip must preserve focus inside the dialog');
await shot('iphone16-nearest-guide-next.png');
await page.waitForTimeout(3100);
await page.locator('[data-action="open-recommended-guide"]').click();
await page.waitForSelector('.detail-view');
check((await page.locator('.detail-header h1').textContent()).trim() === '书院广场', 'listen after skip must open the recommended next guide');
await page.locator('[data-action="back-map"]').click();
await page.locator('[data-action="listen"]').click();
await page.waitForSelector('.nearest-sheet.is-open');
check((await page.locator('#nearest-title').textContent()).trim() === '南门', 'a new simulated location lookup must restart at South Gate');
await page.locator('[data-action="open-recommended-guide"]').click();
await page.waitForSelector('.detail-view');
check((await page.locator('.detail-header h1').textContent()).trim() === '南门', 'guide detail title is wrong');
await shot('iphone16-guide-detail.png');
await page.locator('[data-action="media-audio"]').click();
check(await page.locator('[data-action="media-audio"]').getAttribute('aria-pressed') === 'true', 'audio mode did not activate');
await page.locator('[data-action="toggle-play"]').click();
check((await page.locator('.media-time').textContent()).includes('01:24'), 'play state did not update');
await page.locator('[data-action="media-video"]').click();

await page.locator('[data-action="show-next"]').click();
check(await page.locator('.next-sheet.is-open').count() === 1, 'completion must open next steps sheet');
await shot('iphone16-next-steps.png');
await page.locator('[data-action="next-guide"]').click();
check(await page.locator('.map-view').count() === 1, 'next guide must return to the map transition view');
check(await page.locator('.detail-view').count() === 0, 'next guide must not jump directly to another detail');
check(await page.locator('[data-filter="guide"]').getAttribute('aria-selected') === 'true', 'next guide transition must activate the guide filter');
check(await page.locator('.nearest-sheet.is-open').count() === 1, 'next guide transition must open the guide recommendation sheet');
check((await page.locator('.nearest-sheet .sheet-kicker').textContent()).trim() === '下一个讲解点', 'next guide transition must use the next-guide label');
check((await page.locator('#nearest-title').textContent()).trim() === '书院广场', 'South Gate completion must recommend 书院广场');
check(await page.locator('[data-id="g7"]').getAttribute('aria-pressed') === 'true', 'South Gate completion must select the 书院广场 marker');
await shot('iphone16-next-guide-transition.png');
await page.locator('[data-action="open-recommended-guide"]').click();
await page.waitForSelector('.detail-view');
check((await page.locator('.detail-header h1').textContent()).trim() === '书院广场', 'next guide transition must open the 书院广场 detail');
await page.locator('[data-action="show-next"]').click();
check(await page.locator('.next-sheet.is-open').count() === 1, '书院广场 completion must still expose next steps');
await page.locator('[data-action="next-guide"]').click();
check((await page.locator('#nearest-title').textContent()).trim() === '五福临门', '书院广场 completion must advance to 五福临门');
await page.locator('[data-action="skip-guide"]').click();
check((await page.locator('#nearest-title').textContent()).trim() === '九街糖水', 'skip in the next-guide sheet must advance again');
check((await page.locator('.nearest-sheet .sheet-kicker').textContent()).trim() === '下一个讲解点', 'skip must preserve the next-guide label');
await page.locator('.nearest-sheet.is-open [data-action="close-sheet"]').click();
await page.locator('[data-action="point"][data-id="g7"]').click();
await page.locator('[data-action="point"][data-id="g7"]').click();
await page.waitForSelector('.detail-view');
await page.locator('[data-action="show-next"]').click();
await page.locator('[data-action="open-point"][data-id="r5"]').click();
await page.waitForSelector('.service-detail');
check((await page.locator('.service-type').textContent()).includes('便民坡板'), 'ramp detail type is wrong');
await shot('iphone16-service-detail.png');

await page.locator('[data-action="start-nav"]').click();
const detailNavButton = page.locator('.service-detail [data-action="start-nav"]');
check(await detailNavButton.getAttribute('aria-busy') === 'true', 'service navigation must expose aria-busy while starting');
check((await detailNavButton.textContent()).trim() === '正在启动', 'service navigation must expose a clear pending label');
await page.waitForSelector('.voice-panel');
check(await page.locator('.nav-path').count() === 1, 'voice navigation path is missing');
await shot('iphone16-voice-guidance.png');
await page.locator('[data-action="repeat-nav"]').click();
check((await page.locator('.toast').textContent()).includes('已重播当前语音'), 'repeat voice toast is missing');
await page.locator('[data-action="end-nav"]').click();
check(await page.locator('.voice-panel').count() === 0, 'end navigation did not close voice panel');

await page.setViewportSize({ width: 393, height: 650 });
const shortFrameBox = await page.locator('.device-frame').boundingBox();
const shortShellBox = await page.locator('.phone-shell').boundingBox();
const shortMapBox = await page.locator('.map-area').boundingBox();
check(shortFrameBox && shortFrameBox.height === 650, `short mobile frame must follow 650px viewport height, got ${shortFrameBox?.height}`);
check(shortShellBox && shortShellBox.height === 650, `short mobile shell must follow 650px viewport height, got ${shortShellBox?.height}`);
check(shortMapBox && shortMapBox.height >= 300, `short mobile map must retain at least 300px, got ${shortMapBox?.height}`);
check(await page.locator('.device-overlay').evaluate((el) => getComputedStyle(el).display === 'none'), 'short mobile viewport must hide the simulated device chrome');
check(!(await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)), 'vertical overflow at 393x650');
await shot('iphone16-mobile-short.png');

await page.setViewportSize({ width: 320, height: 700 });
check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'horizontal overflow at 320px');
check(!(await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)), 'vertical overflow at 320x700');
check(await page.locator('.map-legend').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'legend overflows at 320px');

const reducedContext = await browser.newContext({
  viewport: { width: 393, height: 650 },
  screen: { width: 393, height: 650 },
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  reducedMotion: 'reduce'
});
const reducedPage = await reducedContext.newPage();
await reducedPage.goto(target, { waitUntil: 'load' });
await reducedPage.waitForSelector('.map-area');
const reducedStartedAt = Date.now();
await reducedPage.locator('[data-action="listen"]').click();
await reducedPage.waitForSelector('.nearest-sheet.is-open');
check(Date.now() - reducedStartedAt < 150, 'reduced motion mode must remove the simulated guide lookup delay');
check(await reducedPage.locator('.nearest-sheet [data-action="close-sheet"]').evaluate((el) => el === document.activeElement), 'reduced motion mode must preserve dialog focus behavior');
await reducedContext.close();

const desktopContext = await browser.newContext({
  viewport: { width: 1200, height: 900 },
  screen: { width: 1200, height: 900 },
  locale: 'zh-CN',
  colorScheme: 'light'
});
const desktopPage = await desktopContext.newPage();
desktopPage.on('pageerror', (error) => errors.push(`desktop pageerror: ${error.message}`));
desktopPage.on('console', (message) => { if (message.type() === 'error') errors.push(`desktop console: ${message.text()}`); });
desktopPage.on('request', (request) => {
  if (!request.url().startsWith('file:') && !request.url().startsWith('data:')) errors.push(`desktop network request: ${request.url()}`);
});
await desktopPage.goto(target, { waitUntil: 'load' });
await desktopPage.waitForSelector('.map-area');
const desktopBox = await desktopPage.locator('.phone-shell').boundingBox();
const frameBox = await desktopPage.locator('.device-frame').boundingBox();
const screenBox = await desktopPage.locator('#app').boundingBox();
const islandBox = await desktopPage.locator('.dynamic-island').boundingBox();
check(desktopBox && desktopBox.width === 393, `desktop artboard width should remain 393px, got ${desktopBox?.width}`);
check(desktopBox && Math.abs((1200 - desktopBox.width) / 2 - desktopBox.x) <= 1, 'desktop artboard is not centered');
check(frameBox && frameBox.width === 413 && frameBox.height === 872, `desktop device frame must be 413x872px, got ${frameBox?.width}x${frameBox?.height}`);
check(frameBox && Math.abs((1200 - frameBox.width) / 2 - frameBox.x) <= 1, 'desktop device frame is not centered');
check(screenBox && screenBox.width === 393 && screenBox.height === 852, `desktop screen must remain 393x852px, got ${screenBox?.width}x${screenBox?.height}`);
check(await desktopPage.locator('#app').evaluate((el) => getComputedStyle(el).borderRadius === '54px' && getComputedStyle(el).overflow === 'hidden'), 'desktop screen must use 54px rounded clipping');
check(islandBox && screenBox && islandBox.y > screenBox.y && islandBox.y + islandBox.height < screenBox.y + screenBox.height, 'Dynamic Island must float inside the iPhone screen');
await shot('iphone16-device-frame-desktop.png', { scale: 'css' }, desktopPage);

await desktopContext.close();
await browser.close();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Demo verification passed: 17 assets, two-step map markers, guide and nearby-facility recommendations, direct voice guidance, iPhone 16 frame, focus, offline mode, and responsive checks.');
