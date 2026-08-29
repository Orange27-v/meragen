import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every route that changes something must be guarded, unless it is on the list
 * below and says why.
 *
 * `POST /api/v1/pricing/sync` shipped with no guard at all: it rewrites the cost
 * basis every price in the product derives from, and spends a vendor API call
 * each time it runs. Nobody noticed because nothing checked. This reads the
 * source and fails if a mutating route has neither `@UseGuards` on the method
 * nor on its controller.
 */

/** Mutating routes that are deliberately open, and the reason each one is. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  'auth.controller.ts:google':
    'Sign-in. There is no session to guard with yet; the Google ID token is the proof.',
  'auth.controller.ts:logout':
    'Deletes whatever session the caller presents. A guard would only make signing out fail when the token has already expired.',
  'payments.controller.ts:webhooks/paystack':
    'Paystack calls this, not a browser. Authenticity comes from the HMAC signature check.',
};

function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

/**
 * Mutating routes in one controller, and whether each carries a guard.
 *
 * A `@UseGuards` above the class guards every route in the file. Otherwise it
 * belongs to the route whose decorator block it sits in — and this codebase
 * writes it *after* `@Post(...)`, so the whole block has to be read, not just
 * the lines above the route.
 */
function mutatingRoutes(source: string): Array<{ route: string; guarded: boolean }> {
  const classAt = source.search(/export class \w+/);
  const guardedWholeController =
    classAt >= 0 && /@UseGuards\([^)]*\)\s*(?:\/\*[\s\S]*?\*\/\s*)*export class/.test(source);

  const body = classAt >= 0 ? source.slice(classAt) : source;
  const lines = body.split('\n');

  const routes: Array<{ route: string; guarded: boolean }> = [];
  const decorator = /@(?:Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/;

  lines.forEach((line, i) => {
    const match = decorator.exec(line);
    if (!match) return;

    // The decorator block is the run of @-lines around this one, in both
    // directions — that is the set that applies to this single route.
    let first = i;
    while (first > 0 && /^\s*@/.test(lines[first - 1])) first -= 1;
    let last = i;
    while (last + 1 < lines.length && /^\s*@/.test(lines[last + 1])) last += 1;

    const block = lines.slice(first, last + 1).join('\n');
    routes.push({
      route: match[1] ?? '',
      guarded: guardedWholeController || block.includes('@UseGuards('),
    });
  });
  return routes;
}

describe('mutating routes are guarded', () => {
  it('every POST, PATCH, PUT and DELETE requires a session or says why not', () => {
    const src = join(__dirname, '..', 'src');
    const files = controllerFiles(src);
    expect(files.length).toBeGreaterThan(5);

    const unguarded: string[] = [];
    for (const file of files) {
      const name = file.split('/').pop()!;
      for (const { route, guarded } of mutatingRoutes(readFileSync(file, 'utf8'))) {
        const key = `${name}:${route}`;
        if (!guarded && !(key in PUBLIC_BY_DESIGN)) unguarded.push(key);
      }
    }

    expect(
      unguarded,
      `Add @UseGuards, or list it in PUBLIC_BY_DESIGN with a reason: ${unguarded.join(', ')}`,
    ).toEqual([]);
  });

  it('the catalogue sync is owner-only, not merely signed-in', () => {
    const source = readFileSync(
      join(__dirname, '..', 'src', 'pricing', 'pricing.controller.ts'),
      'utf8',
    );
    const syncBlock = source.slice(source.indexOf("@Post('pricing/sync')") - 400);
    expect(syncBlock).toContain('@UseGuards(AdminGuard)');
  });
});
