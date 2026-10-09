// 아이콘을 뜬다: 이 게임의 느티나무(① 마을 어귀의 큰 나무, src/pixel/trees.ts의 zelkova)를
// 캔버스 없이 화소 버퍼로 그려 정수배로 키우고, Node에 딸린 zlib으로 PNG를 쓴다. 바깥 그림을 쓰지 않는다.
//
//   node scripts/make-icons.mjs        → public/icons/ 에 icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
//
// 그림(src/pixel)이 바뀌면 다시 돌려 뜬 파일을 커밋한다. 새 패키지는 쓰지 않는다(TypeScript는 Vite가 읽어 준다).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

// ── PNG 쓰기(RGBA 8비트, 걸러 내기 없음) ──
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}
/** rgba: Uint8Array(w*h*4) */
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── 그림 불러오기(게임이 쓰는 것 그대로: 봄의 빛깔 벌에 맞춘 느티나무) ──
const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
let tree;
try {
  const { zelkova } = await server.ssrLoadModule('/src/pixel/trees.ts');
  const { paletteOf } = await server.ssrLoadModule('/src/pixel/palette.ts');
  const { Snapper } = await server.ssrLoadModule('/src/pixel/quant.ts');
  const { MASTER } = await server.ssrLoadModule('/src/pixel/master.ts');
  const made = zelkova(paletteOf('spring'));
  // 나무는 한 장이거나(Px) 흔들리는 여러 장(첫 장을 쓴다)이다
  const px = Array.isArray(made) ? made[0] : (made.px ?? made.frames?.[0] ?? made);
  tree = new Snapper(MASTER.spring).apply(px);
} finally {
  await server.close();
}

// 나무가 실제로 그려진 네모(빈 가장자리를 뺀다)
let x0 = tree.w, y0 = tree.h, x1 = -1, y1 = -1;
for (let y = 0; y < tree.h; y++) for (let x = 0; x < tree.w; x++) if (tree.d[y * tree.w + x] >>> 24 > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const tw = x1 - x0 + 1;
const th = y1 - y0 + 1;

const PAPER = [0xf4, 0xec, 0xd9]; // base.css의 한지 빛(--paper)
const GROUND = [0xdc, 0xcf, 0xb0]; // 나무 발치의 엷은 흙빛(한지 빛을 조금 눌렀다)

/**
 * size×size 그림(RGBA). 한지 빛 바탕을 끝까지 채우고 나무를 scale배로 키워 가운데에 둔다(lift만큼 위로).
 * 나무 발치에 엷은 흙빛 둔덕을 깔아 나무가 떠 보이지 않게 한다.
 */
function paint(size, scale, lift = 0) {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) out.set([...PAPER, 255], i * 4);
  const w = tw * scale;
  const h = th * scale;
  const left = Math.round((size - w) / 2);
  const top = Math.round((size - h) / 2) - lift;
  // 둔덕: 줄기 발치를 지나는 납작한 타원(점이 또렷하게 계단지도록 scale 단위로 찍는다)
  const cx = size / 2;
  const cy = top + h - 4 * scale;
  const rx = w * 0.34;
  const ry = 5 * scale;
  for (let y = 0; y < size; y += scale) {
    for (let x = 0; x < size; x += scale) {
      const dx = (x + scale / 2 - cx) / rx;
      const dy = (y + scale / 2 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      for (let j = 0; j < scale && y + j < size; j++) for (let i = 0; i < scale && x + i < size; i++) out.set([...GROUND, 255], ((y + j) * size + x + i) * 4);
    }
  }
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const c = tree.d[(y0 + y) * tree.w + x0 + x];
      const a = c >>> 24;
      if (a === 0) continue;
      const r = c & 255;
      const g = (c >> 8) & 255;
      const b = (c >> 16) & 255;
      for (let j = 0; j < scale; j++) {
        for (let i = 0; i < scale; i++) {
          const X = left + x * scale + i;
          const Y = top + y * scale + j;
          if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
          const o = (Y * size + X) * 4;
          // 반투명한 점(그늘)은 바탕에 섞는다
          out[o] = Math.round((r * a + out[o] * (255 - a)) / 255);
          out[o + 1] = Math.round((g * a + out[o + 1] * (255 - a)) / 255);
          out[o + 2] = Math.round((b * a + out[o + 2] * (255 - a)) / 255);
        }
      }
    }
  }
  return out;
}

/** 큰 그림을 k로 나누어 줄인다(k×k 칸을 고르게 섞는다). 나무가 한 배로도 192점이라, 작은 아이콘은 두 배로 그려 셋으로 나눈다. */
function shrink(big, size, k) {
  const out = new Uint8Array(size * size * 4);
  const bw = size * k;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) sum += big[((y * k + j) * bw + x * k + i) * 4 + ch];
        out[(y * size + x) * 4 + ch] = Math.round(sum / (k * k));
      }
    }
  }
  return out;
}

// 가장자리가 잘려도 되는 아이콘(maskable)은 한가운데의 동그라미(지름의 80%) 안에 나무가 다 들어와야 한다
function farthest(scale) {
  let r = 0;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      if (tree.d[(y0 + y) * tree.w + x0 + x] >>> 24 < 128) continue;
      r = Math.max(r, Math.hypot(x + 0.5 - tw / 2, y + 0.5 - th / 2));
    }
  }
  return r * scale;
}

mkdirSync(outDir, { recursive: true });
const made = [
  // 512: 나무 두 배(384×352점)가 그대로 또렷하게
  ['icon-512.png', 512, paint(512, 2, 6)],
  // maskable 512: 같은 크기, 한가운데에. 나무에서 가장 먼 점이 안전한 동그라미(반지름 204.8) 안이다
  ['icon-maskable-512.png', 512, paint(512, 2, 0)],
  // 192와 아이패드용 180: 두 배로 그린 것을 셋으로 나눈다(나무 128×117점)
  ['icon-192.png', 192, shrink(paint(576, 2, 6), 192, 3)],
  ['apple-touch-icon.png', 180, shrink(paint(540, 2, 6), 180, 3)],
];
for (const [name, size, rgba] of made) writeFileSync(join(outDir, name), png(size, size, rgba));
const far = farthest(2);
console.log(`느티나무 ${tree.w}×${tree.h}점, 그려진 곳 ${tw}×${th}점`);
console.log(`maskable: 가운데에서 가장 먼 점 ${far.toFixed(1)} / 안전한 반지름 ${(512 * 0.4).toFixed(1)} → ${far <= 512 * 0.4 ? '안에 든다' : '넘는다!'}`);
for (const [name, size] of made) console.log(`${name} ${size}×${size}`);
if (far > 512 * 0.4) process.exitCode = 1;
