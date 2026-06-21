/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a', // Deep dark
        surface: '#121212',
        surfaceBorder: '#27272a',
        primary: '#3B82F6', // Electric Blue
        accent: '#8B5CF6',  // Purple highlights
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
        glow: '0 0 20px rgba(59, 130, 246, 0.2)',
      }
    },
  },
  plugins: [],
}
