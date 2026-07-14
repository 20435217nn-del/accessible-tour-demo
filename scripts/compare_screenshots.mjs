import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharedNodeModules = process.env.CODEX_NODE_MODULES
  || 'C:\\Users\\10189\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const { chromium } = require(path.join(sharedNodeModules, '.pnpm', 'playwright@1.61.1', 'node_modules', 'playwright'));
const screenshotDir = path.resolve(import.meta.dirname, '..', 'demo', 'screenshots');
const referenceDir = path.join(screenshotDir, 'reference');
const names = fs.readdirSync(referenceDir).filter((name) => name.endsWith('.png')).sort();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
});
const page = await browser.newPage();

for (const name of names) {
  const actual = fs.readFileSync(path.join(screenshotDir, name)).toString('base64');
  const reference = fs.readFileSync(path.join(referenceDir, name)).toString('base64');
  const result = await page.evaluate(async ({ actual, reference }) => {
    const decode = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    };
    const [a, b] = await Promise.all([decode(actual), decode(reference)]);
    if (a.width !== b.width || a.height !== b.height) return { dimensionsMatch: false };
    const canvas = new OffscreenCanvas(a.width, a.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(a, 0, 0);
    const ad = context.getImageData(0, 0, a.width, a.height).data;
    context.clearRect(0, 0, a.width, a.height);
    context.drawImage(b, 0, 0);
    const bd = context.getImageData(0, 0, b.width, b.height).data;
    let changed = 0;
    let absolute = 0;
    // A 36/255 channel threshold excludes font rasterization and translucent-edge noise.
    const threshold = 36;
    for (let i = 0; i < ad.length; i += 4) {
      const dr = Math.abs(ad[i] - bd[i]);
      const dg = Math.abs(ad[i + 1] - bd[i + 1]);
      const db = Math.abs(ad[i + 2] - bd[i + 2]);
      absolute += dr + dg + db;
      if (Math.max(dr, dg, db) > threshold) changed += 1;
    }
    const pixels = a.width * a.height;
    return {
      dimensionsMatch: true,
      changedPercent: changed / pixels * 100,
      meanChannelErrorPercent: absolute / (pixels * 3 * 255) * 100
    };
  }, { actual, reference });
  console.log(`${name}: changed>${36} = ${result.changedPercent?.toFixed(3)}%, mean error = ${result.meanChannelErrorPercent?.toFixed(3)}%`);
}

await browser.close();
