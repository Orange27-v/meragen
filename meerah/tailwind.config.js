/**
 * Tailwind exists here for one reason: the forked studio components in
 * packages/studio are written entirely in Tailwind utilities, and without it
 * they render unstyled.
 *
 * The theme is mapped onto the tokens in app/globals.css, so the fork's
 * semantic classes (bg-app-bg, text-primary…) resolve to our navy-and-indigo
 * palette rather than its original one. Every entry is a var() reference, so
 * the palette has exactly one source of truth.
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
      },
      colors: {
        // The fork's semantic names, repointed at our surfaces.
        'app-bg':   'var(--night)',      // canvas
        'panel-bg': 'var(--slab)',       // card
        'card-bg':  'var(--sunk)',       // recessed
        scrim:      'var(--scrim)',      // behind a dialog
        veil:       'var(--veil)',       // over a card while it renders

        // shadcn/ui's semantic names. HSL triplets, so `bg-card/60` and the
        // rest of Tailwind's opacity modifiers work — they silently drop the
        // alpha on a plain var() colour, which is how 136 tints died earlier.
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
          DEFAULT:    'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        // Our scale, available to the fork by name.
        void:       'var(--void)',
        sunk:       'var(--sunk)',
        night:      'var(--night)',
        slab:       'var(--slab)',
        'slab-hi':  'var(--slab-hi)',
        hair:       'var(--hair)',
        'hair-hi':  'var(--hair-hi)',
        'hair-lit': 'var(--hair-lit)',
        'hair-inner': 'var(--hair-inner)',
        chalk:      'var(--chalk)',
        iron:       'var(--iron)',
        steel:      'var(--steel)',
        fog:        'var(--fog)',
        ash:        'var(--ash)',
        indigo:     'var(--indigo)',
        peri:       'var(--peri)',
        lilac:      'var(--lilac)',
        // Legacy scale names the fork still references by name.
        obsidian: 'var(--chalk)',
        graphite: 'var(--paper-ink)',
        mist:     'var(--hair-hi)',
        cloud:    'var(--hair-hi)',
        paper:    'var(--night)',
        snow:     'var(--slab)',
        ember:    'var(--lilac)',
      },
      // One radius for the whole site. The scale is flattened rather than
      // rewriting 250 `rounded-*` classes across the forked studio — and it
      // keeps any class added later on the same 10px.
      borderRadius: {
        DEFAULT: 'var(--radius)',
        none: '0',
        sm: 'var(--radius)',
        md: 'var(--radius)',
        lg: 'var(--radius)',
        xl: 'var(--radius)',
        '2xl': 'var(--radius)',
        '3xl': 'var(--radius)',
        '4xl': 'var(--radius)',
        tag: 'var(--radius)',
        button: 'var(--radius)',
        card: 'var(--radius)',
        full: '9999px',   // circles and pills are deliberate, not rounding
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
