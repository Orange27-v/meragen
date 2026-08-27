/**
 * Tailwind exists here for one reason: the forked studio components in
 * packages/studio are written entirely in Tailwind utilities, and without it
 * they render unstyled.
 *
 * The theme is mapped onto the Awesomic tokens in app/globals.css, so the
 * fork's semantic classes (bg-app-bg, text-primary…) resolve to our palette
 * rather than its original dark one.
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
        'app-bg':   '#f4f4f5',   // canvas
        'panel-bg': '#ffffff',   // card
        'card-bg':  '#fafafa',   // recessed
        primary:    '#09090b',   // the system's primary is ink, not a hue
        secondary:  '#52525b',
        muted:      '#71717a',
        // Our scale, available to the fork by name.
        obsidian: '#09090b',
        graphite: '#18181b',
        iron:     '#3f3f46',
        steel:    '#52525b',
        fog:      '#71717a',
        ash:      '#a1a1aa',
        mist:     '#d4d4d8',
        cloud:    '#ececee',
        paper:    '#f4f4f5',
        snow:     '#ffffff',
        ember:    '#ff5a00',
      },
      borderRadius: {
        tag: '12px',
        button: '14px',
        card: '36px',
      },
    },
  },
  plugins: [],
};
