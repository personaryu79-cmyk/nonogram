import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../public');

const PATTERN = [
  '.#.#.',
  '#####',
  '#####',
  '.###.',
  '..#..',
];

const BG = [20, 24, 33, 255];
const EMPTY = [31, 37, 50, 255];
const FILL = [116, 169, 255, 255];
const ACCENT = [77, 141, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3] ?? 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) setPixel(x, y, BG);
  }

  const margin = Math.round(size * 0.16);
  const inner = size - margin * 2;
  const cell = inner / 5;
  const gap = Math.max(1.5, cell * 0.1);

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const filled = PATTERN[y][x] === '#';
      const color = filled ? FILL : EMPTY;
      const x0 = margin + x * cell + gap / 2;
      const y0 = margin + y * cell + gap / 2;
      const x1 = margin + (x + 1) * cell - gap / 2;
      const y1 = margin + (y + 1) * cell - gap / 2;
      for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
        for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const isEdge =
            px === Math.floor(x0) ||
            py === Math.floor(y0) ||
            px === Math.ceil(x1) - 1 ||
            py === Math.ceil(y1) - 1;
          setPixel(px, py, filled && isEdge ? ACCENT : color);
        }
      }
    }
  }

  return encodePng(size, size, pixels);
}

function makeFaviconSvg() {
  const margin = 18;
  const cell = 64 / 5;
  const gap = cell * 0.12;
  const rects = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (PATTERN[y][x] !== '#') continue;
      const rx = (margin + x * cell + gap / 2).toFixed(2);
      const ry = (margin + y * cell + gap / 2).toFixed(2);
      const s = (cell - gap).toFixed(2);
      rects.push(
        `<rect x="${rx}" y="${ry}" width="${s}" height="${s}" rx="1.4"/>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#141821"/>
  <g fill="#74a9ff">${rects.join('')}</g>
</svg>
`;
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(resolve(PUBLIC, 'pwa-192x192.png'), makeIcon(192));
writeFileSync(resolve(PUBLIC, 'pwa-512x512.png'), makeIcon(512));
writeFileSync(resolve(PUBLIC, 'apple-touch-icon.png'), makeIcon(180));
writeFileSync(resolve(PUBLIC, 'favicon.svg'), makeFaviconSvg());
console.log('Generated PWA icons in public/');
