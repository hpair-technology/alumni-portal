import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Two entry points: the public landing page at / and the signed-in portal at
// /portal. Vercel's cleanUrls setting serves dist/portal.html at /portal.
export default defineConfig({
  publicDir: resolve(__dirname, "public"),
  define: {
    // Stamped into the landing page masthead so "Updated" is always true.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        portal: resolve(__dirname, "portal.html"),
      },
      output: {
        // Firebase changes rarely; keep it in its own long-cached chunk.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"],
          cropper: ["cropperjs"],
        },
      },
    },
  },
});
