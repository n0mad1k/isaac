/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        farm: {
          green: '#2d5a27',
          'green-light': '#4a7c44',
          brown: '#8b5a2b',
          cream: '#f5f0e6',
          sky: '#87ceeb',
        },
      },
    },
  },
  plugins: [],
}
