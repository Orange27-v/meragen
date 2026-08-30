/**
 * Tailwind's theme is a mirror of the tokens in app/globals.css — every entry
 * here is a var() reference, so the palette has exactly one source of truth.
 *
 * Two things this file has to get right:
 *
 *   1. The forked studio components in packages/studio are written entirely in
 *      Tailwind utilities against their own semantic names (bg-app-bg,
 *      text-primary…). Those names are re-pointed at our surfaces below, so the
 *      fork renders in Meerah's palette rather than its original one.
 *
 *   2. Colours that need Tailwind's `/NN` opacity modifier are published as
 *      HSL triplets. Tailwind silently drops the alpha on a plain var() colour,
 *      which is how a batch of tints died here once already.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './packages/studio/src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Menlo', 'monospace'],
      },

      colors: {
        /* ------------------------------------------------------------------
           NOVA — the studio rail's palette.

           Deliberately literal hex rather than var() references, and
           deliberately its own namespace. The system above is the product's:
           near-black surfaces three points apart, a teal accent, depth from
           tone and almost no shadow. The rail is a different instrument — a
           dark cinematic generation surface with layered charcoal, generous
           radii and soft shadows. It shares the product's accent green — see
           `accent` below — but not its surfaces or its elevation, so the two
           sit side by side and the rail opts in by name.
           ------------------------------------------------------------------ */
        nova: {
          bg:       '#0F1113',  /* the page behind the rail */
          surface:  '#131517',  /* the panel */
          card:     '#202427',  /* cards and rows on it */
          elevated: '#272B2E',  /* a card answering a pointer */
          hover:    '#323537',  /* the chosen half of a segmented control */
          circle:   '#323537',  /* the media circles in the drop well */
          inset:    '#101214',  /* chips, which sit below their card */

          border:      '#313538',
          /* The rule that separates a card's header and footer from its body.
             Much fainter than `border` — it divides inside one surface rather
             than bounding it, so at `border`'s weight it would read as three
             stacked cards instead of one. */
          hairline:    'rgba(255,255,255,0.055)',
          borderLight: '#36393B',
          borderRing:  '#414446',

          text:   '#F5F5F5',
          muted:  '#A1A3A5',
          subtle: '#777A7D',
          faint:  '#55585A',

          /* The accent is the product's, not the rail's. It was briefly its own
             lime here, which meant two accents in one app and two places to
             change it; these are var() references so there is exactly one.
             `accentWash` exists because Tailwind silently drops the alpha on a
             plain var() colour — see the note at the top of this file — so the
             translucent uses need their own token rather than a `/NN`. */
          accent:     'var(--accent)',
          accentHover:'var(--accent-hover)',
          accentDark: 'var(--accent-press)',
          accentInk:  'var(--accent-ink)',
          accentWash: 'var(--accent-wash)',
          accentLine: 'var(--accent-line)',
        },

        /* --- The system. Everything new uses these four groups. ---------- */
        surface: {
          inset:   'var(--surface-inset)',
          base:    'var(--surface-base)',
          panel:   'var(--surface-panel)',
          raised:  'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          hover:   'var(--surface-hover)',
          active:  'var(--surface-active)',
        },
        ink: {
          DEFAULT:   'var(--ink-primary)',
          primary:   'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          tertiary:  'var(--ink-tertiary)',
          disabled:  'var(--ink-disabled)',
        },
        edge: {
          subtle:   'var(--border-subtle)',
          DEFAULT:  'var(--border-default)',
          hover:    'var(--border-hover)',
          strong:   'var(--border-strong)',
          selected: 'var(--border-selected)',
        },
        mint: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          press:   'var(--accent-press)',
          ink:     'var(--accent-ink)',
          wash:    'var(--accent-wash)',
          washHi:  'var(--accent-wash-hi)',
          line:    'var(--accent-line)',
        },
        warn:   { DEFAULT: 'var(--warn)', wash: 'var(--warn-wash)' },
        danger: { DEFAULT: 'var(--danger)', wash: 'var(--danger-wash)' },

        /* --- shadcn/ui's semantic names, as HSL triplets so `/NN` works. -- */
        background:  'hsl(var(--background) / <alpha-value>)',
        foreground:  'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT:    'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input:  'hsl(var(--input) / <alpha-value>)',
        ring:   'hsl(var(--ring) / <alpha-value>)',
        primary: {
          DEFAULT:    'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted-bg) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent-bg) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },

        /* --- The fork's own names, and the older Meerah scale. ----------- */
        'app-bg':   'var(--surface-base)',
        'panel-bg': 'var(--surface-raised)',
        'card-bg':  'var(--surface-inset)',
        scrim:      'var(--scrim)',
        veil:       'var(--veil)',
        void:       'var(--surface-base)',
        sunk:       'var(--surface-inset)',
        night:      'var(--surface-base)',
        slab:       'var(--surface-raised)',
        'slab-hi':  'var(--surface-overlay)',
        hair:       'var(--border-default)',
        'hair-hi':  'var(--border-strong)',
        'hair-lit': 'var(--border-strong)',
        'hair-inner': 'var(--border-subtle)',
        chalk:      'var(--ink-primary)',
        iron:       'var(--ink-secondary)',
        steel:      'var(--ink-secondary)',
        fog:        'var(--ink-tertiary)',
        ash:        'var(--ink-disabled)',
        indigo:     'var(--accent)',
        peri:       'var(--accent)',
        lilac:      'var(--accent)',
        lime:       'var(--accent)',
        obsidian:   'var(--ink-primary)',
        graphite:   'var(--ink-primary)',
        mist:       'var(--border-strong)',
        cloud:      'var(--border-strong)',
        paper:      'var(--surface-base)',
        snow:       'var(--surface-raised)',
        ember:      'var(--accent)',
      },

      /* One radius, aliased under every name the codebase already uses. The
         `2xl`-`4xl` entries used to be capped to stop the forked studio's
         `rounded-3xl` calls reintroducing a pill; with a single value there is
         nothing left to cap. See --r in globals.css. */
      borderRadius: {
        none:    '0',
        DEFAULT: 'var(--r-md)',
        xs:      'var(--r-xs)',
        sm:      'var(--r-sm)',
        md:      'var(--r-md)',
        lg:      'var(--r-lg)',
        xl:      'var(--r-xl)',
        media:   'var(--r-media)',
        '2xl':   'var(--r-xl)',
        '3xl':   'var(--r-media)',
        '4xl':   'var(--r-media)',
        tag:     'var(--r-sm)',
        button:  'var(--r-md)',
        card:    'var(--r-lg)',
        full:    'var(--r-full)',

        /* The rail used to run its own, larger scale. It does not any more:
           every name below is the same var(--r) the rest of the product uses,
           so the rail and the pages round identically. Kept as names rather
           than collapsed to one class because ~60 call sites read better
           saying what they are than all saying `rounded-r`. */
        'nova-sm':    'var(--r)',
        'nova-md':    'var(--r)',
        'nova-btn':   'var(--r)',
        'nova-lg':    'var(--r)',
        'nova-card':  'var(--r)',
        'nova-seg':   'var(--r)',
        'nova-well':  'var(--r)',
        'nova-panel': 'var(--r)',
      },

      /* Depth is tone, not shadow. Only detached layers — dropdowns, dialogs —
         get a drop, and it is tight and neutral. Every larger alias collapses
         onto those two so nothing can reintroduce a 40px blur. */
      boxShadow: {
        none:    'none',
        DEFAULT: 'var(--shadow-sm)',
        sm:      'var(--shadow-sm)',
        bevel:   'var(--bevel)',
        overlay: 'var(--shadow-overlay)',
        dialog:  'var(--shadow-dialog)',
        md:      'var(--shadow-overlay)',
        lg:      'var(--shadow-overlay)',
        xl:      'var(--shadow-overlay)',
        '2xl':   'var(--shadow-dialog)',
        modal:   'var(--shadow-dialog)',

      },

      fontSize: {
        badge: ['var(--fs-badge)', { lineHeight: '1', letterSpacing: '0.045em' }],
        xs:    ['var(--fs-xs)',    { lineHeight: '1.45' }],
        sm:    ['var(--fs-sm)',    { lineHeight: '1.5' }],
        base:  ['var(--fs-base)',  { lineHeight: '1.5' }],
        md:    ['var(--fs-md)',    { lineHeight: '1.55' }],
        lg:    ['var(--fs-lg)',    { lineHeight: '1.4',  letterSpacing: '-0.006em' }],
        xl:    ['var(--fs-xl)',    { lineHeight: '1.3',  letterSpacing: '-0.014em' }],
        '2xl': ['var(--fs-2xl)',   { lineHeight: '1.22', letterSpacing: '-0.02em' }],
        '3xl': ['var(--fs-3xl)',   { lineHeight: '1.15', letterSpacing: '-0.024em' }],
      },

      transitionTimingFunction: { DEFAULT: 'var(--ease)', ease: 'var(--ease)' },
      transitionDuration: { DEFAULT: 'var(--dur)', fast: 'var(--dur-fast)', slow: 'var(--dur-slow)' },

      spacing: { nav: 'var(--nav-h)', ctl: 'var(--h-md)', 'ctl-sm': 'var(--h-sm)', 'ctl-lg': 'var(--h-lg)' },
      maxWidth: { page: 'var(--page-max)', prose: 'var(--prose-max)' },

      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'none' },
        },
        sweep: { to: { transform: 'translateX(100%)' } },
      },
      animation: {
        rise: 'rise var(--dur-slow) var(--ease) both',
        sweep: 'sweep 1.5s var(--ease) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
