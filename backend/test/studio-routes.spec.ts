import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `POST /api/v1/:modelId` in StudioController will swallow any path mounted
 * under /api/v1 that it does not recognise, silently turning a real endpoint
 * into "Unknown model". That already happened once, to /api/v1/brand.
 *
 * This reads every controller and asserts its path prefix is reserved. Add a
 * controller under /api/v1 without updating RESERVED and this fails, which is
 * the point.
 */
function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

/** First path segment of every /api/v1 route a controller declares. */
function prefixesIn(source: string): string[] {
  const found = new Set<string>();

  const controllerPath = /@Controller\(\s*'([^']*)'/.exec(source)?.[1] ?? '';
  const base = controllerPath.replace(/^\/?/, '');

  if (base.startsWith('api/v1/')) {
    found.add(base.slice('api/v1/'.length).split('/')[0]);
    return [...found];
  }

  if (base === 'api/v1') {
    for (const match of source.matchAll(/@(?:Get|Post|Patch|Put|Delete)\(\s*'([^']+)'/g)) {
      const segment = match[1].replace(/^\/?/, '').split('/')[0];
      if (segment && !segment.startsWith(':')) found.add(segment);
    }
  }
  return [...found];
}

describe('the model catch-all must not shadow real routes', () => {
  it('reserves every /api/v1 path prefix a controller declares', () => {
    const src = join(__dirname, '..', 'src');
    const studio = readFileSync(join(src, 'generations', 'studio.controller.ts'), 'utf8');

    const reserved = new Set(
      (/const RESERVED = new Set\(\[([\s\S]*?)\]\)/.exec(studio)?.[1] ?? '')
        .match(/'([^']+)'/g)
        ?.map((quoted) => quoted.replace(/'/g, '')) ?? [],
    );

    expect(reserved.size).toBeGreaterThan(5);

    const missing: string[] = [];
    for (const file of controllerFiles(src)) {
      for (const prefix of prefixesIn(readFileSync(file, 'utf8'))) {
        if (!reserved.has(prefix)) missing.push(`${prefix} (${file.split('/src/')[1]})`);
      }
    }

    expect(missing, `Add these to RESERVED in studio.controller.ts: ${missing.join(', ')}`).toEqual([]);
  });
});
