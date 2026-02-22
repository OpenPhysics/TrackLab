import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Vite plugin that serves ./videos/ as /videos/ with proper Range-request
 * support (required for video seeking) and copies the directory to dist on build.
 */
function serveVideos() {
  return {
    name: "serve-videos",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/videos/")) {
          return next();
        }

        const filename = decodeURIComponent(req.url.slice("/videos/".length).split("?")[0]);
        const videosDir = path.resolve("videos");
        const filePath = path.resolve(videosDir, filename);

        // Prevent directory traversal
        if (!filePath.startsWith(videosDir + path.sep)) {
          return next();
        }
        if (!fs.existsSync(filePath)) {
          return next();
        }

        const stat = fs.statSync(filePath);
        const total = stat.size;
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === ".webm" ? "video/webm" : "video/mp4";
        const headers = {
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
          "Cross-Origin-Resource-Policy": "same-origin",
        };

        const rangeHeader = req.headers.range;
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : total - 1;
            res.writeHead(206, {
              ...headers,
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Content-Length": end - start + 1,
            });
            fs.createReadStream(filePath, { start, end }).pipe(res);
            return;
          }
        }

        res.writeHead(200, { ...headers, "Content-Length": total });
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const src = path.resolve("videos");
      const dest = path.resolve("dist", "videos");
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
    },
  };
}

/**
 * Security headers required for:
 *  - COOP/COEP: SharedArrayBuffer (FFmpeg WASM)
 *  - CSP: restrict resource loading to same-origin + known blob/data exceptions
 *  - X-Content-Type-Options: prevent MIME sniffing
 *  - X-Frame-Options: prevent clickjacking (belt-and-suspenders alongside frame-ancestors)
 */
const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Content-Security-Policy": [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is required for FFmpeg/OpenCV WASM modules
    "script-src 'self' 'wasm-unsafe-eval'",
    // FFmpeg and OpenCV spin up blob: workers
    "worker-src blob: 'self'",
    // Inline styles are set via element.style / cssText throughout the UI layer
    "style-src 'self' 'unsafe-inline'",
    // blob: for video playback and CSV download; data: for icons
    "img-src 'self' blob: data:",
    // blob: for webcam recordings and loaded video files
    "media-src 'self' blob:",
    // blob: for fetch inside workers; 'self' for local video middleware
    "connect-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// https://vitejs.dev/config/
export default defineConfig({
  // So the build can be served from an arbitrary path
  base: "./",
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  plugins: [
    serveVideos(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "trackLab",
        // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
        short_name: "trackLab",
        description: "trackLab simulation",
        // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
        theme_color: "#1a1a2e",
        // biome-ignore lint/style/useNamingConvention: Web App Manifest spec requires snake_case keys
        background_color: "#000000",
        display: "standalone",
        orientation: "landscape",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
