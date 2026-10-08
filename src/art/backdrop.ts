// 코드로 그린 배경. 그림 파일이 없는 자리(또는 아직 못 받은 자리)에 나온다.
// 맵의 도트 그림(src/pixel)을 그대로 가져다 옆에서 본 풍경으로 늘어놓는다. 바깥 그림 파일을 쓰지 않는다.
// 자리는 이름으로 부른다: entrance(마을 어귀) · paddy(논) · well(우물가) · temple(절 마당) · hill(뒷산 숲) · yard(집 마당).
// 모르는 이름이면 먼 마을 풍경이 나온다. 계절의 빛은 맵과 같은 팔레트에서 온다.
//
// 그때 없던 것은 그리지 않는다(spec 9.6): 간판·글씨·엽전·줄 맞춘 모·장터가 없다. 논은 갈아엎어 물을 댄 흙이다.
// 중요한 것은 가운데에 두고, 아래 4분의 1은 대화창 자리로 비워 둔다.

import type { Season } from '../engine/types';
import { MAKERS } from '../pixel/catalog';
import { paletteOf, type Palette, type Ramp } from '../pixel/palette';
import { Px, bayer, clamp, fbm, hash2, hex, mix, pick, vnoise, type Color } from '../pixel/px';
import type { SpriteDef } from '../pixel/shapes';

export const BACKDROP_PLACES = ['entrance', 'paddy', 'well', 'temple', 'hill', 'yard'] as const;

// ── 맵의 도트 그림 가져오기 ────────────────────────────────────

const spriteCache = new Map<string, SpriteDef | null>();

function spriteOf(pal: Palette, kind: string, variant: number): SpriteDef | null {
  const key = `${pal.season}:${kind}:${variant}`;
  if (!spriteCache.has(key)) {
    const make = MAKERS[kind];
    let def: SpriteDef | null = null;
    try {
      def = make ? make(pal, variant) : null;
    } catch {
      def = null; // 그림 하나가 안 그려져도 배경은 나온다
    }
    spriteCache.set(key, def);
  }
  return spriteCache.get(key) ?? null;
}

/** 세운 것 하나를 발치가 (x, y)에 오게 놓는다 */
function put(px: Px, pal: Palette, kind: string, x: number, y: number, variant = 0, flip = false): void {
  const def = spriteOf(pal, kind, variant);
  if (!def || def.frames.length === 0) return;
  const img = def.frames[0];
  const ax = flip ? img.w - 1 - def.ax : def.ax;
  px.blit(img, Math.round(x - ax), Math.round(y - def.ay), flip);
}

// ── 하늘, 산, 땅 ──────────────────────────────────────────────

const SKY: Record<Season, [string, string, string]> = {
  // 위 · 가운데 · 산마루 가까이
  spring: ['#86bfe6', '#b9def0', '#eef4e0'],
  summer: ['#69aee2', '#a3d3ee', '#e2f1e4'],
  autumn: ['#8dbbe0', '#cbe0ea', '#f6e9c8'],
  winter: ['#b4c2d4', '#d3dce6', '#eef0ee'],
};

function paintSky(px: Px, season: Season, horizon: number): void {
  const [top, mid, low] = SKY[season].map((s) => hex(s));
  const steps = 9;
  for (let y = 0; y < horizon; y++) {
    for (let x = 0; x < px.w; x++) {
      const t = clamp((y / Math.max(1, horizon)) * steps + (bayer(x, y) - 0.5) * 0.9, 0, steps);
      const u = Math.round(t) / steps;
      px.set(x, y, u < 0.6 ? mix(top, mid, u / 0.6) : mix(mid, low, (u - 0.6) / 0.4));
    }
  }
}

function paintClouds(px: Px, season: Season, horizon: number, seed: number): void {
  const light = hex(season === 'winter' ? '#e9edf1' : '#ffffff');
  const shade = hex(season === 'winter' ? '#c8d1dc' : '#dbe8f0');
  const spots: [number, number, number][] = [
    [0.16, 0.2, 1],
    [0.74, 0.13, 1.25],
    [0.93, 0.34, 0.8],
    [0.42, 0.08, 0.7],
  ];
  spots.forEach(([fx, fy, size], i) => {
    const cx = Math.round(px.w * fx + (hash2(i, 3, seed) - 0.5) * 20);
    const cy = Math.round(horizon * fy);
    for (let k = 0; k < 5; k++) {
      const dx = (k - 2) * 9 * size;
      const r = (6 + hash2(i, k, seed) * 5) * size;
      px.ellipse(cx + dx, cy + 2, r * 1.5, r * 0.8, shade);
      px.ellipse(cx + dx - 1, cy - 1, r * 1.4, r * 0.75, light);
    }
  });
}

/** 산줄기 하나. top(x)까지를 채운다. */
function paintRidge(px: Px, horizon: number, base: number, amp: number, freq: number, ramp: Ramp, seed: number, haze: Color | null): void {
  for (let x = 0; x < px.w; x++) {
    const n = fbm(x * freq, 0.5, seed) * 0.7 + vnoise(x * freq * 3.1, 2.5, seed + 9) * 0.3;
    const top = Math.round(horizon - base - amp * n);
    for (let y = Math.max(0, top); y < horizon; y++) {
      // 왼쪽 위가 밝고 골짜기가 어둡다
      const tex = fbm(x / 5, y / 3.5, seed + 3);
      const depth = (y - top) / Math.max(1, horizon - top);
      let c = pick(ramp, 0.72 - depth * 0.35 + (tex - 0.5) * 0.6, x, y, 0.7);
      if (haze !== null) c = mix(c, haze, 0.52);
      px.set(x, y, c);
    }
  }
}

/** 바닥(풀·흙·마당). 멀수록 조금 밝다. */
function paintGround(px: Px, y0: number, ramp: Ramp, seed: number, tone = 0.5): void {
  for (let y = Math.max(0, y0); y < px.h; y++) {
    const far = 1 - (y - y0) / Math.max(1, px.h - y0);
    for (let x = 0; x < px.w; x++) {
      const tex = fbm(x / 13, y / 6, seed) * 0.65 + hash2(x, y, seed + 1) * 0.35;
      px.set(x, y, pick(ramp, tone + far * 0.14 + (tex - 0.5) * 0.5, x, y, 0.6));
    }
  }
}

/** 풀포기와 들꽃을 드문드문 */
function paintTufts(px: Px, pal: Palette, y0: number, seed: number, skip?: (x: number, y: number) => boolean): void {
  const n = Math.round((px.w * (px.h - y0)) / 90);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 1, seed) * px.w);
    const y = y0 + 2 + Math.floor(hash2(i, 2, seed) * (px.h - y0 - 3));
    if (skip?.(x, y)) continue;
    const kind = hash2(i, 3, seed);
    if (pal.flowers && kind > 0.82) {
      px.set(x, y, kind > 0.92 ? pal.yellow[pal.yellow.length - 1] : pal.blossomWhite[pal.blossomWhite.length - 1]);
    } else {
      const tip = pal.grassTip[Math.min(pal.grassTip.length - 1, 1 + Math.floor(kind * 3))];
      px.set(x, y, tip);
      px.set(x, y - 1, tip);
      if (kind > 0.4) px.set(x + 1, y, pal.grass[0]);
    }
  }
}

/**
 * 멀어지며 좁아지는 흙길. 아래 가운데에서 시작해 (endX, y0)로 간다. 길 위인지 알려 주는 함수를 돌려준다.
 */
function paintPath(px: Px, ramp: Ramp, y0: number, endX: number, wTop: number, wBot: number, seed: number, bend = 0): (x: number, y: number) => boolean {
  const cx = px.w / 2;
  const span = Math.max(1, px.h - y0);
  const centerAt = (y: number): number => {
    const t = (y - y0) / span; // 0 멀리 · 1 가까이
    return endX + (cx - endX) * t + Math.sin(t * Math.PI) * bend;
  };
  const halfAt = (y: number): number => {
    const t = (y - y0) / span;
    return (wTop + (wBot - wTop) * t * t) / 2;
  };
  const on = (x: number, y: number): boolean => {
    if (y < y0 || y >= px.h) return false;
    const edge = (vnoise(y / 5, x / 40, seed) - 0.5) * 4;
    return Math.abs(x - centerAt(y)) <= halfAt(y) + edge;
  };
  for (let y = y0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (!on(x, y)) continue;
      const tex = fbm(x / 9, y / 4, seed + 5) * 0.6 + hash2(x, y, seed + 6) * 0.4;
      px.set(x, y, pick(ramp, 0.55 + (tex - 0.5) * 0.55, x, y, 0.6));
    }
  }
  return on;
}

/** 물 댄 논. 갈아엎은 흙덩이가 물 위로 드문드문 보인다. 계절이 바뀌면 벼가 덮는다(줄을 맞추지 않는다). */
function paintPaddy(px: Px, pal: Palette, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  const state = pal.paddyState;
  for (let y = Math.max(0, y0); y < Math.min(px.h, y1); y++) {
    const far = 1 - (y - y0) / Math.max(1, y1 - y0);
    for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
      let c: Color;
      if (state === 'bare') {
        const tex = fbm(x / 8, y / 4, seed) * 0.6 + hash2(x, y, seed) * 0.4;
        c = pick(pal.mud, 0.45 + (tex - 0.5) * 0.6, x, y, 0.6);
        if (hash2(x, y, seed + 4) > 0.965) c = pal.crop[1]; // 벤 그루터기
      } else {
        // 물: 멀수록 하늘빛이 밝게 비친다. 잔물결은 가로로 눕는다.
        const ripple = vnoise(x / 14, y / 2.2, seed + 2);
        c = pick(pal.paddy, 0.3 + far * 0.5 + (ripple - 0.5) * 0.3, x, y, 0.5);
        // 물 위로 올라온 흙덩이
        const clod = fbm(x / 6, y / 3, seed + 7);
        if (clod > 0.75) c = pick(pal.mud, 0.2 + (clod - 0.75) * 2.6, x, y, 0.5);
        if (state === 'green' || state === 'gold') {
          const grow = hash2(x, y, seed + 11) * 0.6 + fbm(x / 5, y / 3, seed + 12) * 0.4;
          if (grow > 0.34) c = pick(pal.crop, 0.25 + far * 0.3 + (grow - 0.34) * 1.1, x, y, 0.6);
        }
      }
      px.set(x, y, c);
    }
  }
}

/** 논둑: 풀이 난 흙 둑. 가로로 눕되 살짝 구불거린다. */
function paintBund(px: Px, pal: Palette, y: number, thick: number, seed: number, x0 = 0, x1 = px.w): void {
  for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
    const wob = Math.round((vnoise(x / 22, 0.3, seed) - 0.5) * 5);
    for (let k = 0; k < thick; k++) {
      const yy = y + wob + k;
      const t = k / Math.max(1, thick - 1);
      const tex = hash2(x, yy, seed + 2);
      px.set(x, yy, t < 0.55 ? pick(pal.grass, 0.55 - t * 0.5 + (tex - 0.5) * 0.4, x, yy, 0.5) : pick(pal.soil, 0.75 - (t - 0.55) * 1.4 + (tex - 0.5) * 0.3, x, yy, 0.5));
    }
  }
}

/** 갈아 놓은 밭: 흙덩이가 고르지 않게 놓인 흙빛 띠 */
function paintPlowed(px: Px, pal: Palette, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  for (let y = Math.max(0, y0); y < Math.min(px.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
      const edge = (vnoise(x / 9, y / 3, seed + 3) - 0.5) * 6;
      if (x < x0 + 3 + edge || x > x1 - 3 + edge) continue;
      const tex = fbm(x / 7, y / 2.5, seed) * 0.55 + hash2(x, y, seed + 1) * 0.45;
      px.set(x, y, pick(pal.soil, 0.5 + (tex - 0.5) * 0.9, x, y, 0.6));
    }
  }
}

/** 가로로 늘어선 담이나 울타리 */
function putRow(px: Px, pal: Palette, kind: string, x0: number, x1: number, y: number, step = 16): void {
  let i = 0;
  for (let x = x0; x <= x1; x += step) put(px, pal, kind, x, y, i++ % 3);
}

// ── 자리마다 ──────────────────────────────────────────────────

interface Frame {
  px: Px;
  pal: Palette;
  season: Season;
  /** 가운데 */
  cx: number;
  /** 산마루(하늘과 땅이 만나는 줄) */
  horizon: number;
  /** 대화창 위쪽 끝쯤(세운 것의 발치를 여기 위에 둔다) */
  floor: number;
}

function open(f: Frame, far = true): void {
  const { px, pal, season, horizon } = f;
  paintSky(px, season, horizon);
  paintClouds(px, season, horizon, 11);
  const haze = hex(SKY[season][2]);
  if (far) paintRidge(px, horizon, 20, 34, 1 / 70, pal.leafDeep, 21, haze);
  paintRidge(px, horizon, 4, 24, 1 / 46, pal.leafDeep, 37, mix(haze, pal.leafDeep[1], 0.55));
}

function entrance(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 길 양쪽의 갈아 놓은 밭
  paintPlowed(px, pal, cx - px.w, cx - 46, horizon + 26, horizon + 46, 61);
  paintPlowed(px, pal, cx + 60, cx + px.w, horizon + 34, horizon + 58, 62);
  const onPath = paintPath(px, pal.path, horizon + 6, cx + 34, 8, px.w * 0.42, 71, -18);
  paintTufts(px, pal, horizon + 2, 81, onPath);
  // 멀리 초가 몇 채와 돌담
  put(px, pal, 'choga', cx - 128, horizon + 24, 3);
  put(px, pal, 'hut', cx + 132, horizon + 22, 2);
  put(px, pal, 'choga', cx + 214, horizon + 30, 4);
  putRow(px, pal, 'stonewallH', cx - 196, cx - 190 + 16 * 2, horizon + 30);
  putRow(px, pal, 'stonewallH', cx + 86, cx + 86 + 16 * 2, horizon + 30);
  put(px, pal, 'blossom', cx - 60, horizon + 20, 0);
  put(px, pal, 'blossom', cx + 176, horizon + 18, 2);
  // 한가운데의 큰 느티나무
  put(px, pal, 'zelkova', cx - 6, floor - 4, 0);
  put(px, pal, 'flatstone', cx + 44, floor + 2, 0);
  put(px, pal, 'rockS', cx - 58, floor + 4, 1);
}

function paddy(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 멀리 마을
  put(px, pal, 'hut', cx - 150, horizon + 12, 1);
  put(px, pal, 'hut', cx + 120, horizon + 10, 3);
  put(px, pal, 'young', cx + 70, horizon + 10, 1);
  put(px, pal, 'willow', cx - 96, horizon + 14, 0);
  // 논배미 셋(먼 것부터). 사이사이에 논둑.
  const y1 = horizon + 16;
  const y2 = horizon + 40;
  const y3 = Math.max(y2 + 30, floor - 4);
  paintPaddy(px, pal, 0, px.w, y1, y2, 101);
  paintPaddy(px, pal, 0, px.w, y2, y3, 102);
  paintPaddy(px, pal, 0, px.w, y3, px.h, 103);
  paintBund(px, pal, y1 - 3, 4, 111);
  paintBund(px, pal, y2 - 3, 5, 112);
  paintBund(px, pal, y3 - 3, 7, 113);
  // 논둑에 난 풀과 돌
  put(px, pal, 'reed', cx - 120, y2 + 1, 0);
  put(px, pal, 'reed', cx + 150, y3 + 2, 1);
  put(px, pal, 'tuft', cx + 40, y2 + 1, 0);
  put(px, pal, 'rockS', cx - 30, y3 + 3, 0);
}

function wellPlace(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 우물 둘레의 다져진 마당 흙
  for (let y = horizon + 26; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const edge = (vnoise(x / 18, y / 6, 131) - 0.5) * 12;
      if (y < horizon + 34 + edge) continue;
      const tex = fbm(x / 11, y / 5, 132) * 0.6 + hash2(x, y, 133) * 0.4;
      px.set(x, y, pick(pal.yard, 0.5 + (tex - 0.5) * 0.5, x, y, 0.6));
    }
  }
  put(px, pal, 'choga', cx + 118, horizon + 34, 1);
  put(px, pal, 'hut', cx - 150, horizon + 28, 0);
  putRow(px, pal, 'stonewallH', cx - 100, cx - 100 + 16 * 3, horizon + 30);
  put(px, pal, 'blossom', cx - 62, horizon + 28, 1);
  put(px, pal, 'young', cx + 196, horizon + 26, 0);
  put(px, pal, 'jars', cx + 60, horizon + 40, 0);
  // 우물은 한가운데에서 조금 왼쪽, 사람이 설 자리 곁에
  put(px, pal, 'well', cx - 72, floor - 2, 0);
  put(px, pal, 'flatstone', cx - 30, floor + 3, 1);
  put(px, pal, 'tuft', cx + 96, floor, 1);
}

function temple(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  // 산이 바짝 다가와 있다
  paintSky(px, f.season, horizon);
  paintClouds(px, f.season, horizon, 17);
  const haze = hex(SKY[f.season][2]);
  paintRidge(px, horizon, 30, 44, 1 / 60, pal.leafDeep, 41, mix(haze, pal.leafDeep[1], 0.4));
  paintRidge(px, horizon, 8, 30, 1 / 38, pal.pine, 43, null);
  paintGround(px, horizon, pal.forest, 7, 0.55);
  // 마당의 고운 흙
  for (let y = horizon + 30; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const edge = (vnoise(x / 20, y / 7, 151) - 0.5) * 10;
      if (y < horizon + 36 + edge) continue;
      const tex = fbm(x / 12, y / 5, 152) * 0.6 + hash2(x, y, 153) * 0.4;
      px.set(x, y, pick(pal.yard, 0.56 + (tex - 0.5) * 0.45, x, y, 0.6));
    }
  }
  // 뒤의 소나무
  put(px, pal, 'pine', cx - 150, horizon + 20, 0);
  put(px, pal, 'oldpine', cx - 104, horizon + 26, 0);
  put(px, pal, 'pine', cx + 112, horizon + 22, 1);
  put(px, pal, 'pineS', cx + 160, horizon + 28, 0);
  put(px, pal, 'pine', cx + 204, horizon + 20, 2);
  put(px, pal, 'pine', cx - 206, horizon + 24, 2);
  // 법당과 돌탑
  put(px, pal, 'temple', cx, Math.min(floor - 14, horizon + 58), 0);
  put(px, pal, 'pagoda', cx + 104, floor - 2, 0);
  put(px, pal, 'azalea', cx - 96, floor - 6, 0);
  put(px, pal, 'rockM', cx - 132, floor, 0);
}

function hill(f: Frame): void {
  const { px, pal, cx, floor } = f;
  // 숲속이라 하늘이 조금만 보인다
  const horizon = Math.round(px.h * 0.3);
  paintSky(px, f.season, horizon);
  const haze = hex(SKY[f.season][2]);
  paintRidge(px, horizon, 10, 26, 1 / 50, pal.leafDeep, 51, mix(haze, pal.leafDeep[1], 0.5));
  paintGround(px, horizon, pal.forest, 9, 0.5);
  const onPath = paintPath(px, pal.path, horizon + 18, cx - 26, 6, px.w * 0.36, 171, 22);
  paintTufts(px, pal, horizon + 20, 181, onPath);
  // 뒤쪽 나무들(촘촘히)
  const back = ['pine', 'pineS', 'oak', 'pine', 'young', 'pineS'];
  for (let i = -7; i <= 7; i++) {
    const x = cx + i * 30 + Math.round((hash2(i, 1, 191) - 0.5) * 14);
    if (Math.abs(x - (cx - 22)) < 18) continue; // 길은 비운다
    put(px, pal, back[(i + 70) % back.length], x, horizon + 22 + Math.round(hash2(i, 2, 191) * 8), (i + 70) % 3);
  }
  // 가운데 줄
  const mid: [string, number, number, number][] = [
    ['oak', -150, 46, 0],
    ['pine', -92, 52, 1],
    ['oldpine', 92, 50, 0],
    ['oak', 158, 54, 1],
    ['pine', 214, 48, 0],
    ['pineS', -214, 50, 1],
  ];
  for (const [kind, dx, dy, v] of mid) put(px, pal, kind, cx + dx, horizon + dy, v);
  // 나무하는 자리: 그루터기와 쓰러진 나무
  put(px, pal, 'stump', cx + 58, floor - 2, 0);
  put(px, pal, 'fallen', cx - 98, floor + 2, 0);
  put(px, pal, 'azalea', cx + 128, floor - 6, 1);
  put(px, pal, 'rockM', cx - 160, floor - 4, 1);
  put(px, pal, 'bush', cx + 176, floor + 4, 0);
}

function yard(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 마당 흙
  for (let y = horizon + 18; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const tex = fbm(x / 12, y / 5, 201) * 0.6 + hash2(x, y, 202) * 0.4;
      px.set(x, y, pick(pal.yard, 0.5 + (tex - 0.5) * 0.5, x, y, 0.6));
    }
  }
  // 울타리 너머의 나무
  put(px, pal, 'young', cx + 150, horizon + 14, 1);
  put(px, pal, 'blossom', cx - 170, horizon + 14, 0);
  putRow(px, pal, 'fenceH', cx - 240, cx + 240, horizon + 20);
  // 초가 한 채, 장독, 짚가리, 나뭇더미
  put(px, pal, 'choga', cx - 8, Math.min(floor - 12, horizon + 66), 0);
  put(px, pal, 'jars', cx + 86, floor - 10, 0);
  put(px, pal, 'jars', cx + 112, floor - 6, 1);
  put(px, pal, 'strawstack', cx - 112, floor - 8, 0);
  put(px, pal, 'woodpile', cx - 150, floor - 2, 0);
}

function village(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  const onPath = paintPath(px, pal.path, horizon + 8, cx + 10, 8, px.w * 0.4, 211, 10);
  paintTufts(px, pal, horizon + 2, 212, onPath);
  put(px, pal, 'hut', cx - 120, horizon + 22, 0);
  put(px, pal, 'choga', cx + 126, horizon + 28, 2);
  put(px, pal, 'oak', cx - 60, horizon + 24, 0);
  put(px, pal, 'young', cx + 62, horizon + 20, 1);
  put(px, pal, 'rockS', cx - 70, floor, 0);
}

const PAINTERS: Record<string, (f: Frame) => void> = { entrance, paddy, well: wellPlace, temple, hill, yard };

/** 배경 한 장을 w × h 점으로 그린다(화면에는 정수배로 키워 쓴다). */
export function paintBackdrop(place: string, season: Season, w: number, h: number): Px {
  const px = new Px(Math.max(8, w), Math.max(8, h));
  const frame: Frame = {
    px,
    pal: paletteOf(season),
    season,
    cx: Math.round(px.w / 2),
    horizon: Math.round(px.h * 0.46),
    floor: Math.round(px.h * 0.76),
  };
  (PAINTERS[place] ?? village)(frame);
  return px;
}
