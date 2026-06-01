import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: process.env.FRONTIER_SITE ?? "https://loggel.github.io",
  base: process.env.FRONTIER_BASE ?? "/frontier",
  trailingSlash: "always",
  output: "static",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
});
