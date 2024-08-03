// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Creole Network',
  tagline: 'Decentralised.User-controlled.Permissionless',
  favicon: 'img/favicon.svg',

  // Set the production url of your site here
  url: 'https://creole.network',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'shovelers', // Usually your GitHub org/user name.
  projectName: 'network-monorepo', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/'
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
    [
      '@docusaurus/preset-classic',
      {
        gtag: {
          trackingID: 'G-H9K0YV6H99',
        },
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      metadata: [
        {name: 'keywords', content: 'social graph, pds, dwn, privacy, SSI, user-controlled, ipfs, libp2p, social, consumer, crypto, shovel, rolodex, creole'},
        {name: 'description', content: 'Site for Creole Network Whitepeper'},
        {property: 'og:image', content: 'https://creole.network/img/layers.png'},
      ],
      // Replace with your project's social card
      image: 'img/logo.jpg',
      navbar: {
        title: 'Creole Network',
        logo: {
          alt: 'Creole Network',
          src: 'img/logo.jpg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/shovelers/network-monorepo',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Docs',
                to: '/whitepaper',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/QGH2gUWAGf',
              },
              {
                label: 'Twitter',
                href: 'https://x.com/ShovelCompany',
              },
              {
                label: 'Farcaster Channel',
                href: 'https://warpcast.com/~/channel/rolodexsocial',
              },
            ],
          },
          {
            title: 'Links',
            items: [
              {
                label: 'Rolodex',
                href: 'https://rolodex.social',
              },
              {
                label: 'Shovel Company',
                href: 'https://shovel.company',
              },
            ],
          },
        ],
        copyright: `Made with ❤️ by Shovel Company`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
