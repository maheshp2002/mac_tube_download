import fs from "fs";
import path from "path";
import zlib from "zlib";

// Simple PNG encoder in pure Node without external dependencies
function createPNG(size, bgHex = "#4f46e5", fgHex = "#ffffff") {
  const width = size;
  const height = size;

  // Helper to parse hex
  const parseHex = (hex) => {
    const num = parseInt(hex.replace("#", ""), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const [bgR, bgG, bgB] = parseHex(bgHex);
  const [fgR, fgG, fgB] = parseHex(fgHex);

  const buffer = Buffer.alloc(height * (1 + width * 4));
  const radius = size * 0.22;
  const cx = width / 2;
  const cy = height / 2;

  // Arrow geometry
  const arrowWidth = size * 0.44;
  const arrowTop = size * 0.24;
  const arrowBottom = size * 0.62;
  const stemWidth = size * 0.16;
  const barY = size * 0.74;
  const barHeight = size * 0.1;
  const barWidth = size * 0.52;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    buffer[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Rounded rect test
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const rx = width / 2 - radius;
      const ry = height / 2 - radius;

      let inBox = false;
      if (dx <= rx && dy <= height / 2) inBox = true;
      else if (dy <= ry && dx <= width / 2) inBox = true;
      else if (dx > rx && dy > ry) {
        const dist = Math.hypot(dx - rx, dy - ry);
        if (dist <= radius) inBox = true;
      }

      if (!inBox) {
        buffer[offset++] = 0;
        buffer[offset++] = 0;
        buffer[offset++] = 0;
        buffer[offset++] = 0; // Transparent
        continue;
      }

      // Check if inside download icon glyph (arrow + bar)
      let inIcon = false;

      // Stem of arrow
      if (x >= cx - stemWidth / 2 && x <= cx + stemWidth / 2 && y >= arrowTop && y <= size * 0.50) {
        inIcon = true;
      }
      // Arrowhead triangle
      if (y >= size * 0.46 && y <= arrowBottom) {
        const progress = (y - size * 0.46) / (arrowBottom - size * 0.46);
        const halfW = (arrowWidth / 2) * (1 - progress);
        if (Math.abs(x - cx) <= halfW) {
          inIcon = true;
        }
      }
      // Bottom tray bar
      if (x >= cx - barWidth / 2 && x <= cx + barWidth / 2 && y >= barY && y <= barY + barHeight) {
        inIcon = true;
      }

      if (inIcon) {
        buffer[offset++] = fgR;
        buffer[offset++] = fgG;
        buffer[offset++] = fgB;
        buffer[offset++] = 255;
      } else {
        buffer[offset++] = bgR;
        buffer[offset++] = bgG;
        buffer[offset++] = bgB;
        buffer[offset++] = 255;
      }
    }
  }

  // Construct PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
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

  // CRC32 calculation
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Standard CRC32 table
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

const outDir = path.resolve("C:/Users/Mahesh/Documents/Github/mac_tube_download/extension/icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const pngBuf = createPNG(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated: ${outPath} (${size}x${size})`);
}
