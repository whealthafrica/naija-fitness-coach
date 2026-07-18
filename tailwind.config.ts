import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // SINGLE SOURCE OF TRUTH FOR THE APP BACKGROUND COLOR
        // Individual screens must not define their own background values.
        background: '#F5F0EA',    // Cream — background, all screens
        surface: '#FAF4EC',       // Linen — cards, sheets, input backgrounds
        primary: '#6B2737',       // Burgundy — primary, buttons, dominant illustration
        accent: '#C9962C',        // Gold — accent only, never button fill
        'text-primary': '#2B211D',   // Near-Black — text, linework
        'text-secondary': '#4A3C36', // Muted text/placeholders - Darkened for contrast compliance
        'on-primary': '#FFFFFF',     // White — text on burgundy buttons
        success: '#9CAF88',       // Sage — success / selected state accent
        danger: '#6B1515',        // Muted Burgundy — error states
        divider: '#E6DCD0',       // Warm border
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      backgroundImage: {
        // explicitly empty — gradients are prohibited, don't add any here
      },
    },
  },
  plugins: [],
}
export default config
