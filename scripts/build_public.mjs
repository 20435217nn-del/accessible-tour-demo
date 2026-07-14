import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'public');

const files = [
  'index.html',
  'demo/index.html',
  'demo/demo.css',
  'demo/data.js',
  'demo/demo.js',
  'demo/screenshots/iphone16-next-guide-transition.png',
  'output/html/零里说-无障碍在线导览-PRD.html',
  'output/html/screenshots/prd-html-desktop.png',
];

const directories = [
  'demo/assets/figma-make',
];

async function requirePath(relativePath) {
  try {
    return await stat(join(root, relativePath));
  } catch {
    throw new Error(`Missing required publish input: ${relativePath}`);
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relativePath of files) {
  const source = join(root, relativePath);
  const destination = join(output, relativePath);
  const sourceStat = await requirePath(relativePath);
  if (!sourceStat.isFile()) {
    throw new Error(`Expected a file: ${relativePath}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

for (const relativePath of directories) {
  const source = join(root, relativePath);
  const destination = join(output, relativePath);
  const sourceStat = await requirePath(relativePath);
  if (!sourceStat.isDirectory()) {
    throw new Error(`Expected a directory: ${relativePath}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

console.log(`Published ${files.length} files and ${directories.length} asset directory to public/`);

