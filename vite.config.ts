import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execFileSync } from 'node:child_process';

const buildVersion = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), builtAt: new Date().toISOString() };
const buildVersionPlugin: Plugin = {
  name: 'build-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(buildVersion) }); },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: { 'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(JSON.stringify(buildVersion)) },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), buildVersionPlugin,
    process.env.VITE_NATIVE_APP === 'true' && {
      name: 'native-html',
      transformIndexHtml(html: string) {
        const api = process.env.VITE_SUPABASE_URL!;
        const socket = api.replace(/^http/, 'ws');
        const policy = `default-src 'self'; connect-src 'self' ${api} ${socket}; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'`;
        return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`).replace('width=device-width, initial-scale=1.0', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
          .replace(/\s*<link[\s\S]*?\/>/g, '');
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query", "@radix-ui/react-tooltip"],
  },
}));
