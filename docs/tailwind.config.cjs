/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
      backgroundImage: {
        'hero-pattern': "url('/public/graph-paper.svg')",
        'topo-pattern': "url('/public/topography.svg')",
      },
    },
	},
	plugins: [],
}
