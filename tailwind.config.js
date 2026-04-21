/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        bebas: ['Bebas Neue', 'sans-serif'],
      },
      colors: {
        brand: {
          red: '#d63c2a',
          gold: '#c8a84b',
          black: '#0a0a0a',
          surface: '#141414',
          surface2: '#1e1e1e',
          gray: '#2a2a2a',
          'gray-mid': '#3d3d3d',
          'gray-light': '#7a7a7a',
          green: '#4a9e6b',
          blue: '#5b9acc',
        }
      }
    }
  },
  plugins: [],
}
