import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  // Asset base differs by host, and BOTH forms are load-bearing:
  //
  // • UiPath Coded Apps (`npm run build:uipath`) → "./". The app is served under
  //   /<routing-name>/ and the platform injects `<base href="/<routing-name>/">`,
  //   so relative paths resolve correctly at any route depth. An absolute base
  //   would 404 there.
  //
  // • Root hosting for local preview (`npm run build`) → "/". There is no injected
  //   <base href>, so "./" would resolve against the current URL: a hard refresh
  //   on /cases/WR-2026-0417 would request /cases/assets/index.js, which the SPA
  //   fallback answers with index.html as text/html and the browser rejects as a
  //   module, so a blank page.
  base: process.env.UIPATH_BUILD ? "./" : "/",
  plugins: [react(), tailwindcss()],
  define: {
    // The UiPath SDK's bundled deps reference `global` in a couple of places.
    global: "globalThis",
  },
  resolve: {
    // The shared decision-form package resolves its own React; without this
    // the app bundles two copies and hooks blow up with "reading \'useState\'".
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    include: ["@uipath/uipath-typescript"],
  },
  server: {
    port: 5173,
  },
});
