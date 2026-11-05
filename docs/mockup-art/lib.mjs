// 시안 스크립트가 함께 쓰는 것: 화소 버퍼, PNG 쓰기·읽기, 그림 규칙의 수치(Review가 기계로 재는 것).
// 새 패키지를 쓰지 않는다(Node에 딸린 zlib만 쓴다). 빛깔은 src/pixel/px.ts와 같이 0xAABBGGRR 수 하나로 묶는다.

import { deflateSync, inflateSync } from 'node:zlib';

// ── 빛깔 ──────────────────────────────────────────────────────
export const rgb = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const hex = (s, a = 255) => {
  const v = parseInt(s.slice(1), 16);
  return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255, a);
};
export const R = (c) => c & 255;
export const G = (c) => (c >> 8) & 255;
export const B = (c) => (c >> 16) & 255;
export const A = (c) => (c >>> 24) & 255;
/** 밝기 Y′(0~1): 감마를 풀지 않은 Rec.709 가중 합. 규칙의 "밝기"는 모두 이 값이다. */
export const luma = (c) => (0.2126 * R(c) + 0.7152 * G(c) + 0.0722 * B(c)) / 255;
export const mix = (a, b, t) =>
  rgb(Math.round(R(a) * (1 - t) + R(b) * t), Math.round(G(a) * (1 - t) + G(b) * t), Math.round(B(a) * (1 - t) + B(b) * t), A(a));

// ── 무늬(같은 자리면 언제나 같은 값) ─────────────────────────────
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 0x1b873593) ^ Math.imul(y | 0, 0x19d699a5) ^ Math.imul(seed | 0, 0x2545f491)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ── 화소 버퍼 ──────────────────────────────────────────────────
export class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }
  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    return this.inb(x, y) ? this.d[y * this.w + x] : 0;
  }
  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** 다른 그림을 얹는다. 반쯤 비친 점(알파 1~254)은 바탕에 섞는다. */
  blit(src, dx, dy, flip = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + (flip ? src.w - 1 - x : x)];
        const a = A(c);
        if (a === 0) continue;
        if (a === 255) this.set(dx + x, dy + y, c);
        else {
          const X = dx + x;
          const Y = dy + y;
          if (!this.inb(X, Y)) continue;
          const under = this.get(X, Y);
          this.set(X, Y, rgb(...[R, G, B].map((f) => Math.round((f(c) * a + f(under) * (255 - a)) / 255)), 255));
        }
      }
    }
  }
  crop(x0, y0, w, h) {
    const out = new Img(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.d[y * w + x] = this.get(x0 + x, y0 + y);
    return out;
  }
  /** 점 하나를 k×k로(이웃 점 그대로) 키운다 */
  scale(k) {
    const out = new Img(this.w * k, this.h * k);
    for (let y = 0; y < out.h; y++) {
      const sy = Math.floor(y / k) * this.w;
      for (let x = 0; x < out.w; x++) out.d[y * out.w + x] = this.d[sy + Math.floor(x / k)];
    }
    return out;
  }
}

// ── PNG ────────────────────────────────────────────────────────
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
/** Img → PNG(RGBA 8비트). 알파 0인 점은 bg로 칠한다. */
export function encodePng(img, bg = rgb(0, 0, 0)) {
  const { w, h } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = img.d[y * w + x];
      if (A(c) === 0) c = bg;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = R(c);
      raw[o + 1] = G(c);
      raw[o + 2] = B(c);
      raw[o + 3] = 255;
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/** 이 파일이 쓴 꼴의 PNG(RGBA 8비트, 섞음 없음)만 읽는다 */
export function decodePng(buf) {
  let p = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('RGBA 8비트 PNG만 읽는다');
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const img = new Img(w, h);
  const stride = w * 4;
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 4 ? cur[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let v = x;
      if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) img.d[y * w + x] = rgb(cur[x * 4], cur[x * 4 + 1], cur[x * 4 + 2], cur[x * 4 + 3]);
    prev.set(cur);
  }
  return img;
}

// ── 그림 규칙의 수치(기획서 4.7.5의 ㄱ~ㅂ — Review가 기계로 잰다) ─────────
/**
 * 외톨이 점: 이웃 여덟 점이 모두 자기와 다른 빛깔인 점. 땅 그림만 놓고 맵 칸(tile 그림 점) 하나마다 센다.
 * 돌려주는 것: 칸마다의 평균과 가장 많은 칸, 그림 점 천 개당 수.
 */
export function orphans(ground, tile) {
  const { w, h, d } = ground;
  const tw = Math.floor(w / tile);
  const th = Math.floor(h / tile);
  const per = new Array(tw * th).fill(0);
  let total = 0;
  for (let y = 1; y < th * tile - 1; y++) {
    for (let x = 1; x < tw * tile - 1; x++) {
      const c = d[y * w + x];
      if (A(c) === 0) continue;
      let alone = true;
      for (let j = -1; j <= 1 && alone; j++) for (let i = -1; i <= 1; i++) if ((i || j) && d[(y + j) * w + x + i] === c) { alone = false; break; }
      if (alone) {
        per[Math.floor(y / tile) * tw + Math.floor(x / tile)]++;
        total++;
      }
    }
  }
  const avg = total / per.length;
  return { perTileAvg: +avg.toFixed(2), perTileMax: Math.max(...per), per1000: +((total * 1000) / (tw * th * tile * tile)).toFixed(2) };
}

/** 체크무늬(2×2가 a b / b a, a≠b): 섞음 무늬(디더)가 얼마나 있는가. 그림 점 천 개당. */
export function checker(img) {
  const { w, h, d } = img;
  let n = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = d[y * w + x];
      const b = d[y * w + x + 1];
      if (a !== b && d[(y + 1) * w + x] === b && d[(y + 1) * w + x + 1] === a) n++;
    }
  }
  return +((n * 1000) / (w * h)).toFixed(2);
}

/**
 * 사람 그림(한 장, 바탕 없이)의 바깥 테두리: 그림의 점 가운데 위·아래·옆에 빈 점이 닿은 점.
 * 그 가운데 밝기가 dark 이하인 점의 몫(0~1).
 */
export function outlineShare(sprite, dark = 0.2) {
  const { w, h, d } = sprite;
  let edge = 0;
  let inked = 0;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(d[y * w + x]) > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
      edge++;
      if (luma(d[y * w + x]) <= dark) inked++;
    }
  }
  return edge === 0 ? 0 : +(inked / edge).toFixed(3);
}

/**
 * 사람과 그 아래 바닥의 밝기 차: 사람의 테두리 안쪽 점(몸)의 밝기 평균과,
 * 사람의 둘레(테두리 밖 pad 점 안)의 바닥 밝기 평균. 바닥은 사람을 그리기 전의 그림(ground)에서 읽는다.
 * x0, y0: 사람 그림이 놓인 왼쪽 위(장면의 그림 점).
 */
export function personVsGround(sprite, x0, y0, ground, pad) {
  const { w, h, d } = sprite;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(d[y * w + x]) > 0;
  let bodySum = 0;
  let bodyN = 0;
  let edgeSum = 0;
  let edgeN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const inner = on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1);
      if (inner) {
        bodySum += luma(d[y * w + x]);
        bodyN++;
      } else {
        edgeSum += luma(d[y * w + x]);
        edgeN++;
      }
    }
  }
  // 둘레의 바닥: 그림 네모를 pad만큼 넓힌 곳 가운데 그림이 없는 점(발치 아래쪽 절반만 — 사람이 서 있는 땅)
  let gSum = 0;
  let gN = 0;
  for (let y = Math.floor(h / 2); y < h + pad; y++) {
    for (let x = -pad; x < w + pad; x++) {
      if (on(x, y)) continue;
      const c = ground.get(x0 + x, y0 + y);
      if (A(c) === 0) continue;
      gSum += luma(c);
      gN++;
    }
  }
  const body = bodySum / Math.max(1, bodyN);
  const edge = edgeSum / Math.max(1, edgeN);
  const g = gSum / Math.max(1, gN);
  return { body: +body.toFixed(3), edge: +edge.toFixed(3), ground: +g.toFixed(3), bodyMinusGround: +(body - g).toFixed(3), groundMinusEdge: +(g - edge).toFixed(3) };
}

/** 쓰인 빛깔의 수(알파 255인 점만) */
export function colorCount(img) {
  const set = new Set();
  for (const c of img.d) if (A(c) === 255) set.add(c);
  return set.size;
}

/** 낱그림(세운 것 한 장) 안의 외톨이 점: 그림이 찍힌 점 천 개당. 테두리 점도 센다. */
export function spriteOrphans(img) {
  const { w, h, d } = img;
  let n = 0;
  let on = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = d[y * w + x];
      if (A(c) === 0) continue;
      on++;
      let alone = true;
      for (let j = -1; j <= 1 && alone; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const X = x + i;
          const Y = y + j;
          if (X >= 0 && Y >= 0 && X < w && Y < h && d[Y * w + X] === c) { alone = false; break; }
        }
      }
      if (alone) n++;
    }
  }
  return on === 0 ? 0 : +((n * 1000) / on).toFixed(1);
}

/**
 * 단조로움(2차 시안에서 더한 수치 — 기획서 4.7.5의 ㅌ). 땅 그림만 놓고 풀밭(g·m 칸)과 흙(p·y 칸)을 따로 잰다.
 *   큰 결(밝기): 맵 점 8×8 조각마다 평균 밝기를 내어 같은 갈래 조각끼리의 표준편차 ×100 — 큰 얼룩이 있으면 크다.
 *   큰 결(색조): 같은 조각의 평균 빛의 (빨강 − 파랑) ÷ 255의 표준편차 ×100 — 따뜻함·서늘함이 옮겨 가면 크다.
 *   빛깔 갈래: 그 갈래 넓이의 1% 이상을 차지하는 빛깔의 수.
 *   평탄 조각: 맵 점 4×4 조각 가운데 한 빛이 90% 이상을 덮은 조각의 몫(%) — 넓은 한 빛 판이면 크다.
 * 조각의 네 귀가 모두 같은 갈래의 칸일 때만 센다(풀과 흙의 경계는 빼고). k = 그림 점 / 맵 점.
 */
export function monotony(ground, region, k) {
  const { cam, tiles, terrain } = region;
  const code = (X, Y) => {
    const tx = Math.floor((X / k + cam.x) / 16);
    const ty = Math.floor((Y / k + cam.y) / 16);
    const ch = terrain[ty - tiles.y0]?.[tx - tiles.x0] ?? '?';
    return 'gm'.includes(ch) ? 'grass' : 'py'.includes(ch) ? 'dirt' : null;
  };
  const out = {};
  for (const kind of ['grass', 'dirt']) {
    const lum = [];
    const warm = [];
    const counts = new Map();
    let area = 0;
    let flat = 0;
    let small = 0;
    for (const [size, big] of [
      [8, true],
      [4, false],
    ]) {
      const s = size * k;
      for (let y0 = 0; y0 + s <= ground.h; y0 += s) {
        for (let x0 = 0; x0 + s <= ground.w; x0 += s) {
          if (![code(x0, y0), code(x0 + s - 1, y0), code(x0, y0 + s - 1), code(x0 + s - 1, y0 + s - 1)].every((c) => c === kind)) continue;
          let L = 0;
          let W = 0;
          const local = new Map();
          for (let y = y0; y < y0 + s; y++) {
            for (let x = x0; x < x0 + s; x++) {
              const c = ground.d[y * ground.w + x];
              L += luma(c);
              W += (R(c) - B(c)) / 255;
              local.set(c, (local.get(c) ?? 0) + 1);
              if (big) counts.set(c, (counts.get(c) ?? 0) + 1);
            }
          }
          const n = s * s;
          if (big) {
            lum.push(L / n);
            warm.push(W / n);
            area += n;
          } else {
            small++;
            if (Math.max(...local.values()) >= 0.9 * n) flat++;
          }
        }
      }
    }
    const sd = (a) => {
      const m = a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
      return Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / Math.max(1, a.length));
    };
    out[kind] = {
      blocks: lum.length,
      lumaStd: +(sd(lum) * 100).toFixed(2),
      warmStd: +(sd(warm) * 100).toFixed(2),
      tones: [...counts.values()].filter((v) => v >= area * 0.01).length,
      flatPct: small === 0 ? 0 : +((flat * 100) / small).toFixed(1),
    };
  }
  return out;
}

/**
 * 따뜻함(3차에서 더한 수치 — 기획서 4.7.5의 ㅍ). 장면 그림 전체를 점 세 개마다 하나씩 잰다(조정자의 잼과 같은 셈).
 *   greenHue: 풀빛(초록이 가장 크고 채도 0.2 넘는 점)의 평균 색상각(도). 100 안팎이면 노란 연두, 120을 넘으면 청록 쪽.
 *   warmth: 화면 전체의 (빨강 − 파랑) 평균.
 *   darkWarmth: 어두운 점(HSL 밝기 0.3 아래)의 (빨강 − 파랑) 평균. 0보다 크면 그늘이 갈색, 작으면 푸르스름.
 *   darkShare: 어두운 점의 몫.
 *   lum: 평균 HSL 밝기((가장 큰 값 + 가장 작은 값) / 510).
 */
export function warmth(img) {
  const { w, h, d } = img;
  let n = 0;
  let rb = 0;
  let lumSum = 0;
  let gH = 0;
  let gN = 0;
  let darkRB = 0;
  let darkN = 0;
  for (let i = 0; i < w * h; i += 3) {
    const v = d[i];
    const r = v & 255;
    const g = (v >>> 8) & 255;
    const b = (v >>> 16) & 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 510;
    const s = mx === mn ? 0 : (mx - mn) / mx;
    n++;
    rb += r - b;
    lumSum += l;
    let hue = 0;
    if (mx !== mn) {
      if (mx === r) hue = ((g - b) / (mx - mn)) % 6;
      else if (mx === g) hue = (b - r) / (mx - mn) + 2;
      else hue = (r - g) / (mx - mn) + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    if (g > r && g > b && s > 0.2) {
      gH += hue;
      gN++;
    }
    if (l < 0.3) {
      darkRB += r - b;
      darkN++;
    }
  }
  return {
    greenHue: +(gH / Math.max(1, gN)).toFixed(1),
    warmth: +(rb / n).toFixed(1),
    darkWarmth: +(darkRB / Math.max(1, darkN)).toFixed(1),
    darkShare: +((darkN / n) * 100).toFixed(1),
    lum: +(lumSum / n).toFixed(3),
  };
}

/**
 * 대비 큰 외톨이 점(3차에서 뜻을 바꾼 ㄹ): 이웃 여덟 점이 모두 자기와 다른 빛이고, 그 가운데 가장 가까운 이웃과도
 * 밝기 차가 big(0~1) 넘게 나는 점. 땅 그림의 그림 점 천 개당. 고운 결(이웃 단계로만 옮겨 가는 점)은 세지 않는다.
 */
export function harshOrphans(img, big = 0.12) {
  const { w, h, d } = img;
  let n = 0;
  let all = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = d[y * w + x];
      if (A(c) === 0) continue;
      all++;
      let alone = true;
      let nearest = 1;
      const lc = luma(c);
      for (let j = -1; j <= 1 && alone; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const q = d[(y + j) * w + x + i];
          if (q === c) {
            alone = false;
            break;
          }
          nearest = Math.min(nearest, Math.abs(luma(q) - lc));
        }
      }
      if (alone && nearest > big) n++;
    }
  }
  return all === 0 ? 0 : +((n * 1000) / all).toFixed(2);
}

/** 대비 큰 체크무늬(3차에서 뜻을 바꾼 ㄷ): 2×2가 a b / b a이고 a와 b의 밝기 차가 big 넘는 것. 그림 점 천 개당. */
export function harshChecker(img, big = 0.1) {
  const { w, h, d } = img;
  let n = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = d[y * w + x];
      const b = d[y * w + x + 1];
      if (a !== b && d[(y + 1) * w + x] === b && d[(y + 1) * w + x + 1] === a && Math.abs(luma(a) - luma(b)) > big) n++;
    }
  }
  return +((n * 1000) / (w * h)).toFixed(2);
}

/**
 * 사람이 바닥에서 떨어져 보이는 정도(3차에서 바꾼 ㅁ): 사람 그림의 가장 바깥 점마다, 그 바로 밖(위·아래·옆)의 바닥 점과의
 * 밝기 차를 내어 평균한다. 먹빛 테두리가 없어도 잴 수 있다. ground는 사람을 그리기 전의 바닥(그림자 포함).
 * bare(있으면): 움직이는 발밑 그림자를 얹기 전의 바닥 — ㅁ의 "바로 밖 바닥"은 이것으로 잰다(기획서 4.7.5, 2026-11-04.
 * 게임의 시험 tests/artRules.ts의 edgeContrast와 같은 셈). 발밑 그림자는 따로 본다(자리·짙기).
 */
export function edgeContrast(sprite, x0, y0, ground, bare) {
  const floor = bare ?? ground;
  const { w, h, d } = sprite;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(d[y * w + x]) > 0;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (on(x + dx, y + dy)) continue;
        const g = floor.get(x0 + x + dx, y0 + y + dy);
        if (A(g) === 0) continue;
        sum += Math.abs(luma(d[y * w + x]) - luma(g));
        n++;
      }
    }
  }
  return n === 0 ? 0 : +(sum / n).toFixed(3);
}

/**
 * 때(4차에서 더한 수치 — 기획서 4.7.5의 ㅎ). 세운 것 한 장(집·담·대문)에서:
 *   grimePct: 둘레 r점(그림 점 4×k — 맵 점 4) 안의 평균보다 밝기가 0.08 넘게 낮은 점의 몫(%) — 짙은 줄·얼룩 자국.
 *     (기둥·문살처럼 꼴이 짙은 곳도 함께 세므로 같은 꼴의 v3과 v3.1을 견줄 때 뜻이 크다. 지금 그림은 참고)
 *   rough: 이웃한 두 점(위아래·옆)의 밝기 차 평균 ×100 — 재질의 결이 얼마나 거친가.
 * k = 그림 점 / 맵 점(지금 그림 1, 시안 2).
 */
export function grime(img, k) {
  const { w, h, d } = img;
  const r = 4 * k;
  const L = new Float32Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) if (A(d[i]) > 0) L[i] = luma(d[i]);
  let dark = 0;
  let on = 0;
  let diff = 0;
  let pairs = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = L[y * w + x];
      if (l < 0) continue;
      on++;
      let sum = 0;
      let n = 0;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          const X = x + i;
          const Y = y + j;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const q = L[Y * w + X];
          if (q < 0) continue;
          sum += q;
          n++;
        }
      }
      if (l < sum / n - 0.08) dark++;
      if (x + 1 < w && L[y * w + x + 1] >= 0) {
        diff += Math.abs(L[y * w + x + 1] - l);
        pairs++;
      }
      if (y + 1 < h && L[(y + 1) * w + x] >= 0) {
        diff += Math.abs(L[(y + 1) * w + x] - l);
        pairs++;
      }
    }
  }
  return { grimePct: on ? +((dark * 100) / on).toFixed(1) : 0, rough: pairs ? +((diff * 100) / pairs).toFixed(2) : 0 };
}

/**
 * 얼룩덜룩함(4차): 땅을 풀·흙으로 나눠, 맵 점 8×8 조각의 평균 밝기가 이웃 조각(오른쪽·아래)과 얼마나 차이 나는가의 평균 ×100.
 * 큰 결(monotony의 lumaStd)은 남기면서 이 값만 낮추면 "얼룩이 부드럽게 번진" 꼴이 된다.
 */
export function blotch(ground, region, k) {
  const { cam, tiles, terrain } = region;
  const code = (X, Y) => {
    const tx = Math.floor((X / k + cam.x) / 16);
    const ty = Math.floor((Y / k + cam.y) / 16);
    const ch = terrain[ty - tiles.y0]?.[tx - tiles.x0] ?? '?';
    return 'gm'.includes(ch) ? 'grass' : 'py'.includes(ch) ? 'dirt' : null;
  };
  const s = 8 * k;
  const bw = Math.floor(ground.w / s);
  const bh = Math.floor(ground.h / s);
  const mean = new Float32Array(bw * bh).fill(-1);
  const kind = new Array(bw * bh).fill(null);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const x0 = bx * s;
      const y0 = by * s;
      const c = [code(x0, y0), code(x0 + s - 1, y0), code(x0, y0 + s - 1), code(x0 + s - 1, y0 + s - 1)];
      if (!c.every((q) => q === c[0]) || !c[0]) continue;
      let L = 0;
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) L += luma(ground.d[y * ground.w + x]);
      mean[by * bw + bx] = L / (s * s);
      kind[by * bw + bx] = c[0];
    }
  }
  const out = {};
  for (const want of ['grass', 'dirt']) {
    let sum = 0;
    let n = 0;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const i = by * bw + bx;
        if (kind[i] !== want) continue;
        for (const j of [bx + 1 < bw ? i + 1 : -1, by + 1 < bh ? i + bw : -1]) {
          if (j < 0 || kind[j] !== want) continue;
          sum += Math.abs(mean[i] - mean[j]);
          n++;
        }
      }
    }
    out[want] = n ? +((sum * 100) / n).toFixed(2) : 0;
  }
  return out;
}
