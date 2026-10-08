// 나무와 덤불과 풀. 코드로 한 점씩 찍는다.
// 넓은 잎 나무(참나무 갈래), 작은 나무, 소나무, 봄꽃 핀 나무(살구·산벚), 버드나무, 마을 어귀의 큰 느티나무.

import type { Palette, Ramp } from './palette';
import { Px, clamp, hash2, rngOf, type Color } from './px';
import { branch, canopy, rim, sway, trunk, type Blob, type SpriteDef } from './shapes';

type Maker = (pal: Palette, variant: number) => SpriteDef;

/** 나무갓과 줄기를 따로 그려 합치고, 갓만 흔들어 세 장을 만든다 */
function tree(
  w: number,
  h: number,
  drawTrunk: (px: Px) => void,
  drawCanopy: (px: Px) => void,
  opts: {
    ax: number;
    ay: number;
    trunkRim: Color;
    leafRim: Color;
    leafSoft: Color;
    swayTop: number;
    swayBot: number;
    amount?: number;
    bottomHeavy?: boolean;
    shades: SpriteDef['shades'];
    sort?: number;
  },
): SpriteDef {
  const base = new Px(w, h);
  drawTrunk(base);
  base.outline(opts.trunkRim);
  const leaves = new Px(w, h);
  drawCanopy(leaves);
  rim(leaves, opts.leafRim, opts.leafSoft);
  const amount = opts.amount ?? 1;
  const frames = [0, amount, -amount].map((a) => {
    const f = base.clone();
    f.blit(a === 0 ? leaves : sway(leaves, a, opts.swayTop, opts.swayBot, opts.bottomHeavy), 0, 0);
    return f;
  });
  return { frames, ax: opts.ax, ay: opts.ay, shades: opts.shades, sort: opts.sort, seq: [0, 1, 0, 2] };
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

function leafMasses(
  px: Px,
  masses: readonly Mass[],
  ramp: Ramp,
  bark: Ramp,
  opts: { seed: number; clump: [number, number]; from?: [number, number]; core?: number; accent?: { ramp: Ramp; share: number }; crease?: number; sparkle?: number },
): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of masses) {
    x0 = Math.min(x0, m.x - m.r);
    x1 = Math.max(x1, m.x + m.r);
    y0 = Math.min(y0, m.y - m.r);
    y1 = Math.max(y1, m.y + m.r);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // 어두운 속
  const k = opts.core ?? 0.4;
  canopy(px, [{ x: cx, y: cy + 1, r: (x1 - x0) * k, squash: ((y1 - y0) * k) / ((x1 - x0) * k) }], ramp, {
    seed: opts.seed + 1,
    clump: opts.clump,
    bias: -0.36,
    crease: 0.1,
  });
  // 속으로 뻗은 가지(뭉치 사이로 보인다)
  if (opts.from) {
    const [fx, fy] = opts.from;
    for (const m of masses) {
      if (m.y > fy - 4) continue;
      branch(px, bark, fx, fy, m.x, m.y + m.r * 0.3, m.r > 14 ? 3 : 2);
    }
  }
  // 잎 뭉치: 위(뒤)에서 아래(앞)로
  [...masses]
    .sort((a, b) => a.y - b.y)
    .forEach((m, i) => {
      const rnd = rngOf(opts.seed * 31 + i * 7 + 3);
      const blobs: Blob[] = [
        // 뭉치는 서로 넉넉히 겹친다(풍선처럼 따로 놀지 않게). 옆으로 조금 퍼진 꼴.
        { x: m.x, y: m.y, r: m.r * 0.98, squash: 0.84, lift: 2 },
        { x: m.x - m.r * (0.46 + rnd() * 0.2), y: m.y + m.r * (0.15 + rnd() * 0.2), r: m.r * 0.66, lift: 1 },
        { x: m.x + m.r * (0.46 + rnd() * 0.2), y: m.y + m.r * (0.05 + rnd() * 0.3), r: m.r * 0.66, lift: 0 },
      ];
      const tmp = new Px(px.w, px.h);
      canopy(tmp, blobs, m.ramp ?? ramp, {
        seed: opts.seed + 11 * i + 5,
        clump: opts.clump,
        bias: m.bias ?? 0,
        accent: opts.accent,
        crease: opts.crease,
        sparkle: opts.sparkle,
      });
      px.blit(tmp, 0, 0);
    });
}

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

export const oak: Maker = (pal, variant) => {
  const W = 56;
  const H = 66;
  const leaf: Ramp = [pal.leaf, pal.leafWarm, pal.leafDeep][variant % 3];
  const shape = OAK_SHAPES[variant % OAK_SHAPES.length];
  const rnd = rngOf(900 + variant * 13);
  const masses = shape.map((m) => ({ ...m, x: m.x + (rnd() - 0.5) * 2, y: m.y + (rnd() - 0.5) * 2 }));
  return tree(
    W,
    H,
    (px) => {
      trunk(px, pal.bark, { x: 28, yTop: 34, yBot: 62, wTop: 5, wBot: 7, roots: true, seed: 3 + variant, curve: 0.7 });
    },
    (px) => leafMasses(px, masses, leaf, pal.bark, { seed: 100 + variant * 17, clump: [5, 4], from: [28, 42] }),
    {
      ax: 28,
      ay: 63,
      trunkRim: pal.bark[0],
      leafRim: leaf[0],
      leafSoft: leaf[1],
      swayTop: 2,
      swayBot: 42,
      shades: [{ dx: 7, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: 0.3 }],
    },
  );
};

// ── 작은 나무 ────────────────────────────────────────────────
export const young: Maker = (pal, variant) => {
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
  return tree(
    W,
    H,
    (px) => trunk(px, pal.bark, { x: 17, yTop: 22, yBot: 40, wTop: 3, wBot: 4, roots: false, seed: 9 + variant, curve: 0.5 }),
    (px) => leafMasses(px, masses, leaf, pal.bark, { seed: 200 + variant * 13, clump: [4, 3], from: [17, 28] }),
    {
      ax: 17,
      ay: 41,
      trunkRim: pal.bark[0],
      leafRim: leaf[0],
      leafSoft: leaf[1],
      swayTop: 2,
      swayBot: 30,
      shades: [{ dx: 5, dy: 0, rx: 12, ry: 5, dapple: true, strength: 0.28 }],
    },
  );
};

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
  const yBot = H - 4;
  return tree(
    W,
    H,
    (px) => {
      trunk(px, pal.pineBark, {
        x: cx,
        yTop: Math.round(8 * s),
        yBot,
        wTop: small ? 2 : 3,
        wBot: small ? 4 : 6,
        lean,
        curve: small ? 0.8 : 1.6,
        roots: !small,
        seed: 5 + variant,
      });
      // 잎 없는 곁가지
      if (!small) {
        branch(px, pal.pineBark, cx + lean * 0.3, 44, cx - 12, 39, 2);
        branch(px, pal.pineBark, cx + lean * 0.5, 34, cx + 14, 29, 2);
      }
    },
    (px) => canopy(px, pads, pal.pine, { seed: 300 + variant * 19 + (small ? 7 : 0), clump: [4, 3], spiky: 2.2 }),
    {
      ax: Math.round(cx),
      ay: yBot + 1,
      trunkRim: pal.pineBark[0],
      leafRim: pal.pine[0],
      leafSoft: pal.pine[1],
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
    W,
    H,
    (px) => {
      trunk(px, pal.pineBark, { x: cx - dir * 2, yTop: 10, yBot: 86, wTop: 4, wBot: 10, lean: dir * 9, curve: 3.2, roots: true, seed: 8 + variant });
      branch(px, pal.pineBark, cx + dir * 2, 52, cx - dir * 18, 42, 3);
      branch(px, pal.pineBark, cx + dir * 4, 44, cx + dir * 22, 30, 3);
      branch(px, pal.pineBark, cx + dir * 3, 60, cx + dir * 24, 50, 2);
      // 부러진 곁가지
      branch(px, pal.pineBark, cx - dir * 1, 66, cx - dir * 11, 61, 2);
    },
    (px) => canopy(px, pads, pal.pine, { seed: 330 + variant * 19, clump: [4, 3], spiky: 2.4 }),
    {
      ax: cx - dir * 2,
      ay: 87,
      trunkRim: pal.pineBark[0],
      leafRim: pal.pine[0],
      leafSoft: pal.pine[1],
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
  return tree(
    W,
    H,
    (px) => {
      trunk(px, pal.bark, { x: 23, yTop: 28, yBot: 48, wTop: 3, wBot: 5, roots: false, seed: 17 + variant, curve: 1.1 });
      branch(px, pal.bark, 22, 36, 14, 28, 2);
      branch(px, pal.bark, 24, 38, 32, 29, 2);
    },
    (px) =>
      canopy(px, blobs, petals, {
        seed: 400 + variant * 23,
        clump: [5, 4],
        accent: { ramp: pal.leafWarm, share: 0.14 },
        bias: 0.06,
        crease: 0.13,
        sparkle: 0.09,
      }),
    {
      ax: 23,
      ay: 49,
      trunkRim: pal.bark[0],
      leafRim: petals[0],
      leafSoft: petals[1],
      swayTop: 2,
      swayBot: 34,
      shades: [{ dx: 6, dy: 0, rx: 16, ry: 6, dapple: true, strength: 0.26 }],
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
    W,
    H,
    (px) =>
      trunk(px, pal.bark, {
        x: cx + (variant === 1 ? -2 : 2),
        yTop: 20,
        yBot: 57,
        wTop: 4,
        wBot: 7,
        lean: variant === 1 ? 3 : -3,
        curve: 1.5,
        roots: true,
        seed: 23 + variant,
      }),
    (px) => {
      canopy(px, blobs, leaf, { seed: 500 + variant * 29, clump: [4, 4] });
      // 늘어진 가지: 세로로 길게 드리운 잎의 줄
      const n = leaf.length - 1;
      for (let x = 2; x < W - 2; x++) {
        // 이 줄에서 나무갓의 아래 끝
        let y0 = -1;
        for (let y = H - 1; y >= 0; y--) {
          if (px.get(x, y) !== 0) {
            y0 = y;
            break;
          }
        }
        if (y0 < 0) continue;
        const r = hash2(x, variant, 521);
        if (r < 0.22) continue;
        const len = Math.round(9 + hash2(x, variant, 522) * 20 + Math.sin(x * 0.7) * 3);
        for (let k = 0; k < len; k++) {
          const y = y0 + k;
          if (y > H - 8) break;
          const t = k / len;
          let v = Math.round(3.6 - t * 1.2 + (hash2(x, y >> 1, 523) - 0.5) * 1.6 - (x > cx + 6 ? 1 : 0));
          if (k === len - 1) v = n - 1;
          if (hash2(x, y, 524) < 0.14) continue; // 사이사이 빈 곳
          px.set(x, y, leaf[clamp(v, 1, n)]);
        }
      }
    },
    {
      ax: cx + (variant === 1 ? -2 : 2),
      ay: 58,
      trunkRim: pal.bark[0],
      leafRim: leaf[0],
      leafSoft: leaf[1],
      swayTop: 18,
      swayBot: 52,
      bottomHeavy: true,
      amount: 2,
      shades: [{ dx: 6, dy: 0, rx: 20, ry: 7.5, dapple: true, strength: 0.28 }],
    },
  );
};

// ── 마을 어귀의 큰 느티나무 ────────────────────────────────────
// 여러 칸 크기의 아주 큰 나무(가로 열두 칸쯤). 굵은 줄기가 세 갈래로 갈라지고 잎 뭉치가 겹겹이 얹힌다.
export const zelkova: Maker = (pal) => {
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
  return tree(
    W,
    H,
    (px) => {
      // 굵은 밑동과 뿌리
      trunk(px, bark, { x: cx, yTop: 92, yBot: 176, wTop: 26, wBot: 34, roots: true, seed: 41, curve: 0 });
      const n = bark.length - 1;
      for (const [sx, len, dir] of [
        [-20, 15, -1],
        [-10, 9, -1],
        [12, 10, 1],
        [21, 16, 1],
      ] as const) {
        for (let k = 0; k < len; k++) {
          const x = cx + sx + dir * k;
          const hgt = Math.max(1, Math.round(7 - k * 0.45));
          for (let j = 0; j < hgt; j++) px.set(x, 177 - j, bark[clamp(dir < 0 ? n - 1 - (j === 0 ? 2 : 0) : j === hgt - 1 ? 2 : 1, 0, n)]);
        }
      }
      // 깊게 팬 껍질의 골과 옹이
      for (let y = 98; y < 174; y++) {
        for (const gx of [cx - 9, cx - 2, cx + 6, cx + 11]) {
          if (hash2(gx, y >> 2, 43) < 0.62) px.over(gx + Math.round(Math.sin(y / 9 + gx) * 1.4), y, bark[0]);
        }
        if (hash2(1, y >> 1, 44) < 0.55) px.over(cx - 13 + Math.round(Math.sin(y / 7) * 1.5), y, bark[n]);
        if (hash2(2, y >> 1, 45) < 0.4) px.over(cx - 6 + Math.round(Math.sin(y / 11) * 1.2), y, bark[n - 1]);
      }
      for (let j = -3; j <= 3; j++) {
        for (let i = -4; i <= 4; i++) {
          if (i * i * 0.6 + j * j > 9) continue;
          px.over(cx + 4 + i, 136 + j, bark[i * i * 0.6 + j * j > 4 ? 0 : 1]);
        }
      }
      // 세 갈래 큰 가지
      branch(px, bark, cx - 9, 98, cx - 50, 60, 10);
      branch(px, bark, cx - 2, 96, cx + 2, 46, 11);
      branch(px, bark, cx + 10, 98, cx + 52, 62, 10);
    },
    (px) => leafMasses(px, masses, leaf, bark, { seed: 600, clump: [7, 6], from: [cx, 92], core: 0.4 }),
    {
      ax: cx,
      ay: 178,
      trunkRim: bark[0],
      leafRim: leaf[0],
      leafSoft: leaf[1],
      swayTop: 0,
      swayBot: 104,
      shades: [{ dx: 18, dy: 3, rx: 86, ry: 27, dapple: true, broad: true, strength: 0.3 }],
      sort: -2,
    },
  );
};

// ── 냇가의 큰 나무(그네를 맬 만한 나무) ─────────────────────────
export const bigtree: Maker = (pal) => {
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
  return tree(
    W,
    H,
    (px) => {
      trunk(px, pal.bark, { x: cx, yTop: 48, yBot: 92, wTop: 10, wBot: 14, roots: true, seed: 61, curve: 0.8 });
      // 그네를 맬 만한 굵은 곁가지
      branch(px, pal.bark, cx + 4, 64, cx + 34, 59, 3);
    },
    (px) => leafMasses(px, masses, leaf, pal.bark, { seed: 700, clump: [6, 5], from: [cx, 52], core: 0.38 }),
    {
      ax: cx,
      ay: 94,
      trunkRim: pal.bark[0],
      leafRim: leaf[0],
      leafSoft: leaf[1],
      swayTop: 0,
      swayBot: 60,
      shades: [{ dx: 10, dy: 1, rx: 40, ry: 13, dapple: true, broad: true, strength: 0.3 }],
      sort: -2,
    },
  );
};

// ── 덤불 ─────────────────────────────────────────────────────
function shrub(pal: Palette, variant: number, kind: 'bush' | 'azalea' | 'forsythia'): SpriteDef {
  const W = 24;
  const H = 20;
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
  const accent =
    kind === 'azalea'
      ? { ramp: pal.azalea, share: 0.62 }
      : kind === 'forsythia'
        ? { ramp: pal.yellow, share: 0.7 }
        : variant === 2
          ? { ramp: pal.leafWarm, share: 0.3 }
          : undefined;
  const leaves = new Px(W, H);
  canopy(leaves, blobs, leaf, { seed: 800 + variant * 7 + kind.length, clump: [3, 3], accent, crease: kind === 'bush' ? 0.26 : 0.16, sparkle: kind === 'bush' ? 0 : 0.08 });
  rim(leaves, leaf[0], leaf[1]);
  const frames = [0, 1, -1].map((a) => (a === 0 ? leaves : sway(leaves, a, 2, 14)));
  return {
    frames,
    ax: 12,
    ay: 18,
    seq: [0, 1, 0, 2],
    shades: [{ dx: 3, dy: -1, rx: 10, ry: 3.5, strength: 0.26 }],
  };
}

export const bush: Maker = (pal, v) => shrub(pal, v, 'bush');
export const azalea: Maker = (pal, v) => shrub(pal, v, 'azalea');
export const forsythia: Maker = (pal, v) => shrub(pal, v, 'forsythia');

// ── 물가의 풀, 풀포기, 들꽃 ──────────────────────────────────────
export const reed: Maker = (pal, variant) => {
  const W = 14;
  const H = 20;
  const base = new Px(W, H);
  const leaf = pal.leafWarm;
  const rnd = rngOf(900 + variant);
  const blades = 5 + variant;
  for (let b = 0; b < blades; b++) {
    const x0 = 2 + Math.floor(rnd() * 10);
    const len = 9 + Math.floor(rnd() * 9);
    const bend = (rnd() - 0.5) * 5;
    const tone = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = Math.round(x0 + bend * t * t);
      const y = H - 2 - k;
      base.set(x, y, leaf[clamp(k === len - 1 ? tone + 1 : t < 0.25 ? tone - 1 : tone, 1, leaf.length - 1)]);
    }
    // 부들의 이삭
    if (b % 3 === 0 && len > 12) {
      const x = Math.round(x0 + bend);
      base.set(x, H - 2 - len, pal.wood[2]);
      base.set(x, H - 3 - len, pal.wood[3]);
      base.set(x, H - 4 - len, pal.wood[2]);
    }
  }
  const frames = [0, 1, -1].map((a) => (a === 0 ? base : sway(base, a, 0, H - 4)));
  return { frames, ax: 7, ay: H - 2, seq: [0, 1, 0, 2] };
};

export const tuft: Maker = (pal, variant) => {
  const W = 12;
  const H = 10;
  const base = new Px(W, H);
  const rnd = rngOf(950 + variant * 3);
  const g = pal.grass;
  const tip = pal.grassTip;
  const blades = 5 + (variant % 3);
  for (let b = 0; b < blades; b++) {
    const x0 = 2 + Math.floor(rnd() * 8);
    const len = 3 + Math.floor(rnd() * 5);
    const bend = (rnd() - 0.5) * 3;
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = Math.round(x0 + bend * t);
      const y = H - 1 - k;
      base.set(x, y, k === 0 ? g[1] : k === len - 1 ? tip[2] : t > 0.5 ? tip[1] : g[variant % 2 ? 4 : 3]);
    }
  }
  const frames = [0, 1, -1].map((a) => (a === 0 ? base : sway(base, a, 0, H - 2)));
  return { frames, ax: 6, ay: H - 1, seq: [0, 1, 0, 2] };
};

export const flower: Maker = (pal, variant) => {
  const W = 10;
  const H = 11;
  const base = new Px(W, H);
  const g = pal.grass;
  const ramps: Ramp[] = [pal.blossomWhite, pal.yellow, pal.blossom, pal.azalea, pal.yellow];
  const head = pal.flowers ? ramps[variant % ramps.length] : pal.grassTip;
  const stems: [number, number][] = variant % 2 === 0 ? [[3, 6], [6, 4], [8, 7]] : [[2, 5], [5, 7], [7, 4]];
  for (const [x, len] of stems) {
    for (let k = 0; k < len; k++) base.set(x, H - 1 - k, k === 0 ? g[1] : g[3]);
    const y = H - 1 - len;
    const m = head.length - 1;
    base.set(x, y, head[m]);
    base.set(x - 1, y, head[m - 1]);
    base.set(x + 1, y, head[Math.max(0, m - 2)]);
    base.set(x, y - 1, head[m]);
    base.set(x, y + 1, variant % ramps.length === 0 ? pal.yellow[2] : head[Math.max(0, m - 2)]);
    // 잎
    base.set(x + 1, H - 2, g[4]);
  }
  const frames = [0, 1, -1].map((a) => (a === 0 ? base : sway(base, a, 0, H - 2)));
  return { frames, ax: 5, ay: H - 1, seq: [0, 1, 0, 2] };
};
