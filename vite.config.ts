import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** Handles a Range request and writes the partial response. Returns false if the header is malformed. */
function serveRangedFile(
  res: ServerResponse,
  filePath: string,
  headers: Record<string, string | number>,
  total: number,
  rangeHeader: string,
): boolean {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return false;
  }
  const [, startStr, endStr] = match;
  const start = parseInt(startStr ?? "0", 10);
  const end = endStr ? parseInt(endStr, 10) : total - 1;
  res.writeHead(206, {
    ...headers,
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Content-Length": end - start + 1,
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
  return true;
}

/**
 * Vite plugin that serves ./videos/ as /videos/ with proper Range-request
 * support (required for video seeking) and copies the directory to dist on build.
 */
function serveVideos(): Plugin {
  return {
    name: "serve-videos",
    configureServer(server: ViteDevServer): void {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/videos/")) {
          return next();
        }

        const filename = decodeURIComponent(req.url.slice("/videos/".length).split("?")[0] ?? "");
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
        const headers: Record<string, string | number> = {
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
          "Cross-Origin-Resource-Policy": "same-origin",
        };

        const rangeHeader = req.headers.range;
        if (rangeHeader && serveRangedFile(res as ServerResponse, filePath, headers, total, rangeHeader)) {
          return;
        }

        res.writeHead(200, { ...headers, "Content-Length": total });
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle(): void {
      const src = path.resolve("videos");
      if (!fs.existsSync(src)) {
        return;
      }
      // cpSync handles subdirectories; the old flat loop did not
      fs.cpSync(src, path.resolve("dist", "videos"), { recursive: true });
    },
  };
}

/**
 * Vite plugin that serves the pre-built OpenCV.js directly from node_modules
 * during development and copies it to dist/ on build.
 *
 * This avoids running the 11 MB Emscripten output through Rollup, which
 * externalises Node-only imports (fs, path, crypto) and produces a
 * content-hashed chunk that breaks across deployments when the browser or
 * service worker caches the old index chunk but the server has new assets.
 */
function serveOpenCV(): Plugin {
  const opencvSrc = path.resolve("node_modules/@techstark/opencv-js/dist/opencv.js");
  return {
    name: "serve-opencv",
    configureServer(server: ViteDevServer): void {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/opencv.js") {
          return next();
        }
        const stat = fs.statSync(opencvSrc);
        res.writeHead(200, {
          "Content-Type": "application/javascript",
          "Content-Length": stat.size,
          "Cross-Origin-Resource-Policy": "same-origin",
        });
        fs.createReadStream(opencvSrc).pipe(res);
      });
    },
    closeBundle(): void {
      fs.copyFileSync(opencvSrc, path.resolve("dist", "opencv.js"));
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
const securityHeaders: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Content-Security-Policy": [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is required for FFmpeg/OpenCV WASM modules
    // 'unsafe-eval' is required for SceneryStack query parameter parsing
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
    // FFmpeg and OpenCV spin up blob: workers
    "worker-src blob: 'self'",
    // Inline styles are set via element.style / cssText throughout the UI layer
    "style-src 'self' 'unsafe-inline'",
    // blob: for video playback and CSV download; data: for icons
    "img-src 'self' blob: data:",
    // blob: for webcam recordings and loaded video files
    "media-src 'self' blob:",
    // blob: for fetch inside workers; 'self' for local video middleware
    // data: required for @techstark/opencv-js which loads its WASM as a base64 data URI
    "connect-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// https://vite.dev/config/
export default defineConfig({
  // So the build can be served from an arbitrary path
  base: "./",
  build: {
    // Requires Vite 8+ / esbuild ≥0.24. Run `npm ci` if build errors on ES2024.
    target: "es2024",
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  plugins: [
    serveVideos(),
    serveOpenCV(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon.png"],
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
        // opencv.js (≈11 MB) is loaded on-demand; skip precaching to speed up
        // the initial service-worker install.  It is still cached at runtime by
        // the CacheFirst runtimeCaching entry below (matched by the *.js pattern).
        globIgnores: ["opencv.js"],
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
