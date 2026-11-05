// 마당과 길가의 것들: 우물, 장독, 나뭇더미, 짚가리, 울타리와 돌담, 돌탑과 돌등, 돌, 그루터기.
//
// 그림 점(ART — 맵 점의 반)으로 그린다(그림 올리기 ②). 꼴·크기·발치는 1-라 그림의 ART배 그대로이고(1-라의 점 좌표를 그림 점의
// 가운데에서 셈해 경계를 곱게 잇는다), 바닥 그림자(shades)는 맵 점 그대로다. 칠은 3.1차 시안의 맛이다(spec 4.7.5):
//   먹빛 테두리를 쓰지 않고 가장자리는 제 빛깔로 가른다(ㄴ — wash.ts의 selfRim), 빛은 왼쪽 위 하나(ㄷ),
//   재질마다 수채화 같은 결(ㅌ — 돌은 큰 결, 나무·싸리·짚은 결 방향으로 긴 결, 질그릇은 잔잔하게), 때·얼룩을 쓰지 않는다(ㅎ).
// 1-라 그림 둘레의 먹빛 테두리 한 점이 차지하던 자리는 그 그림의 제 빛깔로 채운다(같은 넓이를 덮는다).

import type { Palette, Ramp } from './palette';
import { ART, Px, clamp, hash2, hex, mix, rngOf, tnoise, vnoise, type Color } from './px';
import { rock, type SpriteDef } from './shapes';
import { WARM_DARK, WARM_LIGHT, calmSprite, finish, rampsOf, selfRim, watercolor, type RampIndex, type WashOpts } from './wash';

type Maker = (pal: Palette, variant: number) => SpriteDef;

const R = (...list: string[]): Ramp => list.map((s) => hex(s));
/** 질그릇 독의 빛(유약을 바르지 않은 수수한 잿빛 갈색) */
const JAR = R('#33261f', '#4d3a30', '#69513f', '#866a52', '#a3876b', '#bfa587');

const A = ART;
/** 그림 점 X(또는 Y)의 가운데를 1-라의 점 좌표(연속)로 옮긴다 */
const P = (X: number): number => (X + 0.5) / A;

/** 결 → 제 빛깔 그늘 → 외톨이 점 고르기. 결을 여러 겹(자리마다 다른 결) 입힐 수 있다. 돌려주는 값은 결이 어둡게 만든 점(%) */
function finishLayers(px: Px, ramps: RampIndex, layers: readonly (readonly [number, WashOpts])[]): number {
  let dark = 0;
  for (const [seed, o] of layers) dark += watercolor(px, ramps, seed, o);
  selfRim(px, ramps);
  calmSprite(px);
  return dark;
}

// ── 이어 놓는 것(울타리·돌담) ─────────────────────────────────────
// 맵에는 한 칸(32 그림 점)씩 가로·세로로 이어 놓이고, 칸마다 생김새가 제비뽑기로 정해진다(이웃 칸을 모른다).
// 이음매에 곧은 금이 서지 않게: 결은 칸의 너비(높이)를 주기로 이어지는 무늬로 입히고, 제 빛깔 그늘은 칸의 맞은편 끝을 이웃으로 본다.
// 칸 경계에 걸친 돌·띠의 꼴과 빛은 생김새와 상관없이 같다(두 반쪽이 이어진다).

interface Tile {
  /** 가로로 이어진다(주기 = 그림의 너비) */
  x?: number;
  /** 세로로 이어진다(위 칸의 아래쪽을 아래 칸이 덮는다 — 주기 32) */
  y?: number;
}

/** 칸마다 이어지는 수채화 결(wash.ts의 watercolor와 같은 셈 — 무늬만 주기를 가진다) */
function tiledWash(px: Px, ramps: RampIndex, seed: number, o: WashOpts, tile: Tile): number {
  const { w, h, d } = px;
  const up = o.up ?? 0.32;
  const down = -(o.down ?? 0.42);
  // 결 한 칸이 sx×sy 그림 점인 무늬. 이어지는 쪽은 주기가 결 칸의 정수배가 되게 칸 크기를 조금 고친다
  const layer = (sx: number, sy: number, k: number): ((x: number, y: number) => number) => {
    const nx = tile.x ? Math.max(1, Math.round(tile.x / sx)) : 4096;
    const ny = tile.y ? Math.max(1, Math.round(tile.y / sy)) : 4096;
    const fx = tile.x ? nx / tile.x : 1 / sx;
    const fy = tile.y ? ny / tile.y : 1 / sy;
    return (x, y) => tnoise(x * fx, y * fy, nx, ny, seed + k);
  };
  const big = layer(o.big ?? 8, o.bigY ?? 6.5, 0);
  const fine = layer(2.7, 2.3, 1);
  const streak = o.streak ? layer(o.streak[0], o.streak[1], 2) : null;
  let on = 0;
  let darker = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = d[y * w + x];
      if (c >>> 24 !== 255) continue;
      on++;
      const info = ramps.get(c);
      if (!info) continue;
      const [ramp, i] = info;
      let n = (big(x, y) - 0.5) * (o.amp ?? 1.7) * 0.6 + (fine(x, y) - 0.5) * (o.fine ?? 0.8) * 0.55;
      if (streak && o.streak) n += (streak(x, y) - 0.5) * o.streak[2] * 0.5;
      const step = n > up ? 1 : n < down ? -1 : 0;
      if (step === 0) continue;
      const j = clamp(i + step, 0, ramp.length - 1);
      if (j < i) darker++;
      d[y * w + x] = ramp[j];
    }
  }
  return on ? (darker * 100) / on : 0;
}

/** 제 빛깔 그늘(wash.ts의 selfRim과 같다). 이어지는 쪽은 그림 밖을 맞은편 끝의 점으로 본다(세로는 위쪽만 — 아래는 땅이다) */
function tiledRim(px: Px, ramps: RampIndex, tile: Tile): void {
  const src = px.d.slice();
  const { w, h } = px;
  const on = (x: number, y: number): boolean => {
    if (tile.x) x = ((x % w) + w) % w;
    if (tile.y && y < 0) y += tile.y;
    return x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const c = src[y * w + x];
      const info = ramps.get(c);
      if (!on(x, y + 1) || !on(x + 1, y)) px.d[y * w + x] = info ? info[0][Math.max(0, info[1] - 1)] : mix(c, WARM_DARK, 0.3);
      else if (!on(x, y - 1) || !on(x - 1, y)) px.d[y * w + x] = info ? info[0][Math.min(info[0].length - 1, info[1] + 1)] : mix(c, WARM_LIGHT, 0.2);
    }
  }
}

function finishTiled(px: Px, ramps: RampIndex, seed: number, o: WashOpts, tile: Tile): number {
  const dark = tiledWash(px, ramps, seed, o, tile);
  tiledRim(px, ramps, tile);
  calmSprite(px);
  return dark;
}

/** [0, len)을 들쭉날쭉한 너비(lo~hi)로 나눈 경계들(첫 경계 0, 끝 경계 len) */
function splits(len: number, lo: number, hi: number, rnd: () => number): number[] {
  const n = Math.max(1, Math.round(len / ((lo + hi) / 2)));
  const ws = Array.from({ length: n }, () => lo + rnd() * (hi - lo));
  const sum = ws.reduce((a, b) => a + b, 0);
  const out = [0];
  let at = 0;
  for (const w of ws) out.push((at += (w * len) / sum));
  return out;
}

// ── 우물 ─────────────────────────────────────────────────────
// 둥글게 돌을 쌓은 우물과 두레박. 3.1차 시안의 우물보다 돌의 얼룩을 덜었다(13.1의 58번): 돌 켜와 돌 테는 남기되
// 짙은 돌·짙은 줄을 줄이고, 돌마다의 빛은 주로 밝은 쪽으로 조금씩 다르다.
export const well: Maker = (pal) => {
  const W = 38 * A;
  const H = 34 * A;
  const px = new Px(W, H);
  const part = new Uint8Array(W * H); // 1 돌, 2 물, 3 두레박, 4 줄, 5 우물 안 벽
  const put = (X: number, Y: number, c: Color, k: number): void => {
    if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    px.set(X, Y, c);
    part[Y * W + X] = k;
  };
  const { stone, water, wood } = pal;
  const st = (v: number): Color => stone[clamp(Math.round(v), 1, 5)];
  // 1-라의 점 좌표: 돌 테(윗면)의 가운데와 반지름(테두리 한 점까지), 우물 안(물과 안 벽)의 반지름
  const CX = 17;
  const CY = 13;
  const RX = 15.3;
  const RY = 8.3;
  const IRX = 10.46;
  const IRY = 5.3;
  // 앞면(둥근 벽): 둥근 면을 따라 휜 돌 켜. 돌의 너비는 둘레를 따라 재서 켜마다 들쭉날쭉하다
  const RA = RX * A;
  const CH = 7.6; // 켜의 높이(그림 점)
  const edges = [0, 1, 2, 3].map((k) => {
    const rnd = rngOf(240 + k);
    const out: number[] = [];
    for (let a = -RA * 1.7 - rnd() * 10; a < RA * 1.7; a += 9 + rnd() * 7) out.push(a);
    return out;
  });
  const stoneOf = (k: number, a: number): number => {
    const e = edges[clamp(k, 0, 3)];
    let i = 0;
    while (i + 1 < e.length && e[i + 1] <= a) i++;
    return i;
  };
  const arc = (X: number): number => Math.asin(clamp((P(X) - CX) / RX, -1, 1)) * RA;
  const course = (X: number, Y: number): number => {
    const dx = (P(X) - CX) / RX;
    const s = Math.sqrt(Math.max(0, 1 - dx * dx));
    const dist = (P(Y) - (CY + RY * s)) * A;
    return dist + (vnoise(arc(X) / 9, dist / 7, 244) - 0.5) * 2.4;
  };
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const dx = (P(X) - CX) / RX;
      if (Math.abs(dx) >= 1) continue;
      const s = Math.sqrt(1 - dx * dx);
      const y = P(Y);
      const bottom = CY + 9 + 7 * s;
      if (y < CY || y >= bottom) continue;
      const q = course(X, Y);
      const k = Math.floor(q / CH);
      const id = stoneOf(k, arc(X) + k * 5.3);
      const joint = stoneOf(k, arc(X + 1) + k * 5.3) !== id || Math.floor(course(X, Y + 1) / CH) !== k;
      let v = 3.45 - dx * 1.5 + (hash2(id, k, 245) - 0.3) * 0.9 - (q / CH - k) * 0.5;
      if (q - k * CH < 1) v += 0.7; // 켜의 윗줄은 볕
      if (joint) v -= 1.2; // 돌 사이(짙은 돌빛이 아니라 한 단계 아래)
      if (y >= bottom - 1) v -= 0.5;
      put(X, Y, st(v), 1);
    }
  }
  // 돌 테(윗면)와 우물 안: 테는 열한 덩이(너비가 조금씩 다르다), 안쪽은 뒤 벽의 그늘과 하늘이 비친 물
  const bounds = Array.from({ length: 11 }, (_, i) => i + (hash2(i, 0, 243) - 0.5) * 0.45);
  const segOf = (X: number, Y: number): number => {
    const f = ((Math.atan2((P(Y) - CY) / RY, (P(X) - CX) / RX) + Math.PI) / (Math.PI * 2)) * 11;
    let i = 10;
    for (let j = 0; j < 11; j++) if (bounds[j] <= f) i = j;
    return i;
  };
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const x = P(X);
      const y = P(Y);
      const ex = (x - CX) / RX;
      const ey = (y - CY) / RY;
      const e2 = ex * ex + ey * ey;
      if (e2 > 1) continue;
      const ix = (x - CX) / IRX;
      const iy = (y - CY) / IRY;
      if (ix * ix + iy * iy < 1) {
        // 물낯은 우물 안보다 조금 아래·안쪽에 있다. 그 위로 뒤 벽(그늘), 앞 테 밑은 그늘진 물
        const wx = (x - CX - 0.3) / (IRX - 1.1);
        const wy = (y - CY - 1.1) / (IRY - 1.2);
        const wet = wx * wx + wy * wy;
        if (wet > 1) {
          if (y < CY + 0.5) put(X, Y, stone[1], 5);
          else put(X, Y, water[0], 2);
          continue;
        }
        const dx1 = (x - CX) / 14.5;
        const dy1 = (y - CY) / 7.5;
        let c = water[1];
        const lx = (x - CX + 1.6) / 6.5;
        const ly = (y - CY - 1.7) / 2.4;
        if (lx * lx + ly * ly < 1) c = water[2];
        if (dy1 > 0.05 && dx1 > -0.5 && dx1 < 0.1 && vnoise(X / 5, Y / 1.6, 242) > 0.56) c = water[3];
        if (dy1 > 0.25 && dy1 < 0.42 && dx1 > -0.36 && dx1 < -0.12) c = water[4];
        put(X, Y, c, 2);
        continue;
      }
      const seg = segOf(X, Y);
      let v = 3.85 - ex * 1.1 - ey * 0.9 + (hash2(seg, 0, 243) - 0.35) * 0.8;
      if (ey > 0 && e2 > 0.86) v -= 0.5; // 앞 가장자리는 둥글게 내려간다
      if (segOf(X + 1, Y) !== seg || segOf(X, Y + 1) !== seg) v -= 1.3;
      put(X, Y, st(v), 1);
    }
  }
  // 두레박(나무통): 아가리(밝은 테와 안의 그늘), 통널, 테 둘
  const BX0 = 59;
  const BX1 = 74;
  const BY0 = 39;
  const BY1 = 58;
  const bcx = (BX0 + BX1 + 1) / 2;
  const staves = [63, 69];
  for (let Y = BY0; Y <= BY1; Y++) {
    for (let X = BX0; X <= BX1; X++) {
      const u = (X + 0.5 - bcx) / ((BX1 - BX0 + 1) / 2);
      if (Y === BY1 && Math.abs(u) > 0.8) continue;
      if (Y === BY0 && Math.abs(u) > 0.85) continue;
      let v = 3.3 - u * 1.6;
      if (Y <= BY0 + 1) {
        // 아가리: 가장자리 테는 볕, 안은 그늘
        const inside = Math.abs(u) < 0.7 && Y === BY0 + 1;
        put(X, Y, inside ? wood[0] : wood[clamp(Math.round(5.2 - u * 1.4), 2, 5)], 3);
        continue;
      }
      if (Y === 44 || Y === 45 || Y === 52 || Y === 53) v = (Y === 44 || Y === 52 ? 2.2 : 1.5) - u * 0.6; // 테
      else if (staves.includes(X)) v -= 0.8; // 통널의 이음
      if (Y >= BY1 - 1) v -= 0.6;
      put(X, Y, wood[clamp(Math.round(v), 1, 5)], 3);
    }
  }
  // 두레박 줄(꼰 새끼줄): 왼쪽 위로 뻗는다
  for (let i = 0; i <= 12; i++) {
    const X = 60 - i;
    const Y = 38 - Math.round(i * 0.46);
    const lit = Math.floor(i / 2) % 2 === 0;
    put(X, Y, pal.thatch[lit ? 4 : 3], 4);
    put(X, Y + 1, pal.thatch[lit ? 2 : 1], 4);
  }
  const ramps = rampsOf(pal);
  const wash = finishLayers(px, ramps, [
    [241, { big: 6, bigY: 5, keep: (X, Y) => part[Y * W + X] === 1 }],
    [246, { big: 3, bigY: 10, streak: [1.2, 8, 1.2], keep: (X, Y) => part[Y * W + X] === 3 }],
  ]);
  return { frames: [px], ax: 17 * A, ay: 30 * A, shades: [{ dx: 5, dy: -1, rx: 20, ry: 6, strength: 0.32 }], wash };
};

/**
 * 독 하나(1-라의 점 좌표): 어깨가 넓고 밑이 좁다, 왼쪽에 윤이 나는 세로 빛줄, 뚜껑과 꼭지.
 * 앞에 놓인 독은 뒤의 독에 오른쪽으로 그늘을 드리운다(두 점).
 */
function jar(px: Px, cx: number, yBot: number, rw: number, h: number): void {
  const mid = cx + 0.5;
  const top = yBot - h;
  // 몸의 꼴: 어깨에서 가장 넓고(1-라와 같은 너비) 밑으로 갈수록 부드럽게 좁아진다(3.1차 시안의 독)
  const halfAt = (t: number): number =>
    Math.max(2, rw * (t < 0.3 ? 0.62 + 0.38 * Math.sin((t / 0.3) * (Math.PI / 2)) : 1 - 0.32 * Math.pow((t - 0.3) / 0.7, 1.4))) + 0.5 + 0.2;
  for (let Y = top * A; Y <= (yBot + 1) * A - 1; Y++) {
    const t = clamp((P(Y) - 0.5 - top) / h, 0, 1);
    const half = halfAt(t);
    const xr = Math.ceil((mid + half) * A);
    for (let X = xr; X < xr + 2; X++) {
      const i = JAR.indexOf(px.get(X, Y));
      if (i > 0) px.set(X, Y, JAR[i - 1]);
    }
    for (let X = Math.floor((mid - half) * A); X <= xr; X++) {
      const u = (P(X) - mid) / half;
      if (Math.abs(u) > 1) continue;
      let v = 2.7 - u * 1.9 + (t < 0.22 ? 0.5 : 0) - (t > 0.8 ? 0.8 : 0);
      // 윤이 나는 세로 빛줄: 가운데가 굵고 위아래 끝이 가늘다
      const w = 0.13 * Math.sin(clamp((t - 0.18) / 0.46, 0, 1) * Math.PI);
      if (t > 0.18 && t < 0.64 && Math.abs(u + 0.46) < w + 0.02) v = 5;
      px.set(X, Y, JAR[clamp(Math.round(v), 0, 5)]);
    }
  }
  // 뚜껑(위가 조금 둥글다): 윗면은 볕, 아래 테는 그늘
  const lid = Math.round(rw * 0.78) + 0.8;
  const LY = (top - 2) * A;
  for (let r = 0; r < 6; r++) {
    const half = lid - (r === 0 ? 0.9 : r === 1 ? 0.3 : 0);
    for (let X = Math.floor((mid - half) * A); X <= Math.ceil((mid + half) * A); X++) {
      const u = (P(X) - mid) / half;
      if (Math.abs(u) > 1) continue;
      const i = r < 2 ? (u < -0.2 ? 5 : u < 0.5 ? 4 : 3) : r < 4 ? (u < -0.2 ? 4 : u < 0.5 ? 3 : 2) : r === 4 ? (u < 0 ? 2 : 1) : 1;
      px.set(X, LY + r, JAR[i]);
    }
  }
  // 꼭지
  const kx = cx * A;
  for (const [dx, dy, i] of [
    [-1, -3, 5],
    [0, -3, 4],
    [-2, -2, 5],
    [-1, -2, 5],
    [0, -2, 4],
    [1, -2, 3],
    [-2, -1, 4],
    [-1, -1, 4],
    [0, -1, 3],
    [1, -1, 2],
  ]) {
    px.set(kx + dx, LY + dy, JAR[i]);
  }
}

// ── 장독 ─────────────────────────────────────────────────────
export const jars: Maker = (pal, variant) => {
  const W = 34 * A;
  const H = 30 * A;
  const px = new Px(W, H);
  const { stone } = pal;
  // 낮은 돌 단: 볕 받은 윗면, 앞면의 돌 두 켜(이음은 들쭉날쭉), 밑의 그늘
  const rnd = rngOf(250 + variant);
  const jointsOf = (start: number): number[] => {
    const out: number[] = [];
    for (let x = start + rnd() * 6; x < W - 5; x += 11 + rnd() * 9) out.push(Math.round(x));
    return out;
  };
  const upper = jointsOf(5);
  const lower = jointsOf(11);
  for (let Y = 48; Y <= 59; Y++) {
    for (let X = 0; X < W; X++) {
      if ((X === 0 || X === W - 1) && (Y === 48 || Y === 59)) continue;
      const u = X / (W - 1);
      let v: number;
      if (Y <= 51) v = Y <= 49 ? 5 : 4.6 - u * 0.8;
      else if (Y <= 55) v = 3.6 - u * 0.9 - (upper.includes(X) ? 1 : 0);
      else if (Y <= 57) v = 2.9 - u * 0.9 - (lower.includes(X) ? 1 : 0);
      else v = 2;
      if (Y === 52 || Y === 56) v += 0.5; // 켜의 윗줄
      px.set(X, Y, stone[clamp(Math.round(v), 1, 5)]);
    }
  }
  if (variant === 0) {
    jar(px, 9, 24, 7, 16);
    jar(px, 24, 24, 6, 12);
    jar(px, 17, 25, 4, 8);
  } else {
    jar(px, 7, 24, 5, 10);
    jar(px, 18, 24, 8, 17);
    jar(px, 28, 25, 4, 9);
  }
  const wash = finish(px, rampsOf(pal, [JAR]), 251 + variant, { big: 6, bigY: 9, amp: 1.2 });
  return { frames: [px], ax: 17 * A, ay: 26 * A, shades: [{ dx: 5, dy: 0, rx: 18, ry: 4, strength: 0.3 }], wash };
};

/** 통나무의 자른 끝(1-라의 점 (cx, cy) 가운데, 반지름 r): 볕 받은 나이테 면과 껍질 테 */
function logEnd(px: Px, cx: number, cy: number, r: number, pal: Palette, seed: number): void {
  const { wood, thatch } = pal;
  const ox = (cx + 0.5) * A;
  const oy = (cy + 0.5) * A;
  const RR = (r + 0.85) * A;
  const tint = (hash2(seed, 0, 261) - 0.5) * 1.0;
  for (let Y = Math.floor(oy - RR); Y <= Math.ceil(oy + RR); Y++) {
    for (let X = Math.floor(ox - RR); X <= Math.ceil(ox + RR); X++) {
      const dx = X + 0.5 - ox;
      const dy = Y + 0.5 - oy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > RR) continue;
      const s = (dx + dy) / RR;
      let c: Color;
      if (d > RR - 1.7) c = wood[s < -0.35 ? 3 : s > 0.35 ? 1 : 2];
      else {
        let tone = 4.6 - s * 1.8 + tint;
        if (Math.abs(d - RR * 0.45) < 0.55) tone -= 1; // 나이테
        if (d < 0.9) tone -= 0.8; // 고갱이
        c = thatch[clamp(Math.round(tone), 3, 6)];
      }
      px.set(X, Y, c);
    }
  }
}

// ── 나뭇더미(장작) ─────────────────────────────────────────────
export const woodpile: Maker = (pal) => {
  const W = 34 * A;
  const H = 24 * A;
  const px = new Px(W, H);
  const logs: [number, number][] = [];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - row; i++) logs.push([5 + row * 3 + i * 6, 24 - 6 - row * 6]);
  // 통나무 사이의 그늘(두 통나무 사이에만 — 바깥 둘레에 선을 두르지 않는다)
  const RR = 3.75 * A;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      let d1 = Infinity;
      let d2 = Infinity;
      for (const [lx, ly] of logs) {
        const d = Math.hypot(X + 0.5 - (lx + 0.5) * A, Y + 0.5 - (ly + 0.5) * A);
        if (d < d1) [d1, d2] = [d, d1];
        else if (d < d2) d2 = d;
      }
      if (d2 <= RR + 2.2) px.set(X, Y, pal.bark[d1 + d2 < 2 * RR + 1 ? 1 : 2]);
    }
  }
  logs.forEach(([lx, ly], k) => logEnd(px, lx, ly, 3, pal, k));
  const wash = finish(px, rampsOf(pal), 262, { big: 4, bigY: 4, amp: 1.0 });
  return { frames: [px], ax: 17 * A, ay: 21 * A, shades: [{ dx: 5, dy: 0, rx: 18, ry: 4, strength: 0.3 }], wash };
};

// ── 짚가리 ───────────────────────────────────────────────────
// 타작 마당에 쌓아 둔 볏짚 더미. 켜마다 짚 끝이 겹쳐 내려오고(켜의 높이가 들쭉날쭉하다), 짚 결은 세로로 흐른다.
export const strawstack: Maker = (pal, variant) => {
  const W = 38 * A;
  const H = 44 * A;
  const px = new Px(W, H);
  const ramp = pal.thatch;
  const n = ramp.length - 1;
  const cx = 19.5;
  const tall = variant === 0 ? 0 : 5;
  const top = 4 + tall;
  const span = 44 - 7 - tall;
  const rnd = rngOf(270 + variant);
  const courses: number[] = [];
  for (let y = top * A + 5 + rnd() * 4; y < H; y += 10 + rnd() * 3.5) courses.push(y);
  for (let Y = 0; Y < H; Y++) {
    const y = P(Y);
    const t = (y - 0.5 - top) / span;
    if (t < -0.05 || y > 41.6) continue;
    const half = 4 + 13 * Math.pow(clamp(t, 0, 1), 0.62) + 0.5 + 0.55;
    for (let X = 0; X < W; X++) {
      const u = (P(X) - cx) / half;
      if (Math.abs(u) > 1) continue;
      let tone = 0.74 - u * 0.3 - t * 0.12;
      // 켜: 둥근 더미를 따라 가운데가 조금 처진다. 켜의 윗줄은 위 켜 밑의 그늘, 그 아래는 볕 받은 짚 끝
      const q = Y - 2.2 * (1 - u * u) + (vnoise(X / 8, 0, 271) - 0.5) * 4;
      let local = Infinity;
      for (const c of courses) if (c <= q) local = q - c;
      const edge = 1.3 + vnoise(X / 3, 3.7, 272) * 0.9;
      if (local < edge) tone -= 0.17;
      else if (local < edge + 1.8) tone += 0.09;
      if (y >= 39) tone -= 0.2;
      px.set(X, Y, ramp[clamp(Math.round(tone * n), 0, n)]);
    }
  }
  // 꼭대기를 묶은 매듭과 삐죽한 짚 끝
  const ky = (3 + tall) * A;
  for (let Y = ky - 3; Y <= ky + 2; Y++) {
    for (let X = 32; X <= 46; X++) {
      const dx = (X + 0.5 - 39) / 5.8;
      const dy = (Y + 0.5 - (ky + 0.2)) / 2.9;
      if (dx * dx + dy * dy > 1) continue;
      px.set(X, Y, ramp[clamp(Math.round(5.6 - dx * 1.1 - dy * 0.5), 4, n)]);
    }
  }
  for (const [X, Y, i] of [
    [38, ky - 4, 5],
    [39, ky - 4, 5],
    [39, ky - 5, 5],
    [40, ky - 5, 4],
    [40, ky - 6, 4],
    [41, ky - 6, 4],
    [41, ky - 7, 4],
  ]) {
    px.set(X, Y, ramp[i]);
  }
  const wash = finish(px, rampsOf(pal), 273 + variant, { big: 9, bigY: 7, amp: 1.5, streak: [1.4, 7, 1.6], down: 0.5 });
  return { frames: [px], ax: 19 * A, ay: 40 * A, shades: [{ dx: 6, dy: 0, rx: 19, ry: 5.5, strength: 0.32 }], wash };
};

// ── 싸리 울타리 ──────────────────────────────────────────────
/** 가로로 엮은 띠의 윗줄(그림 점 — 1-라의 9·15줄)과 꼰 매듭 자리(칸마다 같다 — 이웃 칸과 이어진다) */
const FENCE_BANDS = [18, 30].map((y, b) => {
  const rnd = rngOf(286 + b);
  const s0 = Math.floor(rnd() * 3);
  const knots: number[] = [];
  for (let x = s0; x < s0 + 32 - 2; x += 3 + Math.floor(rnd() * 3)) knots.push(x % 32);
  return { y, knots };
});

export const fenceH: Maker = (pal, variant) => {
  const W = 16 * A;
  const H = 22 * A;
  const px = new Px(W, H);
  const { wood, thatch } = pal;
  const rnd = rngOf(280 + variant);
  // 싸릿대: 굵기 1~3점, 높이와 빛이 들쭉날쭉하다. 끝은 볕을 받고 밑동 쪽은 그늘
  for (let x = 0; x < W; ) {
    const r = rnd();
    const w = r < 0.18 ? 1 : r < 0.85 ? 2 : 3;
    const topY = 6 + Math.floor(rnd() * 8);
    const tone = 2.2 + rnd() * 2.2;
    const slant = w > 1 && rnd() < 0.5;
    for (let i = 0; i < w && x + i < W; i++) {
      const t0 = topY + (slant && i === w - 1 ? 1 : 0);
      for (let Y = t0; Y <= 39; Y++) {
        let v = tone + (w > 1 ? (i === 0 ? 0.35 : i === w - 1 ? -0.35 : 0) : 0) - clamp((Y - 31) / 6, 0, 1) * 0.9;
        if (Y === t0) v += 1;
        else if (Y === t0 + 1) v += 0.4;
        px.set(x + i, Y, wood[clamp(Math.round(v), 1, 5)]);
      }
    }
    x += w;
  }
  // 가로로 엮은 띠(꼰 짚): 꼰 자리마다 볕 받은 올, 밑에는 싸릿대에 진 그늘
  for (const { y, knots } of FENCE_BANDS) {
    for (let X = 0; X < W; X++) {
      const knot = knots.includes(X);
      const after = knots.includes((X + W - 1) % W);
      px.set(X, y, thatch[knot ? 5 : 4]);
      px.set(X, y + 1, thatch[knot ? 4 : after ? 3 : 4]);
      px.set(X, y + 2, thatch[2]);
      const i = wood.indexOf(px.get(X, y + 3));
      if (i > 1) px.set(X, y + 3, wood[i - 1]);
    }
  }
  for (let X = 0; X < W; X++) {
    px.set(X, 40, wood[1]);
    px.set(X, 41, wood[1]);
  }
  const wash = finishTiled(px, rampsOf(pal), 281, { big: 3, bigY: 12, streak: [1.2, 9, 1.2] }, { x: W });
  return { frames: [px], ax: 8 * A, ay: 19 * A, shades: [{ dx: 3, dy: 1, rx: 9, ry: 3, strength: 0.26 }], wash };
};

/** 세로 울타리의 토막 놓임(생김새와 상관없이 같다 — 위 칸의 아래쪽이 아래 칸에 덮여 꼴이 어긋나지 않는다): [윗줄, 높이, 왼쪽 끝, 오른쪽 끝] */
const FENCE_V_ROWS: [number, number, number, number][] = (() => {
  const rnd = rngOf(290);
  const out: [number, number, number, number][] = [];
  for (const base of [0, 32]) {
    const end = Math.min(base + 32, 58);
    for (let y = base; y < end; ) {
      let h = 3 + Math.floor(rnd() * 3);
      if (end - y - h < 3) h = end - y;
      const x0 = Math.floor(rnd() * 3);
      out.push([y, h, x0, x0 + 12 + (rnd() < 0.4 ? 1 : 0)]);
      y += h;
    }
  }
  return out;
})();

export const fenceV: Maker = (pal, variant) => {
  const W = 8 * A;
  const H = 30 * A;
  const px = new Px(W, H);
  const { wood, thatch } = pal;
  const rnd = rngOf(295 + variant);
  // 옆에서 본 울타리: 싸릿대의 끝이 줄지어 보인다. 토막마다 왼쪽·위는 볕, 오른쪽·아래는 그늘
  for (const [y, h, x0, x1] of FENCE_V_ROWS) {
    const tone = 2 + rnd() * 2.4;
    for (let Y = y; Y < y + h; Y++) {
      for (let X = x0; X <= x1; X++) {
        const v = tone + (X < x0 + 3 ? 1 : X > x1 - 2 ? -1 : 0) - (Y - y >= h / 2 ? 1 : 0);
        px.set(X, Y, wood[clamp(Math.round(v), 1, 5)]);
      }
    }
  }
  // 엮은 띠(1-라의 5·14·23줄)
  for (const by of [10, 28, 46]) {
    for (let X = 1; X < W - 1; X++) {
      px.over(X, by, thatch[4]);
      px.over(X, by + 1, thatch[3]);
    }
  }
  const wash = finishTiled(px, rampsOf(pal), 291, { big: 4, bigY: 3, streak: [6, 1.4, 1.0] }, { y: 32 });
  return { frames: [px], ax: 4 * A, ay: 27 * A, shades: [{ dx: 4, dy: -8, rx: 5, ry: 9, strength: 0.26 }], wash };
};

// ── 돌담 ─────────────────────────────────────────────────────
/**
 * 막돌 하나: 모서리가 둥근 네모(p가 클수록 네모나다 — 켜를 촘촘히 채운다). 빛은 wash.ts의 ball과 같다(왼쪽 위 하나, 단계는 띠로,
 * 오른쪽 아래 가장자리 한 점 남짓은 rim 단계의 그늘 골).
 */
function cobble(px: Px, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, lo: number, hi: number, rim: number, p = 2.5): void {
  const edge = Math.pow(1 - 1.2 / Math.min(rx, ry), p);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.pow(Math.abs(dx), p) + Math.pow(Math.abs(dy), p);
      if (d > 1) continue;
      const nz = Math.sqrt(Math.max(0.05, 1 - Math.min(1, dx * dx + dy * dy) * 0.85));
      const t = clamp(0.42 + 0.62 * (-0.5 * dx - 0.62 * dy + 0.6 * nz), 0, 0.999);
      let i = lo + Math.floor(t * (hi - lo + 1));
      if (d > edge && dx + dy > 0.25) i = rim;
      px.set(x, y, ramp[clamp(i, 0, ramp.length - 1)]);
    }
  }
}

// 낮게 쌓은 막돌(3.1차 시안의 돌담): 둥근 돌을 켜로 쌓고 틈은 그늘. 틈은 가장 어두운(차가운) 단계가 아니라 한 단계 위에
// 흙빛을 조금 섞은 따뜻한 잿빛(큰비·겨울의 벌에서도 푸르스름해지지 않는다).
const gapOf = (pal: Palette): Color => mix(pal.stone[1], pal.soil[2], 0.45);
/** 켜마다 가운데 높이와, 칸 경계에 걸친 돌(가운데 x — 0과 칸의 너비 두 자리에 같은 돌이 놓인다, 너비) */
const STONEWALL_ROWS = [
  { cy: 29.2, ry: 5.0, ex: -2, ew: 13 },
  { cy: 18.9, ry: 5.3, ex: 4, ew: 12 },
  { cy: 8.7, ry: 5.0, ex: -5, ew: 14 },
];

export const stonewallH: Maker = (pal, variant) => {
  const W = 16 * A;
  const H = 18 * A;
  const px = new Px(W, H);
  const { stone } = pal;
  const gap = gapOf(pal);
  for (let Y = 5; Y < H; Y++) for (let X = 0; X < W; X++) px.set(X, Y, gap);
  const rnd = rngOf(300 + variant);
  for (const { cy, ry, ex, ew } of STONEWALL_ROWS) {
    // 칸 안의 돌: 생김새마다 너비·높이·빛이 들쭉날쭉하다
    const a = ex + ew / 2;
    const b = W + ex - ew / 2;
    const cut = splits(b - a, 6, 16, rnd);
    for (let i = 0; i + 1 < cut.length; i++) {
      const x0 = a + cut[i];
      const w = cut[i + 1] - cut[i];
      const shade = rnd();
      const rh = ry - 0.9 + rnd() * 1.3;
      const lift = (rnd() - 0.5) * 2;
      cobble(px, x0 + w / 2 + (rnd() - 0.5), cy + lift, w / 2 - 0.4, rh, stone, shade < 0.14 ? 1 : 2, shade < 0.14 ? 3 : shade > 0.8 ? 5 : 4, 1, 1.9 + rnd() * 0.7);
    }
    // 칸 경계에 걸친 돌(두 반쪽이 이어진다)
    for (const at of [ex, ex + W]) cobble(px, at, cy, ew / 2 - 0.4, ry, stone, 2, 4, 1, 2.2);
  }
  // 담 위에 돋은 풀(두세 점짜리 포기 둘)
  for (let k = 0; k < 2; k++) {
    const X = 3 + Math.floor(rnd() * (W - 8));
    let Y = 0;
    while (Y < H && px.get(X, Y) === 0) Y++;
    px.set(X, Y - 1, pal.grass[3]);
    px.set(X + 1, Y - 1, pal.grass[4]);
    px.set(X + 1, Y - 2, pal.grass[4]);
    if (rnd() < 0.6) px.set(X + 2, Y - 1, pal.grass[3]);
  }
  const wash = finishTiled(px, rampsOf(pal), 301, { big: 5, bigY: 4 }, { x: W });
  return { frames: [px], ax: 8 * A, ay: 15 * A, shades: [{ dx: 3, dy: 1, rx: 9, ry: 3, strength: 0.28 }], wash };
};

export const stonewallV: Maker = (pal, variant) => {
  const W = 12 * A;
  const H = 30 * A;
  const px = new Px(W, H);
  const { stone } = pal;
  // 틈(따뜻한 잿빛)을 깔고 돌을 두 줄로 얹는다: 왼쪽 줄은 볕, 오른쪽 줄은 그늘. 32점마다 같은 자리에서 켜가 끊어지고,
  // 오른쪽 줄의 그 자리에 걸친 돌은 생김새와 상관없이 같다(아래 칸이 위 칸의 아래쪽을 덮어도 이어진다)
  const gap = gapOf(pal);
  for (let Y = 0; Y <= 58; Y++) for (let X = 1; X <= 22; X++) px.set(X, Y, gap);
  const rnd = rngOf(310 + variant);
  const col = (x0: number, x1: number, from: number, to: number, dark: boolean): void => {
    const cut = splits(to - from, 9, 13, rnd);
    for (let i = 0; i + 1 < cut.length; i++) {
      const y0 = from + cut[i];
      const h = cut[i + 1] - cut[i];
      const low = y0 + h / 2 > 42 ? 1 : 0;
      const shade = rnd();
      const lo = (dark ? 1 : 2) - (low && !dark ? 1 : 0);
      const hi = (dark ? 3 : shade > 0.7 ? 5 : 4) - low;
      cobble(px, (x0 + x1) / 2 + (rnd() - 0.5) * 0.6, y0 + h / 2, (x1 - x0) / 2 - 0.3, h / 2 - 0.4, stone, lo, hi, 1, 2.4 + rnd() * 0.8);
    }
  };
  col(1, 10.5, 0, 32, false);
  col(1, 10.5, 32, 58, false);
  col(11.5, 22.5, 5, 27, true);
  col(11.5, 22.5, 37, 58, true);
  for (const at of [0, 32]) cobble(px, 17, at, 5.0, 4.5, stone, 1, 3, 1);
  const wash = finishTiled(px, rampsOf(pal), 311, { big: 4, bigY: 5 }, { y: 32 });
  return { frames: [px], ax: 6 * A, ay: 27 * A, shades: [{ dx: 5, dy: -8, rx: 6, ry: 9, strength: 0.28 }], wash };
};

// ── 돌탑(절 마당의 작은 탑) ──────────────────────────────────────
export const pagoda: Maker = (pal) => {
  const W = 26 * A;
  const H = 50 * A;
  const px = new Px(W, H);
  const { stone } = pal;
  const cx = 13.5;
  // 1-라의 점 좌표: y줄부터 hgt줄, 반너비 half. 지붕돌은 위가 좁고(비탈은 볕) 처마 밑은 그늘
  const slab = (y: number, half: number, hgt: number, roof: boolean): void => {
    const Y1 = (y + hgt) * A - 1;
    for (let Y = y * A; Y <= Y1; Y++) {
      const j = P(Y) - 0.5 - y;
      const hw = (roof ? half - Math.max(0, hgt - 1 - j) * 1.4 : half) + 1.3;
      for (let X = 0; X < W; X++) {
        const u = (P(X) - cx) / hw;
        if (Math.abs(u) > 1) continue;
        let v = 3.6 - u * 1.5;
        if (roof) v += clamp(1 - j / (hgt - 1), 0, 1);
        else if (Y === y * A) v -= 0.4;
        if (Y === Y1) v -= 1.2;
        else if (Y === Y1 - 1) v -= 0.4;
        px.set(X, Y, stone[clamp(Math.round(v), 1, 5)]);
      }
    }
  };
  // 아래에서 위로: 기단, 몸돌과 지붕돌 세 층, 꼭대기
  slab(44, 11, 4, false);
  slab(40, 9, 4, false);
  let y = 40;
  for (const [body, roof] of [
    [6, 9],
    [5, 7],
    [4, 6],
  ] as const) {
    y -= 7;
    slab(y, body - 1, 7, false);
    y -= 4;
    slab(y, roof, 4, true);
  }
  slab(y - 3, 1, 3, false);
  // 보주(꼭대기의 작은 구슬)
  for (let Y = 3; Y <= 7; Y++) {
    for (let X = 24; X <= 29; X++) {
      const dx = (X + 0.5 - 27) / 1.8;
      const dy = (Y + 0.5 - 5.6) / 2.4;
      if (dx * dx + dy * dy > 1) continue;
      px.set(X, Y, stone[clamp(Math.round(4.6 - dx * 1.2 - dy * 0.6), 2, 5)]);
    }
  }
  const wash = finish(px, rampsOf(pal), 320, { big: 6, bigY: 5 });
  return { frames: [px], ax: 13 * A, ay: 47 * A, shades: [{ dx: 5, dy: 0, rx: 13, ry: 4, strength: 0.32 }], wash };
};

// ── 돌등 ─────────────────────────────────────────────────────
export const lantern: Maker = (pal) => {
  const W = 16 * A;
  const H = 28 * A;
  const px = new Px(W, H);
  const { stone, wood } = pal;
  const cx = 8.5;
  const block = (y: number, half: number, hgt: number): void => {
    const Y1 = (y + hgt) * A - 1;
    for (let Y = y * A; Y <= Y1; Y++) {
      for (let X = 0; X < W; X++) {
        const u = (P(X) - cx) / (half + 1.35);
        if (Math.abs(u) > 1) continue;
        px.set(X, Y, stone[clamp(Math.round(3.8 - u * 1.5 - (Y === Y1 ? 1 : Y === Y1 - 1 ? 0.4 : 0)), 1, 5)]);
      }
    }
  };
  block(23, 5, 3);
  block(15, 1, 8);
  block(12, 4, 3);
  block(7, 3, 5);
  // 불을 넣는 창(비어 있다 — 안은 따뜻한 어둠)
  for (let Y = 18; Y < 22; Y++) for (let X = 14; X < 18; X++) px.set(X, Y, wood[Y === 21 || X === 17 ? 1 : 0]);
  // 지붕돌: 처마가 넓고 위로 좁아진다
  for (let Y = 8; Y < 14; Y++) {
    const hw = 2.5 + (P(Y) - 0.5 - 4) * 2 + 0.95;
    for (let X = 0; X < W; X++) {
      const u = (P(X) - cx) / hw;
      if (Math.abs(u) > 1) continue;
      px.set(X, Y, stone[clamp(Math.round(4.2 - u * 1.6 - (Y === 13 ? 1 : Y === 12 ? 0.4 : 0) + (Y <= 9 ? 0.4 : 0)), 1, 5)]);
    }
  }
  for (const [X, Y, i] of [
    [16, 5, 5],
    [17, 5, 4],
    [15, 6, 5],
    [16, 6, 5],
    [17, 6, 4],
    [18, 6, 3],
    [15, 7, 4],
    [16, 7, 4],
    [17, 7, 4],
    [18, 7, 3],
  ]) {
    px.set(X, Y, stone[i]);
  }
  const wash = finish(px, rampsOf(pal), 325, { big: 5, bigY: 5 });
  return { frames: [px], ax: 8 * A, ay: 25 * A, shades: [{ dx: 4, dy: 0, rx: 7, ry: 3, strength: 0.3 }], wash };
};

// ── 돌 ───────────────────────────────────────────────────────
// shapes.ts의 rock을 2배 그림에 맞춰(마지막 인자 ART) 1-라의 자리·반지름 ×2로 부른다. 반지름에는 1-라 테두리 한 점의 몫을 더한다.
const RIM = 1.6;

export const rockS: Maker = (pal, variant) => {
  const px = new Px(12 * A, 9 * A);
  rock(px, pal.stone, (5.5 + (variant % 2)) * A, 5 * A, (3.6 + (variant % 3) * 0.6) * A + RIM, 2.6 * A + RIM, 330 + variant, undefined, A);
  const wash = finish(px, rampsOf(pal), 331 + variant, { big: 4, bigY: 3, amp: 1.2, fine: 0.6 });
  return { frames: [px], ax: 6 * A, ay: 7 * A, shades: [{ dx: 2, dy: 0, rx: 5, ry: 2, strength: 0.24 }], wash };
};

export const rockM: Maker = (pal, variant) => {
  const px = new Px(22 * A, 18 * A);
  rock(px, pal.stone, 11 * A, 10 * A, (7.5 + variant * 0.5) * A + RIM, 5.6 * A + RIM, 340 + variant, variant === 1 ? pal.leaf : undefined, A);
  if (variant === 2) rock(px, pal.stone, 5 * A, 13 * A, 3.4 * A + RIM, 2.6 * A + RIM, 345, undefined, A);
  const wash = finish(px, rampsOf(pal), 341 + variant, { big: 5, bigY: 4, amp: 1.3, fine: 0.6 });
  return { frames: [px], ax: 11 * A, ay: 16 * A, shades: [{ dx: 4, dy: 0, rx: 11, ry: 3.5, strength: 0.3 }], wash };
};

export const rockL: Maker = (pal, variant) => {
  const px = new Px(40 * A, 28 * A);
  rock(px, pal.stone, 17 * A, 15 * A, 14 * A + RIM, 9.5 * A + RIM, 350 + variant, variant === 0 ? pal.leaf : undefined, A);
  rock(px, pal.stone, 30 * A, 19 * A, 7.5 * A + RIM, 5.5 * A + RIM, 355 + variant, undefined, A);
  const wash = finish(px, rampsOf(pal), 351 + variant, { big: 6, bigY: 5, amp: 1.3, fine: 0.6 });
  return { frames: [px], ax: 20 * A, ay: 26 * A, shades: [{ dx: 6, dy: 0, rx: 21, ry: 5, strength: 0.32 }], wash };
};

// ── 너럭돌(앉는 돌) ────────────────────────────────────────────
export const flatstone: Maker = (pal, variant) => {
  const W = 22 * A;
  const H = 14 * A;
  const px = new Px(W, H);
  const { stone } = pal;
  // 윗면(볕): 1-라의 2~8줄 안
  for (let Y = 0; Y < H; Y++) {
    const y = P(Y);
    if (y < 1.5 || y > 9) continue;
    for (let X = 0; X < W; X++) {
      const x = P(X);
      const dx = (x - 11) / 10.6;
      const dy = (y - 5.5) / 4.3;
      const wob = (vnoise(x / 3 + variant * 9, y / 2, 360) - 0.5) * 0.3;
      if (dx * dx + dy * dy > 1 + wob) continue;
      const v = 4.4 - dx * 0.9 - dy * 0.3 + (vnoise(x / 4, y / 3, 361 + variant) - 0.5) * 1.2;
      px.set(X, Y, stone[clamp(Math.round(v), 3, 5)]);
    }
  }
  // 옆면: 윗면 아래로 다섯 점(왼쪽은 볕, 오른쪽은 그늘)
  for (let X = 0; X < W; X++) {
    let yb = -1;
    for (let Y = H - 1; Y >= 0; Y--) {
      if (px.get(X, Y) !== 0) {
        yb = Y;
        break;
      }
    }
    if (yb < 0) continue;
    const dx = (P(X) - 11) / 10.6;
    for (let k = 1; k <= 5; k++) px.set(X, yb + k, stone[clamp(Math.round(3.0 - dx * 1.0 - (k - 1) * 0.3), 1, 4)]);
  }
  const wash = finish(px, rampsOf(pal), 362 + variant, { big: 7, bigY: 4 });
  return { frames: [px], ax: 11 * A, ay: 11 * A, shades: [{ dx: 3, dy: 1, rx: 11, ry: 3, strength: 0.26 }], wash };
};

// ── 그루터기와 통나무 ──────────────────────────────────────────
export const stump: Maker = (pal, variant) => {
  const W = 18 * A;
  const H = 16 * A;
  const px = new Px(W, H);
  const part = new Uint8Array(W * H); // 1 껍질, 2 자른 면
  const { bark, thatch } = pal;
  const cx = 9.25;
  // 줄기: 껍질의 세로 골, 밑동이 조금 퍼진다
  for (let Y = 0; Y < H; Y++) {
    const y = P(Y);
    if (y < 5 || y > 14.6) continue;
    const half = 6.5 + clamp(y - 11.2, 0, 3.4) * 0.3 + 0.55;
    for (let X = 0; X < W; X++) {
      const u = (P(X) - cx) / half;
      if (Math.abs(u) > 1) continue;
      let v = 2.6 - u * 1.5;
      const furrow = vnoise(X / 1.7, Y / 6, 370 + variant);
      if (furrow < 0.3) v -= 0.9;
      else if (furrow > 0.78) v += 0.5;
      px.set(X, Y, bark[clamp(Math.round(v), 0, 4)]);
      part[Y * W + X] = 1;
    }
  }
  // 자른 면: 볕 받은 나무, 나이테 둘, 껍질 테
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const dx = (P(X) - cx) / 7.2;
      const dy = (P(Y) - 5) / 3.9;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const r = Math.sqrt(d);
      const wob = (vnoise(Math.atan2(dy, dx) * 1.5 + 3, 0.5, 372 + variant) - 0.5) * 0.06;
      let c = thatch[clamp(Math.round(5 - dx - dy * 0.6), 4, 6)];
      let k = 2;
      if (Math.abs(r - 0.67 - wob) < 0.045 || Math.abs(r - 0.37 - wob) < 0.045 || r < 0.08) {
        c = thatch[3];
        k = 3; // 나이테는 결을 입히지 않는다(끊기지 않게)
      }
      if (r > 0.87) c = bark[dx + dy > 0 ? 1 : 3];
      px.set(X, Y, c);
      part[Y * W + X] = k;
    }
  }
  if (variant === 1) {
    // 새순
    for (const [X, Y, i] of [
      [28, 5, 2],
      [28, 4, 2],
      [29, 3, 3],
      [29, 2, 4],
      [30, 2, 4],
      [30, 1, 4],
      [31, 1, 5],
      [31, 0, 5],
      [27, 3, 3],
      [26, 3, 3],
      [26, 2, 4],
    ]) {
      px.set(X, Y, pal.leafWarm[i]);
    }
  }
  const wash = finishLayers(px, rampsOf(pal), [
    [373 + variant, { big: 3, bigY: 8, streak: [1.2, 6, 1.0], keep: (X, Y) => part[Y * W + X] === 1 }],
    [375 + variant, { big: 4, bigY: 3, amp: 1.0, keep: (X, Y) => part[Y * W + X] === 2 }],
  ]);
  return { frames: [px], ax: 9 * A, ay: 13 * A, shades: [{ dx: 4, dy: 0, rx: 9, ry: 3, strength: 0.28 }], wash };
};

/** 누운 줄기의 껍질: 위는 볕, 아래는 그늘, 가로로 긴 결 */
function barkAt(pal: Palette, X: number, Y: number, t: number, seed: number): Color {
  let v = 3.5 - t * 2.1;
  const g = vnoise(X / 7, Y / 1.4, seed);
  if (g < 0.3) v -= 0.7;
  else if (g > 0.8) v += 0.5;
  return pal.bark[clamp(Math.round(v), 1, 4)];
}

export const log: Maker = (pal) => {
  const W = 36 * A;
  const H = 14 * A;
  const px = new Px(W, H);
  for (let Y = 0; Y < H; Y++) {
    const y = P(Y);
    if (y < 2.3 || y > 11.7) continue;
    const t = (y - 2.3) / 9.4;
    for (let X = 0; X < W; X++) {
      const x = P(X);
      if (x < 5 || x > 34.8) continue;
      // 먼 끝은 둥글다
      if (x > 33.6) {
        const ex = (x - 33.6) / 1.2;
        const ey = (t - 0.5) * 2;
        if (ex * ex + ey * ey > 1) continue;
      }
      px.set(X, Y, barkAt(pal, X, Y, t, 380));
    }
  }
  logEnd(px, 5, 7, 4, pal, 3);
  // 잔가지 자른 자리
  for (const [X, Y, c] of [
    [40, 2, pal.thatch[5]],
    [41, 2, pal.thatch[5]],
    [40, 3, pal.thatch[5]],
    [41, 3, pal.thatch[5]],
    [42, 3, pal.thatch[4]],
    [40, 4, pal.bark[3]],
    [41, 4, pal.bark[2]],
    [42, 4, pal.bark[2]],
    [43, 4, pal.bark[1]],
    [40, 5, pal.bark[3]],
    [41, 5, pal.bark[2]],
    [42, 5, pal.bark[2]],
    [43, 5, pal.bark[1]],
  ] as const) {
    px.set(X, Y, c);
  }
  const wash = finish(px, rampsOf(pal), 381, { big: 10, bigY: 3, streak: [8, 1.5, 1.0] });
  return { frames: [px], ax: 18 * A, ay: 11 * A, shades: [{ dx: 4, dy: 0, rx: 18, ry: 3, strength: 0.28 }], wash };
};

// ── 쓰러져 이끼 낀 나무 ────────────────────────────────────────
export const fallen: Maker = (pal) => {
  const W = 40 * A;
  const H = 18 * A;
  const px = new Px(W, H);
  const moss = pal.leaf;
  for (let X = 0; X < W; X++) {
    const x = P(X);
    if (x < 6 || x > 37.8) continue;
    const sag = Math.sin((x - 6.5) / 30) * 2;
    let half = (x < 31 ? 4.5 : x < 33 ? 4.5 - (x - 31) : 2.5) + 0.75;
    if (x > 36.6) half *= Math.sqrt(Math.max(0, 1 - ((x - 36.6) / 1.2) ** 2));
    const mid = 9.5 + sag;
    const mossy = vnoise(x / 3.2, 0.5, 391);
    for (let Y = 0; Y < H; Y++) {
      const j = (P(Y) - mid) / half;
      if (Math.abs(j) > 1) continue;
      let c = barkAt(pal, X, Y, (j + 1) / 2, 390);
      // 위쪽에 낀 이끼(아래 끝이 들쭉날쭉하다)
      const depth = (P(Y) - (mid - half)) * A;
      if (mossy > 0.42 && depth < 2.4 + (mossy - 0.42) * 6 + (vnoise(X / 2.5, Y / 2, 392) - 0.5) * 2) c = moss[depth < 1.5 ? 4 : 3];
      px.set(X, Y, c);
    }
  }
  logEnd(px, 6, 9, 4, pal, 5);
  // 부러진 가지
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const X = Math.round(45 + t * 8);
    const Y = Math.round(12 - t * 9);
    const thick = t < 0.7 ? 4 : 3;
    for (let k = 0; k < thick; k++) px.set(X + k, Y, pal.bark[k === 0 ? 3 : k === thick - 1 ? 1 : 2]);
  }
  // 버섯 둘: 줄기 윗선에 돋았다
  const topOf = (X: number): number => {
    let Y = 0;
    while (Y < H && px.get(X, Y) === 0) Y++;
    return Y;
  };
  for (const [mx, w] of [
    [61, 4],
    [28, 3],
  ]) {
    const ty = topOf(mx + 1);
    for (let i = 0; i < w; i++) {
      px.set(mx + i, ty - 3, pal.plaster[i < w - 1 ? 3 : 2]);
      px.set(mx + i, ty - 2, pal.plaster[i < w - 2 ? 3 : 2]);
    }
    px.set(mx + 1, ty - 1, pal.plaster[1]);
    px.set(mx + 1, ty, pal.plaster[1]);
  }
  const wash = finish(px, rampsOf(pal), 393, { big: 10, bigY: 3, streak: [8, 1.5, 1.0] });
  return { frames: [px], ax: 20 * A, ay: 15 * A, shades: [{ dx: 4, dy: 0, rx: 19, ry: 3.5, strength: 0.28 }], wash };
};

// ── 길가의 돌무더기 ────────────────────────────────────────────
// 지나는 사람들이 하나씩 얹은 돌. 꾸밈없이 쌓인 돌더미다.
export const cairn: Maker = (pal) => {
  const W = 24 * A;
  const H = 26 * A;
  const px = new Px(W, H);
  const stones: [number, number, number, number, number][] = [
    [6, 20, 4.5, 3, 1],
    [12, 21, 5, 3, 2],
    [18, 20, 4.5, 3, 3],
    [9, 16, 4.5, 3, 4],
    [15, 16, 4.5, 3, 5],
    [12, 12, 4.2, 2.8, 6],
    [12, 8, 3.2, 2.4, 7],
    [12.5, 5, 2.2, 1.8, 8],
  ];
  for (const [x, y, rx, ry, seed] of stones) rock(px, pal.stone, x * A, y * A, rx * A + 1.2, ry * A + 1.2, 395 + seed, seed === 2 ? pal.leaf : undefined, A);
  const wash = finish(px, rampsOf(pal), 396, { big: 5, bigY: 4 });
  return { frames: [px], ax: 12 * A, ay: 23 * A, shades: [{ dx: 4, dy: 0, rx: 12, ry: 3.5, strength: 0.3 }], wash };
};
