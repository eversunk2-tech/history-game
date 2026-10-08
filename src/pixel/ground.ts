// 땅 그림. 타일을 한 장씩 찍어 붙이지 않고, 맵 전체를 한 장의 그림으로 "칠한다".
//
// 1) 점마다 어느 땅인지 가른다. 칸의 경계를 그대로 쓰지 않고, 둘레 칸을 뭉갠 값에 무늬를 더해 가르므로
//    길과 물가가 구불구불 이어지고 격자 티가 나지 않는다.
// 2) 땅마다 큰 얼룩 + 작은 결 + 낱낱의 것(풀포기, 들꽃, 자갈, 흙덩이)을 얹는다. 무늬의 주기가 맵보다 커서
//    같은 그림이 되풀이되지 않는다.
// 3) 물가의 턱, 논둑의 그늘, 둔덕의 비탈면, 세운 것의 그림자를 얹는다.
//
// 냇물 자리는 비워 둔다(알파 0). 그 아래에 움직이는 물결을 깔고 이 그림을 덮는다.
// 캔버스를 쓰지 않는다(버퍼만 다룬다).

import { T, TILE, isWater } from '../map/types';
import type { Palette } from './palette';
import { Px, alpha, bayer, blue, clamp, fbm, green, hash2, mix, red, rgb, tnoise, vnoise, withAlpha, type Color } from './px';

// 점의 갈래
const K = {
  grass: 0,
  forest: 1,
  thicket: 2,
  path: 3,
  yard: 4,
  ridge: 5, // 논둑 가운데의 밟힌 흙
  soil: 6,
  paddy: 7,
  field: 8,
  water: 9,
  deep: 10,
  rock: 11,
  bank: 12,
  steps: 13,
} as const;

const KIND_OF: number[] = [];
KIND_OF[T.grass] = K.grass;
KIND_OF[T.meadow] = K.grass;
KIND_OF[T.forest] = K.forest;
KIND_OF[T.thicket] = K.thicket;
KIND_OF[T.path] = K.path;
KIND_OF[T.yard] = K.yard;
KIND_OF[T.ridge] = K.grass;
KIND_OF[T.soil] = K.soil;
KIND_OF[T.paddy] = K.paddy;
KIND_OF[T.field] = K.field;
KIND_OF[T.shallow] = K.water;
KIND_OF[T.deep] = K.deep;
KIND_OF[T.ford] = K.water;
KIND_OF[T.bridge] = K.water;
KIND_OF[T.rock] = K.rock;
KIND_OF[T.bank] = K.bank;
KIND_OF[T.steps] = K.steps;

const isPlot = (k: number): boolean => k === K.soil || k === K.paddy || k === K.field;
const isWet = (k: number): boolean => k === K.water || k === K.deep;

/** 바닥에 지는 그림자(타원). 좌표는 맵의 점. */
export interface Shade {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** 나뭇잎 사이로 빛이 새는 얼룩 그림자인가 */
  dapple?: boolean;
  /** 큰 나무: 얼룩의 덩어리가 크고 가장자리에만 빛이 샌다 */
  broad?: boolean;
  /** 0~1. 클수록 짙다 */
  strength?: number;
  /**
   * 집의 꼴을 따라 드리운 그림자: 벽의 아랫줄이 x0~x1(맵의 점), 땅에 닿는 줄이 y, 처마 높이가 h.
   * 빛이 왼쪽 위에서 오므로 오른쪽으로 side만큼, 아래로 depth만큼 드리운다.
   */
  cast?: { x0: number; x1: number; y: number; h: number; side: number; depth: number; ragged?: boolean };
}

export interface GroundMap {
  w: number;
  h: number;
  terrain: Uint8Array;
}

export interface Ground {
  px: Px;
  /** 칸마다: 물결이 비쳐 보이는 점이 있는가 */
  wet: Uint8Array;
  /** 칸마다: 물 댄 논인가(반짝임을 놓을 곳) */
  glint: Uint8Array;
}

export function paintGround(map: GroundMap, pal: Palette, shades: readonly Shade[] = []): Ground {
  const { w, h, terrain } = map;
  const W = w * TILE;
  const H = h * TILE;
  const out = new Px(W, H);
  const kind = new Uint8Array(W * H);
  const amt = new Uint8Array(W * H);

  const tAt = (tx: number, ty: number): number =>
    terrain[clamp(ty, 0, h - 1) * w + clamp(tx, 0, w - 1)];

  // ── 칸의 무리마다 0/1 판 ──
  const maskOf = (test: (t: number) => boolean): Uint8Array => {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = test(terrain[i]) ? 1 : 0;
    return m;
  };
  const mWater = maskOf(isWater);
  const mDeep = maskOf((t) => t === T.deep);
  const mPlot = maskOf((t) => t === T.soil || t === T.paddy || t === T.field);
  const mPath = maskOf((t) => t === T.path);
  const mRidge = maskOf((t) => t === T.ridge);
  const mYard = maskOf((t) => t === T.yard || t === T.path);
  const mRock = maskOf((t) => t === T.rock || t === T.path || t === T.steps);
  const mForest = maskOf((t) => t === T.forest || t === T.thicket || t === T.path);
  const mThick = maskOf((t) => t === T.thicket);

  /** 점 (x, y) 둘레(반 너비 r)의 칸들이 이 무리로 덮인 몫(0~1) */
  const cover = (m: Uint8Array, x: number, y: number, r: number): number => {
    const tx = x >> 4;
    const ty = y >> 4;
    const fx = (x & 15) + 0.5;
    const fy = (y & 15) + 0.5;
    const l = Math.max(0, r - fx);
    const rr = Math.max(0, fx + r - TILE);
    const c = 2 * r - l - rr;
    const u = Math.max(0, r - fy);
    const d = Math.max(0, fy + r - TILE);
    const mid = 2 * r - u - d;
    const x0 = tx > 0 ? tx - 1 : 0;
    const x2 = tx < w - 1 ? tx + 1 : tx;
    const row = (yy: number): number => {
      const o = yy * w;
      return c * m[o + tx] + (l > 0 ? l * m[o + x0] : 0) + (rr > 0 ? rr * m[o + x2] : 0);
    };
    let sum = mid * row(ty);
    if (u > 0) sum += u * row(ty > 0 ? ty - 1 : 0);
    if (d > 0) sum += d * row(ty < h - 1 ? ty + 1 : ty);
    return sum / (4 * r * r);
  };

  // 둘레 여덟 칸이 모두 같은 땅인 칸은 빨리 지나간다
  const uniform = new Uint8Array(w * h);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const k = KIND_OF[terrain[ty * w + tx]];
      let same = true;
      for (let j = -1; j <= 1 && same; j++) {
        for (let i = -1; i <= 1; i++) {
          if (KIND_OF[tAt(tx + i, ty + j)] !== k) {
            same = false;
            break;
          }
        }
      }
      uniform[ty * w + tx] = same ? 1 : 0;
    }
  }

  // ── 1. 점마다 땅을 가른다 ──
  for (let y = 0; y < H; y++) {
    const ty = y >> 4;
    for (let x = 0; x < W; x++) {
      const tx = x >> 4;
      const ti = ty * w + tx;
      const t = terrain[ti];
      const i = y * W + x;
      if (t === T.bank || t === T.steps) {
        kind[i] = KIND_OF[t];
        amt[i] = 255;
        continue;
      }
      if (uniform[ti]) {
        kind[i] = KIND_OF[t];
        amt[i] = 255;
        continue;
      }
      const n = (vnoise(x / 7.3, y / 7.3, 11) - 0.5) * 2 + (vnoise(x / 2.9, y / 2.9, 12) - 0.5) * 0.5;
      const cw = cover(mWater, x, y, 6);
      if (cw + n * 0.24 > 0.5) {
        const dx2 = clamp(Math.round(x + (vnoise(x / 17, y / 17, 15) - 0.5) * 18), 0, W - 1);
        const dy2 = clamp(Math.round(y + (vnoise(x / 17 + 3.1, y / 17 + 7.7, 16) - 0.5) * 18), 0, H - 1);
        const cd = cover(mDeep, dx2, dy2, 8);
        kind[i] = cd + n * 0.12 > 0.52 ? K.deep : K.water;
        amt[i] = Math.round(clamp(cw, 0, 1) * 255);
        continue;
      }
      const cp = cover(mPlot, x, y, 4);
      if (cp + n * 0.07 > 0.5) {
        // 가장 가까운 논밭 칸의 갈래를 따른다
        let pk = KIND_OF[t];
        if (!isPlot(pk)) {
          const fx = x & 15;
          const fy = y & 15;
          const cand: [number, number, number][] = [
            [tx - 1, ty, fx],
            [tx + 1, ty, 15 - fx],
            [tx, ty - 1, fy],
            [tx, ty + 1, 15 - fy],
          ];
          let best = 99;
          for (const [cx, cy, d] of cand) {
            const ck = KIND_OF[tAt(cx, cy)];
            if (isPlot(ck) && d < best) {
              best = d;
              pk = ck;
            }
          }
        }
        if (isPlot(pk)) {
          kind[i] = pk;
          amt[i] = Math.round(clamp(cp, 0, 1) * 255);
          continue;
        }
      }
      const cpath = cover(mPath, x, y, 6);
      if (cpath + n * 0.3 > 0.5) {
        kind[i] = K.path;
        amt[i] = Math.round(clamp(cpath, 0, 1) * 255);
        continue;
      }
      if (t === T.ridge) {
        const cr = cover(mRidge, x, y, 5);
        // 논둑이 꺾이거나 만나는 곳이 아니면 가운데 줄만 밟힌 흙으로 보인다
        const fx = (x & 15) - 7.5;
        const fy = (y & 15) - 7.5;
        const horiz = tAt(tx - 1, ty) === T.ridge || tAt(tx + 1, ty) === T.ridge;
        const vert = tAt(tx, ty - 1) === T.ridge || tAt(tx, ty + 1) === T.ridge;
        const off = horiz && vert ? Math.min(Math.abs(fx), Math.abs(fy)) : horiz ? Math.abs(fy) : Math.abs(fx);
        if (off + n * 1.6 < 2.6 && cr > 0.3) {
          kind[i] = K.ridge;
          amt[i] = 255;
          continue;
        }
      }
      const cy = cover(mYard, x, y, 6);
      if (cy + n * 0.3 > 0.5) {
        kind[i] = K.yard;
        amt[i] = Math.round(clamp(cy, 0, 1) * 255);
        continue;
      }
      const crock = cover(mRock, x, y, 6);
      if (crock + n * 0.3 > 0.5) {
        kind[i] = K.rock;
        amt[i] = Math.round(clamp(crock, 0, 1) * 255);
        continue;
      }
      // 숲 바닥과 풀밭의 경계는 칸을 따라 꺾이지 않게, 재는 자리를 크게 휘어서 가른다
      const fx = clamp(Math.round(x + (vnoise(x / 21, y / 21, 13) - 0.5) * 26), 0, W - 1);
      const fy = clamp(Math.round(y + (vnoise(x / 21 + 5.3, y / 21 + 1.7, 14) - 0.5) * 26), 0, H - 1);
      const cf = cover(mForest, fx, fy, 7);
      if (cf + n * 0.3 > 0.5) {
        kind[i] = cover(mThick, fx, fy, 7) > 0.5 ? K.thicket : K.forest;
        amt[i] = Math.round(clamp(cf + n * 0.3, 0, 1) * 255);
        continue;
      }
      kind[i] = K.grass;
      amt[i] = 255;
    }
  }
  // 논둑 칸은 한결같아도 가운데 줄을 그린다(위에서 uniform으로 지나간 칸)
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      if (terrain[ty * w + tx] !== T.ridge || !uniform[ty * w + tx]) continue;
      for (let fy = 0; fy < TILE; fy++) {
        for (let fx = 0; fx < TILE; fx++) {
          const x = tx * TILE + fx;
          const y = ty * TILE + fy;
          const n = (vnoise(x / 7.3, y / 7.3, 11) - 0.5) * 2;
          if (Math.min(Math.abs(fx - 7.5), Math.abs(fy - 7.5)) + n * 1.6 < 2.6) kind[y * W + x] = K.ridge;
        }
      }
    }
  }

  const kAt = (x: number, y: number): number => kind[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];

  // ── 2. 땅마다 칠한다 ──
  const { grass, forest, path, yard, soil, mud, stone, water, paddy, crop, wood } = pal;
  const paddyState = pal.paddyState;
  const SAND = mix(path[3], water[4], 0.35);

  for (let y = 0; y < H; y++) {
    const ty = y >> 4;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = kind[i];
      const a = amt[i] / 255;
      const tx = x >> 4;
      const t = terrain[ty * w + tx];
      let c: Color = 0;
      switch (k) {
        case K.grass: {
          const m = fbm(x / 23, y / 17, 101);
          const f = vnoise(x / 2.3, y / 2.3, 102);
          let v = 3 + (m - 0.5) * 3.4 + (f - 0.5) * 0.9;
          const hsh = hash2(x >> 1, y, 103);
          if (hsh < 0.035) v -= 1;
          else if (hsh > 0.972) v += 1;
          // 길과 마당 곁의 풀은 조금 짙다(밟혀서 낮고 거친 풀)
          const below = kAt(x, y + 1);
          if (below === K.path || below === K.yard) v -= 1;
          c = grass[clamp(Math.round(v), 2, 4)];
          // 논둑의 풀은 조금 마른 빛
          if (t === T.ridge && hash2(x, y >> 1, 104) < 0.3) c = pal.grassTip[1];
          break;
        }
        case K.forest:
        case K.thicket: {
          const m = fbm(x / 19, y / 15, 111);
          const f = vnoise(x / 2.4, y / 2.4, 112);
          let v = (k === K.thicket ? 1.1 : 2.1) + (m - 0.5) * 3 + (f - 0.5) * 1.0;
          // 풀밭과 만나는 곳은 풀빛 쪽으로 풀린다(가장자리는 점을 섞는다)
          if (a < 0.6) {
            c = bayer(x, y) < (0.6 - a) * 8 ? grass[2] : forest[clamp(Math.round(v + 1.2), 0, 4)];
            break;
          }
          if (a < 0.75) v += 0.8;
          c = forest[clamp(Math.round(v), 0, 4)];
          const hsh = hash2(x >> 1, y, 113);
          // 떨어진 잎과 잔가지
          if (hsh < 0.022) c = pal.thatch[1];
          else if (hsh < 0.034) c = pal.bark[2];
          else if (hsh > 0.985) c = forest[4];
          break;
        }
        case K.path: {
          const m = fbm(x / 15, y / 11, 201);
          const f = vnoise(x / 2.1, y / 2.1, 202);
          let v = 3 + (m - 0.5) * 2.6 + (f - 0.5) * 0.8;
          if (a > 0.93) v += 0.4; // 가운데는 밟혀서 밝다
          if (a < 0.64) v -= 0.9;
          const hsh = hash2(x, y, 203);
          if (hsh < 0.008) v -= 1;
          else if (hsh > 0.993) v += 1;
          const up = kAt(x, y - 1);
          if (up !== K.path && up !== K.yard && up !== K.rock) v = Math.min(v, 1.4); // 풀 아래의 그늘
          c = path[clamp(Math.round(v), 1, 5)];
          break;
        }
        case K.ridge: {
          const f = vnoise(x / 2.2, y / 2.2, 211);
          c = f > 0.68 ? path[4] : f > 0.16 ? path[3] : path[2];
          if (hash2(x, y, 212) < 0.07) c = grass[3];
          break;
        }
        case K.yard: {
          const m = fbm(x / 21, y / 14, 221);
          const f = vnoise(x / 2.6, y / 2.6, 222);
          let v = 2.3 + (m - 0.5) * 2.2 + (f - 0.5) * 0.7;
          if (a < 0.64) v -= 0.8;
          const hsh = hash2(x, y, 223);
          if (hsh < 0.008) v -= 1.3;
          else if (hsh > 0.993) v += 1;
          const up = kAt(x, y - 1);
          if (up !== K.path && up !== K.yard) v = Math.min(v, 0.8);
          c = yard[clamp(Math.round(v), 0, 4)];
          break;
        }
        case K.rock: {
          const m = fbm(x / 9, y / 8, 501);
          const f = vnoise(x / 2.2, y / 2.2, 502);
          if (m > 0.63) c = stone[clamp(Math.round(3.4 + (f - 0.5) * 1.2), 3, 4)];
          else c = path[clamp(Math.round(2.6 + (f - 0.5) * 1.0 + (m - 0.4) * 2), 2, 4)];
          if (a < 0.66 && f > 0.5) c = grass[2];
          break;
        }
        case K.soil:
        case K.paddy:
        case K.field: {
          c = plotColor(k === K.soil && paddyState !== 'water' ? K.paddy : k, x, y, a);
          // 논둑 턱의 그늘
          const up1 = kAt(x, y - 1);
          const up2 = kAt(x, y - 2);
          if (!isPlot(up1)) c = soil[0];
          else if (!isPlot(up2)) c = k === K.paddy && paddyState === 'water' ? mud[0] : soil[0];
          else if (!isPlot(kAt(x - 1, y)) || !isPlot(kAt(x + 1, y))) c = k === K.paddy && paddyState === 'water' ? mud[1] : soil[1];
          break;
        }
        case K.water:
        case K.deep: {
          // 물가의 턱: 북쪽 둑은 비탈면이 보이고, 남쪽 둑은 물이 닿은 흰 줄만 보인다
          let rise = 0;
          for (let j = 1; j <= 5; j++) {
            if (!isWet(kAt(x, y - j))) {
              rise = j;
              break;
            }
          }
          if (rise === 1) c = hash2(x, y, 301) < 0.5 ? grass[1] : soil[1];
          else if (rise === 2) c = soil[hash2(x >> 1, y, 302) < 0.3 ? 2 : 1];
          else if (rise === 3) c = hash2(x >> 1, y, 303) < 0.25 ? stone[2] : soil[0];
          else if (rise === 4) c = withAlpha(water[0], 150);
          else if (rise === 5) c = withAlpha(water[0], bayer(x, y) < 0.5 ? 120 : 60);
          else if (!isWet(kAt(x, y + 1))) c = hash2(x >> 1, y, 304) < 0.7 ? water[6] : withAlpha(water[5], 200);
          else if (!isWet(kAt(x, y + 2))) c = hash2(x >> 1, y, 305) < 0.4 ? withAlpha(water[5], 170) : withAlpha(SAND, 150);
          else if (!isWet(kAt(x - 1, y)) || !isWet(kAt(x + 1, y))) c = withAlpha(water[1], 190);
          else if (a < 0.6) c = withAlpha(SAND, 140);
          else if (a < 0.72) c = bayer(x, y) < 0.5 ? withAlpha(SAND, 110) : withAlpha(SAND, 50);
          else if (k === K.deep) c = withAlpha(water[0], 92);
          else if (kAt(x - 2, y) === K.deep || kAt(x + 2, y) === K.deep || kAt(x, y - 2) === K.deep || kAt(x, y + 2) === K.deep) c = withAlpha(water[0], 46);
          else c = 0;
          break;
        }
        case K.bank: {
          c = bankColor(x, y, tx, ty);
          break;
        }
        case K.steps: {
          const fy = y & 15;
          const fx = x & 15;
          const step = fy & 3;
          const joint = hash2(fx >> 2, fy >> 2, 611 + tx) < 0.35 && (fx & 3) === 0;
          if (step === 0) c = stone[5];
          else if (step === 1) c = stone[4];
          else if (step === 2) c = stone[2];
          else c = stone[1];
          if (joint && step < 2) c = stone[3];
          if (fx === 0 || fx === 15) c = stone[1];
          break;
        }
      }
      out.d[i] = c;
    }
  }

  function plotColor(k: number, x: number, y: number, a: number): Color {
    if (k === K.field) {
      const yy = y + Math.round((vnoise(x / 13, y / 29, 401) - 0.5) * 2);
      const band = ((yy % 6) + 6) % 6;
      const hsh = hash2(x >> 1, yy, 402);
      let v = [0, 1, 3, 3, 2, 1][band];
      if (hsh < 0.14) v -= 1;
      else if (hsh > 0.86) v += 1;
      let c = soil[clamp(v, 0, 4)];
      if (pal.season === 'winter' && band >= 2 && band <= 3 && hsh > 0.4) c = grass[5];
      return c;
    }
    if (k === K.soil) {
      const yy = y + Math.round((vnoise(x / 9, y / 31, 411) - 0.5) * 3);
      const band = ((yy % 5) + 5) % 5;
      let v = [0, 1, 3, 2, 1][band];
      const hsh = hash2(x >> 1, yy, 412);
      if (hsh > 0.82) v += 1;
      else if (hsh < 0.13) v -= 1;
      if (fbm(x / 19, y / 13, 413) < 0.38) v -= 1;
      return soil[clamp(v, 0, 4)];
    }
    // 논
    if (paddyState === 'water') {
      let v = 2.7 + (fbm(x / 34, y / 8, 421) - 0.5) * 3.0;
      if (fbm(x / 47, y / 31, 422) > 0.6) v += 1;
      if (hash2(x >> 2, y, 423) < 0.03) v += 1.2;
      let c = paddy[clamp(Math.round(v), 1, 5)];
      // 가장자리는 얕아서 논바닥의 흙빛이 비친다
      if (a < 0.66) c = mud[2];
      else if (a < 0.8) c = bayer(x, y) < (0.8 - a) / 0.14 ? mud[3] : c;
      else if (a < 0.9 && bayer(x, y) < 0.25) c = mud[3];
      return c;
    }
    if (paddyState === 'bare') {
      const f = vnoise(x / 2.4, y / 2.4, 431);
      const m = fbm(x / 21, y / 15, 432);
      if (m > 0.52) return grass[clamp(Math.round(4 + (f - 0.5) * 2), 3, 6)]; // 눈이 덮인 곳
      const hsh = hash2(x, y >> 1, 433);
      if (hsh < 0.1) return crop[2]; // 벼 그루터기
      return soil[clamp(Math.round(2.4 + (f - 0.5) * 2), 1, 4)];
    }
    // 푸른 벼, 누런 벼: 흩어 뿌린 벼라 줄이 없다
    const f = vnoise(x / 1.7, y / 3.1, 441);
    const m = fbm(x / 17, y / 13, 442);
    let v = 1.4 + (f - 0.5) * 3.2 + (m - 0.5) * 1.4;
    if (hash2(x, y >> 1, 443) > 0.93) v += 1;
    return crop[clamp(Math.round(v), 0, 3)];
  }

  function bankColor(x: number, y: number, tx: number, ty: number): Color {
    const fx = x & 15;
    const fy = y & 15;
    const leftEnd = tAt(tx - 1, ty) !== T.bank && tAt(tx - 1, ty) !== T.steps && tAt(tx - 1, ty) !== T.path;
    const rightEnd = tAt(tx + 1, ty) !== T.bank && tAt(tx + 1, ty) !== T.steps && tAt(tx + 1, ty) !== T.path;
    // 끝에서는 비탈이 낮아져 풀밭으로 이어진다
    let drop = 0;
    if (leftEnd && fx < 9) drop = Math.max(drop, (9 - fx) * 1.6);
    if (rightEnd && fx > 6) drop = Math.max(drop, (fx - 6) * 1.6);
    const top = 2 + Math.round(vnoise(x / 4.2, ty * 3.3, 601) * 2.4) + Math.round(drop);
    const g = (vnoise(x / 23, y / 17, 101) - 0.5) * 2;
    if (fy < top - 1 || top > 14) return grass[clamp(Math.round(3 + g), 2, 4)];
    if (fy === top - 1) return grass[5];
    if (fy === top) return grass[hash2(x, ty, 602) < 0.5 ? 1 : 2];
    if (fy === top + 1 && hash2(x, ty, 603) < 0.45) return grass[1];
    const depth = (fy - top) / Math.max(1, 15 - top);
    const streak = hash2(x >> 1, ty, 604);
    let v = 3.2 - depth * 2.6 + (streak - 0.5) * 1.2;
    if (fy >= 14) v = 0;
    const earth = [soil[0], soil[1], path[1], path[2], path[3]];
    let c = earth[clamp(Math.round(v), 0, 4)];
    // 박힌 돌
    const sx = Math.floor(x / 7);
    const sy = Math.floor((fy - top) / 5);
    if (hash2(sx, sy * 31 + ty, 605) < 0.4 && fy > top + 1 && fy < 14) {
      const ox = x - sx * 7 - 1 - Math.floor(hash2(sx, ty, 606) * 3);
      const oy = fy - top - sy * 5 - 2;
      if (ox >= 0 && ox < 4 && oy >= 0 && oy < 3) {
        c = oy === 0 || ox === 0 ? stone[4] : oy === 2 || ox === 3 ? stone[2] : stone[3];
      }
    }
    return c;
  }

  // ── 3. 낱낱의 것을 얹는다 ──
  const put = (x: number, y: number, c: Color, on: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (kind[y * W + x] !== on) return;
    out.d[y * W + x] = c;
  };
  const ktile = (x: number, y: number): number => terrain[(clamp(y, 0, H - 1) >> 4) * w + (clamp(x, 0, W - 1) >> 4)];

  // 풀포기
  for (let cy = 0; cy * 7 < H; cy++) {
    for (let cx = 0; cx * 8 < W; cx++) {
      const r = hash2(cx, cy, 701);
      const x = cx * 8 + Math.floor(hash2(cx, cy, 702) * 6);
      const y = cy * 7 + Math.floor(hash2(cx, cy, 703) * 5);
      if (kAt(x, y) !== K.grass) continue;
      const dense = fbm(x / 31, y / 27, 704);
      if (r > 0.34 + dense * 0.5) continue;
      const kindOf = Math.floor(hash2(cx, cy, 705) * 5);
      const lt = pal.grassTip[2];
      const md = pal.grassTip[1];
      const dk = grass[1];
      if (kindOf === 0) {
        put(x, y, lt, K.grass);
        put(x + 2, y, lt, K.grass);
        put(x + 1, y + 1, md, K.grass);
        put(x + 1, y + 2, dk, K.grass);
      } else if (kindOf === 1) {
        put(x, y, lt, K.grass);
        put(x, y + 1, md, K.grass);
        put(x, y + 2, dk, K.grass);
        put(x + 1, y + 2, dk, K.grass);
      } else if (kindOf === 2) {
        put(x, y + 1, md, K.grass);
        put(x + 2, y, lt, K.grass);
        put(x + 2, y + 1, md, K.grass);
        put(x + 4, y + 1, lt, K.grass);
        put(x + 1, y + 2, dk, K.grass);
        put(x + 2, y + 2, dk, K.grass);
        put(x + 3, y + 2, dk, K.grass);
      } else if (kindOf === 3) {
        put(x, y, grass[2], K.grass);
        put(x + 1, y, grass[2], K.grass);
        put(x + 2, y + 1, grass[2], K.grass);
      } else {
        put(x, y, grass[5], K.grass);
        put(x + 1, y, grass[5], K.grass);
        put(x + 1, y + 1, grass[2], K.grass);
      }
    }
  }

  // 들꽃(봄)
  if (pal.flowers) {
    for (let cy = 0; cy * 6 < H; cy++) {
      for (let cx = 0; cx * 6 < W; cx++) {
        const x = cx * 6 + Math.floor(hash2(cx, cy, 711) * 5);
        const y = cy * 6 + Math.floor(hash2(cx, cy, 712) * 5);
        if (kAt(x, y) !== K.grass) continue;
        const meadow = ktile(x, y) === T.meadow;
        const patch = fbm(x / 37, y / 33, 713);
        const chance = meadow ? 0.42 : patch > 0.6 ? 0.2 : 0.025;
        if (hash2(cx, cy, 714) > chance) continue;
        const sort = hash2(cx, cy, 715);
        // 꽃은 무리 지어 핀다: 얼룩마다 주로 한 가지 빛
        const hue = Math.floor(fbm(x / 53, y / 47, 716) * 6 + sort * 1.5) % 4;
        if (hue === 0) {
          // 흰 꽃
          put(x + 1, y, pal.blossomWhite[3], K.grass);
          put(x, y + 1, pal.blossomWhite[3], K.grass);
          put(x + 2, y + 1, pal.blossomWhite[2], K.grass);
          put(x + 1, y + 2, pal.blossomWhite[2], K.grass);
          put(x + 1, y + 1, pal.yellow[2], K.grass);
        } else if (hue === 1) {
          // 노란 꽃
          put(x, y, pal.yellow[3], K.grass);
          put(x + 1, y, pal.yellow[2], K.grass);
          put(x, y + 1, pal.yellow[2], K.grass);
          put(x + 1, y + 1, pal.yellow[1], K.grass);
          put(x + 1, y + 2, grass[1], K.grass);
        } else if (hue === 2) {
          // 분홍 꽃
          put(x, y, pal.blossom[3], K.grass);
          put(x + 1, y, pal.blossom[2], K.grass);
          put(x, y + 1, pal.blossom[2], K.grass);
          put(x + 1, y + 1, pal.blossom[1], K.grass);
          put(x, y + 2, grass[1], K.grass);
        } else {
          // 보랏빛 작은 꽃
          put(x, y, pal.azalea[2], K.grass);
          put(x + 1, y + 1, pal.azalea[1], K.grass);
          put(x + 2, y, pal.azalea[3], K.grass);
          put(x + 1, y + 2, grass[1], K.grass);
        }
      }
    }
  }

  // 숲 바닥의 고사리와 이끼
  for (let cy = 0; cy * 9 < H; cy++) {
    for (let cx = 0; cx * 10 < W; cx++) {
      const x = cx * 10 + Math.floor(hash2(cx, cy, 721) * 8);
      const y = cy * 9 + Math.floor(hash2(cx, cy, 722) * 7);
      const k = kAt(x, y);
      if (k !== K.forest && k !== K.thicket) continue;
      if (hash2(cx, cy, 723) > 0.4) continue;
      const lt = pal.leaf[4];
      const md = pal.leaf[3];
      const dk = pal.forest[0];
      put(x, y + 1, lt, k);
      put(x + 1, y, lt, k);
      put(x + 2, y + 1, md, k);
      put(x + 3, y, md, k);
      put(x + 4, y + 1, md, k);
      put(x + 2, y + 2, dk, k);
      put(x + 1, y + 2, dk, k);
      put(x + 3, y + 2, dk, k);
    }
  }

  // 길과 마당, 돌밭의 자갈
  for (let cy = 0; cy * 9 < H; cy++) {
    for (let cx = 0; cx * 9 < W; cx++) {
      const x = cx * 9 + Math.floor(hash2(cx, cy, 731) * 7);
      const y = cy * 9 + Math.floor(hash2(cx, cy, 732) * 7);
      const k = kAt(x, y);
      const chance = k === K.path ? 0.1 : k === K.rock ? 0.4 : k === K.yard ? 0.035 : 0;
      if (hash2(cx, cy, 733) > chance) continue;
      const big = hash2(cx, cy, 734) > (k === K.rock ? 0.45 : 0.75);
      const base = k === K.yard ? yard : path;
      put(x, y, stone[5], k);
      put(x + 1, y, stone[4], k);
      put(x, y + 1, stone[4], k);
      put(x + 1, y + 1, stone[3], k);
      put(x + 2, y + 1, base[1], k);
      put(x + 1, y + 2, base[1], k);
      if (big) {
        put(x + 2, y, stone[4], k);
        put(x + 2, y + 1, stone[3], k);
        put(x, y + 2, stone[3], k);
        put(x + 1, y + 2, stone[2], k);
        put(x + 2, y + 2, stone[2], k);
        put(x + 3, y + 2, base[1], k);
        put(x + 1, y + 3, base[1], k);
        put(x + 2, y + 3, base[1], k);
      }
    }
  }

  // 길가로 넘어온 풀
  for (let cy = 0; cy * 6 < H; cy++) {
    for (let cx = 0; cx * 7 < W; cx++) {
      const x = cx * 7 + Math.floor(hash2(cx, cy, 741) * 6);
      const y = cy * 6 + Math.floor(hash2(cx, cy, 742) * 5);
      const k = kAt(x, y);
      if (k !== K.path && k !== K.yard) continue;
      if (amt[y * W + x] > 190 || hash2(cx, cy, 743) > 0.55) continue;
      put(x, y, pal.grassTip[1], k);
      put(x + 1, y - 1, pal.grassTip[2], k);
      put(x + 2, y, grass[3], k);
      put(x + 1, y + 1, grass[1], k);
    }
  }

  // 물 댄 논에 드러난 흙덩이, 갈아엎은 논의 큰 흙덩이
  for (let cy = 0; cy * 9 < H; cy++) {
    for (let cx = 0; cx * 11 < W; cx++) {
      const x = cx * 11 + Math.floor(hash2(cx, cy, 751) * 9);
      const y = cy * 9 + Math.floor(hash2(cx, cy, 752) * 7);
      const k = kAt(x, y);
      if (k === K.paddy && paddyState === 'water') {
        // 물 위로 드러난 흙덩이: 드문드문, 크기도 고르지 않게
        const r = hash2(cx, cy, 753);
        if (r > 0.24) continue;
        put(x, y, mud[3], k);
        put(x + 1, y, mud[2], k);
        put(x + 1, y + 1, paddy[1], k);
        if (r < 0.13) {
          put(x + 2, y, mud[1], k);
          put(x, y + 1, mud[1], k);
          put(x + 1, y + 1, mud[0], k);
          put(x + 1, y + 2, paddy[1], k);
          put(x + 2, y + 1, paddy[1], k);
        }
      } else if (k === K.soil && paddyState === 'water') {
        if (hash2(cx, cy, 754) > 0.5) continue;
        put(x, y, soil[4], k);
        put(x + 1, y, soil[3], k);
        put(x, y + 1, soil[2], k);
        put(x + 1, y + 1, soil[0], k);
        put(x + 2, y + 1, soil[0], k);
      }
    }
  }

  // 밭이랑의 새싹(봄·여름), 가을에는 누런 포기
  if (pal.season !== 'winter') {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x += 1) {
        if (kind[y * W + x] !== K.field) continue;
        const yy = y + Math.round((vnoise(x / 13, y / 29, 401) - 0.5) * 2);
        const band = ((yy % 6) + 6) % 6;
        if (band !== 2) continue;
        const cell = Math.floor(x / 4);
        if (x % 4 !== Math.floor(hash2(cell, yy, 761) * 3)) continue;
        if (hash2(cell, yy, 762) > 0.78) continue;
        put(x, y, crop[2], K.field);
        put(x, y - 1, crop[3], K.field);
        if (pal.season !== 'spring' || hash2(cell, yy, 763) > 0.5) put(x + 1, y - 1, crop[1], K.field);
        if (pal.season !== 'spring') put(x, y - 2, crop[3], K.field);
      }
    }
  }

  // 징검다리의 돌과 나무다리
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const t = terrain[ty * w + tx];
      const ox = tx * TILE;
      const oy = ty * TILE;
      if (t === T.ford) {
        const jx = Math.round((hash2(tx, ty, 771) - 0.5) * 3);
        const jy = Math.round((hash2(tx, ty, 772) - 0.5) * 2);
        const cx = ox + 8 + jx;
        const cy = oy + 8 + jy;
        for (let j = -6; j <= 6; j++) {
          for (let i = -7; i <= 7; i++) {
            const d = (i * i) / 44 + (j * j) / 21;
            if (d > 1) continue;
            const lit = (-i * 0.5 - j * 0.9) / 6;
            let c = stone[clamp(Math.round(3.3 + lit * 1.6), 2, 5)];
            if (d > 0.74 && j > 0) c = stone[1];
            if (hash2(cx + i, cy + j, 773) < 0.06) c = stone[2];
            out.set(cx + i, cy + j, c);
          }
        }
        // 돌 둘레의 물결
        for (let i = -7; i <= 7; i++) {
          const yy = cy + Math.round(Math.sqrt(Math.max(0, 1 - (i * i) / 44) * 21)) + 1;
          if (hash2(cx + i, yy, 774) < 0.7 && alpha(out.get(cx + i, yy)) < 255) out.set(cx + i, yy, withAlpha(water[6], 210));
          if (alpha(out.get(cx + i, yy + 1)) < 255) out.set(cx + i, yy + 1, withAlpha(water[0], 110));
        }
      } else if (t === T.bridge) {
        const topEdge = tAt(tx, ty - 1) !== T.bridge;
        const botEdge = tAt(tx, ty + 1) !== T.bridge;
        for (let fy = 0; fy < TILE; fy++) {
          for (let fx = 0; fx < TILE; fx++) {
            const x = ox + fx;
            const y = oy + fy;
            const plank = Math.floor(x / 5);
            const gap = x % 5 === 4;
            const grain = hash2(plank, y >> 2, 781);
            let v = 3 + (hash2(plank, 0, 782) - 0.5) * 1.6 + (grain - 0.5) * 0.8;
            if (gap) v = 1;
            if (x % 5 === 0) v += 0.6;
            let c = wood[clamp(Math.round(v), 1, 5)];
            if (topEdge && fy < 3) c = fy === 0 ? wood[5] : fy === 1 ? wood[3] : wood[1];
            if (botEdge && fy > 11) c = fy === 12 ? wood[4] : fy === 13 ? wood[2] : fy === 14 ? wood[1] : wood[0];
            out.set(x, y, c);
          }
        }
        if (botEdge) {
          // 다리 아래 물에 지는 그늘과 기둥
          for (let fx = 0; fx < TILE; fx++) {
            for (let j = 0; j < 5; j++) {
              const x = ox + fx;
              const y = oy + TILE + j;
              if (alpha(out.get(x, y)) < 255) out.set(x, y, withAlpha(water[0], j < 3 ? 170 : bayer(x, y) < 0.5 ? 150 : 80));
            }
            if (fx >= 6 && fx <= 9) {
              for (let j = 0; j < 4; j++) out.set(ox + fx, oy + TILE + j, fx === 6 ? wood[3] : fx === 9 ? wood[0] : wood[1]);
            }
          }
        }
      }
    }
  }

  // ── 4. 그림자 ──
  const darken = (x: number, y: number, k: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    const c = out.d[i];
    const a = alpha(c);
    if (a === 255) {
      out.d[i] = rgb(Math.round(red(c) * k * 0.95), Math.round(green(c) * k), Math.round(Math.min(255, blue(c) * k * 1.13)));
    } else {
      // 물 위의 그늘: 비쳐 보이는 어두운 물빛을 덧입힌다
      const na = Math.min(235, a + Math.round((1 - k) * 330));
      out.d[i] = withAlpha(a === 0 ? water[0] : mix(c, water[0], 0.5), na);
    }
  };

  // 둔덕 아래
  for (let ty = 0; ty < h - 1; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const t = terrain[ty * w + tx];
      if (t !== T.bank) continue;
      for (let fx = 0; fx < TILE; fx++) {
        const x = tx * TILE + fx;
        const reach = 3 + Math.round(vnoise(x / 5, ty, 801) * 2);
        for (let j = 0; j < reach; j++) {
          const y = (ty + 1) * TILE + j;
          if (j === reach - 1 && bayer(x, y) < 0.5) continue;
          darken(x, y, 0.74);
        }
      }
    }
  }

  // 세운 것의 그림자(겹친 곳이 두 번 어두워지지 않게 표시해 둔다)
  const shadeMark = new Uint8Array(W * H);
  for (const s of shades) {
    const k = 1 - (s.strength ?? 0.3);
    if (s.cast) {
      // 집의 꼴을 따라: 벽 아래의 띠와, 오른쪽으로 비스듬히 드리운 덩어리
      const c = s.cast;
      const top = c.h * 0.62;
      for (let y = Math.floor(c.y - top - 2); y <= c.y + c.depth + 1; y++) {
        for (let x = c.x0; x <= c.x1 + c.side + 1; x++) {
          const jag = c.ragged ? Math.round((vnoise(x / 3.1, y / 3.1, 821) - 0.5) * 2.4) : 0;
          let inside = false;
          if (y >= c.y && y <= c.y + c.depth + jag) {
            inside = x >= c.x0 + 2 + (y - c.y) * 1.1 && x <= c.x1 + c.side - (c.y + c.depth - y) * 0.5 + jag;
          } else if (y < c.y && x >= c.x1 - 3) {
            inside = x <= c.x1 + c.side + jag && y >= c.y - top + (x - c.x1) * 0.6 + jag;
          }
          if (!inside || x < 0 || y < 0 || x >= W || y >= H || shadeMark[y * W + x]) continue;
          shadeMark[y * W + x] = 1;
          darken(x, y, k);
        }
      }
      continue;
    }
    const x0 = Math.floor(s.cx - s.rx - 2);
    const x1 = Math.ceil(s.cx + s.rx + 2);
    const y0 = Math.floor(s.cy - s.ry - 2);
    const y1 = Math.ceil(s.cy + s.ry + 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dx = (x + 0.5 - s.cx) / s.rx;
        const dy = (y + 0.5 - s.cy) / s.ry;
        let d = dx * dx + dy * dy;
        if (s.dapple) {
          const grain = s.broad ? 2.6 : 1;
          d += (vnoise(x / (3.3 * grain), y / (2.9 * grain), 811) - 0.5) * (s.broad ? 0.36 : 0.5);
          if (d > 1) continue;
          // 잎 사이로 새는 빛(큰 나무는 가장자리에서만, 덩어리가 크게)
          if (vnoise(x / (2.6 * grain), y / (2.2 * grain), 812) > (s.broad ? 0.74 : 0.7) && d > (s.broad ? 0.5 : 0.25)) continue;
        } else if (d > 1) continue;
        if (shadeMark[y * W + x]) continue;
        shadeMark[y * W + x] = 1;
        darken(x, y, k);
      }
    }
  }

  // 칸마다 물결이 보이는지, 논물인지
  const wet = new Uint8Array(w * h);
  const glint = new Uint8Array(w * h);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      let holes = false;
      for (let fy = 0; fy < TILE && !holes; fy++) {
        for (let fx = 0; fx < TILE; fx++) {
          if (alpha(out.d[(ty * TILE + fy) * W + tx * TILE + fx]) < 255) {
            holes = true;
            break;
          }
        }
      }
      wet[ty * w + tx] = holes ? 1 : 0;
      glint[ty * w + tx] = terrain[ty * w + tx] === T.paddy && paddyState === 'water' ? 1 : 0;
    }
  }
  return { px: out, wet, glint };
}

/**
 * 움직이는 냇물의 물결. 가로세로 64점짜리 이어 붙는 무늬를 frames장 만든다.
 * 두 겹의 무늬가 서로 반대쪽으로 흘러서, 어느 쪽으로 흐르는 냇물에 깔아도 어색하지 않다.
 */
export function waterFrames(pal: Palette, frames = 24): Px[] {
  const S = 64;
  const out: Px[] = [];
  const { water } = pal;
  for (let k = 0; k < frames; k++) {
    const ph = k / frames;
    const px = new Px(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n1 = tnoise((x + ph * S) / 8, y / 4, 8, 16, 901);
        const n2 = tnoise((x - ph * S) / 16, (y + ph * S) / 8, 4, 8, 902);
        const n3 = tnoise(x / 4 + ph * 16, y / 2, 16, 32, 903);
        const v = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
        let c = water[2];
        if (v > 0.715) c = water[4];
        else if (v > 0.61) c = water[3];
        else if (v < 0.33) c = water[1];
        px.d[y * S + x] = c;
      }
    }
    // 반짝임: 몇 군데가 잠깐씩 빛난다
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const at = Math.floor(hash2(cx, cy, 911) * frames);
        const d = (k - at + frames) % frames;
        if (d > 2) continue;
        const x = cx * 16 + Math.floor(hash2(cx, cy, 912) * 12) + 2;
        const y = cy * 16 + Math.floor(hash2(cx, cy, 913) * 12) + 2;
        px.set(x, y, water[5]);
        if (d === 1) {
          px.set(x, y, water[6]);
          px.set(x - 1, y, water[4]);
          px.set(x + 1, y, water[4]);
        }
      }
    }
    out.push(px);
  }
  return out;
}
