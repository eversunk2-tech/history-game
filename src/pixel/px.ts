// 점 그림 바탕. 캔버스 없이도 도는 화소 버퍼와 빛깔·무늬(난수) 도구.
// 바깥 그림 파일을 쓰지 않는다. 모든 그림은 여기 버퍼에 한 점씩 찍어서 만든다.
// 빛깔은 0xAABBGGRR(작은 끝 순서)로 묶은 수 하나다. 0은 비어 있는 점이다.

import { mulberry32 } from '../engine/rng';

export type Color = number;

export const CLEAR: Color = 0;

/**
 * 그림 점 / 맵 점(spec 4.7.5의 ㄱ). 그림은 맵 점의 반 크기 점으로 촘촘하게 찍는다: 땅 한 칸은 32×32 그림 점,
 * 사람 한 장은 48×64 그림 점이고, 화면에서는 맵 점 16×16·24×32를 차지한다(사람의 화면 크기는 그대로다).
 * 맵의 좌표·부딪힘·길 찾기·문·누르는 자리·발 위치는 맵 점(TILE = 16) 그대로다. 그릴 때만
 * 화면의 자리 = 맵 점 × s, 그림의 크기 = 그림 점 × (s ÷ ART)로 셈한다.
 */
export const ART = 2;

export function rgb(r: number, g: number, b: number, a = 255): Color {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** '#rrggbb' → 묶은 빛깔 */
export function hex(s: string, a = 255): Color {
  const v = parseInt(s.slice(1), 16);
  return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255, a);
}

export const red = (c: Color): number => c & 255;
export const green = (c: Color): number => (c >> 8) & 255;
export const blue = (c: Color): number => (c >> 16) & 255;
export const alpha = (c: Color): number => (c >>> 24) & 255;

export function withAlpha(c: Color, a: number): Color {
  return ((c & 0x00ffffff) | (a << 24)) >>> 0;
}

/** 두 빛깔을 섞는다(t=0이면 a, 1이면 b). 알파는 a의 것을 따른다. */
export function mix(a: Color, b: Color, t: number): Color {
  const u = 1 - t;
  return rgb(
    Math.round(red(a) * u + red(b) * t),
    Math.round(green(a) * u + green(b) * t),
    Math.round(blue(a) * u + blue(b) * t),
    alpha(a),
  );
}

/** 그늘 빛: 어둡게 하면서 푸른 쪽으로 조금 민다 */
export function shadeOf(c: Color, k = 0.7): Color {
  return rgb(
    Math.round(red(c) * k * 0.94),
    Math.round(green(c) * k * 0.97),
    Math.round(Math.min(255, blue(c) * k * 1.12)),
    alpha(c),
  );
}

// ── 난수와 무늬 ─────────────────────────────────────────────
// 같은 자리, 같은 씨앗이면 언제나 같은 값이 나온다(Math.random을 쓰지 않는다).

/** 0 이상 1 미만. 정수 자리 (x, y)와 씨앗으로 정해진다. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x1b873593) ^ Math.imul(y | 0, 0x19d699a5) ^ Math.imul(seed | 0, 0x2545f491)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 부드러운 값 무늬(0~1). 칸 크기 1. */
export function vnoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 두 겹의 값 무늬(0~1) */
export function fbm(x: number, y: number, seed = 0): number {
  return vnoise(x, y, seed) * 0.65 + vnoise(x * 2.13 + 7.1, y * 2.13 + 3.7, seed + 17) * 0.35;
}

/** 이어 붙여도 티가 나지 않는 값 무늬(주기 px, py 칸) */
export function tnoise(x: number, y: number, px: number, py: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const m = (v: number, p: number): number => ((v % p) + p) % p;
  const x0 = m(xi, px);
  const x1 = m(xi + 1, px);
  const y0 = m(yi, py);
  const y1 = m(yi + 1, py);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 섞음 무늬(0~1 미만). 빛깔 단계 사이를 점으로 섞을 때 쓴다. */
export function bayer(x: number, y: number): number {
  return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

/** 씨앗 있는 난수(순서대로 뽑는 것). 엔진의 mulberry32와 같은 셈이다(같은 씨앗이면 같은 그림). */
export const rngOf: (seed: number) => () => number = mulberry32;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** 빛깔 단계(어두움 → 밝음)에서 t(0~1)에 맞는 빛을 고른다. dither가 있으면 단계 사이를 점으로 섞는다. */
export function pick(ramp: readonly Color[], t: number, x = 0, y = 0, dither = 0): Color {
  const n = ramp.length - 1;
  let v = clamp(t, 0, 1) * n;
  if (dither > 0) v += (bayer(x, y) - 0.5) * dither;
  return ramp[clamp(Math.round(v), 0, n)];
}

// ── 화소 버퍼 ────────────────────────────────────────────────

export class Px {
  readonly w: number;
  readonly h: number;
  readonly d: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Color {
    return this.inb(x, y) ? this.d[y * this.w + x] : 0;
  }

  /** 점 하나를 찍는다(밖이면 버린다) */
  set(x: number, y: number, c: Color): void {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }

  /** 이미 그림이 있는 자리에만 찍는다 */
  over(x: number, y: number, c: Color): void {
    if (this.get(x, y) !== 0) this.set(x, y, c);
  }

  /** 비어 있는 자리에만 찍는다 */
  under(x: number, y: number, c: Color): void {
    if (this.inb(x, y) && this.get(x, y) === 0) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  hline(x0: number, x1: number, y: number, c: Color): void {
    if (x1 < x0) [x0, x1] = [x1, x0];
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: Color): void {
    if (y1 < y0) [y0, y1] = [y1, y0];
    for (let y = y0; y <= y1; y++) this.set(x, y, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** 채운 타원. 가운데 (cx, cy), 반지름 rx, ry(소수도 된다) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  /** 다른 그림을 얹는다(빈 점은 건너뛴다) */
  blit(src: Px, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (c !== 0) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** 다른 그림을 빈 점까지 그대로 옮겨 붙인다(비쳐 보이는 점도 덮는다) */
  blitRaw(src: Px, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) {
      const yy = dy + y;
      if (yy < 0 || yy >= this.h) continue;
      const x0 = Math.max(0, -dx);
      const x1 = Math.min(src.w, this.w - dx);
      if (x1 <= x0) continue;
      this.d.set(src.d.subarray(y * src.w + x0, y * src.w + x1), yy * this.w + dx + x0);
    }
  }

  flipX(): Px {
    const out = new Px(this.w, this.h);
    out.blit(this, 0, 0, true);
    return out;
  }

  clone(): Px {
    const out = new Px(this.w, this.h);
    out.d.set(this.d);
    return out;
  }

  /**
   * 그림 둘레에 테두리를 두른다(위·아래·옆 네 방향에 그림이 닿은 빈 점).
   * 먹빛 테두리가 인물과 세운 것을 바탕에서 떼어 준다.
   */
  outline(c: Color, corners = false): void {
    const src = this.d.slice();
    const { w, h } = this;
    const has = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== 0) continue;
        if (
          has(x - 1, y) ||
          has(x + 1, y) ||
          has(x, y - 1) ||
          has(x, y + 1) ||
          (corners && (has(x - 1, y - 1) || has(x + 1, y - 1) || has(x - 1, y + 1) || has(x + 1, y + 1)))
        ) {
          this.d[y * w + x] = c;
        }
      }
    }
  }

  /** 그림이 차지한 테두리 상자. 비어 있으면 null */
  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.d[y * this.w + x] !== 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /** 찍힌 점의 수 */
  count(): number {
    let n = 0;
    for (let i = 0; i < this.d.length; i++) if (this.d[i] !== 0) n++;
    return n;
  }
}

/** 버퍼를 캔버스로 옮긴다(브라우저에서만) */
export function toCanvas(px: Px): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = px.w;
  canvas.height = px.h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const image = new ImageData(new Uint8ClampedArray(px.d.buffer.slice(0) as ArrayBuffer), px.w, px.h);
    ctx.putImageData(image, 0, 0);
  }
  return canvas;
}

/** 여러 장을 가로로 이어 붙인 한 장으로 만든다(움직이는 그림). 모두 같은 크기여야 한다. */
export function strip(frames: readonly Px[]): Px {
  const w = frames[0].w;
  const h = frames[0].h;
  const out = new Px(w * frames.length, h);
  frames.forEach((f, i) => out.blit(f, i * w, 0));
  return out;
}
