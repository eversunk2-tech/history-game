// 땅 그림. 타일을 한 장씩 찍어 붙이지 않고, 맵 전체를 한 장의 그림으로 "칠한다".
// 그림 점(ART — 맵 점의 반)으로 칠한다: 땅 한 칸은 32×32 그림 점이다(spec 4.7.5의 ㄱ).
//
// 1) 점마다 어느 땅인지 가른다. 칸의 경계를 그대로 쓰지 않고, 둘레 칸을 뭉갠 값에 무늬를 더해 가르고
//    재는 자리를 부드럽게 휘어(맵 점 ±3) 길과 물가가 구불구불 이어지고 격자 티가 나지 않는다.
// 2) 땅마다 큰 얼룩 + 작은 결 + 낱낱의 것(풀포기, 들꽃, 자갈, 흙덩이)을 얹는다. 결과 낱낱의 것은
//    그림 점으로 셈하므로 지금(1-라) 그림의 같은 결이 반 크기로 곱게 칠해진다(3.1차 시안과 같은 셈).
//    꼴이 있는 것(밭이랑, 벼 포기, 논둑의 밟힌 줄, 물가의 턱, 둔덕, 돌층계, 징검돌, 나무다리)은
//    맵 점의 크기 그대로 두고 그림 점으로 곱게 그린다.
// 3) 물가의 턱, 논둑의 그늘, 둔덕의 비탈면, 세운 것의 그림자를 얹는다. 그늘은 따뜻한 쪽으로 진다(ㅂ·ㅍ).
// 4) 따뜻한 큰 얼룩(ㅌ): 크고 느린 결(맵 점 서른~마흔 칸)에 비례해 조금씩 섞어 넓게 부드럽게 번지게 한다.
//    풀의 볕은 노란 연두·그늘은 올리브 갈색, 흙은 볕에 마른 금빛·불그레한 곳·볕에 바랜 모래빛.
// 5) 계절의 빛깔 한 벌에 맞춘 뒤, 대비 큰 외톨이 점과 대비 큰 체크무늬만 이웃의 빛으로 고른다(ㄷ·ㄹ —
//    이웃 단계로 옮겨 가는 고운 결은 지우지 않는다).
//
// 한꺼번에 칠하지 않아도 된다(ㅋ): groundJob이 네모 하나(그림 점)를 칠해 돌려주고, 어느 네모를 먼저 칠해도
// 같은 자리는 언제나 같은 빛이다(둘레를 넉넉히 함께 셈한 뒤 가운데만 쓴다).
// 냇물 자리는 비워 둔다(알파 0). 그 아래에 움직이는 물결을 깔고 이 그림을 덮는다.
// 캔버스를 쓰지 않는다(버퍼만 다룬다).

import { T, TILE, isWater } from '../map/types';
import { MASTER, toneOf } from './master';
import type { Palette } from './palette';
import { ART, Px, alpha, bayer, blue, clamp, fbm, green, hash2, hex, mix, red, rgb, tnoise, vnoise, withAlpha, type Color } from './px';
import { Snapper } from './quant';

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

/** 땅 한 칸의 그림 점 */
export const GROUND_TILE = TILE * ART;
const SH = Math.log2(GROUND_TILE) | 0;
const FR = GROUND_TILE - 1;

/** 밝기 Y′(0~1, Rec.709 — docs/mockup-art/lib.mjs의 luma와 같은 셈) */
export const luma = (c: Color): number => (0.2126 * red(c) + 0.7152 * green(c) + 0.0722 * blue(c)) / 255;

/** 바닥에 지는 그림자(타원). 좌표는 맵의 점. 칠할 때 그림 점으로 옮긴다. */
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
  /** 칸마다 1이면 논의 벼가 성기다(큰비가 온 해의 가을 — 쓸려 간 자리에 흙탕이 앉았다) */
  thin?: Uint8Array;
}

export interface Ground {
  /** 땅 그림(그림 점). 크기는 맵 칸 × GROUND_TILE */
  px: Px;
  /** 칸마다: 물결이 비쳐 보이는 점이 있는가 */
  wet: Uint8Array;
  /** 칸마다: 물 댄 논인가(반짝임과 잔물결을 놓을 곳). 큰비가 온 여름에는 물에 잠긴 논이다. */
  glint: Uint8Array;
  /** 칸마다: 벼가 서 있는 논인가(바람에 벼가 물결친다) */
  crop: Uint8Array;
}

/** 나눠 칠하는 일감. paint가 칠한 네모 안의 칸은 wet이 채워진다(glint·crop은 처음부터 채워져 있다). */
export interface GroundJob {
  /** 그림 점의 너비·높이 */
  W: number;
  H: number;
  wet: Uint8Array;
  glint: Uint8Array;
  crop: Uint8Array;
  /** 그림 점의 네모 하나를 칠해 돌려준다(가장자리가 칸에 맞으면 그 칸들의 wet을 채운다) */
  paint(x0: number, y0: number, w: number, h: number): Px;
  /** 같은 일을 잘게 나눠 한다: next()를 부를 때마다 조금씩 칠하고, 끝나면 칠한 네모를 돌려준다(쉬었다 이어도 같은 그림) */
  steps(x0: number, y0: number, w: number, h: number): Generator<undefined, Px, undefined>;
}

/** 둘레를 함께 셈하는 너비(그림 점). 한 점의 빛이 기대는 이웃(물가의 턱 열 점, 낱낱의 것, 고르기)보다 넓다. */
const MARGIN = 18;

/** 계절마다 따뜻한 큰 얼룩의 빛(풀의 볕·그늘, 흙의 볕·그늘). 볕은 금빛, 그늘은 갈색·붉은 보라(ㅇ·ㅍ). */
interface Blotch {
  grassSun: Color;
  grassShade: Color;
  grassAmt: [number, number];
  dirtSun: Color;
  dirtShade: Color;
  dirtAmt: [number, number];
  /** 흙의 불그레한 곳·바랜 모래빛 */
  dirtHue: [Color, Color] | null;
}

function blotchOf(pal: Palette): Blotch {
  const warmLight = hex('#fff0c4');
  const warmDark = hex('#4a3020');
  if (pal.season === 'winter') {
    // 눈밭: 볕은 따뜻한 크림빛, 그늘은 엷은 붉은 보랏빛(푸르스름하게 가라앉지 않게). 눈은 깨끗해야 하므로 얼룩은 아주 엷게,
    // 눈 덮인 마당과 길에는 불그레한·모래빛 얼룩을 두지 않는다(녹은 진창처럼 보이지 않게)
    return { grassSun: hex('#fffaf0'), grassShade: hex('#c2b6c6'), grassAmt: [0.1, 0.08], dirtSun: hex('#fff6e6'), dirtShade: hex('#8c7a74'), dirtAmt: [0.1, 0.08], dirtHue: null };
  }
  if (pal.season === 'autumn') {
    return { grassSun: hex('#e6cf6a'), grassShade: hex('#4c3a1c'), grassAmt: [0.26, 0.22], dirtSun: warmLight, dirtShade: warmDark, dirtAmt: [0.32, 0.26], dirtHue: [hex('#a85a36'), hex('#d8c69a')] };
  }
  if (pal.rain) {
    return { grassSun: hex('#b9c25a'), grassShade: hex('#34401e'), grassAmt: [0.2, 0.22], dirtSun: hex('#e8d7a8'), dirtShade: warmDark, dirtAmt: [0.24, 0.24], dirtHue: [hex('#8c5636'), hex('#bfae8a')] };
  }
  // 봄·여름: 3.1차 시안의 빛(노란 연두의 볕, 올리브 갈색의 그늘). 흙의 불그레한 곳은 조금 더 붉게, 바랜 곳은 모래빛으로
  return { grassSun: hex('#d6dc62'), grassShade: hex('#3c4a22'), grassAmt: [0.28, 0.24], dirtSun: warmLight, dirtShade: warmDark, dirtAmt: [0.32, 0.26], dirtHue: [hex('#b4582e'), hex('#dccfae')] };
}

const snappers = new Map<string, Snapper>();
/** 그 계절·날씨의 빛깔 한 벌에 맞추는 틀(같은 벌은 한 번만 짓는다) */
export function snapperOf(pal: Palette): Snapper {
  const tone = toneOf(pal.season, pal.rain ? 'rain' : 'clear');
  let s = snappers.get(tone);
  if (!s) {
    s = new Snapper(MASTER[tone]);
    snappers.set(tone, s);
  }
  return s;
}

/** 맵 한 장을 다 칠한다(시험과 그림 견본이 쓴다. 게임의 맵은 groundJob으로 나눠 칠한다) */
export function paintGround(map: GroundMap, pal: Palette, shades: readonly Shade[] = []): Ground {
  const job = groundJob(map, pal, shades);
  const px = new Px(job.W, job.H);
  // 큰 맵은 조각으로 나눠 칠한다(셈 버퍼가 한꺼번에 커지지 않게) — 결과는 한 번에 칠한 것과 같다
  const step = GROUND_TILE * 16;
  for (let y = 0; y < job.H; y += step) {
    for (let x = 0; x < job.W; x += step) {
      const w = Math.min(step, job.W - x);
      const h = Math.min(step, job.H - y);
      px.blitRaw(job.paint(x, y, w, h), x, y);
    }
  }
  return { px, wet: job.wet, glint: job.glint, crop: job.crop };
}

export function groundJob(map: GroundMap, pal: Palette, shadesIn: readonly Shade[] = []): GroundJob {
  const { w, h, terrain } = map;
  const W = w * GROUND_TILE;
  const H = h * GROUND_TILE;
  const A = ART;
  const snapper = snapperOf(pal);
  const look = blotchOf(pal);

  // 그림자를 그림 점으로 옮긴다
  const shades: Shade[] = shadesIn.map((s) => ({
    ...s,
    cx: s.cx * A,
    cy: s.cy * A,
    rx: s.rx * A,
    ry: s.ry * A,
    cast: s.cast ? { ...s.cast, x0: s.cast.x0 * A, x1: s.cast.x1 * A, y: s.cast.y * A, h: s.cast.h * A, side: s.cast.side * A, depth: s.cast.depth * A } : undefined,
  }));

  const tAt = (tx: number, ty: number): number => terrain[clamp(ty, 0, h - 1) * w + clamp(tx, 0, w - 1)];

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

  /** 점 (x, y) 둘레(반 너비 r)의 칸들이 이 무리로 덮인 몫(0~1). 점은 그림 점이다. */
  const cover = (m: Uint8Array, x: number, y: number, r: number): number => {
    const tx = clamp(x >> SH, 0, w - 1);
    const ty = clamp(y >> SH, 0, h - 1);
    const fx = (x & FR) + 0.5;
    const fy = (y & FR) + 0.5;
    const l = Math.max(0, r - fx);
    const rr = Math.max(0, fx + r - GROUND_TILE);
    const c = 2 * r - l - rr;
    const u = Math.max(0, r - fy);
    const d = Math.max(0, fy + r - GROUND_TILE);
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

  // 칸마다 둘레 3×3 칸에 있는 무리(없는 무리의 덮인 몫은 0이라 셈하지 않는다 — 무늬를 더해도 0.5를 넘지 못한다)
  const NW = 1;
  const NP = 2;
  const NPA = 4;
  const NY = 8;
  const NR = 16;
  const NF = 32;
  const near = new Uint8Array(w * h);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      let m = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const o = clamp(ty + j, 0, h - 1) * w + clamp(tx + i, 0, w - 1);
          if (mWater[o]) m |= NW;
          if (mPlot[o]) m |= NP;
          if (mPath[o]) m |= NPA;
          if (mYard[o]) m |= NY;
          if (mRock[o]) m |= NR;
          if (mForest[o]) m |= NF;
        }
      }
      near[ty * w + tx] = m;
    }
  }
  const nearAt = (x: number, y: number): number => near[(y >> SH) * w + (x >> SH)];

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

  const paddyState = pal.paddyState;
  // 칸마다 물결이 보이는지(칠한 뒤에 채운다), 논물인지, 벼가 섰는지
  const wet = new Uint8Array(w * h);
  const glint = new Uint8Array(w * h);
  const standing = new Uint8Array(w * h);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const t = terrain[ty * w + tx];
      glint[ty * w + tx] = (t === T.paddy && paddyState === 'water') || (t === T.soil && paddyState === 'green') ? 1 : 0;
      standing[ty * w + tx] = t === T.paddy && (paddyState === 'green' || paddyState === 'gold') && !(map.thin && map.thin[ty * w + tx]) ? 1 : 0;
    }
  }

  const { grass, forest, path, yard, soil, mud, stone, water, paddy, crop, wood } = pal;
  const SAND = mix(path[3], water[4], 0.35);
  const ICE = mix(water[5], pal.snow[3], 0.55);
  // 가을 숲 바닥과 나무 아래의 가랑잎 빛
  const LEAVES: Color[] = [pal.leaf[3], pal.leaf[4], pal.leaf[5], pal.leafWarm[3], pal.leafWarm[4], pal.leafDeep[3], pal.leafDeep[4], pal.bark[2]];
  const fallenLeaf = (x: number, y: number): Color => LEAVES[Math.floor(hash2(x, y, 119) * LEAVES.length)];
  // 비 온 날의 웅덩이: 낮은 데에 고인 물이 하늘빛을 비춘다. 둘레의 젖은 흙은 짙다.
  const PUDDLE: Color[] = [mix(water[2], stone[1], 0.5), mix(water[4], stone[3], 0.45), mix(water[5], stone[4], 0.4)];

  const lumaMemo = new Map<Color, number>();
  const lumaOf = (c: Color): number => {
    let v = lumaMemo.get(c);
    if (v === undefined) {
      v = luma(c);
      lumaMemo.set(c, v);
    }
    return v;
  };

  /**
   * 그림 점의 네모 하나를 칠한다. 한꺼번에 하지 않아도 되게 열여섯 줄마다·단계마다 쉰다(yield) — 쉬었다 이어도 결과는 같다.
   * 다 칠하면 그 네모를 돌려준다.
   */
  function* paintSteps(rx0: number, ry0: number, rw: number, rh: number): Generator<undefined, Px, undefined> {
    // 둘레까지 함께 셈하는 네모(맵 밖은 버린다)
    const X0 = Math.max(0, rx0 - MARGIN);
    const Y0 = Math.max(0, ry0 - MARGIN);
    const X1 = Math.min(W, rx0 + rw + MARGIN);
    const Y1 = Math.min(H, ry0 + rh + MARGIN);
    const BW = X1 - X0;
    const BH = Y1 - Y0;
    const kind = new Uint8Array(BW * BH);
    const amt = new Uint8Array(BW * BH);
    /** 점마다 무늬를 정한 칸의 땅(휘어 잰 자리의 칸) */
    const own = new Uint8Array(BW * BH);
    const out = new Uint32Array(BW * BH);
    // 2×2 점마다의 휨(127은 아직 셈하지 않음). 칸은 맵 전체의 짝수 격자(x >> 1, y >> 1)에 맞춘다 —
    // 네모가 홀수 자리에서 시작해도 한 칸의 두 점이 같은 짝수 자리에서 잰 값을 쓴다
    const HX0 = X0 >> 1;
    const HY0 = Y0 >> 1;
    const HW = ((X1 - 1) >> 1) - HX0 + 1;
    const HH = ((Y1 - 1) >> 1) - HY0 + 1;
    const warpX = new Int8Array(HW * HH).fill(127);
    const warpY = new Int8Array(HW * HH);
    const forX = new Int8Array(HW * HH);
    const forY = new Int8Array(HW * HH);
    const slowN = new Float32Array(HW * HH);
    const inBuf = (x: number, y: number): boolean => x >= X0 && y >= Y0 && x < X1 && y < Y1;
    const bi = (x: number, y: number): number => (y - Y0) * BW + (x - X0);
    // 네모 밖의 이웃을 물을 때(드물다): 칸으로 어림한다
    const kAt = (x: number, y: number): number => {
      const cx = clamp(x, 0, W - 1);
      const cy = clamp(y, 0, H - 1);
      if (inBuf(cx, cy)) return kind[bi(cx, cy)];
      return KIND_OF[terrain[(cy >> SH) * w + (cx >> SH)]];
    };

    // ── 1. 점마다 땅을 가른다 ──
    for (let y = Y0; y < Y1; y++) {
      if (((y - Y0) & 15) === 15) yield;
      const ty = y >> SH;
      for (let x = X0; x < X1; x++) {
        const tx = x >> SH;
        const ti = ty * w + tx;
        const t = terrain[ti];
        const i = bi(x, y);
        own[i] = t;
        if (t === T.bank || t === T.steps || uniform[ti]) {
          kind[i] = KIND_OF[t];
          amt[i] = 255;
          continue;
        }
        // 재는 자리를 부드럽게 휜다(맵 점 ±3): 칸을 쪼갠 맵이 칸 금을 따라 곧아지지 않게(3.1차 시안과 같은 휨).
        // 휨은 느리게 바뀌므로 2×2 점마다 한 번 셈한다(자리로 정해지므로 어느 차례로 칠해도 같다)
        const wi = ((y >> 1) - HY0) * HW + ((x >> 1) - HX0);
        if (warpX[wi] === 127) {
          const ex = x & ~1;
          const ey = y & ~1;
          warpX[wi] = Math.round((vnoise(ex / 19, ey / 17, 41) - 0.5) * 12);
          warpY[wi] = Math.round((vnoise(ex / 17 + 5, ey / 19, 42) - 0.5) * 10);
          slowN[wi] = (vnoise(ex / 7.3, ey / 7.3, 11) - 0.5) * 2;
          forX[wi] = Math.round((vnoise(ex / 21, ey / 21, 13) - 0.5) * 26);
          forY[wi] = Math.round((vnoise(ex / 21 + 5.3, ey / 21 + 1.7, 14) - 0.5) * 26);
        }
        const dx = warpX[wi];
        const dy = warpY[wi];
        let sx = clamp(x + dx, 0, W - 1);
        let sy = clamp(y + dy, 0, H - 1);
        let st = terrain[(sy >> SH) * w + (sx >> SH)];
        if (st === T.bank || st === T.steps) {
          // 둔덕과 돌층계는 꼴이 있는 땅이라 휘어 들어가지 않는다
          sx = x;
          sy = y;
          st = t;
        }
        own[i] = st;
        const n = slowN[wi] + (vnoise(x / 2.9, y / 2.9, 12) - 0.5) * 0.5;
        const ns = nearAt(sx, sy);
        const cw = ns & NW ? cover(mWater, sx, sy, 6) : 0;
        if (cw + n * 0.24 > 0.5) {
          const dx2 = clamp(Math.round(sx + (vnoise(x / 17, y / 17, 15) - 0.5) * 18), 0, W - 1);
          const dy2 = clamp(Math.round(sy + (vnoise(x / 17 + 3.1, y / 17 + 7.7, 16) - 0.5) * 18), 0, H - 1);
          const cd = cover(mDeep, dx2, dy2, 8);
          kind[i] = cd + n * 0.12 > 0.52 ? K.deep : K.water;
          amt[i] = Math.round(clamp(cw, 0, 1) * 255);
          continue;
        }
        // 논과 밭은 휨을 반만(논둑의 밟힌 줄이 좁아지지 않게)
        const px2 = clamp(x + (dx >> 1), 0, W - 1);
        const py2 = clamp(y + (dy >> 1), 0, H - 1);
        const cp = nearAt(px2, py2) & NP ? cover(mPlot, px2, py2, 4) : 0;
        if (cp + n * 0.07 > 0.5) {
          // 가장 가까운 논밭 칸의 갈래를 따른다
          const ptx = px2 >> SH;
          const pty = py2 >> SH;
          let pk = KIND_OF[terrain[pty * w + ptx]];
          if (!isPlot(pk)) {
            const fx = px2 & FR;
            const fy = py2 & FR;
            const cand: [number, number, number][] = [
              [ptx - 1, pty, fx],
              [ptx + 1, pty, FR - fx],
              [ptx, pty - 1, fy],
              [ptx, pty + 1, FR - fy],
            ];
            let best = 999;
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
        const cpath = ns & NPA ? cover(mPath, sx, sy, 6) : 0;
        if (cpath + n * 0.3 > 0.5) {
          kind[i] = K.path;
          amt[i] = Math.round(clamp(cpath, 0, 1) * 255);
          continue;
        }
        if (t === T.ridge) {
          const cr = cover(mRidge, x, y, 5);
          // 논둑이 꺾이거나 만나는 곳이 아니면 가운데 줄만 밟힌 흙으로 보인다(줄의 너비는 맵 점 그대로)
          const fx = ((x & FR) - FR / 2) / A;
          const fy = ((y & FR) - FR / 2) / A;
          const horiz = tAt(tx - 1, ty) === T.ridge || tAt(tx + 1, ty) === T.ridge;
          const vert = tAt(tx, ty - 1) === T.ridge || tAt(tx, ty + 1) === T.ridge;
          const off = horiz && vert ? Math.min(Math.abs(fx), Math.abs(fy)) : horiz ? Math.abs(fy) : Math.abs(fx);
          if (off + n * 1.6 < 2.6 && cr > 0.3) {
            kind[i] = K.ridge;
            amt[i] = 255;
            continue;
          }
        }
        const cy = ns & NY ? cover(mYard, sx, sy, 6) : 0;
        if (cy + n * 0.3 > 0.5) {
          kind[i] = K.yard;
          amt[i] = Math.round(clamp(cy, 0, 1) * 255);
          continue;
        }
        const crock = ns & NR ? cover(mRock, sx, sy, 6) : 0;
        if (crock + n * 0.3 > 0.5) {
          kind[i] = K.rock;
          amt[i] = Math.round(clamp(crock, 0, 1) * 255);
          continue;
        }
        // 숲 바닥과 풀밭의 경계는 칸을 따라 꺾이지 않게, 재는 자리를 크게 휘어서 가른다
        const fx = clamp(x + forX[wi], 0, W - 1);
        const fy = clamp(y + forY[wi], 0, H - 1);
        const cf = nearAt(fx, fy) & NF ? cover(mForest, fx, fy, 7) : 0;
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
    for (let y = Y0; y < Y1; y++) {
      if (((y - Y0) & 15) === 15) yield;
      const ty = y >> SH;
      for (let x = X0; x < X1; x++) {
        const tx = x >> SH;
        if (terrain[ty * w + tx] !== T.ridge || !uniform[ty * w + tx]) continue;
        const n = (vnoise(x / 7.3, y / 7.3, 11) - 0.5) * 2;
        if (Math.min(Math.abs(((x & FR) - FR / 2) / A), Math.abs(((y & FR) - FR / 2) / A)) + n * 1.6 < 2.6) kind[bi(x, y)] = K.ridge;
      }
    }

    // ── 2. 땅마다 칠한다 ──
    // 비 온 날의 웅덩이: 꼴(웅덩이의 크기와 자리)은 1-라처럼 맵 점으로 셈하고, 가장자리와 물빛의 결만 그림 점으로 곱게
    const puddled = (c: Color, x: number, y: number, wetRim: Color): Color => {
      const p = fbm(x / (10.5 * A), y / (5.5 * A), 240);
      if (p < 0.635) return c;
      if (p < 0.665) return wetRim;
      if (p > 0.76 && hash2(x >> 2, y >> 1, 241) < 0.6) return PUDDLE[2];
      return PUDDLE[vnoise(x / (4.5 * A), y / (1.9 * A), 242) > 0.55 ? 1 : 0];
    };

    // 큰 결(풀·숲 바닥·흙길·마당)은 넉 점 격자에서 재고 그 사이는 곧게 잇는다(맵 전체에 같은 격자)
    const T4 = 4;
    const tgx0 = Math.floor(X0 / T4);
    const tgy0 = Math.floor(Y0 / T4);
    const TGW = Math.floor((X1 - 1) / T4) - tgx0 + 2;
    const TGH = Math.floor((Y1 - 1) / T4) - tgy0 + 2;
    const TEX: [number, number, number][] = [
      [23, 17, 101],
      [19, 15, 111],
      [15, 11, 201],
      [21, 14, 221],
    ];
    const texGrid = TEX.map(() => new Float32Array(TGW * TGH).fill(-1));
    const texAt = (which: number, x: number, y: number): number => {
      const g = texGrid[which];
      const q = Math.floor(x / T4) - tgx0;
      const j = Math.floor(y / T4) - tgy0;
      const o = j * TGW + q;
      if (g[o] < 0) {
        const [sx, sy, seed] = TEX[which];
        for (const [oo, qq, jj] of [
          [o, q, j],
          [o + 1, q + 1, j],
          [o + TGW, q, j + 1],
          [o + TGW + 1, q + 1, j + 1],
        ]) {
          if (g[oo] < 0) g[oo] = fbm(((tgx0 + qq) * T4) / sx, ((tgy0 + jj) * T4) / sy, seed);
        }
      } else if (g[o + 1] < 0 || g[o + TGW] < 0 || g[o + TGW + 1] < 0) {
        const [sx, sy, seed] = TEX[which];
        if (g[o + 1] < 0) g[o + 1] = fbm(((tgx0 + q + 1) * T4) / sx, ((tgy0 + j) * T4) / sy, seed);
        if (g[o + TGW] < 0) g[o + TGW] = fbm(((tgx0 + q) * T4) / sx, ((tgy0 + j + 1) * T4) / sy, seed);
        if (g[o + TGW + 1] < 0) g[o + TGW + 1] = fbm(((tgx0 + q + 1) * T4) / sx, ((tgy0 + j + 1) * T4) / sy, seed);
      }
      const fx = (x - (tgx0 + q) * T4) / T4;
      const fy = (y - (tgy0 + j) * T4) / T4;
      const a = g[o] + (g[o + 1] - g[o]) * fx;
      const b = g[o + TGW] + (g[o + TGW + 1] - g[o + TGW]) * fx;
      return a + (b - a) * fy;
    };
    for (let y = Y0; y < Y1; y++) {
      if (((y - Y0) & 15) === 15) yield;
      for (let x = X0; x < X1; x++) {
        const i = bi(x, y);
        const k = kind[i];
        const a = amt[i] / 255;
        const tx = x >> SH;
        const ty = y >> SH;
        const t = own[i];
        let c: Color = 0;
        switch (k) {
          case K.grass: {
            const m = texAt(0, x, y);
            const f = vnoise(x / 2.3, y / 2.3, 102);
            let v = 3 + (m - 0.5) * 3.0 + (f - 0.5) * 0.9;
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
            const m = texAt(1, x, y);
            const f = vnoise(x / 2.4, y / 2.4, 112);
            let v = (k === K.thicket ? 1.1 : 2.1) + (m - 0.5) * 3 + (f - 0.5) * 1.0;
            // 풀밭과 만나는 곳은 풀빛 쪽으로 풀린다(가장자리는 이웃 단계의 고운 섞임)
            if (a < 0.6) {
              c = bayer(x, y) < (0.6 - a) * 8 ? grass[2] : forest[clamp(Math.round(v + 1.2), 0, 4)];
              break;
            }
            if (a < 0.75) v += 0.8;
            c = forest[clamp(Math.round(v), 0, 4)];
            // 떨어진 잎과 잔가지(두세 점의 무리 — 외톨이 점이 되지 않게). 가을에는 가랑잎이 수북하다
            const bx = x >> 1;
            const by = y >> 1;
            const hsh = hash2(bx, by, 113);
            const corner = hash2(bx, by, 114) * 4;
            const inLeaf = ((x & 1) + (y & 1) * 2) !== Math.floor(corner);
            if (inLeaf) {
              if (pal.drift === 'leaf' && hsh < 0.13) c = fallenLeaf(bx, by);
              else if (hsh < 0.022) c = pal.thatch[1];
              else if (hsh < 0.034) c = pal.bark[2];
              else if (hsh > 0.985) c = forest[4];
            }
            break;
          }
          case K.path: {
            const m = texAt(2, x, y);
            const f = vnoise(x / 2.1, y / 2.1, 202);
            let v = 3 + (m - 0.5) * 2.2 + (f - 0.5) * 0.8;
            if (a > 0.93) v += 0.4; // 가운데는 밟혀서 밝다
            if (a < 0.64) v -= 0.9;
            const hsh = hash2(x, y, 203);
            if (hsh < 0.008) v -= 1;
            else if (hsh > 0.993) v += 1;
            const up = kAt(x, y - 1);
            if (up !== K.path && up !== K.yard && up !== K.rock) v = Math.min(v, 1.4); // 풀 아래의 그늘
            c = path[clamp(Math.round(v), 1, 5)];
            if (pal.rain && a > 0.8) c = puddled(c, x, y, path[0]);
            break;
          }
          case K.ridge: {
            const f = vnoise(x / 2.2, y / 2.2, 211);
            c = f > 0.68 ? path[4] : f > 0.16 ? path[3] : path[2];
            if (hash2(x, y, 212) < 0.07) c = grass[3];
            break;
          }
          case K.yard: {
            const m = texAt(3, x, y);
            const f = vnoise(x / 2.6, y / 2.6, 222);
            let v = 2.3 + (m - 0.5) * 1.9 + (f - 0.5) * 0.7;
            if (a < 0.64) v -= 0.8;
            const hsh = hash2(x, y, 223);
            if (hsh < 0.008) v -= 1.3;
            else if (hsh > 0.993) v += 1;
            const up = kAt(x, y - 1);
            if (up !== K.path && up !== K.yard) v = Math.min(v, 0.8);
            c = yard[clamp(Math.round(v), 0, 4)];
            if (pal.rain && a > 0.8) c = puddled(c, x, y, yard[0]);
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
            c = plotColor(k, x, y, a);
            // 논둑 턱의 그늘(맵 점 두 줄 — 그림 점 넷)
            const wetPlot = (k === K.paddy && paddyState === 'water') || (k === K.soil && paddyState === 'green');
            if (!isPlot(kAt(x, y - 1)) || !isPlot(kAt(x, y - A))) c = soil[0];
            else if (!isPlot(kAt(x, y - A - 1)) || !isPlot(kAt(x, y - 2 * A))) c = wetPlot ? mud[0] : soil[0];
            else if (!isPlot(kAt(x - 1, y)) || !isPlot(kAt(x + 1, y)) || !isPlot(kAt(x - A, y)) || !isPlot(kAt(x + A, y))) c = wetPlot ? mud[1] : soil[1];
            break;
          }
          case K.water:
          case K.deep: {
            // 물가의 턱: 북쪽 둑은 비탈면이 보이고, 남쪽 둑은 물이 닿은 흰 줄만 보인다(턱의 높이는 맵 점 그대로)
            let rise = 0;
            for (let j = 1; j <= 5 * A; j++) {
              if (!isWet(kAt(x, y - j))) {
                rise = Math.ceil(j / A);
                break;
              }
            }
            let fall = 0;
            for (let j = 1; j <= 2 * A; j++) {
              if (!isWet(kAt(x, y + j))) {
                fall = Math.ceil(j / A);
                break;
              }
            }
            const side = !isWet(kAt(x - 1, y)) || !isWet(kAt(x + 1, y)) || !isWet(kAt(x - A, y)) || !isWet(kAt(x + A, y));
            if (rise === 1) c = hash2(x, y, 301) < 0.5 ? grass[1] : soil[1];
            else if (rise === 2) c = soil[hash2(x >> 1, y, 302) < 0.3 ? 2 : 1];
            else if (rise === 3) c = hash2(x >> 1, y, 303) < 0.25 ? stone[2] : soil[0];
            else if (rise === 4) c = withAlpha(water[0], 150);
            else if (rise === 5) c = withAlpha(water[0], bayer(x, y) < 0.5 ? 120 : 60);
            else if (fall === 1) c = hash2(x >> 1, y, 304) < 0.7 ? water[6] : withAlpha(water[5], 200);
            else if (fall === 2) c = hash2(x >> 1, y, 305) < 0.4 ? withAlpha(water[5], 170) : withAlpha(SAND, 150);
            else if (side) c = withAlpha(water[1], 190);
            else if (pal.season === 'winter' && k === K.water && a < 0.8 + (vnoise(x / 6.1, y / 3.3, 306) - 0.5) * 0.24) {
              // 겨울: 물가의 얕은 곳에 살얼음이 끼었다(가운데는 흐른다)
              const f = vnoise(x / 3.7, y / 2.1, 307);
              c = f > 0.72 ? pal.snow[4] : f > 0.3 ? ICE : pal.snow[2];
              if (hash2(x >> 1, y, 308) < 0.04) c = pal.snow[1];
            } else if (a < 0.6) c = withAlpha(SAND, 140);
            else if (a < 0.72) c = bayer(x, y) < 0.5 ? withAlpha(SAND, 110) : withAlpha(SAND, 50);
            else if (k === K.deep) c = withAlpha(water[0], 92);
            else if (kAt(x - 2 * A, y) === K.deep || kAt(x + 2 * A, y) === K.deep || kAt(x, y - 2 * A) === K.deep || kAt(x, y + 2 * A) === K.deep) c = withAlpha(water[0], 46);
            else c = 0;
            break;
          }
          case K.bank: {
            c = bankColor(x, y, tx, ty);
            break;
          }
          case K.steps: {
            const fy = y & FR;
            const fx = x & FR;
            // 맵 점 넉 줄마다 한 단(그림 점 여덟 줄): 디딤의 밝은 윗면 → 앞면 → 그늘
            const p = fy & (4 * A - 1);
            const joint = hash2(fx >> (A + 1), fy >> (A + 1), 611 + tx) < 0.35 && (fx & (4 * A - 1)) === 0;
            if (p === 0) c = stone[5];
            else if (p < 3) c = stone[4];
            else if (p < 5) c = hash2(x, y, 613) < 0.18 ? stone[3] : stone[2];
            else if (p < 7) c = stone[2];
            else c = stone[1];
            if (joint && p < 4) c = stone[3];
            // 겨울: 디딤돌 위에 눈이 얹혔다(가운데는 밟혀서 돌이 드러났다)
            if (pal.season === 'winter' && p < 4 && (fx < 5 * A || fx > 10 * A + 1 || hash2(fx >> 1, fy >> 1, 612 + tx) < 0.3)) c = pal.snow[p === 0 ? 4 : 3];
            if (fx < A || fx > FR - A) c = stone[1];
            break;
          }
        }
        out[i] = c;
      }
    }

    yield;
    // ── 3. 낱낱의 것을 얹는다 ──
    const put = (x: number, y: number, c: Color, on: number): void => {
      if (!inBuf(x, y)) return;
      const i = bi(x, y);
      if (kind[i] !== on) return;
      out[i] = c;
    };
    const ktile = (x: number, y: number): number => terrain[(clamp(y, 0, H - 1) >> SH) * w + (clamp(x, 0, W - 1) >> SH)];
    /** 이 네모에 닿을 수 있는 격자 칸의 범위(격자 간격 gx·gy, 낱낱의 것이 차지하는 너비 reach) */
    const cells = (gx: number, gy: number, reach: number): [number, number, number, number] => [
      Math.max(0, Math.floor((X0 - reach) / gx) - 1),
      Math.max(0, Math.floor((Y0 - reach) / gy) - 1),
      Math.ceil(X1 / gx) + 1,
      Math.ceil(Y1 / gy) + 1,
    ];

    // 풀포기
    {
      const [cx0, cy0, cx1, cy1] = cells(8, 7, 8);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const r = hash2(cx, cy, 701);
          const x = cx * 8 + Math.floor(hash2(cx, cy, 702) * 6);
          const y = cy * 7 + Math.floor(hash2(cx, cy, 703) * 5);
          if (!inBuf(x, y) || kind[bi(x, y)] !== K.grass) continue;
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
    }

    // 들꽃(봄)
    if (pal.flowers) {
      const [cx0, cy0, cx1, cy1] = cells(6, 6, 6);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const x = cx * 6 + Math.floor(hash2(cx, cy, 711) * 5);
          const y = cy * 6 + Math.floor(hash2(cx, cy, 712) * 5);
          if (!inBuf(x, y) || kind[bi(x, y)] !== K.grass) continue;
          const meadow = ktile(x, y) === T.meadow;
          const patch = fbm(x / 37, y / 33, 713);
          const chance = meadow ? 0.42 : patch > 0.6 ? 0.2 : 0.025;
          if (hash2(cx, cy, 714) > chance) continue;
          const sort = hash2(cx, cy, 715);
          // 꽃은 무리 지어 핀다: 얼룩마다 주로 한 가지 빛
          const hue = Math.floor(fbm(x / 53, y / 47, 716) * 6 + sort * 1.5) % 4;
          if (hue === 0) {
            put(x + 1, y, pal.blossomWhite[3], K.grass);
            put(x, y + 1, pal.blossomWhite[3], K.grass);
            put(x + 2, y + 1, pal.blossomWhite[2], K.grass);
            put(x + 1, y + 2, pal.blossomWhite[2], K.grass);
            put(x + 1, y + 1, pal.yellow[2], K.grass);
          } else if (hue === 1) {
            put(x, y, pal.yellow[3], K.grass);
            put(x + 1, y, pal.yellow[2], K.grass);
            put(x, y + 1, pal.yellow[2], K.grass);
            put(x + 1, y + 1, pal.yellow[1], K.grass);
            put(x + 1, y + 2, grass[1], K.grass);
          } else if (hue === 2) {
            put(x, y, pal.blossom[3], K.grass);
            put(x + 1, y, pal.blossom[2], K.grass);
            put(x, y + 1, pal.blossom[2], K.grass);
            put(x + 1, y + 1, pal.blossom[1], K.grass);
            put(x, y + 2, grass[1], K.grass);
          } else {
            put(x, y, pal.azalea[2], K.grass);
            put(x + 1, y, pal.azalea[2], K.grass);
            put(x + 1, y + 1, pal.azalea[1], K.grass);
            put(x + 2, y, pal.azalea[3], K.grass);
            put(x + 1, y + 2, grass[1], K.grass);
          }
        }
      }
    }

    // 숲 바닥의 고사리와 이끼
    {
      const [cx0, cy0, cx1, cy1] = cells(10, 9, 8);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const x = cx * 10 + Math.floor(hash2(cx, cy, 721) * 8);
          const y = cy * 9 + Math.floor(hash2(cx, cy, 722) * 7);
          if (!inBuf(x, y)) continue;
          const k = kind[bi(x, y)];
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
    }

    // 길과 마당, 돌밭의 자갈
    {
      const [cx0, cy0, cx1, cy1] = cells(9, 9, 6);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const x = cx * 9 + Math.floor(hash2(cx, cy, 731) * 7);
          const y = cy * 9 + Math.floor(hash2(cx, cy, 732) * 7);
          if (!inBuf(x, y)) continue;
          const k = kind[bi(x, y)];
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
    }

    // 길가로 넘어온 풀
    {
      const [cx0, cy0, cx1, cy1] = cells(7, 6, 4);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const x = cx * 7 + Math.floor(hash2(cx, cy, 741) * 6);
          const y = cy * 6 + Math.floor(hash2(cx, cy, 742) * 5);
          if (!inBuf(x, y)) continue;
          const k = kind[bi(x, y)];
          if (k !== K.path && k !== K.yard) continue;
          if (amt[bi(x, y)] > 190 || hash2(cx, cy, 743) > 0.55) continue;
          put(x, y, pal.grassTip[1], k);
          put(x + 1, y - 1, pal.grassTip[2], k);
          put(x + 2, y, grass[3], k);
          put(x + 1, y + 1, grass[1], k);
        }
      }
    }

    // 물 댄 논에 드러난 흙덩이, 갈아엎은 논의 큰 흙덩이(맵 점의 크기 그대로, 그림 점으로 둥글게)
    {
      const gx = 11 * A;
      const gy = 9 * A;
      const [cx0, cy0, cx1, cy1] = cells(gx, gy, 4 * A);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const x = cx * gx + Math.floor(hash2(cx, cy, 751) * 9) * A;
          const y = cy * gy + Math.floor(hash2(cx, cy, 752) * 7) * A;
          if (!inBuf(x, y)) continue;
          const k = kind[bi(x, y)];
          if (k === K.paddy && paddyState === 'water') {
            // 물 위로 드러난 흙덩이: 드문드문, 크기도 고르지 않게
            const r = hash2(cx, cy, 753);
            if (r > 0.24) continue;
            const big = r < 0.13;
            const rx = big ? 3.1 : 2.2;
            const ry = big ? 2.0 : 1.4;
            for (let j = -3; j <= 5; j++) {
              for (let i = -4; i <= 5; i++) {
                const dx = (i + 0.5) / rx;
                const dy = (j + 0.5) / ry;
                const d = dx * dx + dy * dy;
                if (d > 1.9) continue;
                if (d > 1) {
                  // 흙덩이 아래·오른쪽에 비친 그늘
                  if (j > 0 && i > -2) put(x + i + 1, y + j, paddy[1], k);
                  continue;
                }
                const lit = -dx * 0.5 - dy * 0.9;
                put(x + i, y + j, lit > 0.45 ? mud[3] : lit > -0.2 ? mud[2] : big && lit < -0.6 ? mud[0] : mud[1], k);
              }
            }
          } else if (k === K.soil && paddyState === 'water') {
            if (hash2(cx, cy, 754) > 0.5) continue;
            for (let j = -2; j <= 3; j++) {
              for (let i = -3; i <= 4; i++) {
                const dx = (i + 0.5) / 2.8;
                const dy = (j + 0.5) / 1.9;
                const d = dx * dx + dy * dy;
                if (d > 1) continue;
                const lit = -dx * 0.5 - dy * 0.9;
                put(x + i, y + j, lit > 0.5 ? soil[4] : lit > 0 ? soil[3] : lit > -0.5 ? soil[2] : soil[0], k);
              }
            }
          }
        }
      }
    }

    // 밭이랑에 자란 것: 봄의 새싹, 여름의 우거진 잎, 가을의 누런 포기와 거둔 이랑. 겨울에는 비어 있다.
    // 이랑의 간격과 포기의 크기는 맵 점 그대로이고, 잎은 그림 점으로 곱게 그린다.
    if (pal.season !== 'winter') {
      const season = pal.season;
      for (let y = Y0; y < Y1; y++) {
        if (((y - Y0) & 15) === 15) yield;
        for (let x = X0; x < X1; x++) {
          if (kind[bi(x, y)] !== K.field) continue;
          const mx = x / A;
          const my = y / A;
          const yy = Math.floor(my + Math.round((vnoise(mx / 13, my / 29, 401) - 0.5) * 2 * A) / A);
          const band = ((yy % 6) + 6) % 6;
          if (band !== 2 || (y & (A - 1)) !== A - 1) continue;
          const cellX = Math.floor(mx / 4);
          if (Math.floor(mx) % 4 !== Math.floor(hash2(cellX, yy, 761) * 3) || (x & (A - 1)) !== 0) continue;
          if (hash2(cellX, yy, 762) > (season === 'summer' ? 0.92 : 0.78)) continue;
          const sub = (i: number, j: number, c: Color): void => put(x + i, y + j, c, K.field);
          if (season === 'spring') {
            // 새싹: 떡잎 두 장
            sub(0, 0, crop[2]);
            sub(1, 0, crop[1]);
            sub(0, -1, crop[2]);
            sub(-1, -2, crop[3]);
            sub(1, -2, crop[3]);
            sub(0, -2, crop[2]);
            if (hash2(cellX, yy, 763) > 0.5) {
              sub(2, -2, crop[1]);
              sub(2, -3, crop[2]);
            }
          } else if (season === 'summer') {
            // 잎이 우거져 이랑을 덮는다(고랑만 어둡게 남는다): 둥근 잎 덩이를 빛 하나로
            const big = hash2(cellX, yy, 763) > 0.35;
            const rx = big ? 5.2 : 4.2;
            const ry = big ? 4.2 : 3.2;
            for (let j = -9; j <= 3; j++) {
              for (let i = -6; i <= 6; i++) {
                const dx = (i + 0.5) / rx;
                const dy = (j + 2.5) / ry;
                const d = dx * dx + dy * dy + (hash2(x + i, y + j, 764) - 0.5) * 0.25;
                if (d > 1) continue;
                const lit = -dx * 0.55 - dy * 0.8 + Math.sqrt(Math.max(0, 1 - d)) * 0.5;
                sub(i, j, crop[clamp(Math.round(1.3 + lit * 1.7), 0, 3)]);
              }
            }
          } else if (hash2(Math.floor(yy / 6), Math.floor(mx / 44), 765) < 0.42) {
            // 가을: 거둔 이랑에는 마른 줄기만 남았다
            if (hash2(cellX, yy, 766) < 0.5) {
              sub(0, 0, pal.thatch[2]);
              sub(0, -1, pal.thatch[3]);
            }
          } else {
            sub(0, 0, crop[1]);
            sub(1, 0, crop[0]);
            sub(0, -1, crop[2]);
            sub(0, -2, crop[3]);
            sub(1, -2, crop[2]);
            sub(2, -3, crop[3]);
            sub(-1, -3, crop[2]);
            sub(0, -4, crop[3]);
            if (hash2(cellX, yy, 763) > 0.5) {
              sub(-2, -2, crop[1]);
              sub(-1, -2, crop[2]);
            }
          }
        }
      }
    }

    // 징검다리의 돌과 나무다리(맵 점의 크기 그대로)
    const tx0 = X0 >> SH;
    const ty0 = Y0 >> SH;
    const tx1 = (X1 - 1) >> SH;
    const ty1 = (Y1 - 1) >> SH;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = terrain[ty * w + tx];
        const ox = tx * GROUND_TILE;
        const oy = ty * GROUND_TILE;
        const set = (x: number, y: number, c: Color): void => {
          if (inBuf(x, y)) out[bi(x, y)] = c;
        };
        const get = (x: number, y: number): Color => (inBuf(x, y) ? out[bi(x, y)] : 0);
        if (t === T.ford) {
          const jx = Math.round((hash2(tx, ty, 771) - 0.5) * 3);
          const jy = Math.round((hash2(tx, ty, 772) - 0.5) * 2);
          const cx = ox + (8 + jx) * A;
          const cy = oy + (8 + jy) * A;
          // 큰비가 온 해에는 물이 불어 돌의 머리만 보인다
          const sunk = pal.rain ? 0.5 : 1;
          for (let j = -6 * A; j <= 6 * A; j++) {
            for (let i = -7 * A; i <= 7 * A; i++) {
              const mi = (i + 0.5) / A;
              const mj = (j + 0.5) / A;
              const d = (mi * mi) / 44 + (mj * mj) / 21;
              if (d > sunk) continue;
              const lit = (-mi * 0.5 - mj * 0.9) / 6;
              let c = stone[clamp(Math.round(3.3 + lit * 1.6 + (vnoise((cx + i) / 3, (cy + j) / 3, 775) - 0.5) * 0.6), 2, 5)];
              if (d > 0.74 * sunk && mj > 0) c = stone[1];
              // 겨울: 돌 위에 눈이 얹혔다
              if (pal.season === 'winter' && mj < 1 && d < 0.8) c = pal.snow[mj < -2 ? 4 : 3];
              set(cx + i, cy + j, c);
            }
          }
          // 돌 둘레의 물결
          for (let i = -7 * A; i <= 7 * A; i++) {
            const mi = (i + 0.5) / A;
            const yy = cy + Math.round(Math.sqrt(Math.max(0, 1 - (mi * mi) / 44) * 21) * A) + 1;
            if (hash2((cx + i) >> 1, yy, 774) < 0.7 && alpha(get(cx + i, yy)) < 255) set(cx + i, yy, withAlpha(water[6], 210));
            for (let k = 1; k <= A; k++) if (alpha(get(cx + i, yy + k)) < 255) set(cx + i, yy + k, withAlpha(water[0], 110));
          }
        } else if (t === T.bridge) {
          const topEdge = tAt(tx, ty - 1) !== T.bridge;
          const botEdge = tAt(tx, ty + 1) !== T.bridge;
          for (let fy = 0; fy < GROUND_TILE; fy++) {
            for (let fx = 0; fx < GROUND_TILE; fx++) {
              const x = ox + fx;
              const y = oy + fy;
              if (!inBuf(x, y)) continue;
              const plankW = 5 * A;
              const plank = Math.floor(x / plankW);
              const u = x % plankW;
              const grain = hash2(plank, y >> 2, 781);
              let v = 3 + (hash2(plank, 0, 782) - 0.5) * 1.6 + (grain - 0.5) * 0.8;
              if (u === plankW - 1) v = 1;
              else if (u === plankW - 2) v -= 0.6;
              if (u === 0) v += 0.6;
              let c = wood[clamp(Math.round(v), 1, 5)];
              const my = fy / A;
              if (topEdge && my < 3) c = my < 1 ? wood[5] : my < 2 ? wood[3] : wood[1];
              if (botEdge && my >= 12) c = my < 13 ? wood[4] : my < 14 ? wood[2] : my < 15 ? wood[1] : wood[0];
              set(x, y, c);
            }
          }
          if (botEdge) {
            // 다리 아래 물에 지는 그늘과 기둥
            for (let fx = 0; fx < GROUND_TILE; fx++) {
              for (let j = 0; j < 5 * A; j++) {
                const x = ox + fx;
                const y = oy + GROUND_TILE + j;
                if (alpha(get(x, y)) < 255) set(x, y, withAlpha(water[0], j < 3 * A ? 170 : bayer(x, y) < 0.5 ? 150 : 80));
              }
              const mx = fx / A;
              if (mx >= 6 && mx < 10) {
                for (let j = 0; j < 4 * A; j++) set(ox + fx, oy + GROUND_TILE + j, mx < 7 ? wood[3] : mx >= 9 ? wood[0] : wood[1]);
              }
            }
          }
        }
      }
    }

    // 가을: 나무 아래에 가랑잎이 떨어져 쌓였다(나무 그림자의 자리 둘레에)
    if (pal.drift === 'leaf') {
      for (const s of shades) {
        if (!s.dapple) continue;
        if (s.cx + s.rx * 1.5 < X0 || s.cx - s.rx * 1.5 - 8 > X1 || s.cy + s.ry * 1.6 < Y0 || s.cy - s.ry * 1.6 > Y1) continue;
        const count = Math.round(s.rx * s.ry * 0.5);
        for (let k = 0; k < count; k++) {
          const ang = hash2(k, Math.round(s.cx), 831) * Math.PI * 2;
          const far = Math.sqrt(hash2(k, Math.round(s.cy), 832)) * 1.25;
          const x = Math.round(s.cx - 4 + Math.cos(ang) * s.rx * far);
          const y = Math.round(s.cy + Math.sin(ang) * s.ry * far * 1.2);
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !inBuf(x, y)) continue;
          const kk = kind[bi(x, y)];
          if (kk !== K.grass && kk !== K.forest && kk !== K.thicket && kk !== K.path && kk !== K.yard && kk !== K.ridge) continue;
          // 가랑잎 한 장은 두세 점(외톨이 점이 되지 않게)
          const leaf = fallenLeaf(x, y);
          out[bi(x, y)] = leaf;
          if (inBuf(x + 1, y) && kind[bi(x + 1, y)] === kk) out[bi(x + 1, y)] = leaf;
          if (hash2(x, y, 833) < 0.5 && inBuf(x, y + 1) && kind[bi(x, y + 1)] === kk) out[bi(x, y + 1)] = leaf;
        }
      }
    }

    yield;
    // ── 4. 그림자: 따뜻한 쪽으로(붉은 밤빛·보랏빛으로 가라앉는다 — 푸르스름해지지 않게) ──
    const darken = (x: number, y: number, k: number): void => {
      if (!inBuf(x, y)) return;
      const i = bi(x, y);
      const c = out[i];
      const a = alpha(c);
      if (a === 255) {
        out[i] = rgb(Math.round(red(c) * k), Math.round(green(c) * k * 0.96), Math.round(blue(c) * k * 0.9));
      } else {
        // 물 위의 그늘: 비쳐 보이는 어두운 물빛을 덧입힌다
        const na = Math.min(235, a + Math.round((1 - k) * 330));
        out[i] = withAlpha(a === 0 ? water[0] : mix(c, water[0], 0.5), na);
      }
    };

    // 둔덕 아래
    for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(h - 2, ty1); ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (terrain[ty * w + tx] !== T.bank) continue;
        for (let fx = 0; fx < GROUND_TILE; fx++) {
          const x = tx * GROUND_TILE + fx;
          const reach = Math.round((3 + vnoise(x / (5 * A), ty, 801) * 2) * A);
          for (let j = 0; j < reach; j++) {
            const y = (ty + 1) * GROUND_TILE + j;
            if (j >= reach - A && bayer(x, y) < 0.5) continue;
            darken(x, y, 0.74);
          }
        }
      }
    }

    // 세운 것의 그림자(겹친 곳이 두 번 어두워지지 않게 표시해 둔다 — 목록에서 먼저 덮은 그림자가 정한다)
    const shadeMark = new Uint8Array(BW * BH);
    for (const s of shades) {
      const k = 1 - (s.strength ?? 0.3);
      if (s.cast) {
        const c = s.cast;
        const top = c.h * 0.62;
        const yA = Math.max(Y0, Math.floor(c.y - top - 2 * A));
        const yB = Math.min(Y1 - 1, c.y + c.depth + A);
        const xA = Math.max(X0, c.x0);
        const xB = Math.min(X1 - 1, c.x1 + c.side + A);
        for (let y = yA; y <= yB; y++) {
          for (let x = xA; x <= xB; x++) {
            const jag = c.ragged ? Math.round((vnoise(x / (3.1 * A), y / (3.1 * A), 821) - 0.5) * 2.4 * A) : 0;
            let inside = false;
            if (y >= c.y && y <= c.y + c.depth + jag) {
              inside = x >= c.x0 + 2 * A + (y - c.y) * 1.1 && x <= c.x1 + c.side - (c.y + c.depth - y) * 0.5 + jag;
            } else if (y < c.y && x >= c.x1 - 3 * A) {
              inside = x <= c.x1 + c.side + jag && y >= c.y - top + (x - c.x1) * 0.6 + jag;
            }
            const i = bi(x, y);
            if (!inside || shadeMark[i]) continue;
            shadeMark[i] = 1;
            darken(x, y, k);
          }
        }
        continue;
      }
      const x0 = Math.max(X0, Math.floor(s.cx - s.rx - 2 * A));
      const x1 = Math.min(X1 - 1, Math.ceil(s.cx + s.rx + 2 * A));
      const y0 = Math.max(Y0, Math.floor(s.cy - s.ry - 2 * A));
      const y1 = Math.min(Y1 - 1, Math.ceil(s.cy + s.ry + 2 * A));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
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
          const i = bi(x, y);
          if (shadeMark[i]) continue;
          shadeMark[i] = 1;
          darken(x, y, k);
        }
      }
    }

    yield;
    // ── 5. 따뜻한 큰 얼룩(ㅌ) → 빛깔 한 벌에 맞춘다 ──
    const WARM_GRAY = hex('#8c5a36');
    // 크고 느린 결은 넉 점 격자에서 재고 그 사이는 곧게 잇는다(맵 전체에 같은 격자 — 조각마다 같은 값)
    const G4 = 4;
    const gx0 = Math.floor(X0 / G4);
    const gy0 = Math.floor(Y0 / G4);
    const GW = Math.floor((X1 - 1) / G4) - gx0 + 2;
    const GH = Math.floor((Y1 - 1) / G4) - gy0 + 2;
    const bigGrid = new Float32Array(GW * GH);
    const hueGrid = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) {
      for (let q = 0; q < GW; q++) {
        const x = (gx0 + q) * G4;
        const y = (gy0 + j) * G4;
        bigGrid[j * GW + q] = vnoise(x / 72, y / 60, 31) * 0.55 + vnoise(x / 40, y / 34, 32) * 0.45;
        hueGrid[j * GW + q] = vnoise(x / 84 + 9, y / 68, 34);
      }
    }
    const lerpGrid = (g: Float32Array, x: number, y: number): number => {
      const q = Math.floor(x / G4) - gx0;
      const j = Math.floor(y / G4) - gy0;
      const fx = (x - (gx0 + q) * G4) / G4;
      const fy = (y - (gy0 + j) * G4) / G4;
      const o = j * GW + q;
      const a = g[o] + (g[o + 1] - g[o]) * fx;
      const b = g[o + GW] + (g[o + GW + 1] - g[o + GW]) * fx;
      return a + (b - a) * fy;
    };
    const bigAt = (x: number, y: number): number => lerpGrid(bigGrid, x, y);
    const hueAt = (x: number, y: number): number => lerpGrid(hueGrid, x, y);
    for (let y = Y0; y < Y1; y++) {
      if (((y - Y0) & 15) === 15) yield;
      for (let x = X0; x < X1; x++) {
        const i = bi(x, y);
        let c = out[i];
        if (alpha(c) !== 255) continue;
        const k = kind[i];
        const grassy = k === K.grass || k === K.forest || k === K.thicket;
        const dirty = k === K.path || k === K.yard || k === K.ridge || k === K.rock || k === K.bank;
        const plot = k === K.field || (k === K.soil && paddyState !== 'green');
        if (grassy || dirty || plot) {
          // 크고 느린 결만 써서 이웃 조각끼리는 부드럽게 이어지고, 화면 전체로는 명암이 넉넉하다(문턱으로 자르지 않는다)
          const nb = bigAt(x, y) + (hash2(x >> 1, y >> 1, 33) - 0.5) * 0.03;
          // 섞는 몫은 열두 단계로(빛깔이 끝없이 갈리지 않게)
          const t = Math.round(clamp((nb - 0.5) * 3.2, -1, 1) * 12) / 12;
          const gain = plot ? 0.6 : k === K.forest || k === K.thicket ? 0.7 : 1;
          if (grassy) {
            if (t > 0) c = mix(c, look.grassSun, look.grassAmt[0] * t * gain);
            else if (t < 0) c = mix(c, look.grassShade, look.grassAmt[1] * -t * gain);
          } else {
            if (t > 0) c = mix(c, look.dirtSun, look.dirtAmt[0] * t * gain);
            else if (t < 0) c = mix(c, look.dirtShade, look.dirtAmt[1] * -t * gain);
            const r = red(c);
            const g = green(c);
            const b = blue(c);
            if (look.dirtHue && r > g && g > b && r - b > 30) {
              // 불그레한 곳과 볕에 바랜 모래빛(잿빛 얼룩은 쓰지 않는다)
              const hue = Math.round(clamp((hueAt(x, y) - 0.5) * 3, -1, 1) * 8) / 8;
              if (hue > 0) c = mix(c, look.dirtHue[0], 0.4 * hue * gain);
              else if (hue < 0) c = mix(c, look.dirtHue[1], 0.4 * -hue * gain);
              // 잿빛으로 가라앉은 흙(그늘)은 따뜻한 밤빛으로
              if (red(c) - blue(c) < 44 && luma(c) < 0.58) c = mix(c, WARM_GRAY, 0.3);
            }
          }
        }
        out[i] = snapper.nearest(c);
      }
    }

    yield;
    // ── 6. 대비 큰 외톨이 점을 이웃의 빛으로 고른다(고운 결은 남긴다 — ㄹ) ──
    // 셈은 칠한 그림을 그대로 읽어서 한다(어느 차례로 칠해도 같은 결과)
    const src = out.slice();
    const lum = new Float32Array(BW * BH);
    for (let i = 0; i < src.length; i++) lum[i] = alpha(src[i]) === 255 ? lumaOf(src[i]) : -1;
    for (let y = Y0 + 1; y < Y1 - 1; y++) {
      if (((y - Y0) & 15) === 15) yield;
      for (let x = X0 + 1; x < X1 - 1; x++) {
        const i = bi(x, y);
        const c = src[i];
        if (lum[i] < 0) continue;
        let alone = true;
        for (let j = -1; j <= 1 && alone; j++) {
          for (let q = -1; q <= 1; q++) {
            if ((q || j) && src[i + j * BW + q] === c) {
              alone = false;
              break;
            }
          }
        }
        if (!alone) continue;
        let nearest = 1;
        for (let j = -1; j <= 1; j++) for (let q = -1; q <= 1; q++) if (q || j) nearest = Math.min(nearest, Math.abs((lum[i + j * BW + q] < 0 ? -9 : lum[i + j * BW + q]) - lum[i]));
        if (nearest <= 0.12) continue;
        // 이웃에서 가장 많이 쓰인 빛(같으면 앞선 것)
        let best = 0;
        let bestN = 0;
        for (let j = -1; j <= 1; j++) {
          for (let q = -1; q <= 1; q++) {
            if (!q && !j) continue;
            const v = src[i + j * BW + q];
            if (alpha(v) !== 255) continue;
            let n = 0;
            for (let jj = -1; jj <= 1; jj++) for (let qq = -1; qq <= 1; qq++) if ((qq || jj) && src[i + jj * BW + qq] === v) n++;
            if (n > bestN) {
              bestN = n;
              best = v;
            }
          }
        }
        if (bestN > 0) out[i] = best;
      }
    }
    yield;
    // ── 7. 대비 큰 체크무늬(두 빛이 2×2로 엇갈리고 밝기 차가 큰 곳)는 한 빛으로 모은다(ㄷ) ──
    const calm = out.slice();
    const harsh = (x: number, y: number): boolean => {
      if (x < X0 || y < Y0 || x + 1 >= X1 || y + 1 >= Y1) return false;
      const i = bi(x, y);
      const a = calm[i];
      const b = calm[i + 1];
      return a !== b && calm[i + BW] === b && calm[i + BW + 1] === a && alpha(a) === 255 && alpha(b) === 255 && Math.abs(lumaOf(a) - lumaOf(b)) > 0.1;
    };
    const hit = new Uint8Array(BW * BH);
    let any = false;
    for (let y = Y0; y < Y1 - 1; y++) {
      if (((y - Y0) & 15) === 15) yield;
      for (let x = X0; x < X1 - 1; x++) {
        if (harsh(x, y)) {
          hit[bi(x, y)] = 1;
          any = true;
        }
      }
    }
    if (any) {
      for (let y = Y0; y < Y1; y++) {
        if (((y - Y0) & 15) === 15) yield;
        for (let x = X0; x < X1; x++) {
          // 이 점이 든 2×2 가운데 대비 큰 체크무늬가 있으면 그 2×2의 왼쪽 위 빛으로
          const i = bi(x, y);
          if (hit[i]) out[i] = calm[i];
          else if (x > X0 && hit[i - 1]) out[i] = calm[i - 1];
          else if (y > Y0 && hit[i - BW]) out[i] = calm[i - BW];
          else if (x > X0 && y > Y0 && hit[i - BW - 1]) out[i] = calm[i - BW - 1];
        }
      }
    }

    // 칸마다 물결이 보이는지(네모 안에 다 든 칸만)
    for (let ty = ry0 >> SH; ty <= (ry0 + rh - 1) >> SH; ty++) {
      if (ty < 0 || ty >= h || ty * GROUND_TILE < ry0 || (ty + 1) * GROUND_TILE > ry0 + rh) continue;
      for (let tx = rx0 >> SH; tx <= (rx0 + rw - 1) >> SH; tx++) {
        if (tx < 0 || tx >= w || tx * GROUND_TILE < rx0 || (tx + 1) * GROUND_TILE > rx0 + rw) continue;
        let holes = false;
        for (let fy = 0; fy < GROUND_TILE && !holes; fy++) {
          const o = bi(tx * GROUND_TILE, ty * GROUND_TILE + fy);
          for (let fx = 0; fx < GROUND_TILE; fx++) {
            if (out[o + fx] >>> 24 !== 255) {
              holes = true;
              break;
            }
          }
        }
        wet[ty * w + tx] = holes ? 1 : 0;
      }
    }

    const res = new Px(rw, rh);
    for (let y = 0; y < rh; y++) {
      const o = bi(rx0, ry0 + y);
      res.d.set(out.subarray(o, o + rw), y * rw);
    }
    return res;
  }

  /**
   * 벼 포기의 자리. 볍씨를 논에 바로 흩어 뿌렸으므로 줄이 없다: 고르지 않게 흩어진 포기들 가운데
   * 이 점에 가장 가까운 포기를 찾아, 그 가운데에서 얼마나 떨어졌는지(ox, oy — 맵 점)와 포기마다 다른 값(h)을 돌려준다.
   * (cw, ch)는 포기 하나가 차지하는 넓이(맵 점)다. x, y는 그림 점이다(포기의 꼴은 맵 점의 크기 그대로, 가장자리는 곱게).
   */
  function tuftAt(x: number, y: number, cw: number, ch: number): { ox: number; oy: number; h: number } {
    const mx = (x + 0.5) / ART;
    const my = (y + 0.5) / ART;
    const gx = Math.floor(mx / cw);
    const gy = Math.floor(my / ch);
    let best = Infinity;
    let ox = 0;
    let oy = 0;
    let h = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = (gx + i + 0.08 + hash2(gx + i, gy + j, 445) * 0.84) * cw;
        const cy = (gy + j + 0.08 + hash2(gx + i, gy + j, 446) * 0.84) * ch;
        const dx = mx - cx;
        const dy = my - cy;
        const d = dx * dx * (ch / cw) + dy * dy * (cw / ch);
        if (d < best) {
          best = d;
          ox = dx;
          oy = dy;
          h = hash2(gx + i, gy + j, 447);
        }
      }
    }
    return { ox, oy, h };
  }

  /** 물이 찬 논의 물빛(봄의 물 댄 논, 큰비에 잠긴 논) */
  function paddyWater(x: number, y: number, a: number): Color {
    let v = 2.7 + (fbm(x / (34 * ART), y / (8 * ART), 421) - 0.5) * 3.0;
    if (fbm(x / (47 * ART), y / (31 * ART), 422) > 0.6) v += 1;
    if (hash2(x >> 2, y, 423) < 0.03) v += 1.2;
    let c = paddy[clamp(Math.round(v), 1, 5)];
    // 가장자리는 얕아서 논바닥의 흙빛이 비친다
    if (a < 0.66) c = mud[2];
    else if (a < 0.8) c = bayer(x, y) < (0.8 - a) / 0.14 ? mud[3] : c;
    else if (a < 0.9 && bayer(x, y) < 0.25) c = mud[3];
    return c;
  }

  /** 큰물에 쓸려 간 자리: 흙탕이 마른 잿빛 흙에 쓰러진 짚이 물결 따라 누워 있다 */
  function silt(x: number, y: number): Color {
    const f = vnoise(x / (3.1 * ART), y / (1.6 * ART), 461);
    if (hash2(x >> 3, y >> 1, 462) < 0.09 && f > 0.4) return pal.thatch[(x + y) % 3 === 0 ? 3 : 2];
    const v = 2.3 + (fbm(x / (13 * ART), y / (5 * ART), 463) - 0.5) * 2.2 + (f - 0.5) * 0.8;
    return [soil[1], soil[2], mix(soil[3], stone[3], 0.35), mix(soil[4], stone[4], 0.4)][clamp(Math.round(v), 0, 3)];
  }

  function plotColor(k: number, x: number, y: number, a: number): Color {
    const thin = map.thin ? map.thin[(y >> SH) * w + (x >> SH)] === 1 : false;
    // 꼴(이랑, 포기)은 맵 점으로 셈하고 결은 그림 점으로
    const mx = x / ART;
    const my = y / ART;
    if (k === K.field) {
      const yyf = my + Math.round((vnoise(mx / 13, my / 29, 401) - 0.5) * 2 * ART) / ART;
      const yy = Math.floor(yyf);
      const band = ((yy % 6) + 6) % 6;
      const hsh = hash2(x >> 1, Math.floor(yyf * ART), 402);
      let v = [0, 1, 3, 3, 2, 1][band];
      // 이랑의 등은 볕 받는 위쪽 반이 한 단계 밝다
      if (band === 2 && yyf - yy < 0.5) v += 0.5;
      if (hsh < 0.14) v -= 1;
      else if (hsh > 0.86) v += 1;
      let c = soil[clamp(Math.round(v), 0, 4)];
      // 겨울: 고랑에 눈이 쌓이고 이랑의 등은 흙이 드러난다
      if (pal.season === 'winter') {
        if (band === 0 || band === 5 || band === 1) c = grass[band === 0 ? 4 : 5];
        else if (hsh > 0.55) c = grass[6];
      }
      return c;
    }
    if (k === K.soil && paddyState === 'water') {
      // 봄: 갈아엎은 논
      const yyf = my + (vnoise(mx / 9, my / 31, 411) - 0.5) * 3;
      const yy = Math.floor(yyf);
      const band = ((yy % 5) + 5) % 5;
      let v = [0, 1, 3, 2, 1][band];
      const hsh = hash2(x >> 1, Math.floor(yyf * ART), 412);
      if (hsh > 0.82) v += 1;
      else if (hsh < 0.13) v -= 1;
      if (fbm(mx / 19, my / 13, 413) < 0.38) v -= 1;
      return soil[clamp(v, 0, 4)];
    }
    if (paddyState === 'water') return paddyWater(x, y, a);

    if (paddyState === 'bare') {
      // 겨울: 빈 논에 눈이 쌓였다. 벼 그루터기가 눈 위로 삐죽하고, 군데군데 언 흙이 드러난다.
      const t = tuftAt(x, y, 5, 4);
      const m = fbm(mx / 21, my / 15, 432);
      const f = vnoise(x / 2.4, y / 2.4, 431);
      const edge = (k === K.soil ? 0.37 : 0.29) + (bayer(x, y) - 0.5) * 0.05;
      const bare = m < edge;
      if (k === K.paddy && fbm(mx / 27, my / 9, 434) > 0.69 && !bare) {
        // 물이 고였던 자리의 얼음
        const crack = hash2(x + Math.round(vnoise(x / 5, y / 5, 435) * 4), y >> 2, 436) < 0.03;
        return crack ? pal.snow[4] : vnoise(mx / 6, my / 2.2, 437) > 0.6 ? pal.snow[3] : ICE;
      }
      const stub = t.h < 0.5 && Math.abs(t.ox) < 0.6 && t.oy > -1.3 && t.oy < 0.5;
      if (stub) return t.oy < -0.5 ? crop[2] : crop[0];
      if (bare) {
        // 언 흙: 서리가 희끗희끗하다
        if (hash2(x, y, 438) < 0.12) return grass[3];
        return soil[clamp(Math.round(2.9 + (f - 0.5) * 1.8), 2, 4)];
      }
      if (t.h < 0.5 && t.ox >= 0.6 && t.ox < 1.8 && t.oy > -0.3 && t.oy < 0.8) return grass[3]; // 그루터기의 그늘
      return grass[clamp(Math.round(5 + (f - 0.5) * 1.5 + (m - 0.55) * 2.6), 4, 6)];
    }
    if (k === K.soil && paddyState === 'green') {
      // 큰비에 잠긴 논: 흙탕물 위로 벼의 끝만 보인다
      const t = tuftAt(x, y, 4, 5);
      const c = paddyWater(x, y, a);
      if (a < 0.8) return c;
      if (t.h < 0.6 && Math.abs(t.ox) < 1.3 && t.oy > -1.6 && t.oy < 0.5) return t.oy < -0.8 ? crop[3] : t.ox < 0 ? crop[2] : crop[1];
      if (t.h < 0.6 && Math.abs(t.ox) < 1.3 && t.oy >= 0.5 && t.oy < 1.5) return paddy[1]; // 물에 비친 그늘
      return c;
    }
    if (k === K.soil && paddyState === 'gold') {
      // 가을: 벼를 벤 논. 마른 논바닥에 그루터기가 흩어져 있다. 큰물이 쓸고 간 논은 그루터기가 드물고 흙탕이 앉았다.
      const t = tuftAt(x, y, 5, 4);
      const f = vnoise(x / 2.6, y / 2.6, 451);
      const m = fbm(mx / 19, my / 13, 452);
      const keep = thin ? 0.28 : 0.72;
      if (t.h < keep && Math.abs(t.ox) < 0.8 && t.oy > -1.3 && t.oy < 0.6) return t.oy < -0.6 ? pal.thatch[5] : t.ox < 0 ? pal.thatch[3] : pal.thatch[2];
      if (t.h < keep && t.ox >= 0.8 && t.ox < 2 && t.oy > -0.2 && t.oy < 1.0) return soil[1]; // 그루터기의 그늘
      if (thin && fbm(mx / 17, my / 9, 464) > 0.5) return silt(x, y);
      if (hash2(x, y, 453) < 0.016) return pal.thatch[4]; // 떨어진 지푸라기
      const dry = [soil[2], soil[3], soil[4], mix(soil[4], pal.yard[2], 0.5), mix(soil[4], pal.yard[3], 0.6)];
      return dry[clamp(Math.round(2.5 + (f - 0.5) * 1.7 + (m - 0.5) * 2.4), 0, 4)];
    }
    // 푸른 벼, 누런 벼: 포기는 위로 길다. 위쪽(잎 끝, 이삭)이 밝고 밑동은 어두우며, 포기 사이로 논바닥이 어둡게 비친다.
    const t = tuftAt(x, y, 4, 5);
    const gold = paddyState === 'gold';
    // 큰물이 쓸고 간 논(큰비가 온 해의 가을): 남은 포기만 듬성듬성 서 있고 그 사이는 흙탕이 앉았다
    if (thin && gold && (t.h > 0.38 || fbm(mx / 21, my / 11, 465) > 0.62)) return a < 0.62 ? soil[2] : silt(x, y);
    const m = fbm(mx / 17, my / 13, 442);
    // 잎의 결: 포기 안에서 가는 잎이 세로로 갈라진다(그림 점으로)
    const blade = (vnoise(x / 1.6, y / 5.5, 448) - 0.5) * 0.7;
    let v = 1.55 - t.oy * 0.5 + (t.h - 0.5) * 1.0 + (m - 0.5) * 1.5 + blade;
    if (t.ox > 1.1) v -= 0.9; // 포기의 오른쪽은 그늘
    else if (t.ox < -1.2) v += 0.25;
    // 이삭은 포기의 위쪽에 누렇게 숙인다
    if (gold && t.oy < -0.9) v += 0.6;
    if (hash2(x, y >> 1, 443) > 0.955) v += 1;
    let c = crop[clamp(Math.round(v), 0, 3)];
    // 포기 사이의 빈 곳: 여름에는 논물이 하늘을 비추고, 가을에는 마른 논바닥이 보인다
    const gap = t.oy > 1.5 && t.h < 0.62;
    if (gap) c = gold ? mix(crop[0], soil[0], 0.55) : t.h < 0.07 ? paddy[3] : mix(crop[0], water[0], 0.5);
    // 벼 사이에 섞여 자란 풀(여름): 빛이 누렇고 키가 들쭉날쭉하다
    if (!gold && t.h > 0.92 && t.oy < 0.8 && Math.abs(t.ox) < 1.6) c = t.oy < -1 ? pal.leafWarm[5] : t.oy < 0 ? pal.leafWarm[4] : pal.leafWarm[2];
    // 논 가장자리는 벼가 성기다
    if (a < 0.62) c = gold ? soil[2] : mud[1];
    else if (a < 0.74 && bayer(x, y) < 0.5) c = gold ? soil[3] : mud[2];
    return c;
  }

  function bankColor(x: number, y: number, tx: number, ty: number): Color {
    // 꼴은 맵 점으로 셈한다(비탈의 높이, 박힌 돌의 크기), 결은 그림 점으로
    const fx = (x & FR) / ART;
    const fy = (y & FR) / ART;
    const mx = x / ART;
    const leftEnd = tAt(tx - 1, ty) !== T.bank && tAt(tx - 1, ty) !== T.steps && tAt(tx - 1, ty) !== T.path;
    const rightEnd = tAt(tx + 1, ty) !== T.bank && tAt(tx + 1, ty) !== T.steps && tAt(tx + 1, ty) !== T.path;
    // 끝에서는 비탈이 낮아져 풀밭으로 이어진다
    let drop = 0;
    if (leftEnd && fx < 9) drop = Math.max(drop, (9 - fx) * 1.6);
    if (rightEnd && fx > 6) drop = Math.max(drop, (fx - 6) * 1.6);
    const top = 2 + vnoise(mx / 4.2, ty * 3.3, 601) * 2.4 + drop;
    const g = (vnoise(x / 23, y / 17, 101) - 0.5) * 2;
    if (fy < top - 1 || top > 14) return grass[clamp(Math.round(3 + g), 2, 4)];
    if (fy < top) return grass[5];
    if (fy < top + 1) return grass[hash2(x >> 1, ty, 602) < 0.5 ? 1 : 2];
    if (fy < top + 2 && hash2(x >> 1, ty, 603) < 0.45) return grass[1];
    const depth = (fy - top) / Math.max(1, 15 - top);
    const streak = hash2(x >> 1, ty, 604);
    let v = 3.2 - depth * 2.6 + (streak - 0.5) * 1.2 + (vnoise(x / 3, y / 5, 607) - 0.5) * 0.5;
    if (fy >= 14) v = 0;
    const earth = [soil[0], soil[1], path[1], path[2], path[3]];
    let c = earth[clamp(Math.round(v), 0, 4)];
    // 박힌 돌(맵 점 넷 × 셋, 빛은 왼쪽 위)
    const sx = Math.floor(mx / 7);
    const sy = Math.floor((fy - top) / 5);
    if (hash2(sx, sy * 31 + ty, 605) < 0.4 && fy > top + 1 && fy < 14) {
      const ox = mx - sx * 7 - 1 - Math.floor(hash2(sx, ty, 606) * 3);
      const oy = fy - top - sy * 5 - 2;
      if (ox >= 0 && ox < 4 && oy >= 0 && oy < 3) {
        const ex = (ox - 2) / 2;
        const ey = (oy - 1.5) / 1.5;
        if (ex * ex + ey * ey <= 1.05) c = oy < 0.5 || ox < 0.5 ? stone[4] : oy >= 2.5 || ox >= 3.5 ? stone[2] : stone[3];
      }
    }
    return c;
  }

  const paint = (rx0: number, ry0: number, rw: number, rh: number): Px => {
    const steps = paintSteps(rx0, ry0, rw, rh);
    let r = steps.next();
    while (!r.done) r = steps.next();
    return r.value;
  };
  return { W, H, wet, glint, crop: standing, paint, steps: paintSteps };
}

/**
 * 움직이는 냇물의 물결. 가로세로 맵 점 64(그림 점 128)짜리 이어 붙는 무늬를 frames장 만든다.
 * 두 겹의 무늬가 서로 반대쪽으로 흘러서, 어느 쪽으로 흐르는 냇물에 깔아도 어색하지 않다.
 * 무늬의 크기는 지금(1-라)과 같고, 그림 점으로 곱게 셈한다.
 */
export function waterFrames(pal: Palette, frames = 24): Px[] {
  const S = 64 * ART;
  const out: Px[] = [];
  const { water } = pal;
  for (let k = 0; k < frames; k++) {
    const ph = k / frames;
    const px = new Px(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const mx = (x + 0.5) / ART;
        const my = (y + 0.5) / ART;
        const n1 = tnoise((mx + ph * 64) / 8, my / 4, 8, 16, 901);
        const n2 = tnoise((mx - ph * 64) / 16, (my + ph * 64) / 8, 4, 8, 902);
        const n3 = tnoise(mx / 4 + ph * 16, my / 2, 16, 32, 903);
        // 불어난 물은 한쪽으로 세차게 흐른다: 거슬러 흐르는 무늬(n2)를 줄여, 물마루가 X꼴로 줄지어 되풀이되지 않게 한다
        const v = pal.rain ? n1 * 0.62 + n2 * 0.1 + n3 * 0.28 : n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
        let c = water[2];
        // 불어난 물은 물살이 세어 흰 물마루가 많다
        if (v > (pal.rain ? 0.69 : 0.715)) c = water[pal.rain ? 5 : 4];
        else if (v > (pal.rain ? 0.57 : 0.61)) c = water[3];
        else if (v < 0.33) c = water[1];
        px.d[y * S + x] = c;
      }
    }
    // 반짝임: 몇 군데가 잠깐씩 빛난다(두세 점 무리)
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const at = Math.floor(hash2(cx, cy, 911) * frames);
        const d = (k - at + frames) % frames;
        if (d > 2) continue;
        const x = (cx * 16 + Math.floor(hash2(cx, cy, 912) * 12) + 2) * ART;
        const y = (cy * 16 + Math.floor(hash2(cx, cy, 913) * 12) + 2) * ART;
        px.set(x, y, water[5]);
        px.set(x + 1, y, water[5]);
        if (d === 1) {
          px.set(x, y, water[6]);
          px.set(x + 1, y, water[6]);
          px.set(x - 1, y, water[4]);
          px.set(x + 2, y, water[4]);
          px.set(x, y - 1, water[5]);
          px.set(x + 1, y + 1, water[5]);
        }
      }
    }
    out.push(px);
  }
  return out;
}
