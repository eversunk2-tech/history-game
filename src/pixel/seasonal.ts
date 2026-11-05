// 계절의 자리에 놓는 것들. 그 계절의 맵에만 놓인다(src/content/maps/neutigol.ts의 seasonalOf).
//   여름(단오의 냇가): 큰 나무에 맨 그네, 모래를 깐 씨름판과 씨름하는 두 사람, 창포 삶은 물을 담은 함지
//   가을: 벤 논에 세워 말리는 볏단, 타작 마당의 볏단 더미와 개상과 멍석, 길 떠나는 사람의 짐
//   겨울: 쓸어 모은 눈
// 꾸밈없이 그린다. 그네·씨름·창포물은 단오의 놀이로 기록에 있으나(F60) 생김새는 꾸민 것이다.
//
// 그림 점(ART)으로 그린다(그림 올리기 ②). 꼴·크기·발치는 1-라 그림의 ART배, 바닥 그림자는 맵 점 그대로다.
// 먹빛 테두리 없이 제 빛깔로 가장자리를 가르고(ㄴ), 짚·나무·천에는 수채화 같은 결을 입힌다(ㅌ — props.ts와 같은 셈).
// 그네와 씨름의 사람은 people.ts의 personFrame(그림 점 48×64, 발끝 24·60, 부드러운 테두리를 이미 둘렀다)을 그대로 얹는다.

import { CLOTH, HAIR, SKIN, type Palette, type Ramp } from './palette';
import { personFrame, type Person } from './people';
import { ART, Px, clamp, hash2, hex, mix, rngOf, vnoise, type Color } from './px';
import { canopy, type SpriteDef } from './shapes';
import { calmSprite, finish, rampsOf, selfRim, watercolor, type RampIndex } from './wash';

type Maker = (pal: Palette, variant: number) => SpriteDef;

const A = ART;
/** 그림 점 X(또는 Y)의 가운데를 1-라의 점 좌표(연속)로 옮긴다 */
const P = (X: number): number => (X + 0.5) / A;

/** 벼 이삭의 빛: 가을에는 누렇고, 다른 계절의 그림 벌에서도 볏단은 누런 짚빛으로 보인다 */
function earsOf(pal: Palette): Ramp {
  return pal.paddyState === 'gold' ? pal.crop : [pal.thatch[2], pal.thatch[4], pal.thatch[5], pal.thatch[6]];
}

/** 땅에 흩어진 작은 것(낟알·지푸라기): 두세 점짜리 무리로 찍는다(ㄹ). 빈 자리에만 */
function crumbs(px: Px, x0: number, x1: number, y0: number, y1: number, count: number, seed: number, colorOf: (k: number) => Color): void {
  const shapes: [number, number][][] = [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  ];
  for (let k = 0; k < count; k++) {
    const x = x0 + Math.floor(hash2(k, 1, seed) * (x1 - x0));
    const y = y0 + Math.floor(hash2(k, 2, seed) * (y1 - y0));
    const shape = shapes[Math.floor(hash2(k, 3, seed) * shapes.length)];
    if (shape.some(([dx, dy]) => px.get(x + dx, y + dy) !== 0 || px.get(x + dx, y + dy - 1) !== 0)) continue;
    const c = colorOf(k);
    for (const [dx, dy] of shape) px.set(x + dx, y + dy, c);
  }
}

// ── 그네 ─────────────────────────────────────────────────────
// 큰 나무의 가지에 두 줄을 매고 발판을 달았다. 아이가 서서 구르면 앞뒤로 오간다.
const SWING_RIDER: Person = {
  build: 'teen',
  sex: 'f',
  bottom: 'skirt',
  hair: 'braid',
  hairColor: HAIR.black,
  skin: SKIN.fair,
  top: CLOTH.cotton,
  lower: CLOTH.rose,
  shoes: CLOTH.straw,
  ribbon: CLOTH.madder[2],
  blush: true,
};

export const swing: Maker = (pal, variant) => {
  const W = 46 * A;
  const H = 50 * A;
  const cx = 23;
  const topY = 5;
  const seatY = 40;
  const ramps = rampsOf(pal);
  // 줄을 맨 굵은 곁가지: 나무의 줄기 쪽(왼쪽)에서 뻗어 나와 끝으로 갈수록 가늘다. 위는 볕, 아래는 그늘, 가지를 따라 긴 결
  const limb = new Px(W, H);
  for (let X = 0; X < W; X++) {
    const x = P(X);
    if (x > cx + 10) continue;
    let thick = 5.3 - clamp((x - 8) / 18, 0, 1) * 2;
    if (x > cx + 9) thick *= Math.sqrt(Math.max(0, 1 - (x - cx - 9) ** 2));
    const y0 = 8 - (x / (cx + 9)) * 3 - 0.3;
    for (let Y = 0; Y < H; Y++) {
      const t = (P(Y) - y0) / thick;
      if (t < 0 || t > 1) continue;
      limb.set(X, Y, pal.bark[clamp(Math.round(3.5 - t * 2.4), 1, 4)]);
    }
  }
  const wash = finish(limb, ramps, 983, { big: 9, bigY: 2, streak: [7, 1.3, 1.2], down: 0.5 });
  // 가지 끝의 잎 뭉치(나무갓 아래쪽으로 이어진다): 나무갓과 같은 잎 뭉치 셈
  const leaves = new Px(W, H);
  canopy(
    leaves,
    [
      { x: (cx + 8) * A, y: 3 * A + 0.5, r: 6.9 * A, squash: 0.53 },
      { x: (cx - 8) * A, y: 2 * A + 0.5, r: 7.9 * A, squash: 0.43 },
      { x: 5 * A, y: 3 * A + 0.5, r: 6.4 * A, squash: 0.55, shade: -0.04 },
    ],
    pal.leafWarm,
    { seed: 981, clump: [11, 9], spiky: 1.4 },
  );
  /** 줄 한 가닥(세 점 굵기 — 왼쪽은 볕, 오른쪽은 그늘). 1-라의 점 (x0, y0) → (x1, y1) */
  const rope = (px: Px, x0: number, y0: number, x1: number, y1: number, lit: Color, mid: Color, dark: Color): void => {
    const ax = x0 * A + 0.5;
    const ay = y0 * A + 1;
    const bx = x1 * A + 0.5;
    const by = y1 * A;
    const n = Math.max(1, Math.ceil(Math.abs(by - ay)));
    for (let i = 0; i <= n; i++) {
      const X = Math.round(ax + ((bx - ax) * i) / n);
      const Y = Math.round(ay + ((by - ay) * i) / n);
      px.set(X - 1, Y, lit);
      px.set(X, Y, mid);
      px.set(X + 1, Y, dark);
    }
  };
  const frameAt = (d: number, rider: boolean, walkFrame: number): Px => {
    const px = new Px(W, H);
    px.blit(limb, 0, 0);
    const rise = Math.round((d * d) / 60);
    const sx = cx + d;
    const sy = seatY - rise;
    // 줄 두 가닥(뒤쪽 줄이 조금 어둡다)
    rope(px, cx + 5, topY, sx + 5, sy, pal.thatch[3], pal.thatch[2], pal.thatch[1]);
    if (rider) px.blit(personFrame(SWING_RIDER, 'left', d === 0 ? 'idle' : 'walk', walkFrame), sx * A - 24, sy * A - 60);
    rope(px, cx - 5, topY, sx - 5, sy, pal.thatch[5], pal.thatch[4], pal.thatch[2]);
    // 발판: 윗면은 볕, 앞면은 그늘. 양 끝은 조금 둥글다
    const L = (sx - 6) * A;
    const Rr = (sx + 7) * A - 1;
    for (let X = L; X <= Rr; X++) {
      const u = (X - L) / (Rr - L);
      const end = X === L || X === Rr;
      for (let r = 0; r < 4; r++) {
        if (end && (r === 0 || r === 3)) continue;
        const v = r === 0 ? (u < 0.3 ? 5 : 4) : r === 1 ? (u < 0.3 ? 4 : 3) : r === 2 ? (u > 0.75 ? 1 : 2) : 1;
        px.set(X, sy * A + r, pal.wood[v]);
      }
    }
    // 줄을 맨 매듭
    for (const [kx, lit] of [
      [sx - 5, pal.thatch[4]],
      [sx + 5, pal.thatch[2]],
    ] as const) {
      px.set(kx * A, sy * A - 2, lit);
      px.set(kx * A + 1, sy * A - 2, lit);
      px.set(kx * A - 1, sy * A - 1, lit);
      px.set(kx * A, sy * A - 1, lit);
      px.set(kx * A + 1, sy * A - 1, pal.thatch[1]);
      px.set(kx * A + 2, sy * A - 1, pal.thatch[1]);
    }
    px.blit(leaves, 0, 0);
    return px;
  };
  if (variant === 0) return { frames: [frameAt(0, false, 0)], ax: cx * A, ay: 46 * A, sort: 2, wash };
  // 가운데 → 앞 → 앞 끝 → 뒤 → 뒤 끝. 구를 때 무릎을 굽혔다 편다(걷는 장을 빌려 쓴다).
  const frames = [frameAt(0, true, 0), frameAt(-6, true, 1), frameAt(-10, true, 0), frameAt(6, true, 3), frameAt(10, true, 2)];
  return { frames, ax: cx * A, ay: 46 * A, sort: 2, seq: [0, 1, 2, 2, 1, 0, 3, 4, 4, 3], rate: 4.6, shades: [{ dx: 2, dy: 1, rx: 9, ry: 3, strength: 0.24 }], wash };
};

// ── 씨름판 ───────────────────────────────────────────────────
// 풀밭에 모래를 둥글게 깔았다. 땅바닥에 깔린 그림이라 테두리가 없고, 가장자리는 작은 모래 무리로 듬성듬성 풀밭에 풀린다.
export const sandring: Maker = (pal) => {
  const W = 72 * A;
  const H = 42 * A;
  const px = new Px(W, H);
  const sand: Color[] = [mix(pal.path[2], pal.yard[1], 0.5), pal.yard[2], pal.yard[3], pal.yard[4], mix(pal.yard[4], pal.plaster[3], 0.5)];
  const cx = 36;
  const cy = 21;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const x = P(X);
      const y = P(Y);
      const dx = (x - cx) / 35;
      const dy = (y - cy) / 20;
      const wob = (vnoise(x / 5.1, y / 4.3, 931) - 0.5) * 0.16;
      const d = dx * dx + dy * dy + wob;
      if (d > 1) continue;
      if (d > 0.86 && vnoise(X / 2.6, Y / 2.2, 935) < 0.08 + ((d - 0.86) / 0.14) * 0.84) continue;
      let v = 2.6 + (vnoise(x / 9, y / 6, 932) - 0.5) * 2.2 + (vnoise(X / 1.9, Y / 1.7, 933) - 0.5) * 1.1;
      // 둘레에 모래가 도톰하게 쌓였다(위쪽은 밝고 아래쪽은 그늘)
      const ridge = clamp((d - 0.64) / 0.12, 0, 1);
      const side = clamp(-dy * 2.5, -1, 1);
      v += ridge * (side > 0 ? 1.1 * side : 1.3 * side);
      // 발에 패인 자국
      if (d < 0.5 && vnoise(x / 3.1, y / 2.3, 934) > 0.74) v -= 1.1;
      px.set(X, Y, sand[clamp(Math.round(v), 0, 4)]);
    }
  }
  calmSprite(px);
  return { frames: [px], ax: cx * A, ay: cy * A };
};

// ── 씨름하는 두 사람 ──────────────────────────────────────────
// 허리의 띠를 맞잡고 밀고 당긴다. 옷은 입은 채로 수수하게 그린다.
const WRESTLER_A: Person = {
  build: 'adult',
  sex: 'm',
  bottom: 'pants',
  hair: 'braid',
  hairColor: HAIR.brown,
  skin: SKIN.tan,
  top: CLOTH.hemp,
  lower: CLOTH.cotton,
  shoes: CLOTH.straw,
  sash: CLOTH.earth,
};
const WRESTLER_B: Person = {
  build: 'adult',
  sex: 'm',
  bottom: 'pants',
  hair: 'topknot',
  hairColor: HAIR.black,
  skin: SKIN.fair,
  top: CLOTH.cotton,
  lower: CLOTH.ash,
  shoes: CLOTH.straw,
  sash: CLOTH.hemp,
};

export const wrestlers: Maker = () => {
  const W = 40 * A;
  const H = 36 * A;
  // 넉 장: 맞잡음 → 왼쪽이 밀어붙임 → 맞잡음 → 오른쪽이 밀어붙임
  const frames = [
    [1, 1, 0],
    [0, 2, 1],
    [3, 3, 0],
    [2, 0, -1],
  ].map(([fa, fb, push]) => {
    const px = new Px(W, H);
    px.blit(personFrame(WRESTLER_B, 'left', 'work', fb), (14 + push) * A, 3 * A);
    px.blit(personFrame(WRESTLER_A, 'right', 'work', fa), (2 + push) * A, 3 * A);
    return px;
  });
  return { frames, ax: 20 * A, ay: 33 * A, seq: [0, 1, 0, 2, 3, 2], rate: 2.6, shades: [{ dx: 2, dy: 0, rx: 13, ry: 3.5, strength: 0.26 }] };
};

// ── 창포 삶은 물을 담은 함지 ─────────────────────────────────────
export const basin: Maker = (pal) => {
  const W = 24 * A;
  const H = 16 * A;
  const px = new Px(W, H);
  const part = new Uint8Array(W * H); // 1 나무, 2 물
  const { wood } = pal;
  // 옆면: 둥근 통의 널(너비가 조금씩 다르다), 밑은 그늘
  const planks = [-1.15, -0.74, -0.4, -0.02, 0.37, 0.8, 1.2];
  const plankOf = (X: number): number => {
    const a = Math.asin(clamp((P(X) - 12.25) / 10.9, -1, 1));
    let i = 0;
    for (const b of planks) if (a > b) i++;
    return i;
  };
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const dx = (P(X) - 12.25) / 10.9;
      if (Math.abs(dx) > 1) continue;
      const bottom = 9.5 + 5 * Math.sqrt(1 - dx * dx);
      const y = P(Y);
      if (y < 6 || y > bottom) continue;
      let v = 3 - dx * 1.6;
      if (plankOf(X + 1) !== plankOf(X)) v -= 1;
      if (y > bottom - 1) v = Math.min(v, 1.5);
      px.set(X, Y, wood[clamp(Math.round(v), 1, 5)]);
      part[Y * W + X] = 1;
    }
  }
  // 윗면: 나무 테와 물. 창포를 삶아 우린 물은 풀빛이 돌고, 긴 잎이 몇 가닥 떠 있다
  const water: Color = mix(pal.water[1], pal.leafDeep[2], 0.55);
  const sheen: Color = mix(pal.water[3], pal.leafWarm[3], 0.5);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const x = P(X);
      const y = P(Y);
      const dx = (x - 12) / 11.5;
      const dy = (y - 6) / 5.5;
      if (dx * dx + dy * dy > 1) continue;
      const ix = (x - 12) / 11;
      const iy = (y - 6) / 5;
      const inner = (ix * ix) / 0.72 + (iy * iy) / 0.6;
      if (inner < 1) {
        let c = water;
        if (iy > 0.1 && ix < 0.2 && vnoise(X / 4.5, Y / 1.8, 941) > 0.55) c = sheen;
        if (inner > 0.84) c = wood[0];
        else if (inner > 0.72 && iy < 0) c = wood[1];
        px.set(X, Y, c);
        part[Y * W + X] = 2;
      } else {
        px.set(X, Y, wood[clamp(Math.round(4.4 - dx * 1.2 - dy * 1.2), 2, 5)]);
        part[Y * W + X] = 1;
      }
    }
  }
  // 떠 있는 창포 잎(가늘고 긴 칼 모양 — 가운데가 조금 굵다)
  for (const [x0, y0, x1, y1] of [
    [6.4, 7.6, 12.6, 4.7],
    [10, 9.4, 17.4, 5.7],
    [14.6, 9.8, 18.4, 7.9],
  ]) {
    const n = Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * A);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const X = Math.round((x0 + (x1 - x0) * t) * A);
      const Y = Math.round((y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 0.25) * A);
      const ix = (P(X) - 12) / 11;
      const iy = (P(Y) - 6) / 5;
      if ((ix * ix) / 0.72 + (iy * iy) / 0.6 > 0.8) continue;
      px.set(X, Y, pal.leafWarm[4]);
      if (t > 0.25 && t < 0.7) px.set(X, Y + 1, pal.leafWarm[3]);
    }
  }
  const ramps = rampsOf(pal);
  const dark = watercolor(px, ramps, 942, { big: 4, bigY: 6, streak: [1.2, 6, 1.0], keep: (X, Y) => part[Y * W + X] === 1 });
  selfRim(px, ramps);
  calmSprite(px);
  return { frames: [px], ax: 12 * A, ay: 13 * A, shades: [{ dx: 3, dy: 0, rx: 12, ry: 3.5, strength: 0.28 }], wash: dark };
};

// ── 볏단 ─────────────────────────────────────────────────────
/** 세운 볏단 하나(1-라의 점 좌표): 허리를 묶고 이삭 쪽이 위로 퍼진다. (cx, yBot)이 밑동의 가운데. 짚 올은 세로로 길게 흐른다. */
function stook(px: Px, pal: Palette, cx: number, yBot: number, h: number, wide: number, seed: number, lean = 0): void {
  const straw = pal.thatch;
  const ears = earsOf(pal);
  const n = straw.length - 1;
  const waist = 0.36;
  for (let Y = (yBot - h) * A - 1; Y <= (yBot + 1) * A; Y++) {
    const k = P(Y) - 0.5 - (yBot - h);
    const t = clamp(k / h, 0, 1);
    const halfC = t < waist ? 1.6 + (wide * 0.72 - 1.6) * (1 - t / waist) : 1.6 + (wide - 1.6) * ((t - waist) / (1 - waist));
    const half = halfC + 1.15;
    const mid = cx + 0.5 + lean * (1 - t);
    for (let X = Math.floor((mid - half) * A); X <= Math.ceil((mid + half) * A); X++) {
      const u = (P(X) - mid) / half;
      if (Math.abs(u) > 1) continue;
      const strand = vnoise(X / 1.3, Y / 7, seed + 1);
      if (t < waist - 0.05) {
        // 이삭: 누런 낟알이 다닥다닥. 끝은 두 점씩 삐죽삐죽
        if (k < 0.3 + hash2(X >> 1, 0, seed + 2) * 1.6 && hash2(X >> 1, 1, seed + 2) < 0.5) continue;
        const grain = vnoise(X / 1.6, Y / 1.5, seed + 4);
        const v = 2.2 - u * 0.9 + (strand - 0.5) * 1.2 + (grain - 0.5) * 1.0 - (t > waist - 0.15 ? 0.8 : 0);
        px.set(X, Y, ears[clamp(Math.round(v), 0, ears.length - 1)]);
      } else if (Math.abs(t - waist) < 0.055) {
        px.set(X, Y, straw[u > 0.2 ? 0 : t < waist - 0.02 ? 2 : 1]); // 묶은 새끼줄
      } else {
        const v = 3.9 - u * 1.3 + (strand - 0.5) * 1.7 - (t > 0.9 ? 1 : 0);
        px.set(X, Y, straw[clamp(Math.round(v), 1, n)]);
      }
    }
  }
}

// 벤 논에 볏단 셋을 맞대어 세워 말린다
export const sheaf: Maker = (pal, variant) => {
  const W = 26 * A;
  const H = 26 * A;
  const px = new Px(W, H);
  if (variant === 0) {
    stook(px, pal, 8, 22, 17, 4.5, 951, 3);
    stook(px, pal, 18, 22, 17, 4.5, 952, -3);
    stook(px, pal, 13, 23, 19, 5, 953, 0);
  } else if (variant === 1) {
    stook(px, pal, 9, 22, 16, 4.5, 954, 2.5);
    stook(px, pal, 17, 23, 18, 5, 955, -2.5);
  } else {
    stook(px, pal, 13, 23, 20, 6, 956, 0);
    stook(px, pal, 6, 23, 13, 3.6, 957, 2);
    stook(px, pal, 20, 23, 14, 3.8, 958, -2);
  }
  const wash = finish(px, rampsOf(pal), 959 + variant, { big: 3, bigY: 9, streak: [1.2, 8, 1.4] });
  return { frames: [px], ax: 13 * A, ay: 23 * A, shades: [{ dx: 3, dy: 0, rx: 11, ry: 3, strength: 0.26 }], wash };
};

// 타작 마당에 쌓아 둔 볏단 더미: 이삭을 한쪽으로 가지런히 눕혀 쌓았다
export const sheafpile: Maker = (pal) => {
  const W = 38 * A;
  const H = 28 * A;
  const px = new Px(W, H);
  const straw = pal.thatch;
  const ears = earsOf(pal);
  const n = straw.length - 1;
  // 세 켜: 아래가 넓다. 볏단의 너비는 조금씩 다르다(1-라의 8점 안팎)
  [
    [2, 34, 24],
    [5, 32, 17],
    [9, 28, 10],
  ].forEach(([x0, x1, yBot], layer) => {
    const rnd = rngOf(961 + layer);
    const cuts = [x0];
    while (cuts[cuts.length - 1] < x1 + 1) cuts.push(cuts[cuts.length - 1] + 7.2 + rnd() * 1.6);
    for (let Y = (yBot - 7) * A - 1; Y <= (yBot + 1) * A; Y++) {
      const t = (P(Y) - 0.5 - (yBot - 7)) / 7;
      for (let X = 0; X < W; X++) {
        const x = P(X);
        if (x < x0 - 0.45 || x > x1 + 1.45) continue;
        let b = 0;
        while (b + 2 < cuts.length && cuts[b + 1] <= x) b++;
        const inB = (x - cuts[b]) / (cuts[b + 1] - cuts[b]);
        const round = Math.abs(inB - 0.5) * 2;
        // 볏단의 윗머리는 둥글다
        if (t < 0.26 && round > 0.72 + t * 1.1) continue;
        let v = 5.0 - t * 2.0 - round * 1.0 + (vnoise(X / 1.3, Y / 6, 961 + layer) - 0.5) * 1.4;
        if (x > cuts[b + 1] - 0.4) v = 1.6; // 볏단 사이
        let c: Color = straw[clamp(Math.round(v), 1, n)];
        // 이삭 쪽(오른쪽 끝의 볏단은 이삭이 보인다)
        if (x > x1 - 6) c = ears[clamp(Math.round(2.4 - t * 1.4 + (vnoise(X / 1.6, Y / 1.5, 962) - 0.5) * 1.8), 0, ears.length - 1)];
        // 볏단을 묶은 줄
        else if ((b + layer) % 2 === 0 && Math.abs(inB - 0.44) < 0.07) c = straw[1];
        px.set(X, Y, c);
      }
    }
  });
  const wash = finish(px, rampsOf(pal), 963, { big: 4, bigY: 8, streak: [1.2, 6, 1.2] });
  return { frames: [px], ax: 19 * A, ay: 24 * A, shades: [{ dx: 5, dy: 0, rx: 19, ry: 4.5, strength: 0.3 }], wash };
};

// ── 개상 ─────────────────────────────────────────────────────
// 굵은 통나무를 낮은 다리에 얹었다. 볏단을 들어 여기에 내리치면 낟알이 떨어진다.
export const gaesang: Maker = (pal) => {
  const W = 40 * A;
  const H = 22 * A;
  const px = new Px(W, H);
  const { wood, bark, thatch } = pal;
  const ears = earsOf(pal);
  /** 엇걸어 세운 다리 하나(1-라의 점 좌표, 굵기 두 점 → 그림 점 넷): 왼쪽은 볕, 오른쪽은 그늘 */
  const leg = (xa: number, ya: number, xb: number, yb: number, base: number): void => {
    const n = Math.round(Math.abs(ya - yb) * A);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const X = Math.round((xa + (xb - xa) * t) * A - 3);
      const Y = Math.round((ya + (yb - ya) * t) * A);
      for (let k = 0; k < 6; k++) px.set(X + k, Y, wood[clamp(Math.round(base + 1 - k * 0.45), 1, 5)]);
    }
  };
  for (const lx of [9, 29]) {
    leg(lx - 2, 17.5, lx + 3, 9.5, 2);
    leg(lx + 4, 17.5, lx - 1, 9.5, 2.8);
  }
  // 통나무: 위는 볕(볏단에 맞아 닳은 윗면은 더 밝다), 가로로 긴 결
  for (let Y = 0; Y < H; Y++) {
    const y = P(Y);
    if (y < 3.4 || y > 12.6) continue;
    const t = (y - 3.4) / 9.2;
    for (let X = 0; X < W; X++) {
      const x = P(X);
      if (x < 2.4 || x > 37.6) continue;
      let v = 3.6 - t * 3 + (vnoise(X / 7, Y / 1.4, 971) - 0.5) * 1.1;
      if (t < 0.3) v += 0.8 * clamp(Math.min(x - 10, 30 - x) / 3, 0, 1);
      px.set(X, Y, bark[clamp(Math.round(v), 1, 4)]);
    }
  }
  // 나무의 자른 끝
  for (let Y = 0; Y < H; Y++) {
    for (let X = 4; X <= 10; X++) {
      const dx = (X + 0.5 - 7.6) / 2.6;
      const dy = (P(Y) - 8) / 4.4;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      px.set(X, Y, thatch[Math.abs(Math.sqrt(d) - 0.55) < 0.12 ? 3 : dy < -0.1 || dx < -0.3 ? 5 : 4]);
    }
  }
  const wash = finish(px, rampsOf(pal), 972, { big: 10, bigY: 3, streak: [8, 1.5, 1.0] });
  // 떨어진 낟알과 지푸라기(땅에 흩어진다 — 두세 점짜리 무리로)
  crumbs(px, 3, W - 6, 30, 42, 52, 973, (k) => (hash2(k, 4, 975) < 0.7 ? ears[ears.length - 1 - (k % 2)] : thatch[3]));
  return { frames: [px], ax: 20 * A, ay: 18 * A, shades: [{ dx: 4, dy: 0, rx: 19, ry: 3.5, strength: 0.28 }], wash };
};

// ── 멍석에 널어 말리는 낟알 ─────────────────────────────────────
// 짚으로 엮은 네모난 자리. 땅바닥에 깔린 그림이라 테두리는 짚의 어두운 빛으로만 두른다.
export const grainmat: Maker = (pal) => {
  const W = 46 * A;
  const H = 28 * A;
  const px = new Px(W, H);
  const straw = pal.thatchOld;
  const ears = earsOf(pal);
  const m = straw.length - 1;
  // 엮은 결: 가로로 꼰 새끼 줄(한 줄 네 점)이 이어지고, 꼰 자리는 비스듬하고 간격이 들쭉날쭉하다
  for (let Y = 2; Y < H - 2; Y++) {
    for (let X = 2; X < W - 2; X++) {
      const cxn = X < 7 ? 7 : X > W - 8 ? W - 8 : X;
      const cyn = Y < 7 ? 7 : Y > H - 8 ? H - 8 : Y;
      if (Math.hypot(X + 0.5 - cxn - 0.5, Y + 0.5 - cyn - 0.5) > 5.2) continue;
      const q = Y - 2 + (vnoise(X / 9, Y / 9, 984) - 0.5) * 1.2;
      const inR = ((q % 4) + 4) % 4;
      const row = Math.floor(q / 4);
      const twist = vnoise((X + inR * 0.8) / 3.1, row * 3.7, 985);
      let v = 3.6 + (inR < 1 ? 0.6 : inR >= 3 ? -0.8 : 0) + (twist > 0.62 ? 0.55 : twist < 0.3 ? -0.45 : 0);
      if (X < 4 || X > W - 5 || Y > H - 5) v = 1.4;
      else if (Y < 4) v = 2.2;
      px.set(X, Y, straw[clamp(Math.round(v), 1, m)]);
    }
  }
  // 널어 놓은 낟알: 가운데가 도톰하다
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const x = P(X);
      const y = P(Y);
      const dx = (x - 23) / 17;
      const dy = (y - 14) / 9;
      const d = dx * dx + dy * dy + (vnoise(x / 3.3, y / 2.7, 986) - 0.5) * 0.5;
      if (d > 1) continue;
      if (d > 0.82 && vnoise(X / 1.9, Y / 1.7, 987) < 0.5) continue;
      const v = 2.3 - dx * 0.5 - dy * 1.0 + (vnoise(X / 1.6, Y / 1.4, 988) - 0.5) * 1.8;
      px.set(X, Y, ears[clamp(Math.round(v), 0, ears.length - 1)]);
    }
  }
  const ramps = rampsOf(pal);
  const dark = watercolor(px, ramps, 989, { big: 8, bigY: 6, amp: 1.2 });
  selfRim(px, ramps);
  calmSprite(px);
  return { frames: [px], ax: 23 * A, ay: 14 * A, wash: dark };
};

// ── 길 떠나는 사람의 짐 꾸러미 ───────────────────────────────────
export const bundle: Maker = (pal, variant) => {
  const W = 18 * A;
  const H = 14 * A;
  const px = new Px(W, H);
  const cloth = variant === 0 ? CLOTH.hemp : CLOTH.cotton;
  // 보자기로 싼 꾸러미(1-라의 점 좌표): 위의 매듭 쪽으로 천이 모여 부드러운 주름이 진다
  const blob = (cx: number, cy: number, rx: number, ry: number, seed: number): void => {
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const dx = (P(X) - cx) / (rx + 0.75);
        const dy = (P(Y) - cy) / (ry + 0.75);
        if (dx * dx + dy * dy > 1) continue;
        let v = 2.4 - dx * 1.1 - dy * 1.2;
        const ang = Math.atan2(P(Y) - (cy - ry), P(X) - cx);
        const fold = vnoise(ang * 3.2 + seed, 0.5, seed);
        if (dy < 0.4 && fold < 0.32) v -= 0.7 * (1 - Math.max(0, dy + 0.2));
        px.set(X, Y, cloth[clamp(Math.round(v), 0, 3)]);
      }
    }
  };
  blob(8.5, 8.5, 6, 4.4, 991);
  // 매듭: 묶은 두 귀와 가운데 매듭, 그 밑에 모인 천의 골
  for (const [y, row] of [
    [3, [[13, 3], [14, 3], [19, 2], [20, 1]]],
    [4, [[12, 3], [13, 3], [14, 2], [15, 2], [18, 2], [19, 2], [20, 1], [21, 1]]],
    [5, [[14, 3], [15, 2], [16, 3], [17, 2], [18, 2], [19, 1]]],
    [6, [[15, 3], [16, 3], [17, 2], [18, 1]]],
    [7, [[15, 2], [16, 2], [17, 2], [18, 1]]],
    [8, [[16, 1], [17, 1]]],
    [9, [[16, 0], [17, 0]]],
  ] as const) {
    for (const [x, i] of row) px.set(x, y, cloth[i]);
  }
  if (variant === 1) {
    blob(14.5, 10.5, 3.4, 2.6, 992);
    // 새로 삼은 짚신 한 켤레
    for (const [X, Y, i] of [
      [4, 21, 5],
      [5, 21, 5],
      [3, 22, 5],
      [4, 22, 4],
      [5, 22, 2],
      [6, 22, 4],
      [7, 22, 3],
      [3, 23, 4],
      [4, 23, 3],
      [5, 23, 2],
      [6, 23, 3],
      [7, 23, 2],
      [4, 24, 3],
      [5, 24, 2],
      [6, 24, 2],
    ]) {
      px.set(X, Y, pal.thatch[i]);
    }
  }
  const wash = finish(px, rampsOf(pal), 993 + variant, { big: 4, bigY: 3, amp: 1.3, fine: 1.3 });
  return { frames: [px], ax: 9 * A, ay: 12 * A, shades: [{ dx: 2, dy: 0, rx: 8, ry: 2.4, strength: 0.24 }], wash };
};

// ── 쓸어 모은 눈 ──────────────────────────────────────────────
// 눈의 볕은 눈빛 그대로, 그늘은 엷은 붉은 보랏빛(푸르스름하게 가라앉지 않게 — 겨울 땅의 눈밭 그늘과 같은 쪽)
const SNOW_SHADE = [hex('#a59aa6'), hex('#b8b0b8'), hex('#d6d4d2')];

export const snowpile: Maker = (pal, variant) => {
  const W1 = variant === 0 ? 20 : 28;
  const H1 = variant === 0 ? 11 : 14;
  const W = W1 * A;
  const H = H1 * A;
  const px = new Px(W, H);
  const snow: Ramp = [...SNOW_SHADE, pal.snow[3], pal.snow[4]];
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const x = P(X);
      const y = P(Y);
      const dx = (x - W1 / 2) / (W1 / 2 - 0.5);
      if (Math.abs(dx) > 1) continue;
      const top = H1 - 2 - (H1 - 4) * Math.sqrt(1 - dx * dx) * (0.8 + vnoise(x / 4.1, variant, 995) * 0.3) - 0.5;
      if (y < top || y > H1 - 0.6) continue;
      const t = (y - top) / Math.max(1, H1 - 1.5 - top);
      let v = 3.7 - dx * 1.3 - t * 1.6 + (vnoise(X / 2.2, Y / 1.8, 996) - 0.5) * 1.1 + (vnoise(X / 6, Y / 4, 998) - 0.5) * 0.8;
      if (y > H1 - 1.6) v = Math.min(v, 1.5);
      px.set(X, Y, snow[clamp(Math.round(v), 0, 4)]);
    }
  }
  // 이 눈의 단계가 먼저 오게(눈빛 단계의 푸른 그늘로 옮기지 않는다)
  const ramps: RampIndex = new Map(rampsOf(pal));
  snow.forEach((c, i) => ramps.set(c, [snow, i]));
  const wash = finish(px, ramps, 997 + variant, { big: 5, bigY: 3, amp: 1.0, fine: 1.2 });
  return { frames: [px], ax: Math.round(W1 / 2) * A, ay: (H1 - 2) * A, shades: [{ dx: 2, dy: 0, rx: W1 / 2, ry: 2.4, strength: 0.16 }], wash };
};
