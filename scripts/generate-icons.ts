import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const Dirname: string = dirname(fileURLToPath(import.meta.url));
const root: string = resolve(Dirname, "..");

const svgBuffer: Buffer = readFileSync(resolve(root, "public/icons/icon.svg"));

const pngIcons: Array<{ name: string; size: number }> = [
  { name: "icons/apple-touch-icon.png", size: 180 },
  { name: "icons/icon-192.png", size: 192 },
  { name: "icons/icon-512.png", size: 512 },
];

// Generate PNG icons
for (const { name, size } of pngIcons) {
  const dest = resolve(root, "public", name);
  await sharp(svgBuffer).resize(size, size).png().toFile(dest);
}

// Generate multi-size favicon.ico (16, 32, 48, 64)
const faviconSizes: number[] = [16, 32, 48, 64];
const faviconPngs: Buffer[] = [];

for (const size of faviconSizes) {
  const pngBuffer = await sharp(svgBuffer).resize(size, size).png().toBuffer();
  faviconPngs.push(pngBuffer);
}

const icoBuffer: Buffer = await pngToIco(faviconPngs);
const faviconDest: string = resolve(root, "public", "favicon.ico");
writeFileSync(faviconDest, icoBuffer);
