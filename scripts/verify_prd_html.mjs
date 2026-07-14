import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';


const require = createRequire(import.meta.url);
const sharedNodeModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10189\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const { chromium } = require(path.join(sharedNodeModules, '.pnpm', 'playwright@1.61.1', 'node_modules', 'playwright'));

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'PRD.md');
const prototypePath = path.join(root, 'demo', '原型说明.md');
const outputPath = process.env.PRD_HTML_OUTPUT
  || path.join(root, 'output', 'html', '零里说-无障碍在线导览-PRD.html');
const screenshotDir = path.join(root, 'output', 'html', 'screenshots');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

execFileSync('python', [path.join(root, 'scripts', 'build_prd_html.py')], {
  cwd: root,
  env: { ...process.env, PRD_HTML_OUTPUT: outputPath },
  stdio: 'inherit'
});
fs.mkdirSync(screenshotDir, { recursive: true });

const markdown = fs.readFileSync(sourcePath, 'utf8');
const prototype = fs.readFileSync(prototypePath, 'utf8');
const generated = fs.readFileSync(outputPath, 'utf8');
const chapters = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((match) => ({
  number: match[1], title: match[2].trim(), id: `section-${match[1]}`
}));

for (const title of ['产品概览', '用户任务与内容结构', '信息架构与入口路径', '核心需求与验收', '当前状态与协作分工', '验收与配套文档']) {
  check(markdown.includes(title), `missing project-level section: ${title}`);
}
check(chapters.length === 6, `expected 6 concise chapters, found ${chapters.length}`);
for (const status of ['已确认', '待确认', '已具备', '仅作展示', '待技术落地', '待现场验证']) {
  check(markdown.includes(status), `missing status definition: ${status}`);
}
for (const pathText of [
  '地图首页 → 底部操作区 → 当前位置',
  '地图首页 → 居民讲解 → 听讲解',
  '地图首页 → 底部操作区 → 附近设施'
]) {
  check(markdown.includes(pathText), `missing location entry path: ${pathText}`);
}
for (const stateText of ['首次或尚未授权', '已授权且位置有效', '权限被拒绝', '定位失败', '精度不足']) {
  check(markdown.includes(stateText), `missing location state: ${stateText}`);
}
check(markdown.includes('打开产品、切换内容域、浏览点位或查看详情均不主动申请定位'), 'on-demand location rule is missing');
check(markdown.includes('不得使用“最近”'), 'low-accuracy wording boundary is missing');
check(markdown.includes('讲解完成后选择下一讲解点会先返回地图并打开候选弹层'), 'next-guide map transition rule is missing');
check(markdown.includes('不固化具体点位'), 'project PRD must keep Demo guide IDs out of the formal flow');
check(!/V0\.9\.[0-9]/.test(markdown), 'main PRD still contains version-specific framing');
check(!markdown.includes('s3 -> s1 -> r5'), 'main PRD still contains fixed Demo recommendation sequence');
check(prototype.includes('s3 -> s1 -> r5 -> s3'), 'prototype specification does not preserve the fixed facility sequence');
check(markdown.includes('demo/原型说明.md'), 'main PRD does not link to the prototype specification');
check(markdown.includes('```prd-tree') && markdown.includes('```prd-flow'), 'semantic information architecture diagrams are missing');
check(!/<(?:script|img|link)\b[^>]*(?:src|href)=["']https?:/i.test(generated), 'generated HTML contains a remote runtime resource');
check(!generated.includes('V0.9'), 'generated HTML exposes obsolete version text');
check(generated.includes('讲解完成后选择下一讲解点会先返回地图并打开候选弹层'), 'generated HTML is missing the next-guide map transition');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('request', (request) => {
  if (!request.url().startsWith('file:') && !request.url().startsWith('data:')) errors.push(`network request: ${request.url()}`);
});

const captureWithoutProjectHome = async (options) => {
  const homeLink = page.locator('.project-home-link');
  if (await homeLink.count()) await homeLink.evaluate((element) => { element.style.visibility = 'hidden'; });
  await page.screenshot(options);
  if (await homeLink.count()) await homeLink.evaluate((element) => { element.style.removeProperty('visibility'); });
};

const target = pathToFileURL(outputPath).href;
await page.goto(target, { waitUntil: 'load' });

check(await page.locator('h1').count() === 1, 'document must contain exactly one H1');
const projectHome = page.locator('.project-home-link');
check(await projectHome.count() === 1, 'PRD must expose one project home control');
check(await projectHome.getAttribute('href') === '../../index.html', 'PRD project home href is incorrect');
const projectHomeBox = await projectHome.boundingBox();
check(projectHomeBox && projectHomeBox.width >= 44 && projectHomeBox.height >= 44, 'PRD project home target must be at least 44px');
check(await page.locator('.chapter').count() === chapters.length, `expected ${chapters.length} chapters`);
check(await page.locator('.directory .toc-link').count() === chapters.length, 'directory link count does not match chapters');
check(await page.locator('.side-nav .side-link').count() === chapters.length, 'desktop navigation link count does not match chapters');
check(await page.locator('.summary-card').count() === 6, 'six project summary cards were not rendered');
check(await page.locator('.domain-card').count() === 3, 'three content-domain cards were not rendered');
check(await page.locator('.architecture-viz').count() === 1, 'visitor architecture tree was not rendered');
check(await page.locator('.flow-lane').count() === 3, 'three location-entry flows were not rendered');
check(await page.locator('.status-pill').count() >= 10, 'status labels were not rendered as visual pills');
check(await page.locator('svg.icon').count() >= 5, 'paired visual icons are missing');

for (const chapter of chapters) {
  const section = page.locator(`#${chapter.id}`);
  check(await section.count() === 1, `missing or duplicate chapter id ${chapter.id}`);
  check((await section.locator('h2').first().textContent()).trim() === chapter.title, `chapter title mismatch for ${chapter.id}`);
  check(await page.locator(`.directory a[href="#${chapter.id}"]`).count() === 1, `directory link missing for ${chapter.id}`);
}

const duplicateIds = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
  return ids.filter((id, index) => ids.indexOf(id) !== index);
});
check(duplicateIds.length === 0, `duplicate HTML ids: ${duplicateIds.join(', ')}`);

const headingLevels = await page.locator('h1, h2, h3, h4').evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
for (let index = 1; index < headingLevels.length; index += 1) {
  check(headingLevels[index] - headingLevels[index - 1] <= 1, `heading level skips at index ${index}`);
}

check(await page.locator('nav[aria-labelledby="directory-title"]').count() === 1, 'semantic directory navigation is missing');
check(await page.locator('aside[aria-label="章节导航"]').count() === 1, 'semantic desktop navigation is missing');
check(await page.locator('.skip-link[href="#main-content"]').count() === 1, 'skip link is missing');
check(await page.locator('figure figcaption').count() === 2, 'visualizations need visible captions');

await page.locator('.directory a[href="#section-3"]').click();
await page.waitForTimeout(150);
check(new URL(page.url()).hash === '#section-3', 'directory click did not update the URL hash');
check(await page.evaluate(() => document.activeElement?.id) === 'section-3', 'directory target did not receive keyboard focus');

const contrast = await page.evaluate(() => {
  function rgb(value) { return (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number); }
  function luminance(values) {
    const channels = values.map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  const style = getComputedStyle(document.body);
  const foreground = luminance(rgb(style.color));
  const background = luminance(rgb(style.backgroundColor));
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
});
check(contrast >= 4.5, `body text contrast is below WCAG AA (${contrast.toFixed(2)}:1)`);

const viewports = [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 393, height: 852, name: 'mobile' },
  { width: 320, height: 700, name: 'narrow' }
];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(target, { waitUntil: 'load' });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyFontSize: parseFloat(getComputedStyle(document.body).fontSize),
    tocHeights: [...document.querySelectorAll('.toc-link')].map((link) => link.getBoundingClientRect().height),
    sideDisplay: getComputedStyle(document.querySelector('.side-nav')).display,
    externalScripts: [...document.scripts].filter((script) => script.src).length,
    externalStyles: [...document.querySelectorAll('link[rel="stylesheet"]')].length
  }));
  check(metrics.scrollWidth <= metrics.clientWidth + 1, `${viewport.name} has page-level horizontal overflow`);
  check(metrics.bodyFontSize >= 16, `${viewport.name} body text is smaller than 16px`);
  check(metrics.tocHeights.every((height) => height >= 44), `${viewport.name} directory contains a target shorter than 44px`);
  check(metrics.externalScripts === 0 && metrics.externalStyles === 0, `${viewport.name} loads external scripts or styles`);
  if (viewport.width >= 1021) check(metrics.sideDisplay !== 'none', 'desktop chapter navigation must remain visible');
  else check(metrics.sideDisplay === 'none', `${viewport.name} should use the single-column layout`);

  if (viewport.name === 'desktop') await captureWithoutProjectHome({ path: path.join(screenshotDir, 'prd-html-desktop.png'), fullPage: false, scale: 'css' });
  if (viewport.name === 'mobile') {
    await page.locator('.project-home-link').evaluate((element) => { element.style.visibility = 'hidden'; });
    await page.locator('.cover').screenshot({ path: path.join(screenshotDir, 'prd-html-mobile.png'), scale: 'css' });
    await page.locator('.project-home-link').evaluate((element) => { element.style.removeProperty('visibility'); });
  }
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${target}#section-3`, { waitUntil: 'load' });
await page.waitForTimeout(100);
await captureWithoutProjectHome({ path: path.join(screenshotDir, 'prd-html-information-architecture.png'), fullPage: false, scale: 'css' });

await page.emulateMedia({ media: 'print' });
check(await page.locator('.side-nav').evaluate((element) => getComputedStyle(element).display) === 'none', 'print view must hide sticky navigation');
check(await page.locator('.project-home-link').evaluate((element) => getComputedStyle(element).display) === 'none', 'print view must hide project home control');
await browser.close();

if (errors.length) {
  console.error(`PRD HTML verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PRD HTML verification passed (${chapters.length} chapters, ${viewports.length} viewports).`);
console.log(`Output: ${outputPath}`);
console.log(`Screenshots: ${screenshotDir}`);
