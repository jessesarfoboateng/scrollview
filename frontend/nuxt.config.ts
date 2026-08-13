// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: false, // SPA mode — runs locally, no SSR needed
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    head: {
      title: 'ScrollView — LED Notice Board Controller',
      meta: [
        { name: 'description', content: 'Bluetooth-controlled scrolling LED dot-matrix notice board controller' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { charset: 'UTF-8' },
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:5000',
      wsBase:  'ws://localhost:5000/ws',
    },
  },
});