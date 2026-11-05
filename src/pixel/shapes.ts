// 그림을 이루는 덩어리들: 잎 뭉치(나무갓), 줄기, 돌, 널빤지.
// 빛은 왼쪽 위에서 온다. 그늘은 오른쪽 아래에 진다. 모든 그림이 이 약속을 지킨다.

import type { Ramp } from './palette';
import { Px, clamp, hash2, vnoise, type Color } from './px';

/** 세운 것 한 가지의 그림 */
export interface SpriteDef {
  /** 움직이는 장들(흔들림). 한 장뿐이면 가만히 있는 그림이다. */
  frames: Px[];
  /** 그림 안에서 발치(놓이는 자리)에 해당하는 점 */
  ax: number;
  ay: number;
  /** 바닥 그림자(발치에서의 어긋남과 크기) */
  shades?: ShadeSpec[];
  /** 앞뒤 가림의 기준 줄을 발치에서 옮긴다(위로 −) */
  sort?: number;
  /** 장을 넘기는 차례(없으면 0,1,2…). 흔들림은 0,1,0,2로 오간다. */
  seq?: number[];
  /** 장을 넘기는 빠르기(초당 장 수). 없으면 바람에 흔들리는 빠르기(1.7). */
  rate?: number;
  /** 굴뚝 끝(그림 안의 점). 여기서 연기가 피어오른다. */
  smoke?: { x: number; y: number };
  /** 수채화 같은 결(ㅌ)이 첫 장에서 한 칸 어둡게 만든 점의 몫(%) — 때의 위 한도(ㅎ)를 시험이 본다(wash.ts의 finish) */
  wash?: number;
}

/**
 * 바닥 그림자. 둥근 얼룩(나무, 돌)이거나, 집의 꼴을 따라 오른쪽 아래로 드리운 그림자(cast).
 * cast: 벽의 아랫줄이 발치에서 x0~x1에 있고 처마 높이가 h인 집이, 오른쪽으로 side만큼·아래로 depth만큼 그늘을 드리운다.
 */
export interface ShadeSpec {
  dx: number;
  dy: number;
  rx: number;
  ry: number;
  /** 나뭇잎 사이로 빛이 새는 얼룩 그림자 */
  dapple?: boolean;
  /** 큰 나무: 얼룩의 덩어리가 크고 가장자리에만 빛이 샌다 */
  broad?: boolean;
  strength?: number;
  cast?: { x0: number; x1: number; h: number; side: number; depth: number; ragged?: boolean };
}

// 빛이 오는 쪽(왼쪽 위, 보는 사람 쪽으로 조금)
const LX = -0.5;
const LY = -0.72;
const LZ = 0.48;

export interface Blob {
  x: number;
  y: number;
  r: number;
  /** 위아래로 눌린 정도(1이면 둥글다) */
  squash?: number;
  /** 앞으로 나온 정도(클수록 다른 덩어리를 덮는다) */
  lift?: number;
  /** 이 덩어리만 다른 빛깔 단계로(꽃 뭉치) */
  ramp?: Ramp;
  /** 이 덩어리만 밝게(+) 어둡게(−) — 뒤쪽 층은 어둡다 */
  shade?: number;
}

export interface CanopyOpts {
  seed: number;
  /** 잎 뭉치 하나의 크기(점) */
  clump?: [number, number];
  /** 가장자리가 삐죽한 정도(솔잎) */
  spiky?: number;
  /** 뭉치마다 이 단계로 바뀔 몫(0~1) — 꽃나무의 꽃 뭉치, 새순 */
  accent?: { ramp: Ramp; share: number };
  /** 전체를 밝게(+) 또는 어둡게(−) */
  bias?: number;
  /** 뭉치 사이 그늘 골의 깊이(기본 0.26). 꽃 뭉치는 얕게 한다. */
  crease?: number;
  /** 낱낱이 반짝이는 점의 몫(꽃잎) */
  sparkle?: number;
  /** 반짝이는 점을 이만한 무리로 모은다(그림 점 — 2면 두세 점짜리 무리. ㄹ의 "작은 것은 두 점 이상"). 기본 1(낱낱이) */
  grain?: number;
}

/**
 * 잎 뭉치로 된 나무갓. 덩어리(공)들을 겹쳐 큰 모양을 만들고, 그 위에 작은 잎 뭉치의 결을 얹는다.
 * 뭉치마다 왼쪽 위가 밝고 오른쪽 아래에 그늘 골이 진다.
 */
export function canopy(px: Px, blobs: readonly Blob[], ramp: Ramp, opts: CanopyOpts): void {
  const n = ramp.length - 1;
  const [cw, ch] = opts.clump ?? [5, 4];
  let top = Infinity;
  let bot = -Infinity;
  for (const b of blobs) {
    top = Math.min(top, b.y - b.r * (b.squash ?? 1));
    bot = Math.max(bot, b.y + b.r * (b.squash ?? 1));
  }
  const span = Math.max(1, bot - top);
  const w = px.w;
  const h = px.h;
  const toneAt = new Float32Array(w * h).fill(-1);
  const rampAt: (Ramp | null)[] = new Array(w * h).fill(null);

  // 가장 가까운 잎 뭉치의 가운데(칸마다의 가운데는 한 번만 셈해 둔다 — 빠르기만 다르고 그림은 같다)
  const grid = new Map<number, number>();
  const centers: number[] = [];
  const centerOf = (gx: number, gy: number): number => {
    const key = (gx + 2048) * 8192 + (gy + 2048);
    let at = grid.get(key);
    if (at === undefined) {
      at = centers.length;
      centers.push((gx + 0.15 + hash2(gx, gy, opts.seed + 1) * 0.7) * cw, (gy + 0.15 + hash2(gx, gy, opts.seed + 2) * 0.7) * ch);
      grid.set(key, at);
    }
    return at;
  };
  let nbx = 0;
  let nby = 0;
  /** 가장 가까운 뭉치의 번호(그 가운데는 nbx, nby) */
  const nearest = (x: number, y: number): number => {
    const gx = Math.floor(x / cw);
    const gy = Math.floor(y / ch);
    let best = Infinity;
    let id = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const at = centerOf(gx + i, gy + j);
        const cx = centers[at];
        const cy = centers[at + 1];
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy) * 1.5;
        if (d < best) {
          best = d;
          nbx = cx;
          nby = cy;
          id = (gx + i) * 7919 + (gy + j) * 104729;
        }
      }
    }
    return id;
  };

  // 덩어리가 닿는 네모만 훑는다(밖은 언제나 비어 있다 — 빠르기만 다르고 그림은 같다)
  let bx0 = w;
  let by0 = h;
  let bx1 = -1;
  let by1 = -1;
  for (const b of blobs) {
    const r = b.r + (opts.spiky ?? 0);
    bx0 = Math.min(bx0, Math.floor(b.x - r - 1));
    bx1 = Math.max(bx1, Math.ceil(b.x + r + 1));
    by0 = Math.min(by0, Math.floor(b.y - r * (b.squash ?? 1) - 1));
    by1 = Math.max(by1, Math.ceil(b.y + r * (b.squash ?? 1) + 1));
  }
  bx0 = Math.max(0, bx0);
  by0 = Math.max(0, by0);
  bx1 = Math.min(w - 1, bx1);
  by1 = Math.min(h - 1, by1);
  const grain = opts.grain ?? 1;
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      let bestH = -Infinity;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      let own: Ramp | undefined;
      let extra = 0;
      for (const b of blobs) {
        const sq = b.squash ?? 1;
        let r = b.r;
        // 솔잎의 삐죽함: 2배 그림은 두세 점짜리 무리로 삐죽하게(낱낱의 점이 흩어진 털처럼 보이지 않게)
        if (opts.spiky) r += ((grain > 1 ? hash2(x >> 1, (y + (x & 1)) >> 1, opts.seed + 9) * 0.8 + hash2(x, y, opts.seed + 9) * 0.2 : hash2(x, y, opts.seed + 9)) - 0.5) * opts.spiky;
        const dx = (x + 0.5 - b.x) / r;
        const dy = (y + 0.5 - b.y) / (r * sq);
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const z = Math.sqrt(1 - d2);
        const hgt = z * b.r + (b.lift ?? 0);
        if (hgt > bestH) {
          bestH = hgt;
          nx = dx;
          ny = dy;
          nz = z;
          own = b.ramp;
          extra = b.shade ?? 0;
        }
      }
      if (bestH === -Infinity) continue;
      const diff = nx * LX + ny * LY + nz * LZ;
      const g = (y - top) / span;
      let tone = 0.52 + 0.5 * diff - 0.34 * (g - 0.4) + (opts.bias ?? 0) + extra;
      // 뭉치의 모양이 비늘처럼 고르게 늘어서지 않게, 찾는 자리를 조금씩 휘어 준다
      const wx = x + (vnoise(x / 6.3, y / 6.3, opts.seed + 40) - 0.5) * cw * 1.5;
      const wy = y + (vnoise(x / 6.3 + 9.1, y / 6.3 + 3.7, opts.seed + 41) - 0.5) * ch * 1.5;
      const id = nearest(wx, wy);
      const cx = nbx;
      const cy = nby;
      const local = clamp((-(wx - cx) * 0.55 - (wy - cy) * 0.85) / (ch * 0.9), -1, 1);
      tone += 0.2 * local;
      // 뭉치의 오른쪽 아래 가장자리는 그늘 골(뭉치 몇은 골 없이 이웃과 이어진다)
      const idR = nearest(wx + 1, wy + 1);
      if (idR !== id && hash2(id, 5, opts.seed + 42) > 0.3) tone -= opts.crease ?? 0.26;
      if (opts.sparkle) {
        // 무리로 모을 때: 줄마다 반 칸씩 어긋난 grain×grain 칸 하나가 한 무리이고, 칸의 한 귀는 비워 네모가 되지 않게 한다
        let sp: number;
        if (grain > 1) {
          const gy = Math.floor(y / grain);
          const gx = Math.floor((x + (gy & 1)) / grain);
          const corner = Math.floor(hash2(gx, gy, opts.seed + 33) * 4);
          const lx = (x + (gy & 1)) - gx * grain;
          const ly = y - gy * grain;
          sp = (lx === (corner & 1) * (grain - 1) && ly === (corner >> 1) * (grain - 1)) ? 0.5 : hash2(gx, gy, opts.seed + 31);
        } else sp = hash2(x, y, opts.seed + 31);
        if (sp < opts.sparkle) tone += 0.28;
        else if (sp > 1 - opts.sparkle * 0.6) tone -= 0.16;
      }
      toneAt[y * w + x] = tone;
      let use: Ramp | null = own ?? null;
      if (!use && opts.accent && hash2(id, 3, opts.seed + 5) < opts.accent.share) use = opts.accent.ramp;
      rampAt[y * w + x] = use;
    }
  }

  const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && toneAt[y * w + x] >= 0;
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const tone = toneAt[y * w + x];
      if (tone < 0) continue;
      const use = rampAt[y * w + x] ?? ramp;
      const m = use.length - 1;
      let v = clamp(Math.round(1 + clamp(tone, 0, 1) * (m - 1)), 1, m);
      // 테두리: 그늘 쪽은 가장 어둡게, 빛 쪽은 한 단계만 어둡게. 2배 그림(grain 2)은 그늘 쪽 가장자리가 1-라처럼 맵 점 하나 너비다 —
      // 바깥 한 점은 가장 어둡게, 그 안쪽 한 점은 둘째로 어둡게(뭉치끼리 갈라져 덩어리감이 1-라 그대로)
      const openDown = !filled(x, y + 1) || !filled(x + 1, y);
      const openDown2 = grain > 1 && (!filled(x, y + 2) || !filled(x + 2, y));
      const openUp = !filled(x, y - 1) || !filled(x - 1, y);
      if (openDown) v = 0;
      else if (openDown2) v = Math.min(v, 1);
      else if (openUp) v = Math.max(1, v - 1);
      px.set(x, y, use === ramp ? ramp[clamp(v, 0, n)] : use[clamp(v, 0, m)]);
    }
  }
}

/** 나무갓을 바람에 흔든다: 위쪽 줄일수록 옆으로 밀린다. bottomHeavy면 아래쪽(늘어진 가지)이 흔들린다. */
export function sway(src: Px, amount: number, y0: number, y1: number, bottomHeavy = false): Px {
  const out = new Px(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    let k = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
    k = bottomHeavy ? k : 1 - k;
    const shift = Math.round(amount * k);
    for (let x = 0; x < src.w; x++) {
      const c = src.d[y * src.w + x];
      if (c !== 0) out.set(x + shift, y, c);
    }
  }
  return out;
}

export interface TrunkOpts {
  /** 밑동 가운데 */
  x: number;
  yTop: number;
  yBot: number;
  wTop: number;
  wBot: number;
  /** 위로 갈수록 옆으로 휘는 정도(점) */
  lean?: number;
  /** 구불거림 */
  curve?: number;
  roots?: boolean;
  seed: number;
  /** 그림 점 / 1-라의 점(뿌리의 길이·퍼짐을 키운다 — 2배 그림은 2). 줄기의 너비·자리는 부르는 쪽이 이미 키워 준다 */
  k?: number;
}

/** 나무 줄기. 왼쪽이 밝고 오른쪽이 어둡다. 껍질의 세로 결이 있다. */
export function trunk(px: Px, ramp: Ramp, o: TrunkOpts): void {
  const n = ramp.length - 1;
  const len = Math.max(1, o.yBot - o.yTop);
  for (let y = o.yTop; y <= o.yBot; y++) {
    const t = (o.yBot - y) / len; // 0 밑동 → 1 위
    let wd = o.wBot + (o.wTop - o.wBot) * t;
    if (o.roots && t < 0.14) wd += (0.14 - t) * 28 * (o.k ?? 1);
    const cx = o.x + (o.lean ?? 0) * t + Math.sin(t * 3.4 + o.seed) * (o.curve ?? 0);
    const x0 = Math.round(cx - wd / 2);
    const x1 = Math.round(cx + wd / 2) - 1;
    for (let x = x0; x <= x1; x++) {
      const u = wd <= 1 ? 0.5 : (x - x0) / Math.max(1, x1 - x0);
      let v = u < 0.22 ? n - 1 : u < 0.5 ? n - 2 : u < 0.8 ? n - 3 : n - 4;
      const grain = hash2(x, Math.floor(y / 3), o.seed + 21);
      if (grain < 0.2) v -= 1;
      else if (grain > 0.88) v += 1;
      px.set(x, y, ramp[clamp(v, 0, n)]);
    }
  }
  if (o.roots) {
    // 땅으로 뻗은 뿌리
    const base = o.yBot;
    const K = o.k ?? 1;
    const half = Math.round(o.wBot / 2 + 3 * K);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4 * K; k++) {
        const x = Math.round(o.x + side * (half + k));
        px.set(x, base, ramp[side < 0 ? n - 1 : 1]);
        if (k < 2 * K) px.set(x, base - 1, ramp[side < 0 ? n - 2 : 1]);
        if (K > 1 && k < K) px.set(x, base - 2, ramp[side < 0 ? n - 2 : 1]);
      }
    }
  }
}

/**
 * 가지 하나(줄기에서 나무갓 속으로 뻗는다). 둥근 붓: 굵기를 가지 방향에 수직으로 쌓는다(그림 올리기 ②의 고침 — 가로로만 쌓으면
 * 거의 가로인 가지가 한 점 높이의 실오라기가 된다). 빛은 왼쪽 위에서 오므로 굵기는 중심선에서 오른쪽 아래 쪽으로 쌓고,
 * 위·왼쪽 가장자리가 볕, 오른쪽 아래로 갈수록 그늘이다(굵은 가지는 줄기와 같은 넷 단). 끝으로 갈수록 0.4배까지 가늘어진다.
 */
export function branch(px: Px, ramp: Ramp, x0: number, y0: number, x1: number, y1: number, thick: number): void {
  const n = ramp.length - 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return;
  const len = Math.sqrt(len2);
  // 가지 방향에 수직인 쪽 가운데 오른쪽 아래를 향한 것
  let nx = -dy / len;
  let ny = dx / len;
  if (nx + ny < 0 || (nx + ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const X0 = Math.floor(Math.min(x0, x1) - 1);
  const X1 = Math.ceil(Math.max(x0, x1) + thick + 1);
  const Y0 = Math.floor(Math.min(y0, y1) - 1);
  const Y1 = Math.ceil(Math.max(y0, y1) + thick + 1);
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const rx = x - x0;
      const ry = y - y0;
      const t = (rx * dx + ry * dy) / len2;
      if (t < 0 || t > 1) continue;
      // 중심선(위·왼쪽 가장자리)에서 굵기 쪽으로 몇 점 들어왔는가
      const k = rx * nx + ry * ny;
      const wd = Math.max(1, Math.round(thick * (1 - t * 0.6)));
      if (k < -0.5 || k >= wd - 0.5) continue;
      const kk = Math.round(k);
      // 굵은 가지는 줄기처럼 볕 쪽 네 몫 하나가 밝고 그늘 쪽으로 차츰 짙다(가는 가지는 볕 한 줄·가운데 한 줄·그늘)
      const u = (kk + 0.5) / wd;
      const v = wd >= 4 ? (u < 0.25 ? n - 1 : u < 0.5 ? n - 2 : u < 0.8 ? n - 3 : n - 4) : kk <= 0 ? n - 2 : n - 3 - (kk > 1 ? 1 : 0);
      px.set(x, y, ramp[clamp(v, 0, n)]);
    }
  }
}

/** 울퉁불퉁한 돌. 위와 왼쪽 면이 밝고 오른쪽 아래가 어둡다. */
export function rock(px: Px, ramp: Ramp, cx: number, cy: number, rx: number, ry: number, seed: number, moss?: Ramp, k = 1): void {
  const n = ramp.length - 1;
  const inside = (x: number, y: number): number => {
    const ang = Math.atan2(y - cy, x - cx);
    const wob = 1 + (vnoise(ang * 1.7 + seed, seed * 0.37, seed) - 0.5) * 0.36;
    const dx = (x + 0.5 - cx) / (rx * wob);
    const dy = (y + 0.5 - cy) / (ry * wob);
    return dx * dx + dy * dy;
  };
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      const d = inside(x, y);
      if (d > 1) continue;
      const ux = (x - cx) / rx;
      const uy = (y - cy) / ry;
      // 면을 나눈다: 윗면, 왼쪽 면, 오른쪽 아래 면
      const facet = vnoise(x / (3.4 * k) + seed, y / (3.4 * k), seed + 3);
      let v = 3.1 - ux * 1.2 - uy * 1.9 + (facet - 0.5) * 1.5;
      if (uy > 0.45) v -= 0.8;
      if (d > 0.72 && (ux > 0.1 || uy > 0.1)) v = Math.min(v, 1);
      if (hash2(Math.floor(x / k), Math.floor(y / k), seed + 5) < 0.04 && (k === 1 || hash2(x, y, seed + 6) < 0.6)) v -= 1;
      let c: Color = ramp[clamp(Math.round(v), 1, n)];
      if (moss && uy < -0.15 && vnoise(x / (2.3 * k), y / (2.3 * k), seed + 7) > 0.6) c = moss[clamp(Math.round(3 - ux * 1.5), 2, 4)];
      px.set(x, y, c);
    }
  }
  // 아래 테두리는 가장 어둡게(2배 그림은 한 단계 위 — 제 빛깔 그늘이 한 칸 더 어둡게 한다)
  for (let y = Math.floor(cy); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (px.get(x, y) !== 0 && px.get(x, y + 1) === 0) px.set(x, y, ramp[k > 1 ? 1 : 0]);
    }
  }
}

/**
 * 겨울: 그림의 위쪽 면에 눈을 얹는다. 위가 비어 있는 점마다 거기서 아래로 depth점쯤을 눈빛으로 바꾼다.
 * 맨 윗줄(먹빛 테두리가 있던 줄)은 눈의 그늘빛으로 두어, 흰 눈밭 위에서도 그림의 윗선이 읽힌다.
 * 얇은 것을 통째로 눈으로 바꾸지는 않는다(눈 아래에 그림이 한 점은 남는다).
 */
export function snowCap(px: Px, snow: Ramp, depth: number, seed: number, k = 1): void {
  const src = px.d.slice();
  const { w, h } = px;
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : 0);
  const top = snow.length - 1;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (at(x, y) === 0 || at(x, y - 1) !== 0) continue;
      const d = Math.max(1, Math.round(depth * (0.5 + vnoise(x / (3.7 * k), y / (9 * k), seed) * 0.8)));
      for (let k = 0; k <= d; k++) {
        if (at(x, y + k) === 0 || at(x, y + k + 1) === 0) break;
        px.set(x, y + k, k === 0 ? snow[2] : k === d ? snow[top - 1] : snow[top]);
      }
    }
  }
}
