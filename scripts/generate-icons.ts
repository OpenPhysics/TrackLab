import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svgBuffer = readFileSync(resolve(root, "public/icons/icon.svg"));

const pngIcons = [
  { name: "icons/apple-touch-icon.png", size: 180 },
  { name: "icons/icon-192.png", size: 192 },
  { name: "icons/icon-512.png", size: 512 },
];

// Generate PNG icons
for (const { name, size } of pngIcons) {
  const dest = resolve(root, "public", name);
  await sharp(svgBuffer).resize(size, size).png().toFile(dest);
  console.log(`Generated ${name} (${size}x${size})`);
}

// Generate multi-size favicon.ico (16x16, 32x32, 48x48)
const faviconDest = resolve(root, "public", "favicon.ico");
await sharp(svgBuffer)
  .resize(32, 32)
  .toFormat("png")
  .toFile(faviconDest);
console.log("Generated favicon.ico (32x32)");
