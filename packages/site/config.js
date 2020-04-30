const config = {
  gatsby: {
    pathPrefix: '/',
    siteUrl: 'https://bilt.io',
    gaTrackingId: null,
    trailingSlash: false,
  },
  header: {
    logo: '/images/logo.svg',
    logoLink: 'https://bilt.io/',
    title: 'Bilt',
    githubUrl: 'https://github.com/giltayar/bilt',
    helpUrl: '',
    tweetText: '',
    social: `<li>
		    <a href="https://twitter.com/giltayar" target="_blank" rel="noopener">
		      <div class="twitterBtn">
		        <img src='/images/twitter.svg' alt={'Discord'}/>
		      </div>
		    </a>
		  </li>`,
    links: [{ text: '', link: '' }],
    search: {
      enabled: false,
      indexName: '',
      algoliaAppId: process.env.GATSBY_ALGOLIA_APP_ID,
      algoliaSearchKey: process.env.GATSBY_ALGOLIA_SEARCH_KEY,
      algoliaAdminKey: process.env.ALGOLIA_ADMIN_KEY,
    },
  },
  sidebar: {
    forcedNavOrder: [
      '/introduction', // add trailing slash if enabled above
      '/codeblock',
    ],
    collapsedNav: [
      '/codeblock', // add trailing slash if enabled above
    ],
    links: [{ text: 'Github Repo', link: 'https://github.com/giltayar/bilt' }],
    frontline: false,
    ignoreIndex: true,
    title: "<a href='/'>Monorepo? Bilt!</a>",
  },
  siteMetadata: {
    title: 'Bilt',
    description: 'Site for Bilt (A build system for monorepos) information',
    ogImage: null,
    docsLocation: '???',
    favicon: '/images/logo.svg',
  },
  pwa: {
    enabled: false, // disabling this will also remove the existing service worker.
    manifest: {
      name: 'Gatsby Gitbook Starter',
      short_name: 'GitbookStarter',
      start_url: '/',
      background_color: '#6b37bf',
      theme_color: '#6b37bf',
      display: 'standalone',
      crossOrigin: 'use-credentials',
      icons: [
        {
          src: 'src/pwa-512.png',
          sizes: `512x512`,
          type: `image/png`,
        },
      ],
    },
  },
};

module.exports = config;
