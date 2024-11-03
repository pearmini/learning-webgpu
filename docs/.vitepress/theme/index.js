import DefaultTheme from "vitepress/theme";
import Layout from "genji-theme-vitepress";
import { h } from "vue";

// More props: https://genji-md.dev/reference/props
const props = {
  Theme: DefaultTheme,
  transform: {
    braces: (code) => `(() => ${code})()`,
  },
};

export default {
  extends: DefaultTheme,
  Layout: () => h(Layout, props),
};
