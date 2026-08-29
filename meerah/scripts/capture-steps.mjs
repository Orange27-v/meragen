/**
 * Capture the step images the guide and the showcase use.
 *
 * These used to be stock photographs, which told a first-time customer nothing:
 * a picture of a beach does not explain what pressing Generate does. The
 * reference product uses screenshots of its own interface performing each step,
 * and that is what these are — the real rail, the real quality dialog, the real
 * work area, from the running app.
 *
 * Three per tool *kind*, not per tool: the moves are the same for every video
 * tool, and fifteen honest frames beat thirty-six near-duplicates.
 *
 * Run against a signed-in dev server:
 *   node scripts/capture-steps.mjs <session-token>
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('Usage: node scripts/capture-steps.mjs <session-token>');
  process.exit(1);
}

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000';
const OUT = join(process.cwd(), 'public', 'steps');

/** One representative tool per kind, and the three moves its guide describes. */
const KINDS = [
  { kind: 'video',   tool: 'videngine' },
  { kind: 'image',   tool: 'pixcraft'  },
  { kind: 'lipsync', tool: 'talksync'  },
  { kind: 'audio',   tool: 'soundtrack' },
  { kind: 'voice',   tool: 'myvoice'   },
];

/** 16:9 crops of the parts of the page each step is actually about. */
const SHOTS = [
  { n: 1, clip: { x: 48, y: 56, width: 384, height: 216 } },   // the rail's poster and what is under it
  { n: 2, clip: { x: 48, y: 250, width: 384, height: 216 } },  // the prompt and settings
  { n: 3, clip: { x: 48, y: 690, width: 384, height: 216 } },  // the price and the button
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2, // retina, so a 384px crop is still sharp when scaled up
});
await context.addInitScript((t) => localStorage.setItem('meerah_token', t), TOKEN);
const page = await context.newPage();

let written = 0;
for (const { kind, tool } of KINDS) {
  await page.goto(`${ORIGIN}/create/${tool}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3200);
  // Any dialog left open would appear in every frame.
  await page.click('button[aria-label=Close]').catch(() => {});
  await page.waitForTimeout(800);

  for (const shot of SHOTS) {
    const name = `${kind}-${shot.n}.jpg`;
    await page.screenshot({
      path: join(OUT, name),
      clip: shot.clip,
      type: 'jpeg',
      quality: 82,
      timeout: 60_000,
    });
    written += 1;
    process.stdout.write(`  ${name}\n`);
  }
}

await browser.close();
console.log(`\n${written} step frames in public/steps`);
