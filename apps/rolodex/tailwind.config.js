/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [ './views/**/*.ejs', './src/**/*.js' ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["night"],
  },
}
