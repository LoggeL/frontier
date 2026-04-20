import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://loggel.github.io",
  base: "/frontier",
  trailingSlash: "always",
  output: "static",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
});
