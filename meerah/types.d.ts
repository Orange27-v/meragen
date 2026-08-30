/**
 * Ambient declarations the framework does not supply.
 *
 * ── Global stylesheets ────────────────────────────────────────────────────
 * Next declares `*.module.css` (see `next/types/global.d.ts`) but deliberately
 * not plain `*.css`, on the reasoning — stated in a comment there — that
 * TypeScript does not check side-effect imports by default. That holds for
 * `tsc` on the command line, which is why `import './landing.css'` compiles
 * clean. It stops holding under `noUncheckedSideEffectImports`, which editors
 * may enable on their own: the import then has nothing to resolve to and
 * reports TS2882.
 *
 * An empty body rather than the shorthand `declare module '*.css';`, which
 * would type every export as `any` and quietly allow `import styles from
 * './x.css'`. A global stylesheet exports nothing; only its side effect
 * matters, and the bundler is what produces that. The more specific
 * `*.module.css` pattern still wins for CSS modules, so those keep their
 * class-name typing.
 */
declare module '*.css' {}
