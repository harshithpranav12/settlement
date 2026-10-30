/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Specified Palettes
        surface: {
          bg: '#F5F4EF',        // Main workstation background
          card: '#FFFFFF',      // Card background
          cardSubtle: '#FAFAF7',// Secondary subtle surface
          hover: '#F2F1EC',     // Hover row/button
        },
        brand: {
          primary: '#25364A',   // Primary text / dark elements
          secondary: '#697586', // Secondary muted text
          accent: '#527D70',    // Primary accent (sage / forest green)
          accentLight: '#EBF2EE', // Subtle accent background
          steel: '#7189A6',     // Secondary accent (technical steel blue)
          steelLight: '#EFF4F9',
          warning: '#C18A45',   // Warning (warm ochre/amber)
          warningLight: '#FAF4EB',
          critical: '#B85C5C',  // Critical alert (restrained terracotta/crimson)
          criticalLight: '#FBF2F2',
          border: '#D9DEE3',    // Clean subtle borders
          borderLight: '#EDF0F3',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.6875rem', // 11px
      },
      boxShadow: {
        card: '0 1px 3px rgba(37, 54, 74, 0.05), 0 1px 2px rgba(37, 54, 74, 0.03)',
        dropdown: '0 4px 12px rgba(37, 54, 74, 0.08), 0 2px 4px rgba(37, 54, 74, 0.04)',
      },
    },
  },
  plugins: [],
};
