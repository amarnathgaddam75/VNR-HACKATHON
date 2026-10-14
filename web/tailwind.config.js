/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="night"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        pulse: 'rgb(var(--pulse) / <alpha-value>)',
        crash: 'rgb(var(--crash) / <alpha-value>)',
        escalate: 'rgb(var(--escalate) / <alpha-value>)',
        action: 'rgb(var(--action) / <alpha-value>)',
        measure: 'rgb(var(--measure) / <alpha-value>)',
        calm: 'rgb(var(--calm) / <alpha-value>)',
        amber: 'rgb(var(--amber) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
      },
    },
  },
  plugins: [],
};
