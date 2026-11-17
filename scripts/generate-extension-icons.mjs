import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "extension", "icons");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

// Distance to rounded tray
function distToTray(px, py, left, right, top, bottom, radius) {
  // Left vertical
  const dLeft = distToSegment(px, py, left, top, left, bottom - radius);
  // Right vertical
  const dRight = distToSegment(px, py, right, top, right, bottom - radius);
  // Bottom horizontal
  const dBottom = distToSegment(px, py, left + radius, bottom, right - radius, bottom);
  // Bottom-left corner arc
  const cornerLX = left + radius;
  const cornerLY = bottom - radius;
  let dCornerL = Infinity;
  if (px <= cornerLX && py >= cornerLY) {
    dCornerL = Math.abs(Math.hypot(px - cornerLX, py - cornerLY) - radius);
  }
  // Bottom-right corner arc
  const cornerRX = right - radius;
  const cornerRY = bottom - radius;
  let dCornerR = Infinity;
  if (px >= cornerRX && py >= cornerRY) {
    dCornerR = Math.abs(Math.hypot(px - cornerRX, py - cornerRY) - radius);
  }

  return Math.min(dLeft, dRight, dBottom, dCornerL, dCornerR);
}

function createDownloadIconPNG(size, fgHex = "#ffffff", withShadow = false) {
  const width = size;
  const height = size;

  const parseHex = (hex) => {
    const num = parseInt(hex.replace("#", ""), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const [fgR, fgG, fgB] = parseHex(fgHex);
  const buffer = Buffer.alloc(height * (1 + width * 4));

  // Stroke thickness tuned for each resolution
  // At 16x16: stroke ~1.8px (radius 0.9)
  // At 32x32: stroke ~3.4px (radius 1.7)
  const strokeRadius = Math.max(0.9, size * 0.052);

  // Geometry definitions normalized to [0, size]
  const arrowX = size * 0.50;
  const arrowTopY = size * 0.12;
  const arrowStemEndY = size * 0.58;

  const arrowWingLeftX = size * 0.28;
  const arrowWingRightX = size * 0.72;
  const arrowWingY = size * 0.38;

  const trayLeft = size * 0.18;
  const trayRight = size * 0.82;
  const trayTop = size * 0.62;
  const trayBottom = size * 0.84;
  const trayCornerRadius = size * 0.08;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    buffer[offset++] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      // Sub-pixel 2x2 sampling for ultra-smooth anti-aliasing
      let totalAlpha = 0;
      let totalShadow = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = x + (sx + 0.5) / 2;
          const py = y + (sy + 0.5) / 2;

          // 1. Arrow stem
          const dStem = distToSegment(px, py, arrowX, arrowTopY, arrowX, arrowStemEndY);

          // 2. Arrow chevron
          const dWingL = distToSegment(px, py, arrowWingLeftX, arrowWingY, arrowX, arrowStemEndY);
          const dWingR = distToSegment(px, py, arrowWingRightX, arrowWingY, arrowX, arrowStemEndY);

          // 3. Tray
          const dTray = distToTray(px, py, trayLeft, trayRight, trayTop, trayBottom, trayCornerRadius);

          const minDist = Math.min(dStem, dWingL, dWingR, dTray);

          // Calculate alpha using smoothstep
          if (minDist <= strokeRadius + 0.6) {
            const a = Math.max(0, Math.min(1, (strokeRadius + 0.6 - minDist) / 1.0));
            totalAlpha += a;
          }

          if (withShadow && minDist <= strokeRadius + 1.8) {
            const sa = Math.max(0, Math.min(0.45, (strokeRadius + 1.8 - minDist) / 1.5));
            totalShadow += sa;
          }
        }
      }

      const glyphAlpha = totalAlpha / 4;
      const shadowAlpha = totalShadow / 4;

      if (glyphAlpha > 0.01) {
        buffer[offset++] = fgR;
        buffer[offset++] = fgG;
        buffer[offset++] = fgB;
        buffer[offset++] = Math.round(glyphAlpha * 255);
      } else if (withShadow && shadowAlpha > 0.02) {
        // Subtle dark shadow to preserve contrast on light backgrounds
        buffer[offset++] = 15;
        buffer[offset++] = 23;
        buffer[offset++] = 42;
        buffer[offset++] = Math.round(shadowAlpha * 180);
      } else {
        buffer[offset++] = 0;
        buffer[offset++] = 0;
        buffer[offset++] = 0;
        buffer[offset++] = 0; // 100% transparent
      }
    }
  }

  // PNG structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT
  const compressed = zlib.deflateSync(buffer);
  const idatChunk = createChunk("IDAT", compressed);

  // IEND
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function generateAllIcons(targetDir = outDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const sizes = [16, 32, 48, 128];

  for (const size of sizes) {
    // 1. Light variant (for dark browser toolbars) - crisp white
    const lightBuf = createDownloadIconPNG(size, "#f8fafc", false);
    fs.writeFileSync(path.join(targetDir, `icon-${size}-light.png`), lightBuf);

    // 2. Dark variant (for light browser toolbars) - crisp slate
    const darkBuf = createDownloadIconPNG(size, "#1e293b", false);
    fs.writeFileSync(path.join(targetDir, `icon-${size}-dark.png`), darkBuf);

    // 3. Default variant - clean white with subtle shadow so it's visible on any toolbar
    const defaultBuf = createDownloadIconPNG(size, "#f8fafc", true);
    fs.writeFileSync(path.join(targetDir, `icon-${size}.png`), defaultBuf);

    console.log(`[Icon Generator] Generated ${size}x${size} icons (default, light, dark)`);
  }
}

// Run if called directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  generateAllIcons();
}
