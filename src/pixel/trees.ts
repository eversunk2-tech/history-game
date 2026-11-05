// 나무와 덤불과 풀. 코드로 한 점씩 찍는다.
// 넓은 잎 나무(참나무 갈래), 작은 나무, 소나무, 봄꽃 핀 나무(살구·산벚), 버드나무, 마을 어귀의 큰 느티나무.
//
// 계절: 봄·여름·가을은 그림 벌의 잎빛이 바뀐다(새순 → 짙은 잎 → 단풍. 꽃나무의 꽃과 진달래·개나리는 봄에만 핀다).
// 겨울에는 잎 뭉치를 그리지 않고, 잎 뭉치가 있던 자리로 뻗은 앙상한 가지와 그 위에 얹힌 눈을 그린다(bareCrown).
// 소나무는 겨울에도 푸르고 솔잎 층마다 눈이 얹힌다.

import type { Palette, Ramp } from './palette';
import { ART, Px, clamp, hash2, rngOf, vnoise } from './px';
import { branch, canopy, sway, trunk, type Blob, type SpriteDef } from './shapes';
import { calmSprite, rampsOf, selfRim } from './wash';

type Maker = (pal: Palette, variant: number) => SpriteDef;

/** 그림 점 / 1-라의 점. 나무의 꼴(덩어리의 자리·반지름, 잎 뭉치, 줄기의 굵기)은 1-라의 수에 K를 곱해 쓴다(spec 4.7.5의 ㅅ). */
const K = ART;

/** 1-라의 수로 적은 덩어리를 그림 점으로 */
const big = <T extends { x: number; y: number; r: number; lift?: number }>(list: readonly T[]): T[] =>
  list.map((b) => ({ ...b, x: b.x * K, y: b.y * K, r: b.r * K, lift: b.lift === undefined ? undefined : b.lift * K }));

/**
 * 나무갓과 줄기를 따로 그려 합치고, 갓만 흔들어 세 장을 만든다. 크기·발치·흔들리는 줄은 1-라의 수(이 함수가 K를 곱한다).
 * 먹빛 테두리 대신 제 빛깔 그늘(ㄴ): 줄기와 갓의 안쪽 가장자리를 제 단계에서 한 칸 어둡게(아래·오른쪽)·밝게(위·왼쪽).
 */
/** 쉬어 가며 짓는 그림(그림 벌이 한 장의 시간 안에 나눠 짓는다 — spec 4.7.5의 ㅋ) */
export type Job = Generator<undefined, SpriteDef, undefined>;

/** 쉬어 가며 짓는 그림을 한 번에 다 짓는다 */
export function drain(job: Job): SpriteDef {
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}

function tree(...args: Parameters<typeof treeJob>): SpriteDef {
  return drain(treeJob(...args));
}

function* treeJob(
  pal: Palette,
  w: number,
  h: number,
  drawTrunk: (px: Px) => void,
  drawCanopy: (px: Px) => Iterable<undefined> | void,
  opts: {
    ax: number;
    ay: number;
    swayTop: number;
    swayBot: number;
    /** 흔들림(그림 점 — ㅊ의 1~2) */
    amount?: number;
    bottomHeavy?: boolean;
    shades: SpriteDef['shades'];
    sort?: number;
    /** 잎이 진 나무인가(가지에는 그늘을 두르지 않는다 — 잔가지가 뭉개지지 않게) */
    bare?: boolean;
  },
): Job {
  const ramps = rampsOf(pal);
  const base = new Px(w * K, h * K);
  drawTrunk(base);
  selfRim(base, ramps);
  const leaves = new Px(w * K, h * K);
  const steps = drawCanopy(leaves);
  if (steps) yield* steps;
  yield;
  if (!opts.bare) {
    selfRim(leaves, ramps);
    // 잎의 결은 둘레 단계와 밝기 차가 작은 점만 남긴다(벌에 맞추면 단계 사이가 벌어지므로 문턱을 낮게 — ㄹ)
    calmSprite(leaves, 0.09);
  } else calmSprite(leaves); // 겨울의 가지: 홀로 떨어진 눈 한 점 따위만 고른다
  const amount = opts.amount ?? 2;
  const frames = [0, amount, -amount].map((a) => {
    const f = base.clone();
    f.blit(a === 0 ? leaves : sway(leaves, a, opts.swayTop * K, opts.swayBot * K, opts.bottomHeavy), 0, 0);
    return f;
  });
  return { frames, ax: opts.ax * K, ay: opts.ay * K, shades: opts.shades, sort: opts.sort, seq: [0, 1, 0, 2] };
}

function jitter(blobs: Blob[], seed: number, amount: number): Blob[] {
  const rnd = rngOf(seed * 7919 + 13);
  return blobs.map((b) => ({
    ...b,
    x: b.x + (rnd() - 0.5) * amount * 2,
    y: b.y + (rnd() - 0.5) * amount,
    r: b.r + (rnd() - 0.5) * amount,
  }));
}

// ── 잎 뭉치를 겹쳐 쌓은 나무갓 ─────────────────────────────────
// 뭉게구름 한 덩어리가 아니라, 어두운 속 위에 잎 뭉치 여럿을 뒤에서 앞으로 겹쳐 쌓는다.
// 뭉치마다 왼쪽 위가 밝고 오른쪽 아래가 어두워 서로 갈라지고, 뭉치 사이로 어두운 속과 가지가 보인다.

interface Mass {
  x: number;
  y: number;
  r: number;
  /** 밝게(+) 어둡게(−) */
  bias?: number;
  ramp?: Ramp;
}

function* leafMasses(
  px: Px,
  masses: readonly Mass[],
  ramp: Ramp,
  bark: Ramp,
  opts: { seed: number; clump: [number, number]; from?: [number, number]; core?: number; accent?: { ramp: Ramp; share: number }; crease?: number; sparkle?: number },
): Generator<undefined, void, undefined> {
  // 덩어리·뭉치·가지는 1-라의 수로 받아 그림 점으로 키운다(3.1차 시안의 셈 그대로)
  const ms = big(masses);
  const clump: [number, number] = [opts.clump[0] * K, opts.clump[1] * K];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of ms) {
    x0 = Math.min(x0, m.x - m.r);
    x1 = Math.max(x1, m.x + m.r);
    y0 = Math.min(y0, m.y - m.r);
    y1 = Math.max(y1, m.y + m.r);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // 어두운 속
  const k = opts.core ?? 0.4;
  canopy(px, [{ x: cx, y: cy + K, r: (x1 - x0) * k, squash: ((y1 - y0) * k) / ((x1 - x0) * k) }], ramp, {
    seed: opts.seed + 1,
    clump,
    bias: -0.36,
    crease: 0.1,
  });
  // 속으로 뻗은 가지(뭉치 사이로 보인다)
  if (opts.from) {
    const fx = opts.from[0] * K;
    const fy = opts.from[1] * K;
    for (const m of ms) {
      if (m.y > fy - 4 * K) continue;
      branch(px, bark, fx, fy, m.x, m.y + m.r * 0.3, (m.r > 14 * K ? 3 : 2) * K);
    }
  }
  yield;
  // 잎 뭉치: 위(뒤)에서 아래(앞)로(뭉치 하나마다 쉬어 간다)
  const order = [...ms].sort((a, b) => a.y - b.y);
  for (let i = 0; i < order.length; i++) {
    const m = order[i];
    {
      const rnd = rngOf(opts.seed * 31 + i * 7 + 3);
      const blobs: Blob[] = [
        // 뭉치는 서로 넉넉히 겹친다(풍선처럼 따로 놀지 않게). 옆으로 조금 퍼진 꼴.
        { x: m.x, y: m.y, r: m.r * 0.98, squash: 0.84, lift: 2 * K },
        { x: m.x - m.r * (0.46 + rnd() * 0.2), y: m.y + m.r * (0.15 + rnd() * 0.2), r: m.r * 0.66, lift: K },
        { x: m.x + m.r * (0.46 + rnd() * 0.2), y: m.y + m.r * (0.05 + rnd() * 0.3), r: m.r * 0.66, lift: 0 },
      ];
      const tmp = new Px(px.w, px.h);
      canopy(tmp, blobs, m.ramp ?? ramp, {
        seed: opts.seed + 11 * i + 5,
        clump,
        bias: m.bias ?? 0,
        accent: opts.accent,
        crease: opts.crease,
        sparkle: opts.sparkle,
        grain: K,
      });
      px.blit(tmp, 0, 0);
    }
    yield;
  }
}

// ── 겨울: 잎이 진 나무갓 ───────────────────────────────────────
// 잎 뭉치가 있던 자리마다 굵은 가지가 뻗고, 그 끝에서 잔가지가 부채처럼 갈라진다. 가지 위에는 눈이 얹힌다.

/** 가지에 눈을 얹는다: 위가 비어 있는 가지의 점 위에 흰 점을 놓는다(두세 점씩 이어진 눈 — 외톨이 점이 되지 않게) */
function snowOnTwigs(px: Px, snow: Ramp, seed: number, share = 0.74): void {
  const hits: [number, number, boolean][] = [];
  for (let y = 1; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (px.get(x, y) === 0 || px.get(x, y - 1) !== 0) continue;
      const r = hash2(x >> 1, y >> 1, seed);
      if (r < share) hits.push([x, y - 1, r < share * 0.4]);
    }
  }
  const top = snow.length - 1;
  for (const [x, y, thick] of hits) {
    px.set(x, y, snow[top]);
    // 굵은 가지 위에는 눈이 도톰하게 쌓인다(위 한 줄은 그늘빛 — 흰 하늘 앞에서도 윗선이 읽힌다)
    if (thick && px.get(x, y - 1) === 0 && px.get(x, y + 2) !== 0) px.set(x, y - 1, snow[top - 1]);
  }
}

/** 가지 하나를 두 점 굵기로(위·왼쪽이 밝은 빛, 아래·오른쪽이 짙은 빛) */
function twig2(px: Px, x0: number, y0: number, x1: number, y1: number, lit: number, dark: number): void {
  px.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, dark);
  px.line(x0, y0, x1, y1, lit);
}

/** 겨울의 나무갓: 덩어리·갈림목은 1-라의 수로 받는다 */
function bareCrown(
  px: Px,
  masses: readonly Mass[],
  bark: Ramp,
  opts: { seed: number; hubs: readonly (readonly [number, number])[]; snow?: Ramp; twigs?: number },
): void {
  const rnd = rngOf(opts.seed * 53 + 7);
  const dark = bark[1];
  const mid = bark[2];
  const hubs = opts.hubs.map(([x, y]) => [x * K, y * K] as const);
  // 큰 뭉치부터(굵은 가지를 먼저 긋는다)
  for (const m1 of [...masses].sort((a, b) => b.r - a.r)) {
    const m = { x: m1.x * K, y: m1.y * K, r: m1.r * K };
    const tx = m.x + (rnd() - 0.5) * m.r * 0.3;
    const ty = m.y + m.r * 0.25;
    // 가장 가까운 갈림목에서 뭉치의 가운데로
    let hub = hubs[0];
    let best = Infinity;
    for (const h of hubs) {
      const d = Math.hypot(h[0] - tx, h[1] - ty) + (h[1] < ty ? 30 * K : 0);
      if (d < best) {
        best = d;
        hub = h;
      }
    }
    const thick = (m1.r > 16 ? 4 : m1.r > 9.5 ? 3 : 2) * K;
    branch(px, bark, hub[0], hub[1], tx, ty, thick);
    const n = Math.max(3, Math.round((m1.r / 2.4) * (opts.twigs ?? 1)));
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + ((k + 0.5) / n - 0.5) * Math.PI * 1.55 + (rnd() - 0.5) * 0.5;
      const len = m.r * (0.6 + rnd() * 0.5);
      const ex = tx + Math.cos(ang) * len;
      const ey = ty + Math.sin(ang) * len * 0.85 - m.r * 0.2;
      // 가운데가 살짝 휜 가지(밑은 두 점, 끝은 한 점으로 가늘어진다)와 곁가지 둘
      const mx = (tx + ex) / 2 + (rnd() - 0.5) * 3 * K;
      const my = (ty + ey) / 2 - K - rnd() * 2 * K;
      twig2(px, tx, ty, mx, my, mid, dark);
      px.line(mx, my, ex, ey, dark);
      const side = rnd() < 0.5 ? -1 : 1;
      const a2 = ang + side * (0.5 + rnd() * 0.5);
      px.line(mx, my, mx + Math.cos(a2) * len * 0.5, my + Math.sin(a2) * len * 0.42, dark);
      if (len > 7 * K) {
        const a3 = ang - side * (0.4 + rnd() * 0.4);
        const qx = mx + (ex - mx) * 0.5;
        const qy = my + (ey - my) * 0.5;
        px.line(qx, qy, qx + Math.cos(a3) * len * 0.34, qy + Math.sin(a3) * len * 0.3, dark);
      }
    }
  }
  if (opts.snow) snowOnTwigs(px, opts.snow, opts.seed + 3);
}

/** 겨울의 덤불: 밑동에서 부채처럼 뻗은 잔가지와 그 위에 소복이 얹힌 눈 */
function bareShrub(pal: Palette, variant: number, seed: number): SpriteDef {
  const W = 24 * K;
  const H = 20 * K;
  const px = new Px(W, H);
  const rnd = rngOf(seed * 17 + variant);
  const bark = pal.bark;
  const n = 9 + variant;
  const bx = 12 * K;
  const by = 17 * K;
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + ((k + 0.5) / n - 0.5) * Math.PI * 1.25;
    const len = (8 + rnd() * 5) * K;
    const ex = bx + Math.cos(ang) * len * 1.05;
    const ey = by + Math.sin(ang) * len;
    const x0 = bx + ((k % 3) - 1) * K;
    twig2(px, x0, by, (x0 + ex) / 2, (by + ey) / 2, bark[k % 2 === 0 ? 3 : 2], bark[1]);
    px.line((x0 + ex) / 2, (by + ey) / 2, ex, ey, bark[k % 2 === 0 ? 2 : 1]);
    const a2 = ang + (rnd() - 0.5) * 1.4;
    px.line((bx + ex) / 2, (by + ey) / 2, (bx + ex) / 2 + Math.cos(a2) * 4 * K, (by + ey) / 2 + Math.sin(a2) * 4 * K, bark[1]);
  }
  // 덤불 위에 얹힌 눈: 가지 끝을 덮은 낮은 덩이(볕 쪽은 희고 아래쪽은 눈의 그늘)
  const snow = pal.snow;
  for (let y = 2 * K; y < 12 * K; y++) {
    for (let x = 2 * K; x < W - 2 * K; x++) {
      const dx = (x + 0.5 - 12 * K) / (9.5 * K);
      const dy = (y + 0.5 - 8 * K) / (4.2 * K);
      const d = dx * dx + dy * dy + (vnoise(x / (2.2 * K), y / (1.6 * K), seed + 5) - 0.5) * 0.55;
      if (d > 1 || (dy > 0.25 && vnoise(x / (1.4 * K), y / (1.2 * K), seed + 6) < 0.5)) continue;
      px.set(x, y, snow[clamp(Math.round(3.6 - dx * 1.1 - dy * 1.3), 1, snow.length - 1)]);
    }
  }
  selfRim(px, rampsOf(pal));
  calmSprite(px);
  const frames = [0, 1, -1].map((a) => (a === 0 ? px : sway(px, a, 2 * K, 14 * K)));
  return { frames, ax: 12 * K, ay: 18 * K, seq: [0, 1, 0, 2], shades: [{ dx: 3, dy: -1, rx: 9, ry: 3, strength: 0.2 }] };
}

const WINTER_SHADE = 0.2;

// ── 넓은 잎 나무 ──────────────────────────────────────────────
// 꼴 여섯 가지 × 잎 빛 세 벌(새순의 연두, 풀빛, 짙은 풀빛).
const OAK_SHAPES: Mass[][] = [
  // 0 둥근 나무
  [
    { x: 28, y: 13, r: 11, bias: -0.04 },
    { x: 15, y: 23, r: 10 },
    { x: 41, y: 22, r: 10, bias: -0.06 },
    { x: 28, y: 25, r: 10, bias: 0.04 },
    { x: 19, y: 34, r: 8.5, bias: 0.02 },
    { x: 37, y: 35, r: 8.5, bias: -0.03 },
  ],
  // 1 키 큰 나무
  [
    { x: 27, y: 9, r: 9, bias: -0.03 },
    { x: 19, y: 19, r: 9 },
    { x: 37, y: 18, r: 9, bias: -0.06 },
    { x: 28, y: 28, r: 10, bias: 0.04 },
    { x: 18, y: 37, r: 7.5 },
    { x: 38, y: 37, r: 7.5, bias: -0.04 },
  ],
  // 2 옆으로 퍼진 나무
  [
    { x: 21, y: 14, r: 9, bias: -0.03 },
    { x: 36, y: 13, r: 9.5, bias: -0.06 },
    { x: 11, y: 26, r: 9 },
    { x: 45, y: 26, r: 9, bias: -0.06 },
    { x: 28, y: 26, r: 10.5, bias: 0.04 },
    { x: 28, y: 37, r: 7, bias: 0.02 },
  ],
  // 3 한쪽으로 기운 나무
  [
    { x: 24, y: 11, r: 10, bias: -0.03 },
    { x: 12, y: 21, r: 9.5 },
    { x: 36, y: 20, r: 9, bias: -0.06 },
    { x: 22, y: 29, r: 10, bias: 0.04 },
    { x: 40, y: 32, r: 7.5, bias: -0.05 },
  ],
  // 4 가운데가 성긴 나무(속과 가지가 보인다)
  [
    { x: 27, y: 12, r: 9.5, bias: -0.03 },
    { x: 13, y: 24, r: 9 },
    { x: 43, y: 21, r: 9, bias: -0.06 },
    { x: 38, y: 35, r: 8, bias: -0.03 },
    { x: 17, y: 37, r: 6.5, bias: 0.02 },
  ],
  // 5 갓이 작은 나무
  [
    { x: 28, y: 16, r: 10, bias: -0.03 },
    { x: 18, y: 25, r: 8.5 },
    { x: 38, y: 25, r: 8.5, bias: -0.05 },
    { x: 28, y: 32, r: 8, bias: 0.04 },
  ],
];

export function* oakJob(pal: Palette, variant = 0): Job {
  const W = 56;
  const H = 66;
  const leaf: Ramp = [pal.leaf, pal.leafWarm, pal.leafDeep][variant % 3];
  const shape = OAK_SHAPES[variant % OAK_SHAPES.length];
  const rnd = rngOf(900 + variant * 13);
  const masses = shape.map((m) => ({ ...m, x: m.x + (rnd() - 0.5) * 2, y: m.y + (rnd() - 0.5) * 2 }));
  const winter = pal.season === 'winter';
  return yield* treeJob(
    pal,
    W,
    H,
    (px) => {
      trunk(px, pal.bark, { x: 28 * K, yTop: (winter ? 30 : 34) * K, yBot: 62 * K, wTop: (winter ? 4 : 5) * K, wBot: 7 * K, roots: true, seed: 3 + variant, curve: 0.7 * K, k: K });
    },
    (px) =>
      winter
        ? bareCrown(px, masses, pal.bark, { seed: 100 + variant * 17, hubs: [[28, 38], [27, 31]], snow: pal.snow })
        : leafMasses(px, masses, leaf, pal.bark, { seed: 100 + variant * 17, clump: [5, 4], from: [28, 42] }),
    {
      ax: 28,
      ay: 63,
      swayTop: 2,
      swayBot: 42,
      bare: winter,
      shades: [{ dx: 7, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: winter ? WINTER_SHADE : 0.3 }],
    },
  );
}
export const oak: Maker = (pal, variant) => drain(oakJob(pal, variant));

// ── 작은 나무 ────────────────────────────────────────────────
export function* youngJob(pal: Palette, variant = 0): Job {
  const W = 34;
  const H = 44;
  const leaf: Ramp = [pal.leafWarm, pal.leaf, pal.leafDeep][variant % 3];
  const shapes: Mass[][] = [
    [
      { x: 17, y: 9, r: 7, bias: -0.03 },
      { x: 11, y: 17, r: 6.5 },
      { x: 23, y: 17, r: 6.5, bias: -0.05 },
      { x: 17, y: 23, r: 6, bias: 0.04 },
    ],
    [
      { x: 16, y: 10, r: 7.5, bias: -0.03 },
      { x: 22, y: 19, r: 6.5, bias: -0.05 },
      { x: 12, y: 21, r: 6.5, bias: 0.03 },
    ],
    [
      { x: 18, y: 8, r: 6.5, bias: -0.03 },
      { x: 12, y: 15, r: 6 },
      { x: 23, y: 15, r: 6, bias: -0.05 },
      { x: 14, y: 24, r: 5.5, bias: 0.03 },
      { x: 22, y: 25, r: 5, bias: -0.02 },
    ],
  ];
  const masses = shapes[variant % shapes.length];
  const winter = pal.season === 'winter';
  return yield* treeJob(
    pal,
    W,
    H,
    (px) => trunk(px, pal.bark, { x: 17 * K, yTop: (winter ? 18 : 22) * K, yBot: 40 * K, wTop: (winter ? 2 : 3) * K, wBot: 4 * K, roots: false, seed: 9 + variant, curve: 0.5 * K, k: K }),
    (px) =>
      winter
        ? bareCrown(px, masses, pal.bark, { seed: 200 + variant * 13, hubs: [[17, 26], [17, 19]], snow: pal.snow })
        : leafMasses(px, masses, leaf, pal.bark, { seed: 200 + variant * 13, clump: [4, 3], from: [17, 28] }),
    {
      ax: 17,
      ay: 41,
      swayTop: 2,
      swayBot: 30,
      bare: winter,
      shades: [{ dx: 5, dy: 0, rx: 12, ry: 5, dapple: true, strength: winter ? WINTER_SHADE : 0.28 }],
    },
  );
}
export const young: Maker = (pal, variant) => drain(youngJob(pal, variant));

/** 겨울: 솔잎 층마다 위쪽에 눈이 얹힌다(층의 아래쪽은 푸른 솔잎이 보인다) */
function snowyPads(pal: Palette, pads: Blob[]): Blob[] {
  if (pal.season !== 'winter') return pads;
  const out: Blob[] = [];
  for (const p of pads) {
    const sq = p.squash ?? 1;
    out.push(p, { x: p.x - p.r * 0.06, y: p.y - p.r * sq * 0.42, r: p.r * 0.86, squash: sq * 0.62, lift: (p.lift ?? 0) + p.r * 0.2, ramp: pal.snow });
  }
  return out;
}

// ── 소나무 ───────────────────────────────────────────────────
// 붉은 줄기가 조금 휘고, 솔잎이 층층이 납작한 뭉치로 얹힌다.
function pineOf(pal: Palette, variant: number, small: boolean): SpriteDef {
  const W = small ? 34 : 48;
  const H = small ? 48 : 70;
  const s = small ? 0.68 : 1;
  const cx = W / 2;
  const lean = (variant === 1 ? -1 : 1) * (small ? 2 : 4);
  let pads: Blob[] = [
    { x: cx + lean * 1.1, y: 11 * s, r: 12 * s, squash: 0.5, lift: 4 },
    { x: cx + lean * 0.9 - 9 * s, y: 20 * s, r: 11 * s, squash: 0.48, lift: 3 },
    { x: cx + lean * 0.7 + 8 * s, y: 24 * s, r: 12.5 * s, squash: 0.46, lift: 5 },
    { x: cx + lean * 0.4 - 6 * s, y: 32 * s, r: 13 * s, squash: 0.44, lift: 6 },
    { x: cx + lean * 0.2 + 10 * s, y: 38 * s, r: 9.5 * s, squash: 0.48, lift: 7 },
  ];
  if (variant === 2) pads = pads.slice(0, 4).map((p, i) => ({ ...p, x: p.x + (i % 2 ? 2 : -2), r: p.r * 1.05 }));
  pads = jitter(pads, 71 + variant + (small ? 9 : 0), 1.4);
  pads = snowyPads(pal, pads);
  const yBot = H - 4;
  return tree(
    pal,
    W,
    H,
    (px) => {
      trunk(px, pal.pineBark, {
        x: cx * K,
        yTop: Math.round(8 * s) * K,
        yBot: yBot * K,
        wTop: (small ? 2 : 3) * K,
        wBot: (small ? 4 : 6) * K,
        lean: lean * K,
        curve: (small ? 0.8 : 1.6) * K,
        roots: !small,
        seed: 5 + variant,
        k: K,
      });
      // 잎 없는 곁가지
      if (!small) {
        branch(px, pal.pineBark, (cx + lean * 0.3) * K, 44 * K, (cx - 12) * K, 39 * K, 2 * K);
        branch(px, pal.pineBark, (cx + lean * 0.5) * K, 34 * K, (cx + 14) * K, 29 * K, 2 * K);
      }
    },
    (px) => canopy(px, big(pads), pal.pine, { seed: 300 + variant * 19 + (small ? 7 : 0), clump: [4 * K, 3 * K], spiky: 2.2 * K, grain: K }),
    {
      ax: Math.round(cx),
      ay: yBot + 1,
      swayTop: 2,
      swayBot: Math.round(42 * s),
      shades: [{ dx: 6, dy: 0, rx: small ? 11 : 16, ry: small ? 4.5 : 6, dapple: true, strength: 0.3 }],
    },
  );
}

// 길목과 고갯마루의 늙은 소나무: 굵고 휜 줄기, 넓게 퍼진 솔잎 층, 부러진 곁가지
export const oldpine: Maker = (pal, variant) => {
  const W = 72;
  const H = 92;
  const dir = variant === 1 ? -1 : 1;
  const cx = 36;
  const pads: Blob[] = [
    { x: cx + dir * 9, y: 11, r: 15, squash: 0.48, lift: 4 },
    { x: cx + dir * 20, y: 23, r: 13, squash: 0.46, lift: 3 },
    { x: cx - dir * 6, y: 24, r: 16, squash: 0.44, lift: 5 },
    { x: cx + dir * 10, y: 36, r: 15, squash: 0.44, lift: 6 },
    { x: cx - dir * 17, y: 39, r: 12, squash: 0.46, lift: 7 },
    { x: cx + dir * 23, y: 47, r: 9, squash: 0.5, lift: 8 },
  ];
  return tree(
    pal,
    W,
    H,
    (px) => {
      const b = (x0: number, y0: number, x1: number, y1: number, t: number): void => branch(px, pal.pineBark, x0 * K, y0 * K, x1 * K, y1 * K, t * K);
      trunk(px, pal.pineBark, { x: (cx - dir * 2) * K, yTop: 10 * K, yBot: 86 * K, wTop: 4 * K, wBot: 10 * K, lean: dir * 9 * K, curve: 3.2 * K, roots: true, seed: 8 + variant, k: K });
      b(cx + dir * 2, 52, cx - dir * 18, 42, 3);
      b(cx + dir * 4, 44, cx + dir * 22, 30, 3);
      b(cx + dir * 3, 60, cx + dir * 24, 50, 2);
      // 부러진 곁가지
      b(cx - dir * 1, 66, cx - dir * 11, 61, 2);
    },
    (px) => canopy(px, big(snowyPads(pal, pads)), pal.pine, { seed: 330 + variant * 19, clump: [4 * K, 3 * K], spiky: 2.4 * K, grain: K }),
    {
      ax: cx - dir * 2,
      ay: 87,
      swayTop: 2,
      swayBot: 54,
      shades: [{ dx: 8, dy: 0, rx: 24, ry: 8, dapple: true, strength: 0.3 }],
      sort: -1,
    },
  );
};

export const pine: Maker = (pal, variant) => pineOf(pal, variant, false);
export const pineS: Maker = (pal, variant) => pineOf(pal, variant, true);

// ── 봄꽃 핀 나무 ─────────────────────────────────────────────
// 봄에는 분홍·흰 꽃 뭉치가 가득하다. 다른 계절에는 팔레트가 잎빛으로 바뀐다.
export const blossom: Maker = (pal, variant) => {
  const W = 46;
  const H = 52;
  const petals: Ramp = variant === 1 ? pal.blossomWhite : pal.blossom;
  let blobs: Blob[] = [
    { x: 23, y: 20, r: 12.5, lift: 4 },
    { x: 12, y: 24, r: 8.5, lift: 2 },
    { x: 34, y: 23, r: 8.5, lift: 1 },
    { x: 20, y: 11, r: 8.5, lift: 3 },
    { x: 30, y: 13, r: 7.5, lift: 2 },
    { x: 17, y: 31, r: 6, lift: 5 },
    { x: 30, y: 31, r: 6, lift: 4 },
  ];
  blobs = jitter(blobs, 91 + variant, 1.8);
  if (variant === 2) blobs = blobs.map((b) => ({ ...b, x: W - b.x }));
  const winter = pal.season === 'winter';
  return tree(
    pal,
    W,
    H,
    (px) => {
      trunk(px, pal.bark, { x: 23 * K, yTop: (winter ? 24 : 28) * K, yBot: 48 * K, wTop: (winter ? 2 : 3) * K, wBot: 5 * K, roots: false, seed: 17 + variant, curve: 1.1 * K, k: K });
      branch(px, pal.bark, 22 * K, 36 * K, 14 * K, 28 * K, 2 * K);
      branch(px, pal.bark, 24 * K, 38 * K, 32 * K, 29 * K, 2 * K);
    },
    (px) =>
      winter
        ? bareCrown(px, blobs, pal.bark, { seed: 400 + variant * 23, hubs: [[23, 32], [15, 28], [31, 29]], snow: pal.snow })
        : canopy(px, big(blobs), petals, {
            seed: 400 + variant * 23,
            clump: [5 * K, 4 * K],
            grain: K,
            // 꽃 사이의 새잎(봄). 꽃이 진 뒤에는 잎만 무성하다.
            accent: { ramp: pal.leafWarm, share: 0.14 },
            bias: 0.06,
            crease: pal.flowers ? 0.13 : 0.22,
            sparkle: pal.flowers ? 0.09 : 0,
          }),
    {
      ax: 23,
      ay: 49,
      swayTop: 2,
      swayBot: 34,
      bare: winter,
      shades: [{ dx: 6, dy: 0, rx: 16, ry: 6, dapple: true, strength: winter ? WINTER_SHADE : 0.26 }],
    },
  );
};

// ── 버드나무 ─────────────────────────────────────────────────
export const willow: Maker = (pal, variant) => {
  const W = 52;
  const H = 62;
  const leaf = pal.leafWarm;
  const cx = variant === 1 ? 28 : 24;
  const blobs: Blob[] = jitter(
    [
      { x: cx, y: 16, r: 14, squash: 0.8, lift: 4 },
      { x: cx - 11, y: 20, r: 9.5, squash: 0.85, lift: 2 },
      { x: cx + 11, y: 19, r: 10, squash: 0.85, lift: 1 },
      { x: cx - 2, y: 9, r: 9, lift: 3 },
    ],
    111 + variant,
    1.4,
  );
  return tree(
    pal,
    W,
    H,
    (px) =>
      trunk(px, pal.bark, {
        x: (cx + (variant === 1 ? -2 : 2)) * K,
        yTop: 20 * K,
        yBot: 57 * K,
        wTop: 4 * K,
        wBot: 7 * K,
        lean: (variant === 1 ? 3 : -3) * K,
        curve: 1.5 * K,
        roots: true,
        seed: 23 + variant,
        k: K,
      }),
    (px) => {
      // 늘어진 가지는 1-라처럼 맵 점 하나(그림 점 둘)마다 한 가닥이다. 가닥 안에서 오른쪽 한 줄은 한 단계 짙다(빛은 왼쪽 위).
      if (pal.season === 'winter') {
        // 겨울: 잎이 진 가지가 실처럼 늘어진다
        bareCrown(px, blobs, pal.bark, { seed: 500 + variant * 29, hubs: [[cx, 24], [cx, 18]], snow: pal.snow, twigs: 0.7 });
        for (let X = 3; X < W - 3; X++) {
          if (hash2(X, variant, 525) < 0.42) continue;
          const x = X * K + (hash2(X, variant, 528) < 0.5 ? 0 : 1);
          let y0 = -1;
          for (let y = 0; y < 34 * K; y++) {
            if (px.get(x, y) !== 0) {
              y0 = y;
              break;
            }
          }
          if (y0 < 0) continue;
          const len = Math.round(12 + hash2(X, variant, 526) * 22) * K;
          for (let k = 1; k < len && y0 + k < (H - 8) * K; k++) {
            if (hash2(x, (y0 + k) >> 1, 527) < 0.1) continue;
            px.set(x + Math.round(Math.sin(k / (7 * K) + X) * 0.6 * K), y0 + k, leaf[k > len - 3 * K ? 3 : 2]);
          }
        }
        return;
      }
      canopy(px, big(blobs), leaf, { seed: 500 + variant * 29, clump: [4 * K, 4 * K] });
      // 늘어진 가지: 세로로 길게 드리운 잎의 줄
      const n = leaf.length - 1;
      for (let X = 2; X < W - 2; X++) {
        const r = hash2(X, variant, 521);
        if (r < 0.22) continue;
        const len0 = Math.round(9 + hash2(X, variant, 522) * 20 + Math.sin(X * 0.7) * 3) * K;
        for (let side = 0; side < K; side++) {
          const x = X * K + side;
          // 이 줄에서 나무갓의 아래 끝
          let y0 = -1;
          for (let y = H * K - 1; y >= 0; y--) {
            if (px.get(x, y) !== 0) {
              y0 = y;
              break;
            }
          }
          if (y0 < 0) continue;
          const len = len0 - (side === 1 ? Math.round(hash2(X, variant, 529) * 3) : 0);
          for (let k = 0; k < len; k++) {
            const y = y0 + k;
            if (y > (H - 8) * K) break;
            const t = k / len;
            let v = Math.round(3.6 - t * 1.2 + (hash2(X, y >> 2, 523) - 0.5) * 1.6 - (X > cx + 6 ? 1 : 0)) - side;
            if (k >= len - 2) v = n - 1 - side;
            if (hash2(X, y >> 1, 524) < 0.14) continue; // 사이사이 빈 곳
            px.set(x, y, leaf[clamp(v, 1, n)]);
          }
        }
      }
    },
    {
      ax: cx + (variant === 1 ? -2 : 2),
      ay: 58,
      swayTop: 18,
      swayBot: 52,
      bottomHeavy: true,
      amount: 2,
      bare: pal.season === 'winter',
      shades: [{ dx: 6, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: pal.season === 'winter' ? WINTER_SHADE : 0.28 }],
    },
  );
};

// ── 마을 어귀의 큰 느티나무 ────────────────────────────────────
// 여러 칸 크기의 아주 큰 나무(가로 열두 칸쯤). 굵은 줄기가 세 갈래로 갈라지고 잎 뭉치가 겹겹이 얹힌다.
export function* zelkovaJob(pal: Palette, _variant = 0): Job {
  const W = 196;
  const H = 186;
  const leaf = pal.leaf;
  const deep = pal.leafDeep;
  const bark = pal.bark;
  const cx = 98;
  const masses: Mass[] = [
    // 뒤쪽 위(짙은 잎)
    { x: cx - 6, y: 22, r: 22, ramp: deep, bias: 0.06 },
    { x: cx - 38, y: 34, r: 21, ramp: deep, bias: 0.08 },
    { x: cx + 34, y: 32, r: 21, ramp: deep, bias: 0.02 },
    // 가운데 층
    { x: cx - 64, y: 54, r: 20 },
    { x: cx - 22, y: 46, r: 23, bias: 0.03 },
    { x: cx + 22, y: 48, r: 22, bias: -0.03 },
    { x: cx + 62, y: 56, r: 20, bias: -0.07 },
    // 앞쪽 아래(늘어진 가지 끝)
    { x: cx - 78, y: 80, r: 14, bias: 0.02 },
    { x: cx - 48, y: 82, r: 18, bias: 0.04 },
    { x: cx - 14, y: 76, r: 19, bias: 0.05 },
    { x: cx + 20, y: 80, r: 18, bias: -0.02 },
    { x: cx + 52, y: 84, r: 17, bias: -0.05 },
    { x: cx + 78, y: 78, r: 13, bias: -0.08 },
  ];
  return yield* treeJob(
    pal,
    W,
    H,
    (px) => {
      // 굵은 밑동과 뿌리
      trunk(px, bark, { x: cx * K, yTop: 92 * K, yBot: 176 * K, wTop: 26 * K, wBot: 34 * K, roots: true, seed: 41, curve: 0, k: K });
      const n = bark.length - 1;
      const foot = 178 * K - 1; // 뿌리가 땅에 닿는 줄(1-라의 177번 줄의 아래 끝)
      for (const [sx, len, dir] of [
        [-20, 15, -1],
        [-10, 9, -1],
        [12, 10, 1],
        [21, 16, 1],
      ] as const) {
        for (let k = 0; k < len * K; k++) {
          const x = (cx + sx) * K + dir * k;
          const hgt = Math.max(K, Math.round((7 - (k / K) * 0.45) * K));
          for (let j = 0; j < hgt; j++) px.set(x, foot - j, bark[clamp(dir < 0 ? n - 1 - (j < K ? 2 : 0) : j >= hgt - K ? 2 : 1, 0, n)]);
        }
      }
      // 깊게 팬 껍질의 골과 옹이(골은 그림 점 하나 굵기로 곱게)
      for (let y = 98 * K; y < 174 * K; y++) {
        for (const g of [cx - 9, cx - 2, cx + 6, cx + 11]) {
          if (hash2(g, y >> 3, 43) < 0.62) px.over(g * K + Math.round(Math.sin(y / (9 * K) + g) * 1.4 * K), y, bark[hash2(g, y >> 2, 46) < 0.55 ? 0 : 1]);
        }
        if (hash2(1, y >> 2, 44) < 0.55) px.over((cx - 13) * K + Math.round(Math.sin(y / (7 * K)) * 1.5 * K), y, bark[n]);
        if (hash2(2, y >> 2, 45) < 0.4) px.over((cx - 6) * K + Math.round(Math.sin(y / (11 * K)) * 1.2 * K), y, bark[n - 1]);
      }
      for (let j = -3 * K; j <= 3 * K; j++) {
        for (let i = -4 * K; i <= 4 * K; i++) {
          const d = ((i / K) * (i / K)) * 0.6 + (j / K) * (j / K);
          if (d > 9) continue;
          px.over((cx + 4) * K + i, 136 * K + j, bark[d > 4 ? 0 : d > 1.5 ? 1 : 2]);
        }
      }
      // 세 갈래 큰 가지
      branch(px, bark, (cx - 9) * K, 98 * K, (cx - 50) * K, 60 * K, 10 * K);
      branch(px, bark, (cx - 2) * K, 96 * K, (cx + 2) * K, 46 * K, 11 * K);
      branch(px, bark, (cx + 10) * K, 98 * K, (cx + 52) * K, 62 * K, 10 * K);
    },
    (px) =>
      pal.season === 'winter'
        ? bareCrown(px, masses, bark, {
            seed: 600,
            // 세 갈래 큰 가지의 끝과 가운데에서 다시 갈라진다
            hubs: [[cx - 50, 60], [cx + 2, 46], [cx + 52, 62], [cx - 30, 78], [cx + 30, 80], [cx, 70]],
            snow: pal.snow,
            twigs: 1.25,
          })
        : leafMasses(px, masses, leaf, bark, { seed: 600, clump: [7, 6], from: [cx, 92], core: 0.4 }),
    {
      ax: cx,
      ay: 178,
      swayTop: 0,
      swayBot: 104,
      bare: pal.season === 'winter',
      shades: [{ dx: 18, dy: 3, rx: 86, ry: 27, dapple: true, broad: true, strength: pal.season === 'winter' ? WINTER_SHADE : 0.3 }],
      sort: -2,
    },
  );
}
export const zelkova: Maker = (pal, variant) => drain(zelkovaJob(pal, variant));

// ── 냇가의 큰 나무(그네를 맬 만한 나무) ─────────────────────────
export function* bigtreeJob(pal: Palette, _variant = 0): Job {
  const W = 92;
  const H = 98;
  const leaf = pal.leafWarm;
  const cx = 46;
  const masses: Mass[] = [
    { x: cx - 4, y: 14, r: 13, ramp: pal.leaf, bias: 0.04 },
    { x: cx + 14, y: 18, r: 12, ramp: pal.leaf, bias: -0.02 },
    { x: cx - 24, y: 30, r: 13 },
    { x: cx, y: 30, r: 14, bias: 0.03 },
    { x: cx + 26, y: 32, r: 13, bias: -0.06 },
    { x: cx - 30, y: 46, r: 9 },
    { x: cx - 10, y: 48, r: 11, bias: 0.04 },
    { x: cx + 12, y: 49, r: 11, bias: -0.02 },
    { x: cx + 32, y: 47, r: 9, bias: -0.07 },
  ];
  return yield* treeJob(
    pal,
    W,
    H,
    (px) => {
      trunk(px, pal.bark, { x: cx * K, yTop: 48 * K, yBot: 92 * K, wTop: 10 * K, wBot: 14 * K, roots: true, seed: 61, curve: 0.8 * K, k: K });
      // 그네를 맬 만한 굵은 곁가지
      branch(px, pal.bark, (cx + 4) * K, 64 * K, (cx + 34) * K, 59 * K, 3 * K);
    },
    (px) =>
      pal.season === 'winter'
        ? bareCrown(px, masses, pal.bark, { seed: 700, hubs: [[cx, 50], [cx - 12, 40], [cx + 14, 40], [cx, 32]], snow: pal.snow, twigs: 1.15 })
        : leafMasses(px, masses, leaf, pal.bark, { seed: 700, clump: [6, 5], from: [cx, 52], core: 0.38 }),
    {
      ax: cx,
      ay: 94,
      swayTop: 0,
      swayBot: 60,
      bare: pal.season === 'winter',
      shades: [{ dx: 10, dy: 1, rx: 40, ry: 13, dapple: true, broad: true, strength: pal.season === 'winter' ? WINTER_SHADE : 0.3 }],
      sort: -2,
    },
  );
}
export const bigtree: Maker = (pal, variant) => drain(bigtreeJob(pal, variant));

// ── 덤불 ─────────────────────────────────────────────────────
function shrub(pal: Palette, variant: number, kind: 'bush' | 'azalea' | 'forsythia'): SpriteDef {
  if (pal.season === 'winter') return bareShrub(pal, variant, 140 + kind.length * 3);
  const W = 24;
  const H = 20;
  // 덩어리는 1-라의 수(big이 그림 점으로 키운다)
  const leaf: Ramp = kind === 'forsythia' ? pal.leafWarm : pal.leaf;
  const blobs = jitter(
    [
      { x: 12, y: 10, r: 7.5, squash: 0.85, lift: 3 },
      { x: 6.5, y: 12.5, r: 5, squash: 0.85, lift: 2 },
      { x: 17.5, y: 12.5, r: 5, squash: 0.85, lift: 1 },
      { x: 12, y: 14, r: 5, squash: 0.7, lift: 4 },
    ],
    131 + variant + (kind === 'azalea' ? 5 : kind === 'forsythia' ? 9 : 0),
    1.2,
  );
  // 진달래와 개나리는 봄에만 꽃이 핀다. 다른 계절에는 잎만 무성하다.
  const accent =
    kind === 'azalea'
      ? { ramp: pal.azalea, share: 0.62 }
      : kind === 'forsythia'
        ? pal.flowers
          ? { ramp: pal.yellow, share: 0.7 }
          : { ramp: pal.leaf, share: 0.4 }
        : variant === 2
          ? { ramp: pal.leafWarm, share: 0.3 }
          : undefined;
  const leaves = new Px(W * K, H * K);
  canopy(leaves, big(blobs), leaf, {
    seed: 800 + variant * 7 + kind.length,
    clump: [3 * K, 3 * K],
    accent,
    crease: kind === 'bush' ? 0.26 : 0.16,
    sparkle: kind === 'bush' ? 0 : 0.08,
    grain: K,
  });
  selfRim(leaves, rampsOf(pal));
  calmSprite(leaves);
  const frames = [0, 2, -2].map((a) => (a === 0 ? leaves : sway(leaves, a, 2 * K, 14 * K)));
  return {
    frames,
    ax: 12 * K,
    ay: 18 * K,
    seq: [0, 1, 0, 2],
    shades: [{ dx: 3, dy: -1, rx: 10, ry: 3.5, strength: 0.26 }],
  };
}

export const bush: Maker = (pal, v) => shrub(pal, v, 'bush');
export const azalea: Maker = (pal, v) => shrub(pal, v, 'azalea');
export const forsythia: Maker = (pal, v) => shrub(pal, v, 'forsythia');

// ── 물가의 풀, 풀포기, 들꽃 ──────────────────────────────────────

/**
 * 풀잎 한 가닥(그림 점): 밑동은 두 점 굵기(오른쪽 한 점이 한 단계 짙다 — 빛은 왼쪽 위)이고 끝으로 갈수록 한 점으로 가늘어진다.
 * tone(t)는 밑동 0 → 끝 1의 자리에서 단계의 자리를 준다.
 */
function blade(px: Px, ramp: Ramp, x0: number, y0: number, len: number, bend: number, tone: (t: number) => number, thin = 0.55): void {
  const n = ramp.length - 1;
  for (let k = 0; k < len; k++) {
    const t = k / Math.max(1, len - 1);
    const x = Math.round(x0 + bend * t * t);
    const y = y0 - k;
    const v = clamp(Math.round(tone(t)), 0, n);
    px.set(x, y, ramp[v]);
    if (t < thin) px.set(x + 1, y, ramp[clamp(v - 1, 0, n)]);
  }
}

export const reed: Maker = (pal, variant) => {
  const W = 14;
  const H = 20;
  const base = new Px(W * K, H * K);
  const leaf = pal.leafWarm;
  const rnd = rngOf(900 + variant);
  const blades = 5 + variant;
  for (let b = 0; b < blades; b++) {
    const x0 = 2 + Math.floor(rnd() * 10);
    const len = 9 + Math.floor(rnd() * 9);
    const bend = (rnd() - 0.5) * 5;
    const tone = 2 + Math.floor(rnd() * 3);
    blade(base, leaf, x0 * K, (H - 2) * K + 1, len * K, bend * K, (t) => (t > 0.94 ? tone + 1 : t < 0.25 ? tone - 1 : tone), 0.6);
    // 부들의 이삭(갈색 이삭이 도톰하다 — 왼쪽이 볕)
    if (b % 3 === 0 && len > 12) {
      const x = Math.round((x0 + bend) * K);
      const yt = (H - 2 - len) * K - 4;
      for (let j = 0; j < 6; j++) {
        base.set(x, yt + j, pal.wood[j < 1 ? 3 : j < 4 ? 3 : 2]);
        base.set(x + 1, yt + j, pal.wood[j < 1 ? 2 : 2]);
      }
      base.set(x, yt - 1, pal.wood[2]);
    }
  }
  calmSprite(base);
  const frames = [0, 2, -2].map((a) => (a === 0 ? base : sway(base, a, 0, (H - 4) * K)));
  return { frames, ax: 7 * K, ay: (H - 2) * K, seq: [0, 1, 0, 2] };
};

export const tuft: Maker = (pal, variant) => {
  const W = 12;
  const H = 10;
  const base = new Px(W * K, H * K);
  const rnd = rngOf(950 + variant * 3);
  const g = pal.grass;
  const tip = pal.grassTip;
  // 풀빛 단계와 풀포기 끝의 빛을 이어 한 단계로(밑동은 짙고 끝은 밝다)
  const ramp: Ramp = [g[1], g[2], g[variant % 2 ? 4 : 3], tip[1], tip[2]];
  const blades = 5 + (variant % 3);
  for (let b = 0; b < blades; b++) {
    const x0 = 2 + Math.floor(rnd() * 8);
    const len = 3 + Math.floor(rnd() * 5);
    const bend = (rnd() - 0.5) * 3;
    blade(base, ramp, x0 * K, H * K - 1, len * K, bend * K, (t) => (t < 0.12 ? 0 : t > 0.74 ? 4 : t > 0.45 ? 3 : 2));
  }
  calmSprite(base, 0.1);
  const frames = [0, 1, -1].map((a) => (a === 0 ? base : sway(base, a, 0, (H - 2) * K)));
  return { frames, ax: 6 * K, ay: (H - 1) * K, seq: [0, 1, 0, 2] };
};

export const flower: Maker = (pal, variant) => {
  const W = 10;
  const H = 11;
  const base = new Px(W * K, H * K);
  const g = pal.grass;
  const ramps: Ramp[] = [pal.blossomWhite, pal.yellow, pal.blossom, pal.azalea, pal.yellow];
  const head = pal.flowers ? ramps[variant % ramps.length] : pal.grassTip;
  const stems: [number, number][] = variant % 2 === 0 ? [[3, 6], [6, 4], [8, 7]] : [[2, 5], [5, 7], [7, 4]];
  const bottom = H * K - 1;
  for (const [sx, len] of stems) {
    const x = sx * K;
    // 줄기(한 점)와 밑동의 잎(두세 점 — 오른쪽 위로 뻗는다)
    for (let k = 0; k < len * K; k++) base.set(x, bottom - k, k < K ? g[1] : g[3]);
    base.set(x + 1, bottom - 2, g[4]);
    base.set(x + 2, bottom - 3, g[4]);
    base.set(x + 3, bottom - 3, g[3]);
    // 꽃: 둥근 꽃잎 다섯 점 남짓(왼쪽 위가 밝다)과 가운데의 꽃술
    const cy = bottom - len * K - 1;
    const m = head.length - 1;
    for (const [dx, dy, t] of [
      [0, -2, m],
      [-1, -1, m],
      [0, -1, m],
      [1, -1, m - 1],
      [-2, 0, m - 1],
      [-1, 0, m],
      [1, 0, m - 1],
      [2, 0, Math.max(0, m - 2)],
      [-1, 1, m - 1],
      [0, 1, Math.max(0, m - 2)],
      [1, 1, Math.max(0, m - 2)],
    ] as const) {
      base.set(x + dx, cy + dy, head[t]);
    }
    // 꽃술(두 점 — 외톨이 점이 되지 않게). 꽃이 지는 철에는 풀포기 끝처럼 보인다(1-라의 노란 한 점은 두지 않는다)
    const heart = !pal.flowers ? head[Math.max(0, m - 1)] : variant % ramps.length === 0 ? pal.yellow[2] : head[Math.max(0, m - 2)];
    base.set(x, cy, heart);
    base.set(x, cy + 1, heart);
  }
  const frames = [0, 1, -1].map((a) => (a === 0 ? base : sway(base, a, 0, (H - 2) * K)));
  return { frames, ax: 5 * K, ay: (H - 1) * K, seq: [0, 1, 0, 2] };
};
