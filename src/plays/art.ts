// 일 놀이의 도트 그림: 벼와 풀, 볏단, 자루와 되, 베, 멍석 — 모두 화소 버퍼(Px)에 한 점씩 찍어 만든다.
// 빛깔은 맵과 같은 벌(pixel/palette.ts의 계절 벌)에서 가져온다. 그때 없던 것(줄 맞춘 모, 엽전, 저울, 글씨)은 그리지 않는다.
// 생김새(되, 자루, 베틀)는 확인하지 못한 것이 많아 단순하게 그렸다(spec 12.3의 21번).

import { paletteOf, type Palette, type Ramp } from '../pixel/palette';
import { Px, clamp, hash2, hex, mix, pick, vnoise, fbm, type Color } from '../pixel/px';
import { rim } from '../pixel/shapes';

const R = (...list: string[]): Ramp => list.map((s) => hex(s));

/** 그림 한 장과 밑동의 자리 */
export interface Art {
  px: Px;
  ax: number;
  ay: number;
}

const art = (px: Px, ax: number, ay: number): Art => ({ px, ax, ay });

// ── 여름 논의 벼와 풀 ─────────────────────────────────────────

/** 잎 한 가닥: 밑동에서 끝까지 휘어 올라간다(어두운 쪽을 먼저 찍고 그 위에 밝은 가닥을 얹는다) */
function blade(px: Px, x0: number, y0: number, x1: number, y1: number, body: Color, tip: Color, shade: Color): void {
  const mx = x0 + (x1 - x0) * 0.35;
  const my = y0 + (y1 - y0) * 0.6;
  px.line(x0 + 1, y0, mx + 1, my, shade);
  px.line(mx + 1, my, x1 + 1, y1, shade);
  px.line(x0, y0, mx, my, body);
  px.line(mx, my, x1, y1, body);
  px.set(Math.round(x1), Math.round(y1), tip);
}

/**
 * 여름의 벼 포기: 가는 잎이 부채처럼 퍼져 올라간다. 밝은 풀빛이고 끝이 누르스름하다.
 * lean이 -1·1이면 그쪽으로 누운 모습이다(건드리면 잠깐 눕는다).
 */
export function riceTuft(pal: Palette, look: number, lean: -1 | 0 | 1 = 0): Art {
  const W = 19;
  const H = 17;
  const px = new Px(W, H);
  const bx = 9;
  const by = H - 2;
  const crop = pal.crop;
  const n = 5 + (look % 3);
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
    const body = i % 2 === 0 ? crop[2] : crop[1];
    blade(px, bx, by, clamp(tx, 0, W - 2), ty, body, crop[3], crop[0]);
  }
  // 밑동
  px.set(bx - 1, by, crop[0]);
  px.set(bx, by, crop[1]);
  px.set(bx + 1, by, crop[0]);
  px.set(bx, by + 1, crop[0]);
  return art(px, bx, by + 1);
}

const WEED_HEAD = R('#4a2a3a', '#6e3f52', '#93596c', '#b98394');
const WEED_FLOWER = R('#6a55ae', '#9d8be0', '#e3dcff');
const WEED_SPIKE = R('#6e5522', '#a1803a', '#d0ad5c');

/**
 * 논의 풀 세 가지(벼와 생김새가 다르다 — 빛깔만으로 가르지 않는다).
 *   0 피 같은 풀: 벼보다 키가 크고 짙으며, 끝에 검붉은 이삭이 늘어진다
 *   1 잎이 넓은 풀: 낮게 퍼진 둥근 잎과 보랏빛 작은 꽃
 *   2 우산살 같은 풀: 곧은 줄기 끝에 살이 별처럼 퍼진다
 */
export function weedArt(pal: Palette, kind: number, look = 0): Art {
  const k = ((kind % 3) + 3) % 3;
  if (k === 0) {
    const W = 21;
    const H = 23;
    const px = new Px(W, H);
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
    ends.forEach(([dx, dy], i) => blade(px, bx, by, bx + dx, by + dy + (look % 2), i % 2 === 0 ? deep[4] : deep[3], deep[5], deep[1]));
    // 늘어진 이삭 둘(검붉다)
    const head = (x: number, y: number, dir: number): void => {
      for (let i = 0; i < 6; i++) {
        const hx = x + dir * Math.round(i * 0.9);
        const hy = y + Math.round((i * i) / 7);
        px.set(hx, hy, WEED_HEAD[i < 2 ? 1 : 2]);
        px.set(hx, hy + 1, WEED_HEAD[0]);
        if (i % 2 === 0) px.set(hx + dir, hy, WEED_HEAD[3]);
      }
    };
    head(bx, by - 20, 1);
    head(bx - 3, by - 16, -1);
    px.set(bx - 1, by, deep[0]);
    px.set(bx, by, deep[1]);
    px.set(bx + 1, by, deep[0]);
    px.set(bx, by + 1, deep[0]);
    return art(px, bx, by + 1);
  }
  if (k === 1) {
    const W = 17;
    const H = 12;
    const px = new Px(W, H);
    const bx = 8;
    const by = H - 2;
    const deep = pal.leafDeep;
    const leaf = (cx: number, cy: number, rx: number, ry: number): void => {
      px.ellipse(cx + 0.5, cy + 0.8, rx, ry, deep[1]);
      px.ellipse(cx, cy, rx, ry, deep[3]);
      px.ellipse(cx - 0.6, cy - 0.5, rx * 0.5, ry * 0.45, deep[5]);
      px.set(Math.round(cx), Math.round(cy), deep[2]); // 잎맥
    };
    leaf(bx - 4.5, by - 2, 3.4, 2.4);
    leaf(bx + 4.5, by - 2.5, 3.4, 2.4);
    leaf(bx + 0.5, by - 5, 3, 2.6);
    leaf(bx + (look % 2 === 0 ? -1 : 1), by - 0.5, 3, 1.8);
    // 보랏빛 작은 꽃
    px.set(bx + 1, by - 8, WEED_FLOWER[1]);
    px.set(bx, by - 9, WEED_FLOWER[2]);
    px.set(bx + 2, by - 9, WEED_FLOWER[1]);
    px.set(bx + 1, by - 10, WEED_FLOWER[0]);
    px.set(bx + 1, by - 9, WEED_FLOWER[2]);
    return art(px, bx, by + 1);
  }
  const W = 17;
  const H = 19;
  const px = new Px(W, H);
  const bx = 8;
  const by = H - 2;
  const warm = pal.leafWarm;
  // 곧은 줄기와 밑동의 짧은 잎 둘
  px.vline(bx + 1, by - 12, by, warm[0]);
  px.vline(bx, by - 13, by, warm[3]);
  px.line(bx, by, bx - 5, by - 5, warm[2]);
  px.line(bx, by, bx + 5, by - 4, warm[2]);
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
  for (const [dx, dy] of rays) {
    px.line(cx, cy, cx + dx, cy + dy, warm[4]);
    px.set(cx + dx, cy + dy, WEED_SPIKE[2]);
    px.set(cx + dx + (dx < 0 ? -1 : dx > 0 ? 1 : 0), cy + dy, WEED_SPIKE[1]);
    px.set(cx + dx, cy + dy + 1, WEED_SPIKE[0]);
  }
  px.set(cx, cy, warm[5]);
  px.set(bx, by + 1, warm[0]);
  return art(px, bx, by + 1);
}

// ── 가을 논의 벼, 그루터기, 볏단 ───────────────────────────────

const EAR = R('#8a6a1e', '#c59a2b', '#e8c544', '#f9e486', '#fff6c4');
const STALK = R('#6b5a26', '#93803a', '#b9a652', '#d8c873');

/** 누렇게 익은 벼 포기: 줄기 끝마다 낟알이 여문 이삭이 무겁게 고개를 숙인다 */
export function goldClump(look: number): Art {
  const W = 25;
  const H = 21;
  const px = new Px(W, H);
  const bx = 12;
  const by = H - 2;
  const n = 6 + (look % 2);
  // 누렇게 마른 잎 몇 가닥(이삭 사이로 비친다)
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) / 1.5;
    px.line(bx, by, Math.round(bx + spread * 8), by - 8 + Math.round(Math.abs(spread) * 3), STALK[i % 2 === 0 ? 1 : 0]);
  }
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const spread = (t - 0.5) * 2;
    const tall = 15 - Math.abs(spread) * 5 - (hash2(i, look, 57) > 0.6 ? 1 : 0);
    const tx = Math.round(bx + spread * 5);
    const ty = by - tall;
    px.line(bx + 1, by, tx + 1, ty, STALK[0]);
    px.line(bx, by, tx, ty, i % 2 === 0 ? STALK[3] : STALK[2]);
    // 고개 숙인 이삭(바깥쪽으로 휘어 늘어진다. 낟알이 두 줄로 붙어 도톰하다)
    const dir = spread < -0.05 ? -1 : spread > 0.05 ? 1 : look % 2 === 0 ? 1 : -1;
    const len = 6;
    for (let k = 0; k < len; k++) {
      const ex = tx + dir * Math.round(k * 0.85);
      const ey = ty + Math.round((k * k) / 4.2);
      px.set(ex, ey + 2, EAR[0]);
      px.set(ex, ey + 1, k % 2 === 0 ? EAR[2] : EAR[1]);
      px.set(ex, ey, k === 0 ? EAR[2] : EAR[3]);
      if (k === 2 || k === 3) px.set(ex, ey - 1, EAR[4]);
    }
  }
  px.set(bx - 1, by, STALK[0]);
  px.set(bx, by, STALK[1]);
  px.set(bx + 1, by, STALK[0]);
  px.set(bx, by + 1, STALK[0]);
  return art(px, bx, by + 1);
}

/** 벤 자리의 그루터기(짧은 밑동 몇 가닥). ears가 참이면 흘린 이삭이 곁에 남아 있다. */
export function stubbleArt(look: number, ears = false): Art {
  const W = 15;
  const H = 8;
  const px = new Px(W, H);
  const bx = 7;
  const by = H - 2;
  for (let i = -2; i <= 2; i++) {
    const tall = 2 + (hash2(i, look, 71) > 0.5 ? 1 : 0);
    px.vline(bx + i * 2, by - tall, by, i % 2 === 0 ? STALK[2] : STALK[1]);
    px.set(bx + i * 2, by - tall, STALK[3]);
    px.set(bx + i * 2 + 1, by, STALK[0]);
  }
  if (ears) {
    px.set(bx + 5, by, EAR[3]);
    px.set(bx + 6, by, EAR[2]);
    px.set(bx + 6, by + 1, EAR[0]);
    px.set(bx - 6, by - 1, EAR[3]);
    px.set(bx - 5, by - 1, EAR[2]);
    px.set(bx - 5, by, EAR[0]);
  }
  return art(px, bx, by + 1);
}

/** 베어 눕혀 놓은 벼 한 줌: 밑동 쪽은 가지런하고 이삭 쪽은 퍼져 있다 */
export function swathArt(look: number): Art {
  const W = 19;
  const H = 9;
  const px = new Px(W, H);
  for (let k = -2; k <= 2; k++) {
    const y0 = 4 + Math.round(k * 0.5);
    const y1 = 4 + Math.round(k * 1.5);
    px.line(1, y0 + 1, 12, y1 + 1, STALK[0]);
    px.line(1, y0, 12, y1, k % 2 === 0 ? STALK[3] : STALK[2]);
    // 이삭
    for (let x = 12; x < 18; x++) {
      const y = y1 + Math.round(((x - 12) * k) / 9);
      px.set(x, y + 1, EAR[0]);
      px.set(x, y, hash2(x, k, 83 + look) > 0.4 ? EAR[3] : EAR[2]);
    }
  }
  px.set(0, 4, STALK[1]);
  px.set(0, 5, STALK[0]);
  return art(look % 2 === 1 ? px.flipX() : px, 9, 6);
}

/** 볏단: 벼를 한 아름 묶어 세운 단. 허리를 새끼로 묶었고 위에 이삭이 수북하다. */
export function sheafArt(pal: Palette): Art {
  const W = 23;
  const H = 30;
  const px = new Px(W, H);
  const cx = 11;
  // 줄기(아래가 퍼지고 허리가 잘록하다)
  for (let y = 9; y < H - 2; y++) {
    const t = (y - 9) / (H - 11);
    const waist = Math.abs(t - 0.42);
    const half = Math.round(3.2 + waist * 9);
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / (half + 0.01);
      const streak = hash2(x + Math.round(u * 3), 0, 101) * 0.5;
      let tone = 0.62 - u * 0.22 + streak * 0.4 - (y > H - 5 ? 0.2 : 0);
      if ((x + cx) % 3 === 0) tone -= 0.16;
      px.set(x, y, pick(STALK, tone, x, y, 0.4));
    }
  }
  // 허리의 새끼줄
  for (let x = cx - 4; x <= cx + 4; x++) {
    px.set(x, 17, pal.thatch[1]);
    px.set(x, 18, (x & 1) === 0 ? pal.thatch[3] : pal.thatch[0]);
  }
  // 위의 이삭 다발
  for (let y = 1; y < 12; y++) {
    const t = (y - 1) / 10;
    const half = Math.round(4 + Math.sin(t * Math.PI) * 6);
    for (let x = cx - half; x <= cx + half; x++) {
      const h = hash2(x, y, 107);
      const u = (x - cx) / (half + 0.01);
      // 낟알 사이의 그늘은 짙은 누런빛으로(구멍을 내지 않는다 — 테두리 먹빛이 속으로 번지지 않게)
      px.set(x, y, h < 0.12 ? EAR[0] : pick(EAR, 0.72 - u * 0.25 - t * 0.2 + (h - 0.5) * 0.5, x, y, 0.5));
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return art(px, cx, H - 2);
}

// ── 값 치르기의 것들 ───────────────────────────────────────────

const RICE = R('#b9ad8c', '#dcd3b6', '#f1ebd6', '#fffbee');
const SALT = R('#8e9aa5', '#b9c4cb', '#dfe7ea', '#ffffff');

const SACK = R('#5f4a2c', '#84693d', '#a98b55', '#c9ac73', '#e2cb97', '#f1e2b9');
/** 껍질을 벗기지 않은 벼 낟알(누렇다) */
const GRAIN = R('#b0892a', '#d8b53d', '#f2dc74', '#fff0a8');

/**
 * 곡식이나 소금을 담은 자루. 아가리를 접어 내려 속이 보인다(쌀은 희고 잘며, 소금은 희고 굵고, 갓 떨어낸 벼 낟알은 누렇다).
 * full(0~1)은 쌀이 남은 만큼이다 — 퍼낼수록 속이 내려간다.
 */
export function sackArt(pal: Palette, holds: 'rice' | 'salt' | 'grain', full = 1): Art {
  const W = 27;
  const H = 29;
  const px = new Px(W, H);
  const cx = 13;
  // 몸통: 아래가 넓고 묵직하다. 세로로 접힌 주름이 몇 줄 있다.
  for (let y = 8; y < H - 1; y++) {
    const t = (y - 8) / (H - 10);
    const half = Math.round(8 + Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * 3.6 - (t > 0.9 ? 1 : 0));
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / (half + 0.01);
      let tone = 0.7 - u * 0.34 - t * 0.12 + (hash2(x, y, 113) - 0.5) * 0.1;
      if (x === cx - 4 || x === cx + 5) tone -= 0.16; // 주름
      if (x === cx - 3 || x === cx + 6) tone += 0.08;
      if ((x + y * 2) % 5 === 0) tone -= 0.05; // 굵은 올
      if (y > H - 4) tone -= 0.18;
      px.set(x, y, pick(SACK, tone, x, y, 0.4));
    }
  }
  // 접어 내린 아가리(도톰한 테)와 그 안에 든 것
  const fill = holds === 'rice' ? RICE : holds === 'grain' ? GRAIN : SALT;
  const sink = Math.round((1 - full) * 3);
  for (let y = 3; y <= 11; y++) {
    for (let x = cx - 9; x <= cx + 9; x++) {
      const dx = (x - cx) / 9;
      const dy = (y - 8) / 3.6;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (d > 0.56) {
        px.set(x, y, pick(SACK, 0.86 - dx * 0.2 + (y > 8 ? -0.22 : 0), x, y, 0.3));
        continue;
      }
      // 속: 가득하면 수북하고, 퍼낼수록 그늘이 진다
      const h = hash2(x, y, 127);
      if (full <= 0) {
        px.set(x, y, SACK[0]);
        continue;
      }
      let c = fill[h > 0.7 ? 3 : h > 0.28 ? 2 : 1];
      if (holds === 'salt' && h > 0.88) c = hex('#cfe6f2'); // 굵은 소금 알의 푸른 기
      if (sink > 0 && y < 6 + sink) c = SACK[0];
      px.set(x, y, c);
    }
  }
  if (full >= 1) {
    // 수북이 올라온 윗부분
    for (let y = 1; y <= 4; y++) {
      const half = y === 1 ? 2 : y === 2 ? 4 : 5;
      for (let x = cx - half; x <= cx + half; x++) {
        const h = hash2(x, y, 129);
        let c = fill[h > 0.55 ? 3 : 2];
        if (holds === 'salt' && h > 0.85) c = hex('#cfe6f2');
        px.set(x, y, c);
      }
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return art(px, cx, H - 2);
}

/** 되: 곡식을 되는 네모난 나무 그릇. filled면 쌀이 수북하다. */
export function measureArt(pal: Palette, filled: boolean): Art {
  const W = 13;
  const H = 10;
  const px = new Px(W, H);
  const wood = pal.wood;
  for (let y = 3; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const tone = 0.75 - (x / W) * 0.3 - ((y - 3) / 6) * 0.25;
      px.set(x, y, pick(wood, tone, x, y, 0.4));
    }
  }
  px.hline(1, W - 2, 3, wood[5]);
  px.hline(2, W - 3, 4, filled ? RICE[2] : wood[0]);
  if (filled) {
    px.hline(2, W - 3, 2, RICE[3]);
    px.hline(3, W - 4, 1, RICE[3]);
    px.hline(5, W - 6, 0, RICE[2]);
    px.set(4, 2, RICE[1]);
    px.set(8, 1, RICE[1]);
  }
  rim(px, pal.ink, pal.inkSoft);
  return art(px, 6, H - 1);
}

/** 멍석에 부어 놓은 쌀 한 되(작은 무더기) */
export function riceHeapArt(pal: Palette): Art {
  const W = 13;
  const H = 9;
  const px = new Px(W, H);
  for (let y = 1; y < H - 1; y++) {
    const t = (y - 1) / (H - 3);
    const half = Math.round(1.2 + Math.pow(t, 0.7) * 3.8);
    for (let x = 6 - half; x <= 6 + half; x++) {
      const h = hash2(x, y, 131);
      const u = (x - 6) / (half + 0.01);
      px.set(x, y, pick(RICE, 0.8 - u * 0.3 - t * 0.2 + (h - 0.5) * 0.4, x, y, 0.4));
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return art(px, 6, H - 1);
}

const HEMP = R('#857247', '#a8945f', '#c7b47c', '#dfcf9c', '#efe3bd');

/**
 * 삼베 한 자락. fray는 끊어 낸 올이 풀린 쪽(왼쪽 -1, 오른쪽 1, 양쪽 2, 없음 0).
 * fold가 있으면 그만큼마다 접은 금이 보인다(끊을 수 있는 자리다).
 */
export function clothPiece(pal: Palette, w: number, h: number, fray: -1 | 0 | 1 | 2 = 0, fold = 0): Px {
  const px = new Px(w + 4, h + 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let tone = 0.78 - (y / h) * 0.26 + (hash2(x, y, 137) - 0.5) * 0.1;
      if ((x + y) % 2 === 0) tone -= 0.07; // 성긴 삼베의 올
      if (fold > 0 && x > 0 && x % fold === 0) tone -= 0.3; // 접은 금
      if (fold > 0 && x % fold === 1 && x > 1) tone += 0.1;
      px.set(x + 2, y + 1, pick(HEMP, tone, x, y, 0.3));
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  // 끊어 낸 쪽은 테두리 대신 풀린 올이 삐죽삐죽하다
  const ragged = (side: -1 | 1): void => {
    const edge = side < 0 ? 1 : w + 2;
    for (let y = 1; y <= h; y++) {
      px.set(edge, y, 0);
      if (y % 2 === 1) {
        px.set(edge, y, HEMP[3]);
        if (hash2(y, w, 139) > 0.4) px.set(edge + side, y, HEMP[2]);
      }
    }
  };
  if (fray === -1 || fray === 2) ragged(-1);
  if (fray === 1 || fray === 2) ragged(1);
  return px;
}

/** 멍석: 짚으로 엮은 깔개(위에서 비스듬히 본 네모) */
export function matArt(pal: Palette, w: number, h: number): Px {
  const px = new Px(w, h);
  const straw = pal.thatch;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const corner = (x < 2 || x > w - 3) && (y < 2 || y > h - 3);
      if (corner && edge < 1) continue;
      let tone = 0.62 + (hash2(x >> 1, y, 149) - 0.5) * 0.2;
      // 엮은 결: 가로줄이 두 점마다 엇갈린다
      if (y % 3 === 0) tone -= 0.14;
      if ((x + (Math.floor(y / 3) % 2) * 3) % 6 === 0) tone -= 0.1;
      if (edge < 2) tone = edge === 0 ? 0.28 : 0.82; // 둘레를 감친 테
      px.set(x, y, pick(straw, tone, x, y, 0.3));
    }
  }
  return px;
}

/** 논둑·길가의 작은 그림자(둥글넓적하다) */
export function shadowArt(rx: number, ry: number, strength = 80): Px {
  const w = Math.ceil(rx * 2);
  const h = Math.ceil(ry * 2);
  const px = new Px(w, h);
  const c = hex('#1a2030', strength);
  px.ellipse(w / 2, h / 2, rx, ry, c);
  return px;
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

/** 위에서 본 논 한 배미: 풀이 난 둑으로 둘러싸여 있다. 볍씨 뿌리기의 봄 논과 같은 짜임이다. */
export function paintPaddy(w: number, h: number, o: PaddyOpts): Px {
  const pal = paletteOf(o.season);
  const px = new Px(w, h);
  const B = o.bund;
  const deep = o.muddy ? hex('#5d6a55') : hex('#3f6a62');
  const calm = o.muddy ? hex('#74795c') : hex('#4d7a6c');
  const glint = o.muddy ? hex('#9a9a78') : hex('#8db9a6');
  const pool = R('#4f5f66', '#6a7b7c', '#8c9a92', '#b3bcab');
  const fw = Math.max(1, w - B * 2);
  const fh = Math.max(1, h - B * 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y) + (vnoise(x / 7, y / 7, 3) - 0.5) * 3;
      const tex = hash2(x, y, 5);
      let c: Color;
      if (edge < B - 6) {
        c = pick(pal.grass, 0.45 + (fbm(x / 9, y / 9, 7) - 0.5) * 0.6 + (tex - 0.5) * 0.2, x, y, 0.6);
      } else if (edge < B - 1) {
        c = tex > 0.8 ? pal.grassTip[1] : pick(pal.soil, 0.7 + (tex - 0.5) * 0.5, x, y, 0.5);
      } else if (edge < B) {
        c = pal.soil[0];
      } else if (o.wet) {
        if (edge < B + 2.2) {
          c = mix(deep, hex('#20302c'), 0.25);
        } else {
          const swell = fbm(x / 46, y / 30, 11);
          c = swell > 0.56 ? calm : swell > 0.5 && ((x + y) & 1) === 0 ? calm : deep;
          if (y % 4 === 1 && hash2(Math.floor(x / 6), y, 13) > 0.94) c = glint;
        }
      } else {
        // 물을 뺀 가을 논바닥: 마른 흙과 군데군데 남은 짚 부스러기
        const lump = fbm(x / 22, y / 16, 17);
        c = pick(pal.mud, 0.42 + (lump - 0.5) * 0.9 + (tex - 0.5) * 0.25, x, y, 0.5);
        if (tex > 0.965) c = pal.thatchOld[4];
        if (edge < B + 1.5) c = pal.mud[0];
        // 큰비에 물이 고인 자리: 흙탕물과 쓰러진 벼
        if (o.pools && o.pools.length > 0) {
          const nx = (x - B) / fw;
          const ny = (y - B) / fh;
          for (const p of o.pools) {
            const dx = (nx - p.x) / p.rx;
            const dy = (ny - p.y) / p.ry;
            const d = dx * dx + dy * dy + (vnoise(x / 9, y / 9, 19) - 0.5) * 0.35;
            if (d < 1) {
              const depth = 1 - d;
              c = pick(pool, 0.2 + depth * 0.6 + (vnoise(x / 14, y / 5, 23) - 0.5) * 0.5, x, y, 0.6);
              if (d > 0.82) c = pal.mud[0]; // 물가의 젖은 흙
              // 물에 쓰러져 썩어 가는 벼(어두운 누런 가닥)
              const lay = hash2(Math.floor(x / 5), Math.floor(y / 3), 29);
              if (lay > 0.72 && d < 0.8 && (x + Math.floor(y / 3)) % 5 < 4 && y % 3 === 0) c = lay > 0.86 ? STALK[1] : STALK[0];
              if (y % 5 === 2 && hash2(Math.floor(x / 7), y, 37) > 0.9 && d < 0.6) c = pool[3]; // 잔물결
            }
          }
        }
      }
      px.set(x, y, c);
    }
  }
  return px;
}

/** 마당이나 길가의 흙바닥(위쪽에 가을 풀밭이 띠처럼 있다) */
export function paintYard(w: number, h: number, season: 'autumn' | 'winter', grassH: number): Px {
  const pal = paletteOf(season);
  const px = new Px(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tex = hash2(x, y, 41);
      const wave = (vnoise(x / 11, 0, 43) - 0.5) * 5;
      let c: Color;
      if (y < grassH + wave - 2) {
        c = pick(pal.grass, 0.42 + (fbm(x / 10, y / 8, 47) - 0.5) * 0.7 + (tex - 0.5) * 0.2, x, y, 0.6);
        if (tex > 0.95) c = pal.grassTip[2];
      } else if (y < grassH + wave) {
        c = tex > 0.5 ? pal.grass[1] : pal.yard[0];
      } else {
        const lump = fbm(x / 26, y / 14, 53);
        c = pick(pal.yard, 0.5 + (lump - 0.5) * 0.7 + (tex - 0.5) * 0.18, x, y, 0.5);
        if (tex > 0.985) c = pal.stone[3];
        else if (tex < 0.012) c = pal.yard[0];
      }
      px.set(x, y, c);
    }
  }
  return px;
}

/** 손짓을 알려 주는 굵은 화살표(도트). dir: 0 오른쪽, 1 아래, 2 왼쪽. 글씨가 아니라 그림이다. */
export function arrowArt(dir: 0 | 1 | 2, body: Color, edge: Color): Px {
  const W = 15;
  const H = 11;
  const base = new Px(W, H);
  // 오른쪽을 가리키는 화살표
  for (let y = 4; y <= 6; y++) for (let x = 1; x <= 8; x++) base.set(x, y, body);
  for (let i = 0; i <= 4; i++) base.vline(13 - i, 5 - i, 5 + i, body);
  base.outline(edge, true);
  if (dir === 0) return base;
  if (dir === 2) return base.flipX();
  const down = new Px(H, W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) down.set(H - 1 - y, x, base.get(x, y));
  return down;
}

