import { defineConfig } from "vitepress";
import config from "genji-theme-vitepress/config";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  extends: config,
  title: "WebGPU",
  description: "My notes, examples, and experiments with WebGPU",
  cleanUrls: true,
  themeConfig: {
    sidebar: [
      {
        items: [{ text: "Fundamentals", link: "/fundamentals" }],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/pearmini/learning-webgpu" },
    ],
  },
});
