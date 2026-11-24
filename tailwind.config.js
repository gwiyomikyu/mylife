/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--c-card) / <alpha-value>)', // カード色（テーマごと）
        ivory: 'rgb(var(--c-ivory) / <alpha-value>)',
        cream: 'rgb(var(--c-cream) / <alpha-value>)',
        beige: 'rgb(var(--c-beige) / <alpha-value>)',
        greige: 'rgb(var(--c-greige) / <alpha-value>)',
        stone: { DEFAULT: 'rgb(var(--c-stone) / <alpha-value>)', dark: 'rgb(var(--c-stonedark) / <alpha-value>)' },
        sage: { light: 'rgb(var(--c-sagelight) / <alpha-value>)', DEFAULT: 'rgb(var(--c-sage) / <alpha-value>)', dark: 'rgb(var(--c-sagedark) / <alpha-value>)', deep: 'rgb(var(--c-sagedeep) / <alpha-value>)' },
        ink: { DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)', soft: 'rgb(var(--c-inksoft) / <alpha-value>)', faint: 'rgb(var(--c-inkfaint) / <alpha-value>)' },
        clay: 'rgb(var(--c-clay) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Noto Sans JP"', 'sans-serif'],
        serif: ['"Cormorant Garamond"', '"Hiragino Mincho ProN"', 'Georgia', 'serif'],
      },
      borderRadius: { '4xl': '1.75rem' },
      boxShadow: { card: '0 1px 2px rgba(59,57,53,0.04), 0 4px 16px rgba(59,57,53,0.04)' },
    },
  },
  plugins: [],
}
