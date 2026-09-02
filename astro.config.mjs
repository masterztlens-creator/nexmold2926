import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nexmold.pages.dev',

  // NEXMOLD 当前采用纯静态输出
  output: 'static',

  integrations: [
    sitemap(),
  ],

  devToolbar: {
    enabled: false,
  },

  prefetch: true,

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de', 'fr'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});