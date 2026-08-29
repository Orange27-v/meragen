/**
 * Fetch the example stills the studios show before you have made anything.
 *
 * Run once; the output is committed. These are served from our own origin
 * rather than hotlinked, for two reasons: a customer on a Lagos mobile network
 * should not wait on a US image host to find out what a tool makes, and the
 * dashboard must not look broken on the day the host is down.
 *
 * The seeds are the tool ids, so re-running reproduces the same set exactly.
 * These are placeholders. Replace them with consented customer work when we
 * have it — `lib/tools.ts:exampleImage` is the only thing that has to change.
 *
 *   node scripts/fetch-examples.mjs
 */
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const TOOLS = [
  'videngine', 'vibereel', 'shotdirect', 'snipreel', 'pixcraft', 'patchup',
  'talksync', 'bodydouble', 'starmaker', 'myvoice', 'salesreel', 'soundtrack',
];

const OUT = join(process.cwd(), 'public', 'examples');
const WIDTH = 640;
const HEIGHT = 360;

/** One image, retried — a single flaky request should not fail the whole run. */
async function grab(url, attempts = 3) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 1024) throw new Error(`suspiciously small: ${bytes.length}b`);
      return bytes;
    } catch (error) {
      if (i === attempts) throw error;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

await mkdir(OUT, { recursive: true });

let written = 0;
let bytes = 0;
for (const tool of TOOLS) {
  for (let n = 1; n <= 3; n += 1) {
    const name = `${tool}-${n}.jpg`;
    const url = `https://picsum.photos/seed/meerah-${tool}-${n}/${WIDTH}/${HEIGHT}.jpg`;
    const data = await grab(url);
    await writeFile(join(OUT, name), data);
    written += 1;
    bytes += data.length;
    process.stdout.write(`  ${name.padEnd(20)} ${String(data.length).padStart(7)} b\n`);
  }
}

const files = await readdir(OUT);
console.log(`\n${written} images, ${(bytes / 1024 / 1024).toFixed(2)} MB, ${files.length} files in public/examples`);
