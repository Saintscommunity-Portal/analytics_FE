import Aura from "@primeuix/themes/aura";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },

  css: ["primeicons/primeicons.css"],

  modules: [
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss",
    "@primevue/nuxt-module", // ← must come AFTER tailwindcss
  ],

  tailwindcss: {
    cssPath: "~/assets/css/main.css",
    configPath: "~/tailwind.config.js",
  },

  primevue: {
    autoImport: true, // auto-registers all components (tree-shaking included)
    options: {
      ripple: true,
      inputVariant: "filled",
      theme: {
        preset: Aura,
        options: {
          prefix: "p",
          darkModeSelector: ".dark",
          cssLayer: false,
        },
      },
    },
  },

  components: {
    // Must exclude these to prevent crashes with Nuxt's internal Form components
    exclude: ["Form", "FormField"],
  },

  experimental: {
    viteEnvironmentApi: true,
  },

  runtimeConfig: {
    public: {
      apiBase:
        process.env.API_BASE ||
        "https://analyticsbe-production.up.railway.app/api/v1",
    },
  },
});
