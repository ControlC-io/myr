/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand
        primary: "#E9E8FF",
        secondary: "#BF60B5",

        // Contrast on brand
        "primary-on-light": "#FFFFFF",
        "primary-on-dark": "#000000",
        "secondary-on-light": "#FFFFFF",
        "secondary-on-dark": "#000000",

        // Background & surfaces
        background: {
          DEFAULT: "#F2EFFF",
          dark: "#040225",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#28164e",
        },
        border: {
          DEFAULT: "#D9C9FF",
          dark: "#3B2A6F",
        },

        // Text
        textPrimary: {
          DEFAULT: "#111827",
          dark: "#F9FAFB",
        },
        textSecondary: {
          DEFAULT: "#4B5563",
          dark: "#9CA3AF",
        },

        // Palette (purple / pink)
        "dark-purple": "#040225",
        "dark-purple-semitransparent": "#040226",
        "dark-purple-transparent": "#040225",
        "black-purple": "#28164e",
        "black-purple-semitransparent": "#28164e",
        purple: "#462671",
        "light-purple": "#73389d",
        pink: "#bf30b5",
      },
      boxShadow: {
        card:        '0 1px 3px rgba(70,38,113,0.08), 0 4px 16px rgba(70,38,113,0.06)',
        'card-dark': '0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3)',
        focus:       '0 0 0 3px rgba(191,96,181,0.18)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm:  '0.375rem',
        md:  '0.5rem',
        lg:  '0.75rem',
        xl:  '1rem',
        '2xl': '1.25rem',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
