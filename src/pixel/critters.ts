// 짐승과 작은 것들: 닭, 병아리, 개, 소, 논 가는 소와 사람, 백로, 까치, 참새, 나비, 잠자리.
// 그리고 맵 위의 표시(깃발, 말풍선, 막힌 길, 누른 곳의 테, 화살표)와 날리는 것(꽃잎·가랑잎·눈, 비, 연기, 물빛, 바람결, 새 떼), 구름 그림자.
// 짐승은 왼쪽을 보는 옆모습으로 그리고, 오른쪽은 그림 벌이 뒤집어 쓴다.
//
// 모두 그림 점(ART — 맵 점의 반)으로 그렸다(그림 올리기 ② — spec 4.7.5). 크기·발치·장 수·장의 차례는 1-라 그대로(×2)다.
//   짐승: 꼴(Form)에 갈래를 적어 두고 빛 하나(왼쪽 위)로 둥글게 칠한다(paint — 단계는 띠로 나뉘고 섞음 무늬가 없다, ㄷ).
//         털·깃의 결은 이웃 단계로만 오르내리고(grain), 테두리는 사람과 같은 (나) 제 빛깔을 짙게 한 부드러운 테두리(softOutline).
//         먹빛은 눈동자 한 점에만 쓴다.
//   표시: 아이들이 찾아 누르는 것이라 1-라만큼 또렷하게 — 바깥 한 점은 따뜻한 짙은 밤빛, 그 안쪽 한 점은 제 빛의 한 단계 어두운 빛.
//   구름 그림자: 따뜻한 빛을 곱해 얹는 그림. 가장자리는 몇 단계에 걸쳐 흰빛 쪽으로 옅어진다.

import { CLOTH, type Palette, type Ramp } from './palette';
import { VILLAGERS, personFrame } from './people';
import { Px, clamp, hash2, hex, mix, vnoise, type Color } from './px';
import { WARM_DARK, calmSprite, softOutline, type RampIndex } from './wash';

const R = (...list: string[]): Ramp => list.map((s) => hex(s));

/** 눈동자(먹빛 — 짐승은 눈동자 한 점만 먹빛이어도 된다) */
const EYE = hex('#2a2422');

/** 글자 그림을 점 그림으로 옮긴다. '.'은 빈 점. 그림 점으로 새로 짠 작은 그림에 쓴다. */
function art(rows: readonly string[], key: Record<string, Color>): Px {
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Px(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = key[row[x]];
      if (c !== undefined) px.set(x, y, c);
    }
  });
  return px;
}

/** 점 여럿을 찍는다: [x, y, 빛] */
function dots(px: Px, list: readonly (readonly [number, number, Color])[]): void {
  for (const [x, y, c] of list) px.set(x, y, c);
}

export interface Critter {
  frames: Px[];
  ax: number;
  ay: number;
}

// ── 짐승의 빛깔 단계(어두움 → 밝음). 1-라의 빛을 단계로 이었다 ─────────────────
const HEN = R('#6f4a2a', '#96683a', '#c79a62', '#dcb27a', '#e9d2a6', '#f5e8cc');
const HEN_TAIL = R('#45342a', '#5a3c29', '#775038', '#9d6e4e');
const ROO = R('#4a3224', '#6a3a26', '#8e4a30', '#a84a34', '#bb533c');
/** 수탉의 목깃(누런 주황) */
const ROO_NECK = R('#9d6e4e', '#c59446', '#d3b15f', '#e1ba8f');
const ROO_HEAD = R('#a89474', '#cdbb98', '#e6d8b8', '#f4ead2');
const ROO_TAIL = R('#1a2428', '#24303a', '#3d5560', '#56707a');
/** 볏·턱볏(벌에 붉은빛이 적어 두 단계) */
const COMB = R('#84533b', '#bb533c');
const BEAK = R('#c59446', '#d9a027', '#e8bd4a');
const LEG = R('#8a6424', '#c99a3c', '#e0b85a');
const CHICK = R('#a8842a', '#d9b344', '#f2d766', '#faeaa0');
const DOG = R('#5e3e22', '#7d5630', '#a87a40', '#c99a5a', '#dcb577', '#e9cf98');
/** 누렁이의 가슴·배·꼬리의 흰 털 */
const DOG_PALE = R('#b89a6c', '#d6c196', '#ecd9b0', '#f6ead0');
const OX = R('#4a2c18', '#7a4a22', '#a56a2e', '#c98d42', '#e0b064', '#f0d49a');
const HORN = R('#8a7f6c', '#b8ab94', '#d9cfb8', '#efe6cf');
const MUZZLE = R('#b89a72', '#d8c39a', '#f2e2bd');
/** 발굽·코처럼 짙은 곳(먹빛이 아니라 따뜻한 밤빛) */
const HOOF = R('#2e2018', '#4a3426', '#6a4c36');
const EGRET = R('#a39b8c', '#c8c1b1', '#e6e0d3', '#f9f6ef');
const MAG = R('#1a1d24', '#262b35', '#343d4c', '#46505f');
const MAG_SHEEN = R('#26385c', '#2f4a7a', '#3f5f92', '#5a7aa8');
const MAG_WHITE = R('#bfbbb0', '#e2ddd0', '#f6f2e8');
const SPARROW = R('#4a2e1c', '#5c3a22', '#8a5a34', '#a87648', '#c4996a');
const SPARROW_PALE = R('#b0a080', '#c9b998', '#e9dcc0', '#f4ecd8');
const SPARROW_BEAK = hex('#6a5a48');
/** 쟁기·멍에의 나무(빛깔 벌의 나무와 같은 단계) */
const PLOW_WOOD = R('#38291f', '#523727', '#6f4a33', '#8d6344', '#ab8159', '#c8a174');
const IRON = R('#585b65', '#797a80', '#9c9b97', '#bfbbb0');

/** 짐승의 단계 표: 테두리(softOutline)가 곁의 빛의 가장 어두운 단계를 찾고, 결(grain)이 이웃 단계로 옮길 때 쓴다 */
function indexOf(list: readonly Ramp[]): RampIndex {
  const out: RampIndex = new Map();
  for (const ramp of list) ramp.forEach((c, i) => void (out.has(c) || out.set(c, [ramp, i])));
  return out;
}
const RAMPS = indexOf([
  HEN,
  HEN_TAIL,
  ROO,
  ROO_NECK,
  ROO_HEAD,
  ROO_TAIL,
  COMB,
  BEAK,
  LEG,
  CHICK,
  DOG,
  DOG_PALE,
  OX,
  HORN,
  MUZZLE,
  HOOF,
  EGRET,
  MAG,
  MAG_SHEEN,
  MAG_WHITE,
  SPARROW,
  SPARROW_PALE,
  PLOW_WOOD,
  IRON,
]);

// ── 꼴과 칠 ───────────────────────────────────────────────────

type Pt = readonly [number, number];

/** 짐승의 꼴: 점마다 갈래(1부터, 0은 빈 점)를 적어 둔다. 나중에 그린 것이 앞을 덮는다. */
class Form {
  readonly w: number;
  readonly h: number;
  readonly m: Uint8Array;
  /** 참이면 이미 찍힌 점의 갈래만 바꾼다(흰 배, 날개 무늬처럼 몸 안의 무늬) */
  inside = false;
  /** 꼴을 이만큼(그림 점) 넉넉하게 — 1-라의 먹빛 테두리 두 점 가운데 부드러운 테두리가 채우지 않는 한 점 몫 */
  grow = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.m = new Uint8Array(w * h);
  }

  put(x: number, y: number, id: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.inside && this.m[i] === 0) return;
    this.m[i] = id;
  }

  /** 타원(p가 2보다 크면 모가 난 타원). 점의 가운데가 안에 들면 찍는다. */
  oval(cx: number, cy: number, rx0: number, ry0: number, id: number, p = 2): void {
    const rx = rx0 + this.grow;
    const ry = ry0 + this.grow;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = Math.abs((x + 0.5 - cx) / rx);
        const dy = Math.abs((y + 0.5 - cy) / ry);
        if ((p === 2 ? dx * dx + dy * dy : Math.pow(dx, p) + Math.pow(dy, p)) <= 1) this.put(x, y, id);
      }
    }
  }

  /** 굵기가 r0 → r1로 바뀌며 이어지는 붓질(끝이 둥글다) */
  path(pts: readonly Pt[], r0: number, r1: number, id: number): void {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay) || 1e-6;
      const ra = r0 + ((r1 - r0) * run) / (total || 1) + this.grow;
      const rb = r0 + ((r1 - r0) * (run + len)) / (total || 1) + this.grow;
      run += len;
      const rr = Math.max(ra, rb) + 1;
      for (let y = Math.floor(Math.min(ay, by) - rr); y <= Math.ceil(Math.max(ay, by) + rr); y++) {
        for (let x = Math.floor(Math.min(ax, bx) - rr); x <= Math.ceil(Math.max(ax, bx) + rr); x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const t = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len), 0, 1);
          const r = ra + (rb - ra) * t;
          if (Math.hypot(px - ax - (bx - ax) * t, py - ay - (by - ay) * t) <= r) this.put(x, y, id);
        }
      }
    }
  }

  /** 다각형(점의 가운데가 안에 들면 찍는다) */
  poly(pts: readonly Pt[], id: number): void {
    const ys = pts.map((p) => p[1]);
    const xs = pts.map((p) => p[0]);
    const g = this.grow;
    for (let y = Math.floor(Math.min(...ys) - g); y <= Math.ceil(Math.max(...ys) + g); y++) {
      for (let x = Math.floor(Math.min(...xs) - g); x <= Math.ceil(Math.max(...xs) + g); x++) {
        if (inPoly(pts, x + 0.5, y + 0.5) || (g > 0 && distToPoly(pts, x + 0.5, y + 0.5) <= g)) this.put(x, y, id);
      }
    }
  }
}

function inPoly(pts: readonly Pt[], qx: number, qy: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > qy !== yj > qy && qx < ((xj - xi) * (qy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 갈래 하나의 칠: 쓰는 단계(lo ~ hi), 오른쪽 아래 가장자리의 그늘 골 단계(rim), 밝기 덧셈(bias) */
interface Coat {
  ramp: Ramp;
  lo?: number;
  hi?: number;
  rim?: number;
  bias?: number;
}

interface PaintOpts {
  /** 둥근 정도: 가장자리에서 이만큼(그림 점) 안쪽까지 둥글게 솟는다 */
  D: number;
  seed: number;
  /** 단계의 경계를 구불게 하는 세기 */
  wob?: number;
  /** 위는 밝고 아래(배)는 어둡게 하는 세기 */
  vg?: number;
}

/**
 * 꼴을 빛 하나(왼쪽 위)로 칠한다. 빈 점까지의 거리로 둥근 언덕을 세우고, 그 기울기로 빛을 받는 정도를 셈한다(wash.ts의 ball과 같은 빛).
 * 갈래가 달라도 언덕은 하나라 이음매(목, 다리의 뿌리)에서 빛이 끊기지 않는다. 단계는 띠로 나뉘고, 띠의 경계는 느린 무늬로 조금 구불다.
 */
function paint(px: Px, f: Form, coats: readonly Coat[], o: PaintOpts): void {
  const { w, h, m } = f;
  const D = o.D;
  const reach = Math.ceil(D) + 1;
  const dist = new Float32Array(w * h);
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      let best = D;
      for (let j = -reach; j <= reach; j++) {
        for (let i = -reach; i <= reach; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) continue;
          const d = Math.sqrt(i * i + j * j) - 0.5;
          if (d < best) best = d;
        }
      }
      dist[y * w + x] = best;
    }
  }
  const hill = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h || !m[y * w + x]) return 0;
    const t = 1 - Math.min(dist[y * w + x], D) / D;
    return D * (1 - t * t);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = m[y * w + x];
      if (!id) continue;
      const c = coats[id - 1];
      const gx = (hill(x + 1, y) - hill(x - 1, y)) / 2;
      const gy = (hill(x, y + 1) - hill(x, y - 1)) / 2;
      const len = Math.hypot(gx, gy, 1);
      const nx = -gx / len;
      const ny = -gy / len;
      const nz = 1 / len;
      const light = -0.5 * nx - 0.62 * ny + 0.6 * nz;
      let t = 0.42 + 0.62 * light + (c.bias ?? 0) + (o.vg ?? 0) * (0.5 - (y - y0) / Math.max(1, y1 - y0));
      t += (vnoise(x / 3.3, y / 2.7, o.seed) - 0.5) * (o.wob ?? 0.12);
      const lo = c.lo ?? 1;
      const hi = c.hi ?? c.ramp.length - 1;
      let k = lo + Math.floor(clamp(t, 0, 0.999) * (hi - lo + 1));
      // 오른쪽 아래 가장자리 한 점은 그늘 골
      if (dist[y * w + x] < 1 && nx + ny > 0.3) k = c.rim ?? 0;
      px.set(x, y, c.ramp[clamp(k, 0, c.ramp.length - 1)]);
    }
  }
}

/**
 * 털·깃의 결: 결 방향(sx × sy)으로 길쭉한 무늬로 단계를 한 칸 오르내린다(이웃 단계로만 — ㄷ). 밝게 옮기는 쪽이 많다(ㅎ).
 * keep이 있으면 그 점만.
 */
function grain(px: Px, seed: number, sx: number, sy: number, keep?: (x: number, y: number) => boolean, up = 0.64, down = 0.27): void {
  const { w, h, d } = px;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = d[y * w + x];
      if (c >>> 24 !== 255 || (keep && !keep(x, y))) continue;
      const info = RAMPS.get(c);
      if (!info) continue;
      const n = vnoise(x / sx, y / sy, seed) * 0.72 + vnoise(x / (sx * 0.5), y / (sy * 0.6), seed + 7) * 0.28;
      const step = n > up ? 1 : n < down ? -1 : 0;
      if (step) d[y * w + x] = info[0][clamp(info[1] + step, 0, info[0].length - 1)];
    }
  }
}

/** 짐승 한 장의 마무리: 외톨이 점 고르기 → (눈·부리 같은 작은 것을 얹고) → 제 빛깔을 짙게 한 부드러운 테두리 */
function critterFinish(px: Px, details: () => void): Px {
  // 벌에 맞춘 뒤의 대비로도 외톨이가 남지 않게 문턱을 조금 낮춘다
  calmSprite(px, 0.1);
  details();
  softOutline(px, RAMPS);
  return px;
}

// ── 닭 ───────────────────────────────────────────────────────
// 1-라의 꼴(섬·걸음·쪼기)을 그림 점으로. 몸·머리는 둥근 덩어리, 꽁지는 치켜든 깃, 볏·부리·턱볏은 점으로.

type HenPose = 'stand' | 'step' | 'peck';

function henFrame(rooster: boolean, pose: HenPose): Px {
  const W = 28;
  const H = 24;
  const px = new Px(W, H);
  const f = new Form(W, H);
  const peck = pose === 'peck';
  const coats: Coat[] = rooster
    ? [
        { ramp: ROO, lo: 2, hi: 4, rim: 1 }, // 1 몸(붉은 밤빛)
        { ramp: ROO_HEAD, lo: 1, hi: 3, rim: 0 }, // 2 머리
        { ramp: ROO_TAIL, lo: 1, hi: 3, rim: 0 }, // 3 꽁지
        { ramp: ROO, lo: 1, hi: 2, rim: 0 }, // 4 날개
        { ramp: ROO_NECK, lo: 1, hi: 3, rim: 0 }, // 5 목깃
      ]
    : [
        { ramp: HEN, lo: 1, hi: 4, rim: 0, bias: -0.1 },
        { ramp: HEN, lo: 3, hi: 4, rim: 2 },
        { ramp: HEN_TAIL, lo: 1, hi: 3, rim: 0 },
        { ramp: HEN, lo: 1, hi: 2, rim: 0 },
        { ramp: HEN, lo: 3, hi: 4, rim: 2 },
      ];
  f.grow = 0.5;
  if (peck) {
    f.oval(21, 8.2, 2.7, 3.8, 3);
    if (rooster) f.path([[19.6, 9], [21.6, 4.6], [24.2, 3.4]], 1.4, 0.6, 3);
    f.oval(15.6, 11.8, 6.7, 4.3, 1);
    f.oval(16.8, 11.4, 3.8, 2.3, 4);
    f.oval(10.4, 12.4, 3.4, 3.1, 5);
    f.oval(6.8, 12.6, 3.6, 3.0, 2);
  } else {
    f.oval(20.9, 10.4, 2.9, 4.5, 3);
    if (rooster) f.path([[19.8, 11.4], [21.8, 5.6], [24.4, 4.4]], 1.5, 0.6, 3);
    f.oval(13.9, 13.9, 8.4, 4.6, 1);
    f.oval(15.6, 13.7, 4.7, 2.5, 4);
    f.oval(10.2, 10.6, 3.8, 3.6, 5);
    f.oval(7.9, 6.9, 3.7, 3.2, 2);
  }
  paint(px, f, coats, { D: 4, seed: rooster ? 11 : 7, vg: 0.22 });
  // 깃의 결(가로로 짧게)
  grain(px, rooster ? 13 : 5, 2.4, 1.3);
  const wing = coats[3].ramp;
  return critterFinish(px, () => {
    const [c0, c1] = COMB;
    const b = BEAK;
    if (peck) {
      // 볏(숙인 머리 위), 부리는 땅을 쫀다
      if (rooster) dots(px, [[5, 7, c1], [5, 8, c1], [7, 7, c1], [7, 8, c1], [9, 8, c1], [4, 9, c1], [5, 9, c1], [6, 9, c1], [7, 9, c1], [8, 9, c1], [9, 9, c0], [10, 9, c0]]);
      else dots(px, [[7, 8, c1], [8, 8, c1], [6, 9, c1], [7, 9, c1], [8, 9, c1], [9, 9, c0]]);
      dots(px, [[2, 14, b[2]], [3, 14, b[2]], [2, 15, b[1]], [3, 15, b[1]], [3, 16, b[0]]]);
      if (rooster) dots(px, [[5, 15, c1], [6, 15, c1], [5, 16, c0], [6, 16, c0]]);
      px.set(5, 12, EYE);
      // 날개 끝
      dots(px, [[19, 13, wing[1]], [20, 13, wing[1]], [20, 12, wing[1]]]);
    } else {
      if (rooster) dots(px, [[5, 1, c1], [5, 2, c1], [7, 1, c1], [7, 2, c1], [9, 1, c1], [9, 2, c1], [4, 3, c1], [5, 3, c1], [6, 2, c1], [6, 3, c1], [7, 3, c1], [8, 2, c1], [8, 3, c1], [9, 3, c0], [10, 3, c0], [10, 2, c0]]);
      else dots(px, [[7, 2, c1], [8, 2, c1], [6, 3, c1], [7, 3, c1], [8, 3, c1], [9, 3, c0]]);
      dots(px, [[2, 6, b[2]], [3, 6, b[2]], [2, 7, b[1]], [3, 7, b[1]]]);
      if (rooster) dots(px, [[4, 8, c1], [5, 8, c1], [4, 9, c1], [5, 9, c0], [4, 10, c0]]);
      else dots(px, [[4, 8, c1], [4, 9, c0], [5, 9, c0]]);
      px.set(6, 6, EYE);
      // 날개의 깃 끝(아래로 한 줄)
      dots(px, [[12, 15, wing[1]], [13, 16, wing[1]], [14, 16, wing[1]], [15, 16, wing[1]], [16, 16, wing[1]], [17, 15, wing[1]], [18, 15, wing[1]], [19, 14, wing[1]]]);
    }
    // 다리와 발가락
    const l = LEG;
    if (pose === 'step') {
      dots(px, [[10, 18, l[1]], [9, 19, l[1]], [9, 20, l[1]], [6, 21, l[2]], [7, 21, l[1]], [8, 21, l[1]], [9, 21, l[1]], [10, 21, l[0]]]);
      dots(px, [[17, 18, l[1]], [17, 19, l[1]], [18, 20, l[1]], [16, 21, l[2]], [17, 21, l[1]], [18, 21, l[1]], [19, 21, l[0]]]);
    } else {
      const top = peck ? 16 : 18;
      for (let y = top; y <= 20; y++) {
        px.set(10, y, l[1]);
        px.set(16, y, l[1]);
      }
      dots(px, [[8, 21, l[2]], [9, 21, l[1]], [10, 21, l[1]], [11, 21, l[0]], [14, 21, l[2]], [15, 21, l[1]], [16, 21, l[1]], [17, 21, l[0]]]);
    }
  });
}

function henLike(rooster: boolean): Critter {
  return { frames: (['stand', 'step', 'peck'] as const).map((pose) => henFrame(rooster, pose)), ax: 12, ay: 22 };
}

export const hen = (): Critter => henLike(false);
export const rooster = (): Critter => henLike(true);

export function chick(): Critter {
  const frames = [0, 1].map((k) => {
    const px = new Px(14, 14);
    const f = new Form(14, 14);
    f.grow = 0.5;
    f.oval(7.9, 8.0, 4.1, 2.7, 1);
    f.oval(9.4, 7.8, 2.4, 1.5, 3);
    f.oval(5.6, 5.0, 2.9, 2.7, 2);
    paint(px, f, [{ ramp: CHICK, lo: 1, hi: 3, rim: 0 }, { ramp: CHICK, lo: 2, hi: 3, rim: 1 }, { ramp: CHICK, lo: 1, hi: 2, rim: 0 }], { D: 3, seed: 21 + k, vg: 0.15 });
    return critterFinish(px, () => {
      dots(px, [[2, 4, BEAK[1]], [2, 5, BEAK[1]], [3, 5, BEAK[0]]]);
      px.set(4, 4, EYE);
      const l = LEG;
      if (k === 0) dots(px, [[5, 10, l[1]], [5, 11, l[1]], [4, 11, l[2]], [9, 10, l[1]], [9, 11, l[1]], [8, 11, l[2]]]);
      else dots(px, [[4, 10, l[1]], [3, 11, l[1]], [2, 11, l[2]], [9, 10, l[1]], [9, 11, l[1]], [8, 11, l[2]]]);
    });
  });
  return { frames, ax: 6, ay: 12 };
}

// ── 개(누렁이) ────────────────────────────────────────────────
// 섬, 걸음 둘, 꼬리 흔듦. 쫑긋한 귀, 짧은 주둥이, 흰 가슴과 배, 말려 올라간 꼬리.

type Leg4 = readonly [number, number, number, number];

function dogFrame(legs: { near: Leg4; far: Leg4 }, tail: readonly Pt[]): Px {
  const W = 44;
  const H = 26;
  const px = new Px(W, H);
  const f = new Form(W, H);
  const coats: Coat[] = [
    { ramp: DOG, lo: 1, hi: 3, rim: 0, bias: -0.1 }, // 1 몸
    { ramp: DOG, lo: 2, hi: 4, rim: 1, bias: -0.16 }, // 2 머리
    { ramp: DOG_PALE, lo: 0, hi: 2, rim: 0 }, // 3 흰 털
    { ramp: DOG, lo: 0, hi: 2, rim: 0 }, // 4 귀
    { ramp: DOG, lo: 2, hi: 5, rim: 1 }, // 5 꼬리(몸보다 밝은 털)
    { ramp: DOG, lo: 1, hi: 2, rim: 0 }, // 6 먼 다리
    { ramp: DOG, lo: 2, hi: 3, rim: 1 }, // 7 가까운 다리
    { ramp: DOG, lo: 0, hi: 1, rim: 0 }, // 8 발
  ];
  // 다리: near(가까운 쪽)·far(먼 쪽) 모두 [앞다리 뿌리, 앞발, 뒷다리 뿌리, 뒷발]의 x
  const leg = (top: number, foot: number, r0: number, id: number): void => {
    f.grow = 0;
    f.path([[top, 14.6], [foot, 21.2]], r0, 1.4, id);
    f.oval(foot - 0.3, 22.6, 2.0, 1.25, 8);
  };
  leg(legs.far[0], legs.far[1], 1.7, 6);
  leg(legs.far[2], legs.far[3], 2.1, 6);
  f.grow = 0.3;
  f.path(tail, 1.9, 1.0, 5);
  f.grow = 0.7;
  f.oval(22.2, 13.5, 14.4, 4.4, 1, 2.6);
  f.oval(10.8, 12.4, 4.2, 4.3, 1);
  leg(legs.near[0], legs.near[1], 1.9, 7);
  leg(legs.near[2], legs.near[3], 2.5, 7);
  // 머리: 둥근 머리통 앞으로 주둥이가 나오고, 귀는 쫑긋 선다
  f.grow = 0.5;
  f.oval(9.4, 7.2, 4.5, 3.6, 2);
  f.oval(4.4, 10.1, 3.0, 1.9, 2);
  f.grow = 0;
  f.poly([[4.6, 5.4], [6.2, 0.8], [9.8, 4.4]], 4);
  // 흰 가슴과 배
  f.inside = true;
  f.oval(6.2, 13.6, 2.4, 2.6, 3);
  f.oval(19.4, 18.6, 7.4, 1.1, 3);
  f.inside = false;
  paint(px, f, coats, { D: 4, seed: 31, vg: 0.3 });
  // 털의 결(몸을 따라 가로로 가늘게)
  grain(px, 33, 2.2, 0.9, (_x, y) => y < 19, 0.72, 0.2);
  return critterFinish(px, () => {
    px.set(6, 7, EYE);
    dots(px, [[1, 9, HOOF[0]], [2, 9, HOOF[0]], [1, 10, HOOF[1]], [3, 11, DOG[1]], [4, 11, DOG[1]], [5, 11, DOG[1]]]);
  });
}

export function dog(): Critter {
  const tailUp: Pt[] = [[33.6, 11.2], [35.4, 6.8], [37, 3.6], [36.4, 2.2]];
  const stand = { near: [9.8, 9.6, 27.2, 27.8], far: [15.8, 15.6, 33.2, 33.8] } as const;
  const walk1 = { near: [9.4, 6.0, 26.6, 23.8], far: [17.6, 17.8, 35, 36] } as const;
  const walk2 = { near: [11.6, 11.8, 25.8, 25.8], far: [17.6, 17.8, 31.6, 32] } as const;
  const frames = [
    dogFrame(stand, tailUp),
    dogFrame(walk1, tailUp),
    dogFrame(walk2, [[33.6, 11.2], [36, 7], [38.4, 3.8], [38.6, 2.2]]),
    dogFrame(stand, [[33.4, 11.2], [34.6, 6.8], [35.4, 3.6], [34.6, 2.2]]),
  ];
  return { frames, ax: 20, ay: 24 };
}

// ── 소(누렁소) ────────────────────────────────────────────────
// 왼쪽을 보는 옆모습. 위로 굽은 두 뿔, 넓고 밝은 주둥이, 목덜미의 혹, 곧은 등과 모난 엉덩이뼈, 가는 다리와 술 달린 꼬리.

/** 소의 몸(테두리 없이, 76×40 그림 점). frame 1은 걸음과 꼬리를 한 번 치는 모습이다. */
function oxBody(frame: number): Px {
  const W = 76;
  const H = 40;
  const px = new Px(W, H);
  const f = new Form(W, H);
  const coats: Coat[] = [
    { ramp: OX, lo: 1, hi: 4, rim: 1, bias: -0.32 }, // 1 몸
    { ramp: OX, lo: 1, hi: 2, rim: 0 }, // 2 먼 다리
    { ramp: OX, lo: 2, hi: 3, rim: 1 }, // 3 가까운 다리
    { ramp: HOOF, lo: 0, hi: 2, rim: 0 }, // 4 발굽
    { ramp: MUZZLE, lo: 0, hi: 2, rim: 0 }, // 5 주둥이
    { ramp: HORN, lo: 1, hi: 3, rim: 1 }, // 6 뿔
    { ramp: OX, lo: 1, hi: 3, rim: 0 }, // 7 꼬리
    { ramp: OX, lo: 0, hi: 1, rim: 0 }, // 8 꼬리 술
    { ramp: OX, lo: 2, hi: 4, rim: 1 }, // 9 귀
    { ramp: OX, lo: 1, hi: 4, rim: 1, bias: -0.18 }, // 10 머리
  ];
  const walk = frame === 1;
  const leg = (pts: readonly Pt[], r0: number, id: number): void => {
    f.grow = 0;
    f.path(pts, r0, 1.7, id);
    const [hx] = pts[pts.length - 1];
    f.oval(hx + 0.2, 38.6, 2.1, 1.25, 4);
  };
  // 먼 쪽 다리
  if (walk) {
    leg([[31, 24], [33.4, 31], [35.6, 37]], 2.6, 2);
    leg([[68, 22], [70.4, 30], [72.4, 37]], 3.1, 2);
  } else {
    leg([[31, 24], [31.4, 37]], 2.6, 2);
    leg([[68, 22], [69.6, 30], [69.2, 37]], 3.1, 2);
  }
  // 꼬리와 술
  f.grow = 0;
  if (walk) {
    f.path([[69.5, 10.5], [72, 12.6], [73.2, 17.5], [73.6, 22]], 1.1, 0.8, 7);
    f.oval(73.6, 24.4, 1.5, 2.4, 8);
  } else {
    f.path([[69.5, 10.5], [71.8, 12.6], [72.6, 18], [72.8, 23]], 1.1, 0.8, 7);
    f.oval(72.9, 25.4, 1.6, 2.6, 8);
  }
  // 몸: 곧은 등, 목덜미의 혹, 모난 엉덩이, 처진 목살
  f.grow = 0.7;
  f.poly(
    [
      [21, 8.6],
      [27, 5.2],
      [31, 3.8],
      [36, 4],
      [40, 6],
      [64, 6],
      [68.4, 7.4],
      [70, 10],
      [70, 22.6],
      [68.2, 27.4],
      [20, 27.4],
      [16, 23.6],
      [12.6, 20.4],
      [14, 13.6],
    ],
    1,
  );
  // 머리: 넓은 이마에서 주둥이로 좁아지며 내려온다
  f.poly(
    [
      [7.6, 6.4],
      [20.4, 6.4],
      [23.4, 9],
      [23, 14],
      [17, 18.6],
      [11.6, 20.6],
      [6, 21.6],
      [1.6, 21.6],
      [0.6, 18],
      [0.8, 13.6],
      [2.6, 9.6],
      [4.6, 7.6],
    ],
    10,
  );
  f.grow = 0.4;
  f.oval(3.4, 17.4, 3.2, 3.8, 5);
  // 가까운 쪽 다리
  if (walk) {
    leg([[21, 24], [18.6, 31], [16, 37]], 2.8, 3);
    leg([[59.4, 22], [57.2, 30], [54, 37]], 3.6, 3);
  } else {
    leg([[23, 24], [23.4, 37]], 2.8, 3);
    leg([[60.4, 22], [62, 30.4], [61.4, 37]], 3.6, 3);
  }
  // 귀와 뿔(1-라처럼 짧게 위로 굽은 뿔)
  f.grow = 0;
  f.path([[8.6, 8.4], [5.6, 7.8], [3.6, 7.0]], 1.5, 1.0, 9);
  f.path([[20.2, 8.0], [23, 7.0]], 1.3, 1.0, 9);
  f.path([[11.4, 6.6], [10, 3.6], [9.2, 1.4]], 1.1, 0.6, 6);
  f.path([[16.6, 6.6], [18, 3.6], [18.8, 1.4]], 1.1, 0.6, 6);
  // 몸의 큰 결은 잔잔하게(얼룩져 보이지 않게 — Review 권고 11): 단계의 경계를 구불리는 무늬를 반으로, 털의 결은 밝게·어둡게 옮기는 문턱을 한 걸음씩 멀리
  paint(px, f, coats, { D: 8, seed: 41 + frame, vg: 0.34, wob: 0.06 });
  // 털의 결(가로로 가늘게) — 다리·주둥이·뿔은 빼고
  grain(px, 43, 2.6, 0.9, (x, y) => y < 28 && x > 7, 0.8, 0.13);
  calmSprite(px, 0.1);
  // 엉덩이뼈와 어깨(혹)의 빛, 눈, 콧구멍과 입
  dots(px, [[60, 9, OX[5]], [61, 9, OX[5]], [62, 9, OX[4]], [61, 10, OX[4]], [27, 7, OX[5]], [28, 7, OX[4]], [27, 8, OX[4]]]);
  dots(px, [[6, 10, EYE], [7, 10, OX[0]], [6, 11, OX[0]], [5, 9, OX[1]], [6, 9, OX[1]]]);
  dots(px, [[2, 16, HOOF[1]], [3, 16, HOOF[0]], [1, 20, MUZZLE[0]], [2, 20, MUZZLE[0]], [3, 20, MUZZLE[0]]]);
  return px;
}

export function ox(): Critter {
  const frames = [0, 1].map((k) => {
    const px = new Px(78, 44);
    px.blit(oxBody(k), 2, 2);
    softOutline(px, RAMPS);
    return px;
  });
  return { frames, ax: 40, ay: 42 };
}

/** 두 점 사이에 나란한 줄을 빛깔 수만큼 긋는다(위·왼쪽이 밝다). 가파르면 옆으로, 눕으면 아래로 잇는다. */
function beam(px: Px, x0: number, y0: number, x1: number, y1: number, colors: readonly Color[]): void {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  colors.forEach((c, i) => (steep ? px.line(x0 + i, y0, x1 + i, y1, c) : px.line(x0, y0 + i, x1, y1 + i, c)));
}

/** 논을 가는 소와 사람(쟁기). 왼쪽으로 간다. */
export function plowTeam(): Critter {
  const frames = [0, 1].map((f) => {
    const px = new Px(156, 68);
    px.blit(oxBody(f), 2, 24);
    // 멍에와 쟁기: 소의 어깨에서 뒤로 뻗은 긴 나무, 땅으로 내려가는 쟁기 몸, 사람이 잡는 손잡이, 땅에 박힌 보습
    const w = PLOW_WOOD;
    beam(px, 26, 30, 92, 46, [w[4], w[3], w[1]]);
    beam(px, 92, 46, 104, 60, [w[3], w[2], w[1]]);
    beam(px, 104, 58, 116, 34, [w[5], w[4], w[2]]);
    dots(px, [
      [100, 61, IRON[3]],
      [101, 61, IRON[2]],
      [100, 62, IRON[2]],
      [101, 62, IRON[2]],
      [102, 62, IRON[1]],
      [101, 63, IRON[1]],
      [102, 63, IRON[0]],
      [103, 63, IRON[0]],
    ]);
    softOutline(px, RAMPS);
    // 쟁기를 잡은 사람(테두리는 personFrame이 이미 둘렀다)
    px.blit(personFrame(VILLAGERS.plowman, 'left', 'walk', f * 2 + 1), 100, 4);
    return px;
  });
  return { frames, ax: 76, ay: 64 };
}

// ── 물새(백로) ────────────────────────────────────────────────
// 얕은 물에 서서 가끔 고개를 숙인다(발치는 다리 중간 — 물에 잠긴다).
export function egret(): Critter {
  const frames = [0, 1].map((k) => {
    const px = new Px(24, 32);
    const f = new Form(24, 32);
    f.grow = 0.5;
    const down = k === 1;
    f.grow = 0.7;
    f.oval(14.4, 18.4, 6.4, 3.4, 1);
    f.grow = 0.5;
    f.path([[17.6, 17.6], [21.8, 19.4]], 1.9, 0.8, 2);
    if (down) {
      f.path([[6.8, 9.4], [8.6, 12], [11, 14.2], [13, 15.6]], 1.3, 1.8, 1);
      f.oval(5.6, 8.2, 2.4, 2.1, 1);
    } else {
      f.path([[8.6, 6.4], [8.8, 9.4], [10.6, 12.4], [12.8, 15.2]], 1.3, 1.8, 1);
      f.oval(7.9, 4.9, 2.5, 2.2, 1);
    }
    paint(px, f, [{ ramp: EGRET, lo: 1, hi: 3, rim: 0 }, { ramp: EGRET, lo: 0, hi: 1, rim: 0 }], { D: 3, seed: 51 + k, vg: 0.15 });
    grain(px, 53, 2.2, 1.4, (_x, y) => y > 14);
    return critterFinish(px, () => {
      const b = BEAK;
      if (down) {
        dots(px, [[3, 9, b[1]], [2, 10, b[2]], [3, 10, b[0]], [2, 11, b[1]], [2, 12, b[0]]]);
        px.set(5, 7, EYE);
      } else {
        dots(px, [[2, 4, b[2]], [3, 4, b[1]], [4, 4, b[1]], [5, 4, b[1]], [4, 5, b[0]], [5, 5, b[0]]]);
        px.set(8, 4, EYE);
      }
      for (let y = 22; y <= 29; y++) {
        px.set(12, y, HOOF[1]);
        px.set(16, y, HOOF[1]);
      }
    });
  });
  return { frames, ax: 12, ay: 26 };
}

// ── 까치 ─────────────────────────────────────────────────────
// 검은 몸에 푸른 윤, 흰 배와 날개의 흰 깃, 긴 꽁지(3.1차 시안의 까치). 섬, 뜀, 날갯짓 둘.
export function magpie(): Critter {
  const poses = ['stand', 'hop', 'up', 'down'] as const;
  const frames = poses.map((pose) => {
    const px = new Px(22, 18);
    const f = new Form(22, 18);
    f.grow = 0.5;
    const coats: Coat[] = [
      { ramp: MAG, lo: 0, hi: 3, rim: 0 }, // 1 몸
      { ramp: MAG_WHITE, lo: 0, hi: 2, rim: 0 }, // 2 흰 깃
      { ramp: MAG_SHEEN, lo: 0, hi: 2, rim: 0 }, // 3 푸른 윤
      { ramp: MAG, lo: 0, hi: 2, rim: 0 }, // 4 꽁지·날개
    ];
    const flying = pose === 'up' || pose === 'down';
    if (flying) {
      f.path([[15, 7.6], [18, 7.4], [21, 7.2]], 1.3, 1.0, 4);
      f.oval(10.8, 7.8, 6.2, 2.3, 1);
      f.oval(5.4, 7.2, 2.6, 2.3, 1);
      if (pose === 'up') {
        f.poly([[8, 8.4], [9, 4], [11.4, 1.4], [15.8, 2.2], [14.4, 5.2], [12.6, 8.4]], 4);
        f.inside = true;
        f.grow = 0;
        f.poly([[8, 8.4], [9, 4], [11.4, 1.4], [12.8, 1.6], [11, 5.4], [10.4, 8.4]], 3);
      } else {
        f.poly([[7, 8.4], [12.6, 8.4], [14.2, 10.2], [12.6, 13.8], [9.4, 13.6], [7.8, 11]], 4);
        f.inside = true;
        f.grow = 0;
        f.poly([[7, 8.4], [9.4, 8.4], [10.6, 13.8], [9.4, 13.6], [7.6, 10.6]], 3);
      }
      f.grow = 0;
      f.oval(10.6, 8.4, 2.6, 1.4, 2);
      f.inside = false;
    } else {
      f.path([[14, 10.2], [17.6, 11.4], [21, 12.6]], 1.6, 1.0, 4);
      f.oval(10.6, 9.6, 5.1, 3.6, 1);
      f.oval(7.0, 5.3, 3.1, 2.7, 1);
      f.inside = true;
      f.grow = 0;
      f.oval(12.6, 9.4, 3.3, 2.1, 3);
      f.oval(11.6, 7.6, 2.4, 0.9, 2);
      f.oval(8.0, 11.2, 2.7, 2.3, 2);
      f.inside = false;
    }
    paint(px, f, coats, { D: 3, seed: 61, vg: 0.1 });
    return critterFinish(px, () => {
      const beak = HOOF[1];
      if (flying) {
        dots(px, [[1, 7, beak], [2, 7, beak], [2, 6, beak]]);
        px.set(4, 6, MAG_WHITE[0]);
      } else {
        dots(px, [[2, 5, beak], [3, 5, beak], [3, 4, beak]]);
        px.set(6, 4, MAG_WHITE[0]);
        const l = HOOF[1];
        if (pose === 'stand') dots(px, [[9, 14, l], [9, 15, l], [8, 15, l], [12, 14, l], [12, 15, l], [11, 15, l]]);
        else dots(px, [[8, 14, l], [7, 15, l], [6, 15, l], [13, 14, l], [14, 15, l], [13, 15, l]]);
      }
    });
  });
  return { frames, ax: 10, ay: 16 };
}

// ── 참새 ─────────────────────────────────────────────────────
// 가을 타작 마당의 낟알에 모여든다. 까치처럼 다가가면 날아오른다(장의 차례도 까치와 같다: 섬, 쪼기, 날갯짓 둘).
export function sparrow(): Critter {
  const poses = ['stand', 'peck', 'up', 'down'] as const;
  const frames = poses.map((pose) => {
    const px = new Px(18, 14);
    const f = new Form(18, 14);
    f.grow = 0.5;
    const coats: Coat[] = [
      { ramp: SPARROW, lo: 2, hi: 4, rim: 1 }, // 1 몸
      { ramp: SPARROW_PALE, lo: 1, hi: 3, rim: 0 }, // 2 흰 배·뺨
      { ramp: SPARROW, lo: 0, hi: 2, rim: 0 }, // 3 등·날개·꽁지
      { ramp: SPARROW, lo: 2, hi: 4, rim: 1 }, // 4 머리
    ];
    if (pose === 'stand') {
      f.path([[12, 8.6], [15.8, 9.6]], 1.3, 0.9, 3);
      f.oval(9.8, 7.9, 4.5, 2.7, 1);
      f.oval(6.2, 4.8, 2.6, 2.4, 4);
      f.inside = true;
      f.grow = 0;
      f.oval(11.4, 7.0, 3.0, 1.6, 3);
      f.oval(7.6, 9.2, 2.6, 1.6, 2);
      f.oval(4.8, 6.4, 1.2, 0.8, 2);
      f.inside = false;
    } else if (pose === 'peck') {
      f.path([[12.6, 6.4], [15.8, 6.6]], 1.3, 0.9, 3);
      f.oval(9.8, 6.8, 4.8, 2.4, 1);
      f.oval(5.4, 6.8, 2.5, 2.1, 4);
      f.inside = true;
      f.grow = 0;
      f.oval(10.8, 5.8, 3.2, 1.4, 3);
      f.oval(6.4, 8.6, 1.8, 1.2, 2);
      f.inside = false;
    } else {
      f.path([[13, 7.0], [16, 7.2]], 1.2, 0.9, 3);
      f.oval(10, 7.0, 5.2, 1.9, 1);
      f.oval(5.6, 6.2, 2.4, 2.1, 4);
      if (pose === 'up') f.poly([[8, 6.4], [8.6, 2], [11.8, 1.4], [12.6, 4], [11.6, 6.4]], 3);
      else f.poly([[8, 7.4], [12.2, 7.4], [12.6, 10.2], [10.4, 11.8], [8.4, 10.2]], 3);
      f.inside = true;
      f.grow = 0;
      f.oval(8.2, 8.2, 2.4, 1.1, 2);
      f.inside = false;
    }
    paint(px, f, coats, { D: 2.5, seed: 71, vg: 0.1 });
    // 등의 줄무늬(참새의 갈색 결)
    grain(px, 73, 1.6, 1.0, (x, y) => x > 8 && y < 9, 0.6, 0.3);
    return critterFinish(px, () => {
      const b = SPARROW_BEAK;
      const l = SPARROW_BEAK;
      if (pose === 'stand') {
        dots(px, [[2, 5, b], [3, 5, b], [3, 4, b]]);
        px.set(5, 4, EYE);
        dots(px, [[7, 10, l], [7, 11, l], [6, 11, l], [10, 10, l], [10, 11, l], [9, 11, l]]);
      } else if (pose === 'peck') {
        dots(px, [[2, 7, b], [3, 7, b], [2, 8, b]]);
        px.set(4, 6, EYE);
        // 1-라의 쪼는 모습은 발이 땅에서 한 점 떠 있었다 — 다리를 땅까지 내린다
        dots(px, [[8, 9, l], [8, 10, l], [8, 11, l], [7, 11, l], [12, 9, l], [12, 10, l], [12, 11, l], [11, 11, l]]);
      } else {
        dots(px, [[2, 6, b], [3, 6, b], [3, 5, b]]);
        px.set(5, 5, EYE);
      }
    });
  });
  return { frames, ax: 8, ay: 12 };
}

export function butterfly(tone: 'white' | 'yellow'): Critter {
  const c = tone === 'white' ? hex('#fbf8ee') : hex('#f4d653');
  const e = tone === 'white' ? hex('#ffffff') : hex('#fbe98a');
  const d = tone === 'white' ? hex('#cfc8b6') : hex('#c99a2a');
  const k = HOOF[1];
  const key = { c, e, d, k };
  const open = art(['ee......ee', 'ecc....cce', '.ccckkccc.', '..cckkcd..', '..ddkkdd..', '.ddd..ddd.', '..d....d..', '..........'], key);
  const shut = art(['..........', '..........', '..ec..ec..', '..cc..cc..', '..cckkcd..', '..ddkkdd..', '....kk....', '....dd....'], key);
  return { frames: [open, shut], ax: 4, ay: 4 };
}

// ── 날리는 것 ─────────────────────────────────────────────────
// 꽃잎·가랑잎·눈은 두세 점 이상의 무리(가장 작은 것도 한 점이 아니다 — ㄹ). 그림의 왼쪽 위가 자리다.
export function driftSprites(pal: Palette): Px[] {
  if (pal.drift === 'petal') {
    const a = pal.blossom[3];
    const b = pal.blossom[2];
    const w = pal.blossomWhite[3];
    return [
      art(['.aa...', 'aaab..', '.abbb.', '...bb.'], { a, b }),
      art(['..aa', '.aab', 'aabb', 'abb.', 'bb..', '....'], { a, b }),
      art(['ww..', 'wwa.', '.waa', '..a.'], { w, a }),
      art(['ww', 'w.'], { w }),
    ];
  }
  if (pal.drift === 'leaf') {
    const a = pal.leaf[4];
    const b = pal.leaf[2];
    const c = pal.leafWarm[4];
    return [
      art(['...aa.', '..aaa.', '.aaab.', 'aabb..', 'abb...', 'b.....'], { a, b }),
      art(['ccc...', 'cccc..', '.cccb.', '...bbb'], { c, b }),
      art(['aa..', 'aaa.', 'aab.', '.abb', '..bb', '...b'], { a, b }),
      art(['cc', '.c'], { c }),
    ];
  }
  if (pal.drift === 'snow') {
    const w = hex('#ffffff');
    const g = hex('#dfe8ee');
    return [art(['ww', 'w.'], { w }), art(['.w..', 'www.', '.wwg', '..g.'], { w, g }), art(['.g', 'gg'], { g }), art(['w.', 'ww'], { w })];
  }
  return [];
}

/** 잠자리(두 장: 날개를 폄, 접음). 여름의 논과 냇가 위를 떠다닌다. 빛깔은 둘(밀잠자리의 잿빛 푸른빛, 누런빛). */
export function dragonfly(tone: 'blue' | 'amber'): Critter {
  const b = tone === 'blue' ? hex('#4a6e98') : hex('#c98d42');
  const t = tone === 'blue' ? hex('#304b72') : hex('#a56a2e');
  const w = hex('#f1fbf4', 215);
  const v = hex('#d8e8e0', 200);
  const key = { w, v, b, t };
  const open = art(
    ['ww..........ww', 'wwvw......wvww', '.wwwvwbbwvwww.', '...wwwbbwww...', '......bb......', '......bb......', '......tt......', '......tt......', '.......t......', '.......t......'],
    key,
  );
  const shut = art(
    ['..............', '..............', 'wwwwvwbbwvwwww', '.wwwwwbbwwwww.', '......bb......', '......bb......', '......tt......', '......tt......', '.......t......', '.......t......'],
    key,
  );
  return { frames: [open, shut], ax: 6, ay: 4 };
}

const withAlphaOf = (c: Color, a: number): Color => ((c & 0x00ffffff) | (a << 24)) >>> 0;

/** 빗줄기(비스듬히 떨어지는 가는 줄 셋)와 땅에 닿아 튀는 물방울 자국(석 장) */
export function rainSprites(pal: Palette): { streaks: Px[]; splash: Px[] } {
  const a = withAlphaOf(pal.water[6], 190);
  const b = withAlphaOf(pal.water[5], 130);
  // 빗줄기는 그림 점 둘 굵기(그림 올리기 ②의 고침 — 한 점이면 1-라의 반 넓이라 큰비가 잘 보이지 않는다). 둘째 점은 줄의 뒤(왼쪽)에 붙여
  // 찍힌 네모는 1-라 그대로다(줄의 아래 끝 한 점만 한 점 굵기)
  const streak = (len: number): Px => {
    const px = new Px((Math.ceil(len / 6) + 1) * 2, len);
    for (let k = 0; k < len; k++) {
      const x = Math.floor((len - 1 - k) / 3);
      const c = k < len / 2 ? b : a;
      px.set(x, k, c);
      if (x > 0) px.set(x - 1, k, c);
    }
    return px;
  };
  const w = withAlphaOf(pal.water[6], 220);
  const g = withAlphaOf(pal.water[5], 150);
  const key = { w, g };
  return {
    streaks: [streak(18), streak(14), streak(10)],
    splash: [
      art(['..............', '..............', '......ww......', '......ww......', '....w....w....', '.....wwww.....', '..............', '..............'], key),
      art(['..............', '..............', '....gg..gg....', '..ww......ww..', '..w........w..', '..ww......ww..', '....gggggg....', '..............'], key),
      art(['..g........g..', '..g........g..', '..............', '..............', 'g............g', 'g............g', '..............', '..............'], key),
    ],
  };
}

/** 1-라의 바람결 한 점을 가는 풀잎 하나(비스듬한 두 점)로 다시 그린다 */
function blades(rows: readonly string[], key: Record<string, Color>, w: number, h: number): Px {
  const px = new Px(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = key[row[x]];
      if (c === undefined) continue;
      px.set(2 * x + 1, 2 * y, c);
      px.set(2 * x, 2 * y + 1, c);
    }
  });
  return px;
}

/** 1-라의 물결 한 점을 가로로 가는 줄(두 점)로 다시 그린다. 줄의 끝은 한 점 아래로 휜다. */
function ripples(rows: readonly string[], key: Record<string, Color>, w: number, h: number): Px {
  const px = new Px(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = key[row[x]];
      if (c === undefined) continue;
      const left = x === 0 || key[row[x - 1]] === undefined;
      const right = x === row.length - 1 || key[row[x + 1]] === undefined;
      px.set(2 * x, 2 * y + (left && !right ? 1 : 0), c);
      px.set(2 * x + 1, 2 * y + (right && !left ? 1 : 0), c);
    }
  });
  return px;
}

/** 논의 벼를 지나가는 바람결: 벼가 눕는 밝은 결(석 장) */
export function cropGustFrames(pal: Palette): Px[] {
  const key = { a: pal.crop[3], b: pal.crop[2] };
  return [
    blades(['............', '....b.b.....', '...b........', '............', '............'], key, 24, 10),
    blades(['...a.a.a....', '..b.a.a.b...', '.b.b...b.b..', '....b.b.....', '............'], key, 24, 10),
    blades(['......a.a...', '....b...b.b.', '............', '.....b......', '............'], key, 24, 10),
  ];
}

/**
 * 논에 들어선 사람의 발치를 가리는 벼 포기(사람이 벼 사이에 서 있는 것으로 보인다): 가는 잎이 하나씩 서고, 끝이 밝고 밑동이 어둡다.
 * 물에 잠긴 논에서는 물결이다.
 */
export function cropFront(pal: Palette): Px {
  if (pal.rain) {
    return ripples(['...............', '..aaaa...aaa...', '.b....bbb...bb.', '...bbb.....b...'], { a: pal.paddy[5], b: pal.paddy[1] }, 30, 8);
  }
  const [d, c, b, a] = [pal.crop[0], pal.crop[1], pal.crop[2], pal.crop[3]];
  // 1-라의 잎 끝 높이(포기마다): 0이면 맨 위까지 자란 잎
  const tops = [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 2];
  const px = new Px(30, 8);
  for (let x = 0; x < 30; x++) {
    const top = tops[x >> 1] * 2 + (hash2(x, 1, 91) < 0.5 ? 0 : 1) + (x & 1);
    for (let y = top; y < 8; y++) {
      const k = y - top;
      const lean = y < 4 && hash2(x, 2, 92) < 0.5 ? 1 : 0;
      const col = k === 0 ? (top <= 1 ? a : b) : k <= 2 ? b : y >= 6 && (x + (hash2(x, 3, 93) < 0.5 ? 1 : 0)) % 3 === 0 ? d : c;
      px.set(clamp(x - lean, 0, 29), y, col);
    }
  }
  return px;
}

/** 그 계절·날씨에 화면에 날리는 것들을 모두(빛깔 한 벌을 짤 때 센다) */
export function weatherSprites(pal: Palette): Px[] {
  const rain = rainSprites(pal);
  return [...dragonfly('blue').frames, ...dragonfly('amber').frames, ...rain.streaks, ...rain.splash, ...cropGustFrames(pal), cropFront(pal)];
}

/** 굴뚝 연기 한 덩이(크기 셋). 왼쪽 위는 밝고 오른쪽 아래는 따뜻한 잿빛이며, 가장자리는 옅은 빛으로 두 번에 걸쳐 풀린다. */
export function smokePuffs(): Px[] {
  return [14, 22, 30].map((size, i) => {
    const px = new Px(size, size);
    const r = size / 2;
    const alpha = 225 - i * 40;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - r) / r;
        const dy = (y + 0.5 - r) / r;
        // 가장자리가 뭉게뭉게(느린 무늬로 구불게)
        const d = dx * dx + dy * dy + (vnoise(x / 3.2, y / 3.2, 420 + i) - 0.5) * 0.34;
        if (d > 1) continue;
        const lit = dx + dy < -0.3 + (vnoise(x / 2.6, y / 2.6, 430 + i) - 0.5) * 0.3;
        const dark = dx + dy > 0.5 + (vnoise(x / 2.6, y / 2.6, 440 + i) - 0.5) * 0.3;
        const a = d > 0.82 ? Math.round(alpha * 0.45) : d > 0.6 ? Math.round(alpha * 0.75) : alpha;
        px.set(x, y, hex(lit ? '#f9f6ef' : dark ? '#aca69e' : '#d8d3c8', a));
      }
    }
    return px;
  });
}

/** 논물의 반짝임(세 장: 점 → 열십자 → 별) */
export function glintFrames(pal: Palette): Px[] {
  const key = { w: pal.paddy[5], s: pal.paddy[4] };
  return [
    art(['......', '......', '..ww..', '..ws..', '......', '......'], key),
    art(['......', '...s..', '...w..', '.swwws', '...w..', '...s..'], key),
    art(['..........', '.....w....', '.....w....', '.....s....', '.....s....', '.wwsswssww', '.....s....', '.....s....', '.....w....', '.....w....'], key),
  ];
}

/** 풀밭을 지나가는 바람결: 풀이 눕는 밝은 결(석 장: 일어남 → 가장 넓음 → 잦아듦) */
export function gustFrames(pal: Palette): Px[] {
  const key = { a: pal.grass[5], b: pal.grass[6] };
  return [
    blades(['...........', '...aa......', '..a........', '...........', '...........'], key, 22, 10),
    blades(['....bbbb...', '..aa....a..', '.a.....aa..', '....aa.....', '...........'], key, 22, 10),
    blades(['......aa...', '....a...a..', '...........', '.....a.....', '...........'], key, 22, 10),
  ];
}

/** 논물의 잔물결: 가로로 번지는 밝은 줄(석 장) */
export function rippleFrames(pal: Palette): Px[] {
  const key = { a: pal.paddy[5], b: pal.paddy[4] };
  return [
    ripples(['............', '....aaa.....', '............', '............'], key, 24, 8),
    ripples(['...bbbbbb...', '..a......a..', '....bbb.....', '............'], key, 24, 8),
    ripples(['.b........b.', '............', '...b...b....', '............'], key, 24, 8),
  ];
}

/** 멀리 날아가는 새(두 장: 날개를 올림, 내림). 오른쪽으로 난다. 먹빛에 가까운 따뜻한 짙은 빛. */
export function birdFrames(): Px[] {
  const k = hex('#3e3532');
  return [
    art(['k............k', '.k..........k.', '..k........k..', '...kk....kk...', '....kk..kk....', '.....kkkk.....', '......kk......', '......kk......'], { k }),
    art(['..............', '..............', '....kkkkkk....', '...k..kk..k...', '..k...kk...k..', '.k....kk....k.', 'k.....kk.....k', '..............'], { k }),
  ];
}

/**
 * 지나가는 구름의 그림자(곱할 빛 — 흰빛은 바닥을 그대로 두고, 짙을수록 바닥을 어둡게 한다). 그림 점 600×336(맵 점 300×168).
 * 가운데는 바닥을 1-라만큼(밝기로 20%쯤) 어둡게 하는 따뜻한 빛이고, 가장자리는 네 단계에 걸쳐 흰빛 쪽으로 옅어진다.
 * 단계의 경계는 느린 무늬로 구불다(체크무늬·외톨이 점 없이). 겨울에는 눈 위의 그늘처럼 붉은 보랏빛 쪽.
 */
export function cloudShadow(pal: Palette): Px {
  const W = 600;
  const H = 336;
  const px = new Px(W, H);
  const blobs: [number, number, number, number][] = [
    [200, 176, 176, 104],
    [368, 144, 184, 112],
    [288, 224, 160, 80],
    [448, 216, 120, 72],
    [120, 216, 104, 64],
  ];
  const core = pal.season === 'winter' ? hex('#d6c8d3') : hex('#d9c8b0');
  const white = hex('#ffffff');
  // 가장자리에서 가운데로: 옅음 → 짙음(가운데 빛의 몫)
  const steps = [0.22, 0.45, 0.68, 0.86, 1].map((t) => mix(white, core, t));
  const edges = [0.035, 0.08, 0.13, 0.19];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let inside = -1;
      for (const [cx, cy, rx, ry] of blobs) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        inside = Math.max(inside, 1 - (dx * dx + dy * dy));
      }
      if (inside < -0.1) continue;
      const v = inside + (vnoise(x / 46, y / 38, 501) - 0.5) * 0.1 + (vnoise(x / 17, y / 15, 502) - 0.5) * 0.035;
      if (v <= 0) continue;
      let k = 0;
      while (k < edges.length && v > edges[k]) k++;
      px.set(x, y, steps[k]);
    }
  }
  return px;
}

// ── 맵 위의 표시 ──────────────────────────────────────────────
// 1-라의 표시를 그림 점으로. 꼴은 1-라의 자리 ×2에 한 점씩 넉넉하게 칠하고(1-라의 먹빛 테두리 두 점 몫을 채운다),
// 안쪽 한 점은 제 빛의 한 단계 어두운 빛, 바깥 한 점은 따뜻한 짙은 밤빛으로 가른다(markRim).

const MARK_EDGE = hex('#3c281c');
const FLAG_POLE = R('#6f4a33', '#8d6344', '#ab8159', '#c8a174');
const BUBBLE = R('#b8a98c', '#d9cdb3', '#ece3cf', '#fbf6e9');
const ARROW = R('#b07a14', '#d99a1e', '#f6c843', '#ffe98a');
const BAR_WOOD = R('#523727', '#6f4a33', '#8d6344');
const BAR_RED = R('#84533b', '#bb533c');
const MARK_RAMPS = indexOf([CLOTH.madder, FLAG_POLE, BUBBLE, ARROW, BAR_WOOD, BAR_RED]);

/** 표시의 테두리: 그림의 가장자리 한 점은 제 빛의 한 단계 어두운 빛, 그 바깥 한 점은 따뜻한 짙은 밤빛 */
function markRim(px: Px): Px {
  const src = px.d.slice();
  const { w, h } = px;
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y) || (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) continue;
      const c = src[y * w + x];
      const info = MARK_RAMPS.get(c);
      px.d[y * w + x] = info ? info[0][Math.max(0, info[1] - 1)] : mix(c, WARM_DARK, 0.3);
    }
  }
  px.outline(MARK_EDGE);
  return px;
}

/** 둥근 모서리의 네모를 칠한다(모서리 반지름 r) */
function roundRect(px: Px, x0: number, y0: number, x1: number, y1: number, r: number, color: (x: number, y: number) => Color): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const cx = clamp(x + 0.5, x0 + r, x1 + 1 - r);
      const cy = clamp(y + 0.5, y0 + r, y1 + 1 - r);
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) px.set(x, y, color(x, y));
    }
  }
}

/** 꼭 푸는 미션의 자리에 서는 깃발(발치는 깃대 밑) */
export function flagMark(): Px {
  const px = new Px(28, 32);
  const red = CLOTH.madder;
  const pole = FLAG_POLE;
  // 천: 깃대에서 오른쪽으로 뾰족하게. 깃대 쪽 아래는 접혀 그늘지고, 위쪽에 볕이 든다.
  const cloth: Pt[] = [
    [5, 3],
    [16.6, 3],
    [27, 8.4],
    [27, 10.4],
    [12.6, 17],
    [5, 17],
  ];
  for (let y = 3; y < 17; y++) {
    for (let x = 5; x < 27; x++) {
      if (!inPoly(cloth, x + 0.5, y + 0.5)) continue;
      const fold = x - 6 < (y - 5.5) * 1.05;
      const c = y >= 14 && x < 13 ? red[0] : fold ? red[1] : y <= 6 && x >= 9 && x <= 16 ? red[3] : red[2];
      px.set(x, y, c);
    }
  }
  // 깃대(왼쪽이 밝다)와 꼭지, 밑동
  for (let y = 2; y <= 30; y++) {
    const low = y >= 26;
    px.set(3, y, low ? pole[1] : pole[3]);
    px.set(4, y, low ? pole[1] : pole[3]);
    px.set(5, y, low ? pole[0] : pole[2]);
    px.set(6, y, low ? pole[0] : pole[2]);
  }
  roundRect(px, 3, 1, 8, 4, 1.6, (x) => (x < 6 ? pole[3] : pole[2]));
  roundRect(px, 1, 27, 8, 30, 1.4, (x, y) => (y === 27 && x < 6 ? pole[2] : pole[1]));
  return markRim(px);
}

/** 말풍선의 몸(둥근 네모와 꼬리): 볕은 왼쪽 위, 아래와 오른쪽 아래는 그늘 */
function bubbleBody(px: Px, x1: number, y1: number, tail: readonly Pt[]): void {
  const [, g, , w] = BUBBLE;
  roundRect(px, 1, 1, x1, y1, 3.2, (x, y) => (y >= y1 - 1 || (x >= x1 - 4 && y >= y1 - 4) ? g : w));
  for (let y = y1 - 1; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) if (inPoly(tail, x + 0.5, y + 0.5)) px.set(x, y, x >= (tail[1][0] + tail[2][0]) / 2 ? g : w);
  }
}

/** 덤으로 할 일의 자리에 뜨는 말풍선(점 셋) */
export function bubbleMark(): Px {
  const px = new Px(26, 22);
  bubbleBody(px, 24, 16, [
    [7, 15],
    [13, 15],
    [9.8, 19],
    [7.2, 21],
  ]);
  const k = hex('#5c5348');
  for (const x of [6, 12, 18]) dots(px, [[x, 8, k], [x + 1, 8, k], [x, 9, k], [x + 1, 9, k]]);
  return markRim(px);
}

/**
 * 막힌 길의 표시: 말풍선 안에 길을 가로막은 나무(기둥 둘과 가로대 둘).
 * 화면 기호임이 뚜렷하고, 그 시대에 없던 물건(맹꽁이자물쇠)으로 읽히지 않는다.
 */
export function barMark(): Px {
  const px = new Px(30, 26);
  bubbleBody(px, 28, 20, [
    [11, 19],
    [17, 19],
    [13.8, 23],
    [11.2, 25],
  ]);
  const [pd, pm, pl] = BAR_WOOD;
  const [bd, bl] = BAR_RED;
  for (const y of [8, 12]) {
    for (let x = 8; x <= 21; x++) {
      px.set(x, y, bl);
      px.set(x, y + 1, bd);
    }
  }
  for (const x of [6, 22]) {
    for (let y = 6; y <= 15; y++) {
      px.set(x, y, pl);
      px.set(x + 1, y, y === 15 ? pd : pm);
    }
  }
  return markRim(px);
}

/** 가려고 누른 곳에 잠깐 뜨는 둥근 테(두 장) */
export function targetRings(): Px[] {
  return [14, 10].map((r) => {
    const W = 36;
    const H = 20;
    const px = new Px(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - W / 2) / r;
        const dy = (y + 0.5 - H / 2) / (r * 0.5);
        const d = dx * dx + dy * dy;
        if (d <= 1.08 && d > 0.46) px.set(x, y, hex(dx + dy > 0.55 ? '#f3e2a4' : '#fff6c8', 235));
      }
    }
    // 다른 표시처럼 가장자리 한 점은 한 단계 어둡게, 그 바깥 한 점은 짙은 밤빛(반투명)으로
    const src = px.d.slice();
    const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && src[y * W + x] !== 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) px.set(x, y, hex('#e2c983', 235));
      }
    }
    px.outline(hex('#5c4326', 200));
    return px;
  });
}

/** 가야 할 쪽을 가리키는 화살표. 여덟 방향(0 = 오른쪽, 시계 방향). */
export function arrowMarks(): Px[] {
  const out: Px[] = [];
  const S = 42;
  const pts: Pt[] = [
    [16, 0],
    [0, -14],
    [0, -6],
    [-16, -6],
    [-16, 6],
    [0, 6],
    [0, 14],
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const poly = pts.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as const);
    const px = new Px(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const qx = x + 0.5 - S / 2;
        const qy = y + 0.5 - S / 2;
        // 1-라의 먹빛 테두리 두 점 몫을 채우게 꼴을 한 점 넉넉하게
        if (!inPoly(poly, qx, qy) && distToPoly(poly, qx, qy) > 1) continue;
        // 빛은 왼쪽 위에서
        px.set(x, y, qx + qy < -2 ? ARROW[3] : qx + qy > 8 ? ARROW[1] : ARROW[2]);
      }
    }
    out.push(markRim(px));
  }
  return out;
}

/** 다각형의 둘레까지의 거리 */
function distToPoly(pts: readonly Pt[], qx: number, qy: number): number {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j];
    const [bx, by] = pts[i];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-6;
    const t = clamp(((qx - ax) * (bx - ax) + (qy - ay) * (by - ay)) / len2, 0, 1);
    best = Math.min(best, Math.hypot(qx - ax - (bx - ax) * t, qy - ay - (by - ay) * t));
  }
  return best;
}
