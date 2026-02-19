import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svgBuffer = readFileSync(resolve(root, "public/icons/icon.svg"));

const icons = [
  { name: "favicon.png", size: 32 },
  { name: "icons/icon-16.png", size: 16 },
  { name: "icons/icon-32.png", size: 32 },
  { name: "icons/icon-48.png", size: 48 },
  { name: "icons/icon-72.png", size: 72 },
  { name: "icons/icon-96.png", size: 96 },
  { name: "icons/icon-128.png", size: 128 },
  { name: "icons/icon-144.png", size: 144 },
  { name: "icons/icon-152.png", size: 152 },
  { name: "icons/icon-180.png", size: 180 },
  { name: "icons/apple-touch-icon.png", size: 180 },
  { name: "icons/icon-192.png", size: 192 },
  { name: "icons/icon-256.png", size: 256 },
  { name: "icons/icon-384.png", size: 384 },
  { name: "icons/icon-512.png", size: 512 },
];

for (const { name, size } of icons) {
  const dest = resolve(root, "public", name);
  await sharp(svgBuffer).resize(size, size).png().toFile(dest);
  console.log(`Generated ${name} (${size}x${size})`);
}
