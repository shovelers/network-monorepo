### Components

* React: Frontend
* Vite: Bundling 
* Radix: Headless Component Library, use the sytling options from this for components by default. [Docs](https://www.radix-ui.com/themes/docs/components/button)
* TailwindCSS: For styling needs on components not being met by Radix and for html tags not in Radix.
               The tailwind classes will only be found inside the className varibale of the html elements 
* Iconify: Icon pack, use bootrap icons (bi) `<Icon icon="bi:<name>" />` [link](https://icon-sets.iconify.design/bi/)

#### Local Dev Server
* `VITE_PRIVY_APP_ID="<app_id_from_privy>" npm run dev`