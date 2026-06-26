/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/web/views/**/*.ejs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // USA-01: primary accent.
        primary: { DEFAULT: '#0029ff', 600: '#0021cc', 700: '#001999' },
        gray: {
          150: '#ecefe5',
          250: '#dbe0e8',
          350: '#b4bcc8',
          450: '#818b98',
          550: '#586270',
          650: '#404956',
          750: '#2b333e',
          850: '#18202b',
          955: '#070b14',
        },
        red: {
          250: '#fca5a5',
          650: '#dc2626',
          750: '#b91c1c',
        },
      },
    },
  },
  plugins: [],
};
