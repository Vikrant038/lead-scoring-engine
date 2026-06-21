/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/web/views/**/*.ejs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // USA-01: primary accent.
        primary: { DEFAULT: '#0029ff', 600: '#0021cc', 700: '#001999' },
      },
    },
  },
  plugins: [],
};
