// 일 놀이의 도트 그림: 벼와 풀, 볏단, 자루와 되, 베, 멍석 — 모두 화소 버퍼(Px)에 한 점씩 찍어 만든다.
// 빛깔은 맵과 같은 벌(pixel/palette.ts의 계절 벌)에서 가져온다. 그때 없던 것(줄 맞춘 모, 엽전, 저울, 글씨)은 그리지 않는다.
// 생김새(되, 자루, 베틀)는 확인하지 못한 것이 많아 단순하게 그렸다(spec 12.3의 21번).
// 그림은 모두 그림 점(ART — 놀이 점의 반)으로 촘촘하게 칠한다(spec 4.7.5): 꼴·크기·밑동은 1-라의 놀이 점 × ART 그대로이고,
// 칠은 그림 점마다 따로 셈한다. 먹빛 테두리를 쓰지 않는다 — 누르는 것·손에 드는 것은 사람과 같은 (나) 부드러운 테두리,
// 바닥에 깔린 것은 제 빛깔 그늘로 가른다(pixel/wash.ts).

import { paletteOf, type Palette, type Ramp } from '../pixel/palette';
import { FOOT_SHIFT, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W } from '../pixel/people';
import { ART, Px, clamp, hash2, hex, mix, pick, rngOf, vnoise, fbm, withAlpha, type Color } from '../pixel/px';
import { WARM_DARK, ball, calmSprite, finish, softOutline, watercolor, type RampIndex } from '../pixel/wash';

// ── 놀이판에 사람을 세우는 도구(놀이 점 → 그림 점) ───────────────────

/**
 * 사람 시트의 한 칸(그림 점 48×64)을 놀이 점 (x, y)에 발끝을 맞춰 세운다. 놀이판은 ART배로 늘여 두었으므로
 * 그림 점 하나가 캔버스 점 하나에 1:1로 놓인다(키워 붙이지 않는다).
 */
export function drawPerson(ctx: CanvasRenderingContext2D, sheet: CanvasImageSource, col: number, row: number, x: number, y: number, rows = PERSON_H): void {
  ctx.drawImage(sheet, col * PERSON_W, row * PERSON_H, PERSON_W, rows, x - PERSON_AX / ART, y - PERSON_AY / ART, PERSON_W / ART, rows / ART);
}

/** 발밑의 따뜻한 그림자(footShadow — 그림 점 32×12)를 놀이 점 (x, y)의 발밑에 곱해 얹는다(가운데가 FOOT_SHIFT만큼 오른쪽 아래 — 맵과 같다) */
export function drawFoot(ctx: CanvasRenderingContext2D, shadow: HTMLCanvasElement, x: number, y: number): void {
  ctx.globalCompositeOperation = 'multiply';
  const cx = x + FOOT_SHIFT.x / ART;
  const cy = y + FOOT_SHIFT.y / ART;
  ctx.drawImage(shadow, cx - (shadow.width >> 1) / ART, cy - (shadow.height >> 1) / ART, shadow.width / ART, shadow.height / ART);
  ctx.globalCompositeOperation = 'source-over';
}

/** 바탕 한 장(그림 점, 놀이 점 × ART)을 놀이판 가득 1:1로 */
export function drawBase(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement): void {
  ctx.drawImage(base, 0, 0, base.width / ART, base.height / ART);
}

const R = (...list: string[]): Ramp => list.map((s) => hex(s));

/** 그림 한 장과 밑동의 자리(그림 점). 놀이판에는 drawArt로 놓는다(그림 점 하나 = 캔버스 점 하나). */
export interface Art {
  px: Px;
  ax: number;
  ay: number;
}

const art = (px: Px, ax: number, ay: number): Art => ({ px, ax, ay });

/**
 * 그림 점으로 그린 낱그림(캔버스)을 놀이 점 (x, y)에 왼쪽 위를 맞춰 놓는다. 놀이판은 ART배로 늘여 두었으므로
 * 그림의 크기를 놀이 점으로 줄여 놓으면 그림 점 하나가 캔버스 점 하나에 1:1로 놓인다(키워 붙이지 않는다).
 * 밑동에 맞춰 놓으려면 x - ax / ART, y - ay / ART를 준다(ax·ay는 늘 짝수라 놀이 점의 자리가 정수로 떨어진다).
 */
export function drawArt(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number): void {
  ctx.drawImage(img, x, y, img.width / ART, img.height / ART);
}

/**
 * 물이 이는 자리·흙탕물처럼 둥글넓적하게 번지는 얼룩을 놀이판(ART배로 늘여 둔 ctx)에 그림 점으로 찍는다.
 * (cx, cy)·rx·ry는 그림 점. 그림 점 둘씩 가로로 이어진 칸이 줄마다 엇갈려(물 위의 가로로 누운 결) 가장자리가 점의 무리로 흩어진다 —
 * 외톨이 점이 없다(ㄹ). 칸의 무늬는 놀이판의 자리로 정해져(겹쳐 찍어도 같은 칸은 같은 값) 얼룩끼리 고르게 이어진다.
 * paint(h, d)가 빛을 돌려주면 그 칸을 찍는다(h: 칸의 무늬 0~1, d: 가운데에서 잰 거리 0~1). keep(X, Y)가 거짓인 칸은 건너뛴다.
 */
export function blot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  paint: (h: number, d: number, X: number, Y: number) => string | null,
  keep?: (X: number, Y: number) => boolean,
): void {
  for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++) {
    const shift = Y & 1;
    for (let c = Math.floor((cx - rx - 2 + shift) / 2); c <= Math.ceil((cx + rx + shift) / 2); c++) {
      const X = c * 2 - shift;
      const d = Math.hypot((X + 1 - cx) / rx, (Y + 0.5 - cy) / ry);
      if (d > 1 || (keep && !keep(X, Y))) continue;
      const style = paint(hash2(c, Y, seed), d, X, Y);
      if (!style) continue;
      ctx.fillStyle = style;
      ctx.fillRect(X / ART, Y / ART, 2 / ART, 1 / ART);
    }
  }
}

// ── 그림 점으로 칠하는 작은 도구(spec 4.7.5 — 꼴은 1-라의 자리 × ART, 칠은 그림 점마다) ──────────

/** 1-라의 점 자리(놀이 점 — 점의 가운데) → 그림 점 자리 */
const G = (v: number): number => v * ART + ART / 2;

type Pt = readonly [number, number];

/** 그 그림이 쓰는 단계만으로 찾는 표(앞에 둔 단계가 먼저). 제 빛깔 그늘·부드러운 테두리·결이 이 단계 안에서 오르내린다. */
function rampsFor(...list: readonly Ramp[]): RampIndex {
  const out: RampIndex = new Map();
  for (const ramp of list) ramp.forEach((c, i) => void (out.has(c) || out.set(c, [ramp, i])));
  return out;
}

/** 빛은 왼쪽 위에서 온다(ㄷ) */
const LIGHT_X = -0.6;
const LIGHT_Y = -0.8;

interface StrandOpts {
  /** 가운데 빛 */
  body: Color;
  /** 볕 받는 쪽(왼쪽 위) 가장자리 */
  lit?: Color;
  /** 그늘 쪽(오른쪽 아래) 가장자리 */
  dim?: Color;
  /** 끝 몇 점의 빛과 그 길이(그림 점) */
  tip?: Color;
  tipLen?: number;
  /** 밑동과 끝의 너비(그림 점) */
  w0: number;
  w1: number;
  /** 비낀 그늘 가닥(1-라의 "어두운 쪽을 먼저 찍고 그 위에 밝은 가닥") — 빛과 비낀 자리 */
  drop?: Color;
  dropAt?: Pt;
  /** 낟알 사이의 틈: 가닥을 따라 every 그림 점마다 한 점을 이 빛으로(볕 쪽과 그늘 쪽이 반씩 엇갈려 낟알이 두 줄로 보인다) */
  seam?: { every: number; c: Color };
}

/**
 * 가는 것(잎, 줄기, 이삭대) 한 가닥을 그림 점으로 칠한다. pts는 밑동에서 끝까지의 꺾은선(그림 점 자리 — 점의 가운데가 .5).
 * 너비는 밑동에서 끝으로 가늘어지고, 볕 받는 쪽과 그늘 쪽은 이웃 단계로 가른다.
 */
function strand(px: Px, pts: readonly Pt[], o: StrandOpts): void {
  if (o.drop !== undefined) {
    const [dx, dy] = o.dropAt ?? [1.1, 0.4];
    paintStrand(
      px,
      pts.map(([x, y]) => [x + dx, y + dy] as const),
      { body: o.drop, w0: o.w0, w1: o.w1 },
    );
  }
  paintStrand(px, pts, o);
}

function paintStrand(px: Px, pts: readonly Pt[], o: StrandOpts): void {
  const segs: { ax: number; ay: number; dx: number; dy: number; s: number; len: number }[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    segs.push({ ax: pts[i - 1][0], ay: pts[i - 1][1], dx, dy, s: total, len });
    total += len;
  }
  if (segs.length === 0) return;
  const pad = Math.max(o.w0, o.w1) / 2 + 1;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys) - pad); y <= Math.ceil(Math.max(...ys) + pad); y++) {
    for (let x = Math.floor(Math.min(...xs) - pad); x <= Math.ceil(Math.max(...xs) + pad); x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let best = Infinity;
      let bt = 0;
      let ox = 0;
      let oy = 0;
      for (const sg of segs) {
        const u = clamp(((cx - sg.ax) * sg.dx + (cy - sg.ay) * sg.dy) / (sg.len * sg.len), 0, 1);
        const qx = sg.ax + sg.dx * u;
        const qy = sg.ay + sg.dy * u;
        const d = Math.hypot(cx - qx, cy - qy);
        if (d < best) {
          best = d;
          bt = (sg.s + u * sg.len) / total;
          ox = cx - qx;
          oy = cy - qy;
        }
      }
      if (best > (o.w0 + (o.w1 - o.w0) * bt) / 2) continue;
      const side = ox * LIGHT_X + oy * LIGHT_Y;
      let c = o.body;
      if (o.tip !== undefined && (1 - bt) * total < (o.tipLen ?? 2)) c = o.tip;
      else if (o.seam && (bt * total + (side > 0 ? o.seam.every / 2 : 0)) % o.seam.every < 0.95) c = o.seam.c;
      else if (o.lit !== undefined && side > 0.45) c = o.lit;
      else if (o.dim !== undefined && side < -0.2) c = o.dim;
      px.set(x, y, c);
    }
  }
}

/** 밑동 → 가운데 → 끝을 지나는 부드러운 휨(1-라의 꺾은선이 지나던 세 점을 그대로 지난다) */
function bend(p0: Pt, m: Pt, p2: Pt, n = 10): Pt[] {
  const c: Pt = [2 * m[0] - (p0[0] + p2[0]) / 2, 2 * m[1] - (p0[1] + p2[1]) / 2];
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]);
  }
  return out;
}

/** 굽은 길 path(t)(t 0~1)를 n토막의 꺾은선으로 */
function along(path: (t: number) => Pt, n = 12): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => path(i / n));
}

/**
 * 낟알이 엇갈려 붙은 이삭: path(t)를 따라 낟알(작은 둥근 덩어리 — 빛 하나)을 gap마다 엇갈려 찍는다.
 * 끝 쪽부터 찍어 밑동 쪽 낟알이 위에 얹힌다. 낟알은 그림 점 여럿의 무리다(ㄹ — 외톨이 점이 없다).
 */
function earChain(px: Px, path: (t: number) => Pt, len: number, ramp: Ramp, o: { gap: number; wide: number; rx: number; ry: number; lo: number; hi: number; rim: number }): void {
  const n = Math.max(1, Math.round(len / o.gap));
  for (let k = n; k >= 0; k--) {
    const t = k / n;
    const [x, y] = path(t);
    const [x2, y2] = path(Math.min(1, t + 0.02));
    const [x1, y1] = path(Math.max(0, t - 0.02));
    const tl = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / tl;
    const ny = (x2 - x1) / tl;
    const side = k % 2 === 0 ? 0.5 : -0.5;
    // 끝으로 갈수록 낟알이 조금 작다
    const s = 1 - t * 0.25;
    ball(px, x + nx * o.wide * side, y + ny * o.wide * side, o.rx * s, o.ry * s, ramp, { lo: o.lo, hi: o.hi, rim: o.rim });
  }
}

// ── 여름 논의 벼와 풀 ─────────────────────────────────────────

/**
 * 여름의 벼 포기: 가는 잎이 부채처럼 퍼져 올라간다. 밝은 풀빛이고 끝이 누르스름하다.
 * lean이 -1·1이면 그쪽으로 누운 모습이다(건드리면 잠깐 눕는다).
 * 1-라의 꼴(놀이 점 19×17, 밑동 9·16)을 그림 점 ×ART로: 잎은 밑동에서 끝으로 가늘어지고, 볕 받는 쪽이 한 단계 밝다.
 */
export function riceTuft(pal: Palette, look: number, lean: -1 | 0 | 1 = 0): Art {
  const W = 19;
  const H = 17;
  const px = new Px(W * ART, H * ART);
  const bx = 9;
  const by = H - 2;
  const crop = pal.crop;
  const n = 5 + (look % 3);
  const base: Pt = [G(bx), G(by)];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const spread = (t - 0.5) * 2; // -1 ~ 1
    const tall = 13 - Math.abs(spread) * 5 - (hash2(i, look, 31) > 0.6 ? 1 : 0);
    let tx = bx + spread * 6.2;
    let ty = by - tall;
    if (lean !== 0) {
      tx += lean * (4 + (1 - Math.abs(spread)) * 3);
      ty += 4 + (1 - Math.abs(spread)) * 2;
    }
    tx = clamp(tx, 0, W - 2);
    const mid: Pt = [G(bx + (tx - bx) * 0.35), G(by + (ty - by) * 0.6)];
    const light = i % 2 === 0;
    strand(px, bend(base, mid, [G(tx), G(ty)]), {
      body: light ? crop[2] : crop[1],
      lit: light ? crop[3] : crop[2],
      dim: light ? crop[1] : crop[0],
      tip: crop[3],
      tipLen: 2.5,
      w0: 2.8,
      w1: 1.5,
    });
  }
  // 밑동: 잎이 모여 나는 자리(가운데가 조금 밝다)
  ball(px, G(bx), G(by) + 0.6, 3.4, 2.2, crop, { lo: 0, hi: 1, rim: 0 });
  px.rect(G(bx) - 1, G(by) + 2, 2, 1, crop[0]);
  // 풀과 같은 (나) 부드러운 테두리(풀만 테두리가 있으면 생김새가 아니라 테두리로 가려지므로 벼에도 같게 두른다)
  softOutline(px, rampsFor(crop));
  calmSprite(px);
  return art(px, bx * ART, (by + 1) * ART);
}

const WEED_HEAD = R('#4a2a3a', '#6e3f52', '#93596c', '#b98394');
const WEED_FLOWER = R('#6a55ae', '#9d8be0', '#e3dcff');
const WEED_SPIKE = R('#6e5522', '#a1803a', '#d0ad5c');

/**
 * 논의 풀 세 가지(벼와 생김새가 다르다 — 빛깔만으로 가르지 않는다).
 *   0 피 같은 풀: 벼보다 키가 크고 짙으며, 끝에 검붉은 이삭이 늘어진다
 *   1 잎이 넓은 풀: 낮게 퍼진 둥근 잎과 보랏빛 작은 꽃
 *   2 우산살 같은 풀: 곧은 줄기 끝에 살이 별처럼 퍼진다
 * 누르는 것이라 사람과 같은 (나) 부드러운 테두리로 물빛에서 뗀다(먹빛이 아니다).
 */
export function weedArt(pal: Palette, kind: number, look = 0): Art {
  const k = ((kind % 3) + 3) % 3;
  if (k === 0) {
    const W = 21;
    const H = 23;
    const px = new Px(W * ART, H * ART);
    const bx = 9;
    const by = H - 2;
    const deep = pal.leafDeep;
    const ends: [number, number][] = [
      [-6, -11],
      [-3, -16],
      [0, -19],
      [3, -17],
      [6, -12],
    ];
    const base: Pt = [G(bx), G(by)];
    ends.forEach(([dx, dy], i) => {
      const tx = bx + dx;
      const ty = by + dy + (look % 2);
      const light = i % 2 === 0;
      strand(px, bend(base, [G(bx + dx * 0.35), G(by + (ty - by) * 0.6)], [G(tx), G(ty)]), {
        body: light ? deep[4] : deep[3],
        lit: light ? deep[5] : deep[4],
        dim: light ? deep[3] : deep[2],
        tip: deep[5],
        tipLen: 2.5,
        w0: 3,
        w1: 1.5,
      });
    });
    // 늘어진 이삭 둘(검붉다): 잎 끝에서 바깥으로 휘어 늘어진다
    const head = (x: number, y: number, dir: number): void =>
      strand(px, along((t) => [G(x + dir * t * 4.5), G(y + ((t * 5) ** 2) / 7) + 0.4]), {
        body: WEED_HEAD[2],
        lit: WEED_HEAD[3],
        dim: WEED_HEAD[1],
        tip: WEED_HEAD[1],
        tipLen: 1.5,
        w0: 2.6,
        w1: 2,
        drop: WEED_HEAD[0],
        dropAt: [0.2, 1.2],
        seam: { every: 2.6, c: WEED_HEAD[1] },
      });
    head(bx, by - 20, 1);
    head(bx - 3, by - 16, -1);
    ball(px, G(bx), G(by) + 0.6, 3.2, 2.2, deep, { lo: 0, hi: 1, rim: 0 });
    px.rect(G(bx) - 1, G(by) + 2, 2, 1, deep[0]);
    softOutline(px, rampsFor(deep, WEED_HEAD));
    calmSprite(px);
    return art(px, bx * ART, (by + 1) * ART);
  }
  if (k === 1) {
    const W = 17;
    const H = 12;
    const px = new Px(W * ART, H * ART);
    const bx = 8;
    const by = H - 2;
    const deep = pal.leafDeep;
    const leaf = (cx: number, cy: number, rx: number, ry: number): void => {
      // 놀이 점의 타원(1-라의 자리) → 그림 점: 비낀 그늘, 빛 하나로 칠한 잎, 가운데 잎맥
      px.ellipse((cx + 0.5) * ART, (cy + 0.8) * ART, rx * ART, ry * ART, deep[1]);
      ball(px, cx * ART, cy * ART, rx * ART, ry * ART, deep, { lo: 2, hi: 5, rim: 2 });
      px.line(Math.round((cx - rx * 0.55) * ART), Math.round(cy * ART), Math.round((cx + rx * 0.3) * ART), Math.round((cy - ry * 0.15) * ART), deep[3]);
    };
    leaf(bx - 4.5, by - 2, 3.4, 2.4);
    leaf(bx + 4.5, by - 2.5, 3.4, 2.4);
    leaf(bx + 0.5, by - 5, 3, 2.6);
    leaf(bx + (look % 2 === 0 ? -1 : 1), by - 0.5, 3, 1.8);
    // 보랏빛 작은 꽃(꽃잎 넷 — 그림 점 무리)
    const fx = G(bx + 1);
    const fy = G(by - 9);
    ball(px, fx - 1.6, fy + 0.2, 1.7, 1.5, WEED_FLOWER, { lo: 1, hi: 2, rim: 1 });
    ball(px, fx + 1.6, fy + 0.4, 1.6, 1.5, WEED_FLOWER, { lo: 0, hi: 2, rim: 0 });
    ball(px, fx, fy - 1.5, 1.6, 1.5, WEED_FLOWER, { lo: 0, hi: 1, rim: 0 });
    ball(px, fx, fy + 1.8, 1.6, 1.4, WEED_FLOWER, { lo: 0, hi: 1, rim: 0 });
    px.rect(fx - 1, fy - 1, 2, 2, WEED_FLOWER[2]);
    softOutline(px, rampsFor(deep, WEED_FLOWER));
    calmSprite(px);
    return art(px, bx * ART, (by + 1) * ART);
  }
  const W = 17;
  const H = 19;
  const px = new Px(W * ART, H * ART);
  const bx = 8;
  const by = H - 2;
  const warm = pal.leafWarm;
  // 곧은 줄기와 밑동의 짧은 잎 둘
  const sx = G(bx) + 0.5;
  strand(px, [[sx, G(by) + 1], [sx, G(by - 13)]], { body: warm[3], lit: warm[4], dim: warm[1], w0: 2.6, w1: 2.2 });
  strand(px, bend([G(bx), G(by)], [G(bx - 2.5), G(by - 3)], [G(bx - 5), G(by - 5)]), { body: warm[2], lit: warm[3], dim: warm[1], w0: 2.4, w1: 1.5 });
  strand(px, bend([G(bx), G(by)], [G(bx + 2.5), G(by - 2.4)], [G(bx + 5), G(by - 4)]), { body: warm[2], lit: warm[3], dim: warm[1], w0: 2.4, w1: 1.5 });
  // 줄기 끝에서 별처럼 퍼진 살과 그 끝의 누런 이삭
  const cx = bx;
  const cy = by - 13;
  const rays: [number, number][] = [
    [-6, 1],
    [-4, -3],
    [0, -4],
    [4, -3],
    [6, 1],
    [-3, 3],
    [3, 3],
  ];
  for (const [dx, dy] of rays) strand(px, [[G(cx), G(cy)], [G(cx + dx), G(cy + dy)]], { body: warm[4], w0: 1.4, w1: 1.2 });
  for (const [dx, dy] of rays) {
    const s = Math.sign(dx);
    ball(px, G(cx + dx) + s * 0.7, G(cy + dy) + 0.5, 1.7, 1.4, WEED_SPIKE, { lo: 0, hi: 2, rim: 0 });
  }
  ball(px, G(cx), G(cy), 1.8, 1.8, warm, { lo: 3, hi: 5, rim: 3 });
  px.rect(G(bx) - 1, G(by) + 2, 3, 1, warm[0]);
  softOutline(px, rampsFor(warm, WEED_SPIKE));
  calmSprite(px);
  return art(px, bx * ART, (by + 1) * ART);
}

// ── 가을 논의 벼, 그루터기, 볏단 ───────────────────────────────

const EAR = R('#8a6a1e', '#c59a2b', '#e8c544', '#f9e486', '#fff6c4');
const STALK = R('#6b5a26', '#93803a', '#b9a652', '#d8c873');

/** 누렇게 익은 벼 포기: 줄기 끝마다 낟알이 여문 이삭이 무겁게 고개를 숙인다 */
export function goldClump(look: number): Art {
  const W = 25;
  const H = 21;
  const px = new Px(W * ART, H * ART);
  const bx = 12;
  const by = H - 2;
  const n = 6 + (look % 2);
  const base: Pt = [G(bx), G(by)];
  // 누렇게 마른 잎 몇 가닥(이삭 사이로 비친다)
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) / 1.5;
    const tip: Pt = [G(bx + spread * 8), G(by - 8 + Math.abs(spread) * 3)];
    strand(px, bend(base, [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 - 1.5], tip), {
      body: STALK[i % 2 === 0 ? 1 : 0],
      lit: STALK[i % 2 === 0 ? 2 : 1],
      w0: 2.2,
      w1: 1.4,
    });
  }
  const ears: { tx: number; ty: number; dir: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const spread = (t - 0.5) * 2;
    const tall = 15 - Math.abs(spread) * 5 - (hash2(i, look, 57) > 0.6 ? 1 : 0);
    const tx = bx + spread * 5;
    const ty = by - tall;
    strand(px, [base, [G(tx), G(ty)]], { body: i % 2 === 0 ? STALK[3] : STALK[2], dim: STALK[1], w0: 2.2, w1: 1.6, drop: STALK[0] });
    ears.push({ tx, ty, dir: spread < -0.05 ? -1 : spread > 0.05 ? 1 : look % 2 === 0 ? 1 : -1 });
  }
  // 고개 숙인 이삭(바깥쪽으로 휘어 늘어진다. 낟알이 두 줄로 붙어 도톰하다)
  for (const { tx, ty, dir } of ears) {
    const path = (t: number): Pt => [G(tx + dir * t * 5 * 0.85), G(ty + ((t * 5) ** 2) / 4.2) + 1.4];
    strand(px, along(path), { body: EAR[2], lit: EAR[3], dim: EAR[1], w0: 4.4, w1: 3, drop: EAR[0], dropAt: [0.3, 1.5], seam: { every: 2.6, c: EAR[1] } });
    // 이삭 허리께의 볕(1-라의 가장 밝은 낟알 둘)
    for (const t of [0.42, 0.58]) {
      const [x, y] = path(t);
      px.set(Math.round(x - 0.9), Math.round(y - 1.6), EAR[4]);
      px.set(Math.round(x + 0.1), Math.round(y - 1.6), EAR[4]);
    }
  }
  ball(px, G(bx), G(by) + 0.6, 3.4, 2.2, STALK, { lo: 0, hi: 1, rim: 0 });
  px.rect(G(bx) - 1, G(by) + 2, 2, 1, STALK[0]);
  calmSprite(px);
  return art(px, bx * ART, (by + 1) * ART);
}

/** 벤 자리의 그루터기(짧은 밑동 몇 가닥). ears가 참이면 흘린 이삭이 곁에 남아 있다. 바닥에 깔린 것이라 제 빛깔 그늘로 가른다. */
export function stubbleArt(look: number, ears = false): Art {
  const W = 15;
  const H = 8;
  const px = new Px(W * ART, H * ART);
  const bx = 7;
  const by = H - 2;
  for (let i = -2; i <= 2; i++) {
    const tall = 2 + (hash2(i, look, 71) > 0.5 ? 1 : 0);
    const x = (bx + i * 2) * ART;
    // 벤 높이가 그림 점 하나쯤 들쭉날쭉하다
    const top = (by - tall) * ART + (hash2(i, look, 72) > 0.6 ? 1 : 0);
    const body = i % 2 === 0 ? 2 : 1;
    // 밑동 오른쪽의 그늘
    px.rect(x + 2, by * ART + 1, 2, 1, STALK[0]);
    px.set(x + 2, by * ART, STALK[0]);
    // 볕 받는 왼쪽 한 줄은 한 단계 밝다(제 빛깔 그늘 — 한 칸씩만 오르내린다)
    px.rect(x, top, 1, by * ART + 2 - top, STALK[body + 1]);
    px.rect(x + 1, top, 1, by * ART + 2 - top, STALK[body]);
    // 벤 자리(위로 드러난 짚의 속)
    px.rect(x, top, 2, 1, STALK[Math.min(3, body + 1)]);
  }
  if (ears) {
    const lie = (x: number, y: number, dir: number): void =>
      earChain(px, (t) => [G(x) + dir * t * 3, G(y) + t * 0.8], 3, EAR, { gap: 1.2, wide: 1.2, rx: 1.5, ry: 1.2, lo: 1, hi: 3, rim: 0 });
    lie(bx + 5, by, 1);
    lie(bx - 6, by - 1, 1);
  }
  calmSprite(px);
  return art(px, bx * ART, (by + 1) * ART);
}

/** 베어 눕혀 놓은 벼 한 줌: 밑동 쪽은 가지런하고 이삭 쪽은 퍼져 있다. 바닥에 깔린 것이라 제 빛깔 그늘로 가른다. */
export function swathArt(look: number): Art {
  const W = 19;
  const H = 9;
  const px = new Px(W * ART, H * ART);
  for (let k = -2; k <= 2; k++) {
    const y0 = 4 + Math.round(k * 0.5);
    const y1 = 4 + Math.round(k * 1.5);
    strand(px, [[G(1), G(y0)], [G(12), G(y1)]], { body: k % 2 === 0 ? STALK[3] : STALK[2], lit: STALK[3], w0: 2, w1: 2, drop: STALK[0], dropAt: [0.2, 1.1] });
  }
  // 이삭(끝이 퍼진다): 낟알 사이의 틈이 엇갈린다
  for (let k = -2; k <= 2; k++) {
    const y1 = 4 + Math.round(k * 1.5);
    const bright = hash2(k, look, 83) > 0.4;
    strand(px, [[G(12), G(y1)], [G(17), G(y1 + (5 * k) / 9)]], { body: bright ? EAR[3] : EAR[2], lit: bright ? EAR[4] : EAR[3], w0: 2.4, w1: 1.8, drop: EAR[0], dropAt: [0.2, 1.1], seam: { every: 2.2, c: EAR[1] } });
  }
  // 벤 자리(가지런한 밑동의 끝)
  px.rect(0, G(4) - 1, 2, 2, STALK[1]);
  px.rect(0, G(5) - 1, 2, 2, STALK[0]);
  finish(px, rampsFor(STALK, EAR), 0, null);
  return art(look % 2 === 1 ? px.flipX() : px, 9 * ART, 6 * ART);
}

/** 볏단: 벼를 한 아름 묶어 세운 단. 허리를 새끼로 묶었고 위에 이삭이 수북하다. */
export function sheafArt(pal: Palette): Art {
  const W = 23;
  const H = 30;
  const px = new Px(W * ART, H * ART);
  const cx = 11;
  const mx = G(cx);
  // 줄기(아래가 퍼지고 허리가 잘록하다): 볕 받는 왼쪽이 밝고, 짚이 세로로 결을 이룬다
  for (let Y = 9 * ART; Y < (H - 2) * ART; Y++) {
    const v = (Y + 0.5) / ART - 0.5;
    const t = (v - 9) / (H - 11);
    const half = 3.2 + Math.abs(t - 0.42) * 9;
    const hw = (half + 0.5) * ART;
    for (let X = 0; X < W * ART; X++) {
      const dx = X + 0.5 - mx;
      if (Math.abs(dx) > hw) continue;
      const u = dx / hw;
      // 짚 한 가닥이 그림 점 하나 — 세로로 길게 이어지고, 가닥마다 볕을 받는 정도가 조금씩 다르다
      const straw = (vnoise(X / 1.05, Y / 16, 101) - 0.5) * 0.36 + (vnoise(X / 4, Y / 30, 103) - 0.5) * 0.16;
      const tone = 0.64 - u * 0.3 + straw - (v > H - 5 ? 0.16 : 0);
      px.set(X, Y, pick(STALK, tone));
    }
  }
  // 허리의 새끼줄: 꼰 가닥이 비스듬히 돈다
  for (let Y = 17 * ART; Y < 19 * ART; Y++) {
    for (let X = (cx - 4) * ART; X < (cx + 5) * ART; X++) {
      const phase = (X + Y * 1.5 + (hash2(X >> 2, 0, 105) > 0.5 ? 1 : 0)) % 4;
      const row = Y - 17 * ART; // 0 위 ~ 3 아래
      const i = (phase < 1.5 ? 4 : phase < 2.5 ? 3 : 2) - (row >= 2 ? 1 : 0) - (row === 3 ? 1 : 0);
      px.set(X, Y, pal.thatch[clamp(i, 0, pal.thatch.length - 1)]);
    }
  }
  // 위의 이삭 다발: 바탕을 먼저 고르게 칠하고(구멍이 없다) 그 위에 낟알을 수북이 얹는다
  const headHalf = (v: number): number => 4 + Math.sin(clamp((v - 1) / 10, 0, 1) * Math.PI) * 6;
  const inHead = (X: number, Y: number): boolean => {
    const v = (Y + 0.5) / ART - 0.5;
    return v >= 0.75 && v <= 11.25 && Math.abs(X + 0.5 - mx) <= (headHalf(v) + 0.5) * ART;
  };
  for (let Y = 0; Y < 12 * ART; Y++) {
    for (let X = 0; X < W * ART; X++) {
      if (!inHead(X, Y)) continue;
      const v = (Y + 0.5) / ART - 0.5;
      const u = (X + 0.5 - mx) / ((headHalf(v) + 0.5) * ART);
      px.set(X, Y, pick(EAR, 0.62 - u * 0.22 - ((v - 1) / 10) * 0.25));
    }
  }
  // 낟알이 꼴 밖으로 삐져나가지 않게 지금 찍힌 자리를 적어 둔다
  const mask = px.d.slice();
  const rnd = rngOf(107);
  const grains: Pt[] = [];
  for (let i = 0; i < 200 && grains.length < 70; i++) {
    const X = rnd() * W * ART;
    const Y = rnd() * 12 * ART;
    if (inHead(Math.floor(X), Math.floor(Y))) grains.push([X, Y]);
  }
  grains.sort((a, b) => a[1] - b[1]);
  for (const [X, Y] of grains) {
    const u = (X - mx) / (10.5 * ART);
    const lit = -u * 0.6 - (Y / (12 * ART)) * 0.8;
    ball(px, X, Y, 1.9, 1.5, EAR, { lo: 1, hi: lit > -0.2 ? 4 : lit > -0.55 ? 3 : 2, rim: lit > -0.4 ? 1 : 0 });
  }
  for (let i = 0; i < mask.length; i++) if (mask[i] === 0) px.d[i] = 0;
  const ramps = rampsFor(STALK, EAR, pal.thatch);
  watercolor(px, ramps, 109, { big: 9, bigY: 12, amp: 0.9, fine: 0.4, streak: [1.5, 14, 0.8], keep: (_x, y) => y >= 12 * ART && (y < 17 * ART || y >= 19 * ART) });
  softOutline(px, ramps);
  calmSprite(px);
  return art(px, cx * ART, (H - 2) * ART);
}

// ── 값 치르기의 것들 ───────────────────────────────────────────

const RICE = R('#b9ad8c', '#dcd3b6', '#f1ebd6', '#fffbee');
const SALT = R('#8e9aa5', '#b9c4cb', '#dfe7ea', '#ffffff');
/** 굵은 소금 알의 푸른 기(1-라 그대로) */
const SALT_GLINT = hex('#cfe6f2');

const SACK = R('#5f4a2c', '#84693d', '#a98b55', '#c9ac73', '#e2cb97', '#f1e2b9');
/** 껍질을 벗기지 않은 벼 낟알(누렇다) */
const GRAIN = R('#b0892a', '#d8b53d', '#f2dc74', '#fff0a8');

type Holds = 'rice' | 'salt' | 'grain';

/**
 * 곡식 알의 결(그림 점): 쌀은 그림 점 둘씩 가로로 이어진 잔 알, 소금은 둘씩 둘의 굵은 알, 벼 낟알은 셋씩 이어진 길쭉한 알.
 * 줄마다 엇갈린다(자로 잰 듯한 바둑판이 되지 않게). 돌려주는 값은 단계를 오르내릴 칸(-1 그늘진 틈, 0, +1 밝은 알).
 */
function kernel(X: number, Y: number, holds: Holds, seed: number): number {
  let h: number;
  if (holds === 'salt') h = hash2((X + ((Y >> 1) & 1)) >> 1, Y >> 1, seed);
  else if (holds === 'grain') h = hash2(Math.floor((X + (Y % 3) * 2) / 3), Y, seed);
  else h = hash2((X + (Y & 1)) >> 1, Y, seed);
  return h > 0.7 ? 1 : h < 0.26 ? -1 : 0;
}

/**
 * 곡식이나 소금을 담은 자루. 아가리를 접어 내려 속이 보인다(쌀은 희고 잘며, 소금은 희고 굵고, 갓 떨어낸 벼 낟알은 누렇다).
 * full(0~1)은 쌀이 남은 만큼이다 — 퍼낼수록 속이 내려간다.
 * 1-라의 꼴(놀이 점 27×29, 밑동 13·27)을 그림 점 ×ART로. 누르는 것이라 (나) 부드러운 테두리로 바닥에서 뗀다.
 */
export function sackArt(_pal: Palette, holds: Holds, full = 1): Art {
  const W = 27;
  const H = 29;
  const px = new Px(W * ART, H * ART);
  const cx = 13;
  const mx = G(cx);
  // 몸통: 아래가 넓고 묵직하다. 세로로 접힌 주름이 몇 줄 있다(가는 금 한 줄과 그 곁의 볕).
  const folds = [
    { dark: G(cx - 4), light: G(cx - 4) + 1, seed: 1 },
    { dark: G(cx + 5), light: G(cx + 5) + 1, seed: 2 },
  ];
  for (let Y = 8 * ART; Y < (H - 1) * ART; Y++) {
    const v = (Y + 0.5) / ART - 0.5;
    const t = (v - 8) / (H - 10);
    const half = 8 + Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * 3.6 - Math.max(0, (t - 0.84) / 0.16) ** 2 * 1.3;
    const hw = (half + 0.5) * ART;
    for (let X = 0; X < W * ART; X++) {
      const dx = X + 0.5 - mx;
      if (Math.abs(dx) > hw) continue;
      const u = dx / hw;
      let tone = 0.7 - u * 0.34 - t * 0.12;
      for (const f of folds) {
        const wob = Math.round((vnoise(Y / 9, f.seed, 115) - 0.5) * 2);
        if (X === f.dark + wob && t > 0.06) tone -= 0.17;
        else if (X === f.light + wob && t > 0.06) tone += 0.09;
      }
      if (v > H - 4) tone -= 0.18;
      // 굵은 올: 그림 점 둘씩 둘의 칸이 줄마다 엇갈려 드문드문 볕을 받거나 그늘진다(띠의 경계가 들쭉날쭉해진다)
      const weave = hash2((X + ((Y >> 1) & 1)) >> 1, Y >> 1, 117);
      tone += weave > 0.84 ? 0.06 : weave < 0.12 ? -0.05 : 0;
      px.set(X, Y, pick(SACK, tone));
    }
  }
  // 몸통에 굵은 올의 결을 잔잔하게(수채화 같은 결 — 때가 지지 않게 밝게 옮기는 쪽이 많다)
  const sackRamps = rampsFor(SACK);
  watercolor(px, sackRamps, 113, { big: 9, bigY: 11, amp: 1.0, fine: 0.6 });
  // 접어 내린 아가리(도톰한 테)와 그 안에 든 것
  const fill = holds === 'rice' ? RICE : holds === 'grain' ? GRAIN : SALT;
  const sink = Math.round((1 - full) * 3);
  const my = G(8);
  for (let Y = 3 * ART; Y < 12 * ART; Y++) {
    for (let X = 0; X < W * ART; X++) {
      const dx = (X + 0.5 - mx) / (9 * ART);
      const dy = (Y + 0.5 - my) / (3.6 * ART);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 0.56) {
        // 테: 위쪽은 볕을 받고 앞쪽(아래)은 그늘. 접어 내린 짚의 가운데가 도톰하게 밝다.
        const r = Math.sqrt(d);
        const lip = 1 - Math.abs(r - 0.875) / 0.125;
        const front = clamp((dy + 0.15) / 0.4, 0, 1);
        px.set(X, Y, pick(SACK, 0.84 - dx * 0.2 - front * 0.24 + (lip - 0.5) * 0.14));
        continue;
      }
      // 속: 가득하면 수북하고, 퍼낼수록 그늘이 진다
      const v = (Y + 0.5) / ART - 0.5;
      if (full <= 0 || (sink > 0 && v < 6 + sink)) {
        px.set(X, Y, sink > 0 && full > 0 && v >= 5.5 + sink ? SACK[1] : SACK[0]);
        continue;
      }
      const k = kernel(X, Y, holds, 127);
      let c = fill[clamp(2 + k, 1, fill.length - 1)];
      if (holds === 'salt' && k > 0 && hash2(X >> 1, Y >> 1, 128) > 0.75) c = SALT_GLINT;
      px.set(X, Y, c);
    }
  }
  if (full >= 1) {
    // 수북이 올라온 윗부분: 빛 하나로 둥글게, 그 위에 알의 결
    for (let Y = ART; Y < 5 * ART; Y++) {
      const v = (Y + 0.5) / ART - 0.5;
      const half = 5.4 * Math.sqrt(Math.max(0, 1 - ((4.6 - v) / 4) ** 2));
      const hw = (half + 0.5) * ART;
      for (let X = 0; X < W * ART; X++) {
        const dx = X + 0.5 - mx;
        if (Math.abs(dx) > hw) continue;
        const k = kernel(X, Y, holds, 129);
        const base = dx < -hw * 0.25 && v < 3.4 ? 3 : 2;
        let c = fill[clamp(base + (k > 0 ? 1 : k < 0 && base === 2 ? -1 : 0), 1, fill.length - 1)];
        if (holds === 'salt' && k > 0 && hash2(X >> 1, Y >> 1, 130) > 0.7) c = SALT_GLINT;
        px.set(X, Y, c);
      }
    }
  }
  softOutline(px, rampsFor(SACK, fill));
  calmSprite(px);
  return art(px, cx * ART, (H - 2) * ART);
}

/** 되: 곡식을 되는 네모난 나무 그릇. filled면 쌀이 수북하다. 손에 드는 것이라 (나) 부드러운 테두리. */
export function measureArt(pal: Palette, filled: boolean): Art {
  const W = 13;
  const H = 10;
  const px = new Px(W * ART, H * ART);
  const wood = pal.wood;
  // 앞면: 볕 받는 왼쪽이 밝고 아래로 갈수록 그늘. 나뭇결이 가로로 길게.
  for (let Y = 3 * ART; Y < (H - 1) * ART; Y++) {
    for (let X = ART; X < (W - 1) * ART; X++) {
      const grain = (vnoise(X / 7, Y / 1.3, 121) - 0.5) * 0.22;
      const tone = 0.75 - ((X + 0.5) / ART / W) * 0.3 - (((Y + 0.5) / ART - 3.5) / 6) * 0.25 + grain;
      px.set(X, Y, pick(wood, tone));
    }
  }
  // 위쪽 테(볕) — 그림 점 한 줄은 가장 밝게, 그 아래 한 줄은 한 단계 낮게
  px.hline(ART, (W - 1) * ART - 1, 3 * ART, wood[5]);
  px.hline(ART, (W - 1) * ART - 1, 3 * ART + 1, wood[4]);
  if (filled) {
    // 안쪽에 찬 쌀과 수북한 윗부분
    for (let X = 2 * ART; X < (W - 2) * ART; X++) {
      px.set(X, 4 * ART, RICE[clamp(2 + kernel(X, 4 * ART, 'rice', 123), 1, 3)]);
      px.set(X, 4 * ART + 1, RICE[1]);
    }
    for (let Y = 0; Y < 3 * ART; Y++) {
      const v = (Y + 0.5) / ART - 0.5;
      // 1-라: 맨 위 줄 5~7, 다음 줄 3~9, 그다음 줄 2~10
      const half = v < 0.6 ? 1.2 + v * 1.5 : v < 1.6 ? 2.9 + (v - 1) * 1.2 : 4;
      const hw = (half + 0.5) * ART;
      for (let X = 0; X < W * ART; X++) {
        const dx = X + 0.5 - G(6);
        if (Math.abs(dx) > hw) continue;
        const base = dx < -hw * 0.2 && v < 1.6 ? 3 : 2;
        px.set(X, Y, RICE[clamp(base + Math.min(0, kernel(X, Y, 'rice', 125)), 1, 3)]);
      }
    }
  } else {
    // 빈 되: 안쪽 벽의 그늘
    px.hline(2 * ART, (W - 2) * ART - 1, 4 * ART, wood[0]);
    px.hline(2 * ART, (W - 2) * ART - 1, 4 * ART + 1, wood[1]);
  }
  softOutline(px, rampsFor(wood, RICE));
  calmSprite(px);
  return art(px, 6 * ART, (H - 1) * ART);
}

/** 멍석에 부어 놓은 쌀 한 되(작은 무더기). 빛 하나로 둥글게, 그 위에 잔 알의 결. */
export function riceHeapArt(_pal: Palette): Art {
  const W = 13;
  const H = 9;
  const px = new Px(W * ART, H * ART);
  const mx = G(6);
  for (let Y = ART; Y < (H - 1) * ART; Y++) {
    const v = (Y + 0.5) / ART - 0.5;
    const t = clamp((v - 1) / (H - 3), 0, 1);
    const half = 1.2 + Math.pow(t, 0.7) * 3.8;
    const hw = (half + 0.5) * ART;
    for (let X = 0; X < W * ART; X++) {
      const dx = X + 0.5 - mx;
      if (Math.abs(dx) > hw) continue;
      const u = dx / hw;
      const tone = 0.8 - u * 0.3 - t * 0.2 + kernel(X, Y, 'rice', 131) * 0.18;
      px.set(X, Y, pick(RICE, tone));
    }
  }
  softOutline(px, rampsFor(RICE));
  calmSprite(px);
  return art(px, 6 * ART, (H - 1) * ART);
}

const HEMP = R('#857247', '#a8945f', '#c7b47c', '#dfcf9c', '#efe3bd');

/**
 * 삼베 한 자락. w·h는 놀이 점이고 그림은 그림 점((w + 4) × (h + 2) 놀이 점의 ART배)이다.
 * fray는 끊어 낸 올이 풀린 쪽(왼쪽 -1, 오른쪽 1, 양쪽 2, 없음 0). fold가 있으면 그만큼(놀이 점)마다 접은 금이 보인다(끊을 수 있는 자리다).
 * 손에 드는 것이라 (나) 부드러운 테두리. 끊어 낸 쪽은 테두리 대신 풀린 올이 삐죽삐죽하다.
 */
export function clothPiece(_pal: Palette, w: number, h: number, fray: -1 | 0 | 1 | 2 = 0, fold = 0): Px {
  const px = new Px((w + 4) * ART, (h + 2) * ART);
  const x0 = 2 * ART;
  const y0 = ART;
  for (let Y = 0; Y < h * ART; Y++) {
    const v = (Y + 0.5) / ART;
    for (let X = 0; X < w * ART; X++) {
      const u = (X + 0.5) / ART;
      // 성긴 삼베의 올: 씨실 한 줄(그림 점 하나)마다 굵고 가는 마디가 들쭉날쭉하게 볕을 받거나 그늘진다
      const seg = Math.floor((X + Math.floor(hash2(Y, w, 136) * 5)) / 4);
      const knot = hash2(seg, Y, 137);
      let tone = 0.78 - (v / h) * 0.26 + (knot > 0.76 ? 0.09 : knot < 0.18 ? -0.08 : 0) + ((Y & 1) === 0 ? 0.02 : -0.02);
      if (fold > 0) {
        const fx = u % fold;
        if (u > 1 && fx < 0.5) tone -= 0.3; // 접은 금(그림 점 한 줄)
        else if (u > 1 && fx < 1) tone -= 0.12;
        else if (u > 1 && fx < 2) tone += 0.08;
      }
      px.set(x0 + X, y0 + Y, pick(HEMP, tone));
    }
  }
  const ramps = rampsFor(HEMP);
  softOutline(px, ramps);
  calmSprite(px);
  const ragged = (side: -1 | 1): void => {
    const edge = side < 0 ? x0 - 1 : x0 + w * ART;
    for (let Y = y0; Y < y0 + h * ART; Y++) {
      px.set(edge, Y, 0);
      const len = Math.floor(hash2(Y, w, 139) * 4);
      for (let i = 0; i < len; i++) px.set(edge + side * i, Y, i < 2 ? HEMP[3] : HEMP[2]);
    }
  };
  if (fray === -1 || fray === 2) ragged(-1);
  if (fray === 1 || fray === 2) ragged(1);
  return px;
}

/**
 * 멍석: 짚으로 엮은 깔개(위에서 비스듬히 본 네모). w·h는 놀이 점이고 그림은 그림 점(× ART)이다.
 * 엮은 줄과 매듭은 1-라의 자리(놀이 점 셋·여섯마다)에 두되 그림 점 하나만큼 들쭉날쭉하게, 짚은 가로로 길게 결을 낸다.
 * 바닥에 깔린 것이라 테두리를 두르지 않고 제 빛깔 그늘로 가른다.
 */
export function matArt(pal: Palette, w: number, h: number): Px {
  const px = new Px(w * ART, h * ART);
  const straw = pal.thatch;
  const W = w * ART;
  const H = h * ART;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      // 둥근 귀퉁이(1-라는 귀퉁이 한 점을 비웠다)
      const ex = Math.min(X + 0.5, W - X - 0.5);
      const ey = Math.min(Y + 0.5, H - Y - 0.5);
      if (ex < 2.5 && ey < 2.5 && Math.hypot(2.5 - ex, 2.5 - ey) > 2.6) continue;
      const edge = Math.min(ex, ey) / ART; // 가장자리까지(놀이 점)
      let tone: number;
      if (edge < 1) {
        tone = 0.3; // 둘레를 감친 테의 바깥
      } else if (edge < 2) {
        tone = edge < 1.75 ? 0.86 : 0.72; // 감친 테(도톰하게 밝다)
      } else {
        const uy = (Y + 0.5) / ART;
        const ux = (X + 0.5) / ART;
        // 엮은 줄: 세 놀이 점마다 그림 점 한 줄, 가로로 가며 그림 점 하나만큼 오르내린다
        const wob = Math.round((vnoise(ux / 13, Math.floor(uy / 3), 151) - 0.5) * 1.6);
        const row = Math.floor((Y + wob) / (3 * ART));
        // 짚은 가로로 길다: 가닥마다 볕을 받는 정도가 조금씩 다르다
        tone = 0.62 + (vnoise(X / 9, Y / 0.8, 149) - 0.5) * 0.2 + (vnoise(X / 3, Y / 0.8, 150) - 0.5) * 0.06;
        // 엮은 줄(그림 점 한 줄)은 군데군데 끊기며 옅게
        if ((Y + wob) % (3 * ART) === 0 && vnoise(X / 5, row, 154) > 0.3) tone -= 0.1;
        // 매듭: 여섯 놀이 점마다, 줄마다 셋씩 엇갈린다(자리는 줄마다 그림 점 하나쯤 다르다)
        const jit = Math.floor(hash2(row, Math.floor((ux + (row % 2) * 3) / 6), 152) * 2);
        if ((X - jit + ((row % 2) * 3) * ART) % (6 * ART) === 0 && (Y + wob) % (3 * ART) > 1) tone -= 0.07;
      }
      px.set(X, Y, pick(straw, tone));
    }
  }
  finish(px, rampsFor(straw), 153, { big: 12, bigY: 8, amp: 0.7, fine: 0.4, streak: [16, 1.6, 0.9], up: 0.4, keep: (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y) >= 2 * ART });
  return px;
}

/** 그림자의 빛(1-라는 검푸른 빛이었다 — 이제 따뜻한 밤빛) */
const SHADE = WARM_DARK;

/**
 * 논둑·길가의 작은 그림자(둥글넓적하다). rx·ry는 놀이 점이고 그림은 그림 점이다(크기는 1-라 그대로 — 놀이 점 ceil(2rx) × ceil(2ry)).
 * 가장자리 그림 점 한 줄은 조금 옅어 부드럽게 바닥에 스민다.
 */
export function shadowArt(rx: number, ry: number, strength = 80): Px {
  const w = Math.ceil(rx * 2) * ART;
  const h = Math.ceil(ry * 2) * ART;
  const px = new Px(w, h);
  // 가운데로 갈수록 조금씩 짙다(세 겹 — 테두리 없이 바닥에 스민다)
  px.ellipse(w / 2, h / 2, rx * ART, ry * ART, withAlpha(SHADE, Math.round(strength * 0.6)));
  px.ellipse(w / 2, h / 2, rx * ART - 1.2, ry * ART - 1.2, withAlpha(SHADE, Math.round(strength * 0.85)));
  px.ellipse(w / 2 + 0.6, h / 2 + 0.3, rx * ART * 0.62, ry * ART * 0.5, withAlpha(SHADE, strength));
  return px;
}

/** 그림의 찍힌 자리를 한 빛(반투명)으로 — 멍석처럼 바닥에 깐 것의 그림자 */
export function silhouette(src: Px, c: Color): Px {
  const out = new Px(src.w, src.h);
  for (let i = 0; i < src.d.length; i++) if (src.d[i] !== 0) out.d[i] = c;
  return out;
}

// ── 놀이판의 바탕 ─────────────────────────────────────────────

export interface PaddyOpts {
  season: 'summer' | 'autumn';
  /** 둑의 너비(점) */
  bund: number;
  /** 물을 댄 논인가(여름). 아니면 물을 뺀 흙바닥(가을). */
  wet: boolean;
  /** 큰비에 흙탕물이 든 논 */
  muddy?: boolean;
  /** 물이 고인 자리(논 안의 0~1 자리). 가을의 큰비가 온 해. */
  pools?: readonly { x: number; y: number; rx: number; ry: number }[];
}

/**
 * 위에서 본 논 한 배미: 풀이 난 둑으로 둘러싸여 있다. 볍씨 뿌리기의 봄 논과 같은 짜임이다.
 * w·h·bund는 놀이 점이고, 그림은 그림 점(놀이 점 × ART)으로 칠한다: 꼴(둑의 너비, 물이 고인 자리)은 놀이 점으로 셈하고
 * 결(흙의 알갱이, 풀의 섞임)은 그림 점으로 곱게 칠한다(1배 바탕을 키워 붙이지 않는다 — spec 4.7.5).
 */
export function paintPaddy(w: number, h: number, o: PaddyOpts): Px {
  const pal = paletteOf(o.season);
  const A = ART;
  const px = new Px(w * A, h * A);
  const B = o.bund;
  const deep = o.muddy ? hex('#5d6a55') : hex('#3f6a62');
  const calm = o.muddy ? hex('#74795c') : hex('#4d7a6c');
  const glint = o.muddy ? hex('#9a9a78') : hex('#8db9a6');
  const pool = R('#4f5f66', '#6a7b7c', '#8c9a92', '#b3bcab');
  const fw = Math.max(1, w - B * 2);
  const fh = Math.max(1, h - B * 2);
  for (let y = 0; y < h * A; y++) {
    const uy = (y + 0.5) / A;
    for (let x = 0; x < w * A; x++) {
      const ux = (x + 0.5) / A;
      const edge = Math.min(ux, uy, w - ux, h - uy) - 0.5 + (vnoise(ux / 7, uy / 7, 3) - 0.5) * 3;
      const tex = hash2(x, y, 5);
      let c: Color;
      if (edge < B - 6) {
        c = pick(pal.grass, 0.45 + (fbm(ux / 9, uy / 9, 7) - 0.5) * 0.6 + (tex - 0.5) * 0.2, x, y, 0.6);
      } else if (edge < B - 1) {
        c = tex > 0.8 ? pal.grassTip[1] : pick(pal.soil, 0.7 + (tex - 0.5) * 0.5, x, y, 0.5);
      } else if (edge < B) {
        c = pal.soil[0];
      } else if (o.wet) {
        if (edge < B + 2.2) {
          c = mix(deep, hex('#20302c'), 0.25);
        } else {
          const swell = fbm(ux / 46, uy / 30, 11);
          c = swell > 0.56 ? calm : swell > 0.5 && ((x + y) & 1) === 0 ? calm : deep;
          if (y % (4 * A) === A && hash2(Math.floor(ux / 6), Math.floor(uy), 13) > 0.94) c = glint;
        }
      } else {
        // 물을 뺀 가을 논바닥: 마른 흙과 군데군데 남은 짚 부스러기
        const lump = fbm(ux / 22, uy / 16, 17);
        c = pick(pal.mud, 0.42 + (lump - 0.5) * 0.9 + (tex - 0.5) * 0.25, x, y, 0.5);
        if (hash2(x >> 1, y >> 1, 6) > 0.965) c = pal.thatchOld[4];
        if (edge < B + 1.5) c = pal.mud[0];
        // 큰비에 물이 고인 자리: 흙탕물과 쓰러진 벼
        if (o.pools && o.pools.length > 0) {
          const nx = (ux - B) / fw;
          const ny = (uy - B) / fh;
          for (const p of o.pools) {
            const dx = (nx - p.x) / p.rx;
            const dy = (ny - p.y) / p.ry;
            const d = dx * dx + dy * dy + (vnoise(ux / 9, uy / 9, 19) - 0.5) * 0.35;
            if (d < 1) {
              const depth = 1 - d;
              c = pick(pool, 0.2 + depth * 0.6 + (vnoise(ux / 14, uy / 5, 23) - 0.5) * 0.5, x, y, 0.6);
              if (d > 0.82) c = pal.mud[0]; // 물가의 젖은 흙
              // 물에 쓰러져 썩어 가는 벼(어두운 누런 가닥)
              const lay = hash2(Math.floor(ux / 5), Math.floor(uy / 3), 29);
              if (lay > 0.72 && d < 0.8 && (Math.floor(ux) + Math.floor(uy / 3)) % 5 < 4 && y % (3 * A) < A) c = lay > 0.86 ? STALK[1] : STALK[0];
              if (y % (5 * A) === 2 * A && hash2(Math.floor(ux / 7), Math.floor(uy), 37) > 0.9 && d < 0.6) c = pool[3]; // 잔물결
            }
          }
        }
      }
      px.set(x, y, c);
    }
  }
  return px;
}

/** 마당이나 길가의 흙바닥(위쪽에 가을 풀밭이 띠처럼 있다). w·h·grassH는 놀이 점이고 그림은 그림 점이다(paintPaddy와 같다). */
export function paintYard(w: number, h: number, season: 'autumn' | 'winter', grassH: number): Px {
  const pal = paletteOf(season);
  const A = ART;
  const px = new Px(w * A, h * A);
  for (let y = 0; y < h * A; y++) {
    const uy = (y + 0.5) / A;
    for (let x = 0; x < w * A; x++) {
      const ux = (x + 0.5) / A;
      const tex = hash2(x, y, 41);
      const wave = (vnoise(ux / 11, 0, 43) - 0.5) * 5;
      let c: Color;
      if (uy < grassH + wave - 2) {
        c = pick(pal.grass, 0.42 + (fbm(ux / 10, uy / 8, 47) - 0.5) * 0.7 + (tex - 0.5) * 0.2, x, y, 0.6);
        if (hash2(x >> 1, y, 46) > 0.95) c = pal.grassTip[2];
      } else if (uy < grassH + wave) {
        c = tex > 0.5 ? pal.grass[1] : pal.yard[0];
      } else {
        const lump = fbm(ux / 26, uy / 14, 53);
        c = pick(pal.yard, 0.5 + (lump - 0.5) * 0.7 + (tex - 0.5) * 0.18, x, y, 0.5);
        const speck = hash2(x >> 1, y >> 1, 44);
        if (speck > 0.985) c = pal.stone[3];
        else if (speck < 0.012) c = pal.yard[0];
      }
      px.set(x, y, c);
    }
  }
  return px;
}


/**
 * 손짓을 알려 주는 굵은 화살표(도트). dir: 0 오른쪽, 1 아래, 2 왼쪽. 글씨가 아니라 그림이다.
 * 크기는 1-라 그대로(놀이 점 15×11 — 그림 점 30×22). 화살촉의 빗변은 그림 점 하나씩 곱게 내려가고,
 * 테두리는 먹빛이 아니라 edge(따뜻한 짙은 밤빛)로 1-라만큼 또렷하게(그림 점 둘) 두른다. 몸의 오른쪽 아래 한 줄은 조금 그늘진다.
 */
export function arrowArt(dir: 0 | 1 | 2, body: Color, edge: Color): Px {
  const W = 15 * ART;
  const H = 11 * ART;
  const base = new Px(W, H);
  // 오른쪽을 가리키는 화살표: 자루(1-라의 4~6줄, 1~8칸)와 화살촉(9~13칸)
  base.rect(ART, 4 * ART, 8 * ART, 3 * ART, body);
  for (let X = 9 * ART; X < 14 * ART; X++) {
    const top = Math.max(ART, X - 17);
    const bottom = Math.min(10 * ART - 1, 38 - X);
    base.vline(X, top, bottom, body);
  }
  // 몸의 볕과 그늘: 아래쪽 반은 아주 조금 낮고(한 단계), 오른쪽 아래 가장자리 한 줄은 그늘
  const low = mix(body, edge, 0.07);
  const shade = mix(body, edge, 0.18);
  const src = base.d.slice();
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && src[y * W + x] !== 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      if (!on(x, y + 1) || !on(x + 1, y + 1)) base.set(x, y, shade);
      else if (y >= 11 || x > 23) base.set(x, y, low);
    }
  }
  // 테두리: 그림 점 둘 — 안쪽 한 겹은 귀퉁이까지, 바깥 한 겹은 귀퉁이를 비워 둥글게
  base.outline(edge, true);
  base.outline(edge, false);
  if (dir === 0) return base;
  if (dir === 2) return base.flipX();
  const down = new Px(H, W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) down.set(H - 1 - y, x, base.get(x, y));
  return down;
}

const THREAD = R('#b8a877', '#d9cc9f', '#f1e8c6');

/**
 * 베 짜기의 북: 배처럼 생긴 나무통. 가운데에 씨실을 감은 꾸리가 들어 있다.
 * 1-라의 꼴(놀이 점 21×9 — 놓는 자리는 가운데 10·4)을 그림 점으로. 손에 드는 것이라 (나) 부드러운 테두리.
 */
export function shuttleArt(pal: Palette): Art {
  const W = 21;
  const H = 9;
  const px = new Px(W * ART, H * ART);
  const wood = pal.wood;
  const mx = G(10);
  // 통: 가운데가 불룩하고 양 끝이 뾰족하다(1-라의 너비 5·8·9·9·9·8·5). 위가 볕, 아래가 그늘, 나뭇결은 가로로 길게.
  for (let Y = ART; Y < 8 * ART; Y++) {
    const v = (Y + 0.5) / ART - 0.5;
    const e = Math.abs(v - 4) / 3;
    const half = 9.4 - 4.4 * e ** 3;
    const hw = (half + 0.5) * ART;
    for (let X = 0; X < W * ART; X++) {
      const dx = X + 0.5 - mx;
      if (Math.abs(dx) > hw) continue;
      const grain = (vnoise(X / 8, Y / 1.4, 141) - 0.5) * 0.16;
      px.set(X, Y, pick(wood, 0.86 - (v - 1) / 8.5 - Math.abs(dx / ART) / 40 + grain));
    }
  }
  // 꾸리: 씨실을 가로로 감았다(감긴 실 한 줄마다 볕과 그늘), 양 끝은 한 단계 그늘
  for (let Y = 3 * ART; Y < 6 * ART; Y++) {
    for (let X = 6 * ART; X < 15 * ART; X++) {
      const end = X === 6 * ART || X === 15 * ART - 1;
      const row = (Y - 3 * ART) % 2 === 0 ? 2 : 1;
      const slub = hash2(X >> 2, Y, 143) > 0.82 ? -1 : 0;
      px.set(X, Y, THREAD[clamp(row - (end ? 1 : 0) + slub, 0, 2)]);
    }
  }
  // 꾸리 아래의 홈(그늘)
  px.hline(6 * ART, 15 * ART - 1, 6 * ART, wood[1]);
  px.hline(6 * ART + 1, 15 * ART - 2, 6 * ART + 1, wood[2]);
  softOutline(px, rampsFor(wood, THREAD));
  calmSprite(px);
  return art(px, 10 * ART, 4 * ART);
}

/** 볍씨(밝은 누런 낟알): 빛깔 셋마다 [그늘, 몸, 볕] */
const SEED_TONES = [R('#d2ad3e', '#f7d95f', '#fff8cf'), R('#c99f34', '#f1c94a', '#fff8cf'), R('#d8bd62', '#fbe488', '#fff8cf')];
/** 볍씨 밑의 그늘(1-라는 먹빛이었다 — 따뜻한 짙은 밤빛을 반투명하게) */
const SEED_SHADOW = withAlpha(hex('#3a2416'), 150);

/**
 * 볍씨 한 알(볍씨 뿌리기). tone은 놀이가 정한 빛깔(0~5): 짝수면 누운 알(놀이 점 3×2), 홀수면 선 알(2×3).
 * 날아가는 알(fly)은 놀이 점 2×2. 그림은 왼쪽 위에 맞춰 놓는다 — 밑의 그늘이 아래·오른쪽으로 놀이 점 하나 비낀다(1-라 그대로).
 */
export function seedArt(tone: number, fly = false): Px {
  const lying = tone % 2 === 0;
  const bw = fly ? 2 : lying ? 3 : 2;
  const bh = fly ? 2 : lying ? 2 : 3;
  // 그늘: 1-라의 (x, y + 1)에서 (bw + 1) × bh(날아가는 알은 bw × bh) — 둥글게
  const sw = fly ? bw : bw + 1;
  const px = new Px(sw * ART, (bh + 1) * ART);
  const ramp = SEED_TONES[tone % SEED_TONES.length];
  px.ellipse((sw * ART) / 2, ART + (bh * ART) / 2, (sw * ART) / 2, (bh * ART) / 2, SEED_SHADOW);
  // 낟알: 빛 하나(왼쪽 위가 밝고 오른쪽 아래가 그늘)
  ball(px, (bw * ART) / 2, (bh * ART) / 2, (bw * ART) / 2, (bh * ART) / 2, ramp, { lo: 1, hi: 2, rim: 0 });
  if (!fly) px.set(lying ? ART : ART - 1, lying ? ART - 1 : ART, ramp[2]);
  return px;
}
