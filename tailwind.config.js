/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          900: '#0f3d3e',
          700: '#0f766e',
        },
      },
    },
  },
  plugins: [],
};
