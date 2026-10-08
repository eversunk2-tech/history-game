// 마당과 길가의 것들: 우물, 장독, 나뭇더미, 짚가리, 울타리와 돌담, 돌탑과 돌등, 돌, 그루터기.

import type { Palette, Ramp } from './palette';
import { Px, clamp, hash2, hex, rngOf, vnoise } from './px';
import { rim, rock, type SpriteDef } from './shapes';

type Maker = (pal: Palette, variant: number) => SpriteDef;

const R = (...list: string[]): Ramp => list.map((s) => hex(s));
/** 질그릇 독의 빛(유약을 바르지 않은 수수한 잿빛 갈색) */
const JAR = R('#33261f', '#4d3a30', '#69513f', '#866a52', '#a3876b', '#bfa587');

// ── 우물 ─────────────────────────────────────────────────────
// 둥글게 돌을 쌓은 우물과 두레박.
export const well: Maker = (pal) => {
  const W = 38;
  const H = 34;
  const px = new Px(W, H);
  const { stone, water, wood } = pal;
  const cx = 17;
  const cy = 13;
  // 돌을 쌓은 둘레(앞면)
  for (let y = cy; y < cy + 15; y++) {
    for (let x = cx - 14; x <= cx + 14; x++) {
      const dx = (x - cx) / 14;
      const bottom = cy + 7 + Math.round(Math.sqrt(Math.max(0, 1 - dx * dx)) * 7);
      if (y > bottom) continue;
      const row = Math.floor((y - cy) / 4);
      const off = row % 2 === 0 ? 0 : 3;
      const inCell = (((x + off) % 7) + 7) % 7;
      let v = 3.3 - dx * 1.6 + (hash2(Math.floor((x + off) / 7), row, 241) - 0.5) * 1.4;
      if ((y - cy) % 4 === 0) v += 0.8;
      if (inCell === 6 || (y - cy) % 4 === 3) v = 1.2;
      px.set(x, y, stone[clamp(Math.round(v), 1, 5)]);
    }
  }
  // 윗면의 돌 테와 물
  for (let y = cy - 9; y <= cy + 9; y++) {
    for (let x = cx - 15; x <= cx + 15; x++) {
      const dx = (x + 0.5 - cx) / 14.5;
      const dy = (y + 0.5 - cy) / 7.5;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const inner = (dx * dx) / 0.52 + (dy * dy) / 0.5;
      if (inner < 1) {
        // 우물 안: 어두운 벽과 물에 비친 하늘
        let c = dy < -0.15 ? stone[1] : water[1];
        if (dy > 0.05 && dx < 0.1 && dx > -0.5 && hash2(x >> 1, y, 242) < 0.5) c = water[3];
        if (dy > 0.25 && dx < -0.1 && dx > -0.4) c = water[4];
        if (inner > 0.82) c = stone[0];
        px.set(x, y, c);
      } else {
        const ang = Math.atan2(dy, dx);
        const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 11);
        let v = 4.2 - dx * 1.1 - dy * 0.9 + (hash2(seg, 0, 243) - 0.5) * 1.2;
        const segEdge = (((ang + Math.PI) / (Math.PI * 2)) * 11) % 1;
        if (segEdge < 0.12) v = 2;
        px.set(x, y, stone[clamp(Math.round(v), 1, 5)]);
      }
    }
  }
  // 두레박(나무통)과 줄
  for (let y = 20; y < 29; y++) {
    for (let x = 30; x < 37; x++) {
      const t = (x - 30) / 6;
      let v = t < 0.3 ? 4 : t < 0.7 ? 3 : 1;
      if (y === 22 || y === 26) v = 1;
      if (y === 20) v = 5;
      px.set(x, y, wood[v]);
    }
  }
  for (let x = 31; x < 36; x++) px.set(x, 20, x === 31 || x === 35 ? wood[4] : pal.bark[0]);
  for (let k = 0; k < 6; k++) px.set(30 - k, 19 - Math.round(k * 0.5), pal.thatch[k % 2 === 0 ? 4 : 2]);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 17, ay: 30, shades: [{ dx: 5, dy: -1, rx: 20, ry: 6, strength: 0.32 }] };
};

function jar(px: Px, cx: number, yBot: number, rw: number, h: number, seed: number): void {
  for (let y = yBot - h; y <= yBot; y++) {
    const t = (y - (yBot - h)) / h; // 0 위 → 1 아래
    // 어깨가 넓고 밑이 좁은 독
    const bulge = Math.sin(clamp(t * 1.15 + 0.12, 0, 1) * Math.PI);
    const half = Math.max(2, Math.round(rw * (0.45 + 0.55 * bulge)));
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / half;
      let v = 2.6 - u * 1.9 - (t > 0.75 ? 0.8 : 0);
      if (u < -0.3 && u > -0.65 && t > 0.2 && t < 0.6) v += 1.4; // 빛이 닿는 자리
      if (hash2(x, y, seed) < 0.05) v -= 0.8;
      px.set(x, y, JAR[clamp(Math.round(v), 0, 5)]);
    }
  }
  // 뚜껑
  const lid = Math.round(rw * 0.78);
  for (let x = cx - lid; x <= cx + lid; x++) {
    px.set(x, yBot - h - 2, JAR[x < cx ? 5 : 3]);
    px.set(x, yBot - h - 1, JAR[x < cx ? 4 : 2]);
    px.set(x, yBot - h, JAR[1]);
  }
  px.set(cx, yBot - h - 3, JAR[4]);
  px.set(cx - 1, yBot - h - 3, JAR[5]);
}

// ── 장독 ─────────────────────────────────────────────────────
export const jars: Maker = (pal, variant) => {
  const W = 34;
  const H = 30;
  const px = new Px(W, H);
  // 낮은 돌 단
  for (let x = 1; x < W - 1; x++) {
    px.set(x, H - 5, pal.stone[5]);
    px.set(x, H - 4, pal.stone[x % 7 === 0 ? 2 : 4]);
    px.set(x, H - 3, pal.stone[x % 7 === 3 ? 2 : 3]);
    px.set(x, H - 2, pal.stone[1]);
  }
  if (variant === 0) {
    jar(px, 9, H - 6, 7, 16, 251);
    jar(px, 24, H - 6, 6, 12, 252);
    jar(px, 17, H - 5, 4, 8, 253);
  } else {
    jar(px, 7, H - 6, 5, 10, 254);
    jar(px, 18, H - 6, 8, 17, 255);
    jar(px, 28, H - 5, 4, 9, 256);
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 17, ay: H - 4, shades: [{ dx: 5, dy: 0, rx: 18, ry: 4, strength: 0.3 }] };
};

function logEnd(px: Px, cx: number, cy: number, r: number, pal: Palette, seed: number): void {
  const { wood, thatch } = pal;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.3) continue;
      let c = thatch[clamp(Math.round(4.6 - (x + y) * 0.35 + (hash2(seed, 0, 261) - 0.5) * 1.2), 3, 6)];
      if (d > r - 0.8) c = wood[x + y > 0 ? 1 : 3];
      else if (Math.abs(d - r * 0.45) < 0.5) c = thatch[2];
      px.set(cx + x, cy + y, c);
    }
  }
}

// ── 나뭇더미(장작) ─────────────────────────────────────────────
export const woodpile: Maker = (pal) => {
  const W = 34;
  const H = 24;
  const px = new Px(W, H);
  let k = 0;
  for (let row = 0; row < 3; row++) {
    const count = 5 - row;
    const y = H - 6 - row * 6;
    for (let i = 0; i < count; i++) {
      const x = 5 + row * 3 + i * 6;
      logEnd(px, x, y, 3, pal, k++);
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 17, ay: H - 3, shades: [{ dx: 5, dy: 0, rx: 18, ry: 4, strength: 0.3 }] };
};

// ── 짚가리 ───────────────────────────────────────────────────
// 타작 마당에 쌓아 둔 볏짚 더미.
export const strawstack: Maker = (pal, variant) => {
  const W = 38;
  const H = 44;
  const px = new Px(W, H);
  const ramp = pal.thatch;
  const n = ramp.length - 1;
  const cx = 19;
  const tall = variant === 0 ? 0 : 5;
  for (let y = 4 + tall; y < H - 3; y++) {
    const t = (y - 4 - tall) / (H - 7 - tall);
    const half = Math.round(4 + 13 * Math.pow(t, 0.62));
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / half;
      let tone = 0.74 - u * 0.3 - t * 0.12;
      const course = (y + Math.round(vnoise(x / 4, 0, 271) * 2)) % 6;
      if (course === 0) tone -= 0.2;
      else if (course === 1) tone += 0.1;
      tone += (hash2(x, Math.floor(y / 4), 272 + variant) - 0.5) * 0.2;
      if (y >= H - 5) tone -= 0.2;
      px.set(x, y, ramp[clamp(Math.round(tone * n), 0, n)]);
    }
  }
  // 꼭대기를 묶은 매듭
  for (let x = cx - 2; x <= cx + 2; x++) {
    px.set(x, 3 + tall, ramp[n]);
    px.set(x, 2 + tall, ramp[n - 1]);
  }
  px.set(cx, 1 + tall, ramp[n - 1]);
  px.set(cx + 1, tall, ramp[n - 2]);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 19, ay: H - 4, shades: [{ dx: 6, dy: 0, rx: 19, ry: 5.5, strength: 0.32 }] };
};

// ── 싸리 울타리 ──────────────────────────────────────────────
export const fenceH: Maker = (pal, variant) => {
  const W = 16;
  const H = 22;
  const px = new Px(W, H);
  const { wood } = pal;
  const rnd = rngOf(280 + variant);
  for (let x = 0; x < W; x++) {
    const top = 3 + Math.floor(rnd() * 4);
    const tone = 2 + Math.floor(rnd() * 3);
    for (let y = top; y < H - 2; y++) {
      let v = tone - (y > H - 6 ? 1 : 0);
      if (y === top) v += 1;
      px.set(x, y, wood[clamp(v, 1, 5)]);
    }
  }
  // 가로로 엮은 띠
  for (let x = 0; x < W; x++) {
    for (const y of [9, 15]) {
      px.set(x, y, pal.thatch[x % 3 === 0 ? 5 : 4]);
      px.set(x, y + 1, pal.thatch[1]);
    }
  }
  for (let x = 0; x < W; x++) {
    px.set(x, H - 2, wood[0]);
    for (let y = 0; y < H; y++) {
      if (px.get(x, y) !== 0) {
        if (y > 0) px.under(x, y - 1, pal.ink);
        break;
      }
    }
  }
  return { frames: [px], ax: 8, ay: H - 3, shades: [{ dx: 3, dy: 1, rx: 9, ry: 3, strength: 0.26 }] };
};

export const fenceV: Maker = (pal, variant) => {
  const W = 8;
  const H = 30;
  const px = new Px(W, H);
  const { wood } = pal;
  const rnd = rngOf(290 + variant);
  // 옆에서 본 울타리: 싸릿대의 끝이 줄지어 보인다
  for (let y = 0; y < H - 2; y += 2) {
    const tone = 2 + Math.floor(rnd() * 3);
    const off = Math.floor(rnd() * 2);
    for (let x = 1 + off; x < 6 + off; x++) {
      px.set(x, y, wood[clamp(tone + (x < 3 ? 1 : x > 4 ? -1 : 0), 1, 5)]);
      px.set(x, y + 1, wood[clamp(tone - 1 + (x < 3 ? 1 : x > 4 ? -1 : 0), 1, 5)]);
    }
  }
  for (let y = 0; y < H - 2; y++) {
    if (y % 9 === 5) for (let x = 1; x < 7; x++) px.over(x, y, pal.thatch[4]);
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 4, ay: H - 3, shades: [{ dx: 4, dy: -8, rx: 5, ry: 9, strength: 0.26 }] };
};

// ── 돌담 ─────────────────────────────────────────────────────
export const stonewallH: Maker = (pal, variant) => {
  const W = 16;
  const H = 18;
  const px = new Px(W, H);
  const { stone } = pal;
  for (let y = 2; y < H - 1; y++) {
    const row = Math.floor((y - 2) / 5);
    const off = (row * 5 + variant * 3) % 8;
    for (let x = 0; x < W; x++) {
      const cell = Math.floor((x + off) / 8);
      const inCell = (x + off) % 8;
      const iy = (y - 2) % 5;
      let v = 3.2 + (hash2(cell, row, 300 + variant) - 0.5) * 1.6;
      if (iy === 0) v += 1.2;
      else if (iy === 4) v = 1;
      if (inCell === 7) v = 1;
      else if (inCell > 4) v -= 0.6;
      if ((iy === 0 && (inCell === 0 || inCell === 6)) || (iy === 3 && inCell === 6)) v = 1;
      px.set(x, y, stone[clamp(Math.round(v), 1, 5)]);
    }
  }
  for (let x = 0; x < W; x++) {
    px.set(x, 1, x % 5 === 2 ? pal.grass[4] : pal.ink);
    px.set(x, H - 1, pal.ink);
  }
  return { frames: [px], ax: 8, ay: H - 3, shades: [{ dx: 3, dy: 1, rx: 9, ry: 3, strength: 0.28 }] };
};

export const stonewallV: Maker = (pal, variant) => {
  const W = 12;
  const H = 30;
  const px = new Px(W, H);
  const { stone } = pal;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const cell = Math.floor((y + (x > 5 ? 3 : 0)) / 6);
      const inCell = (y + (x > 5 ? 3 : 0)) % 6;
      let v = 3.6 + (hash2(cell, x > 5 ? 1 : 0, 310 + variant) - 0.5) * 1.6 - (x > 5 ? 0.8 : 0);
      if (inCell === 5 || x === 5) v = 1.2;
      if (y > H - 10) v -= 0.8;
      px.set(x, y, stone[clamp(Math.round(v), 1, 5)]);
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 6, ay: H - 3, shades: [{ dx: 5, dy: -8, rx: 6, ry: 9, strength: 0.28 }] };
};

// ── 돌탑(절 마당의 작은 탑) ──────────────────────────────────────
export const pagoda: Maker = (pal) => {
  const W = 26;
  const H = 50;
  const px = new Px(W, H);
  const { stone } = pal;
  const cx = 13;
  const slab = (y: number, half: number, hgt: number, roof: boolean): void => {
    for (let j = 0; j < hgt; j++) {
      const hw = roof ? half - Math.round((hgt - 1 - j) * 1.4) : half;
      for (let x = cx - hw; x <= cx + hw; x++) {
        const u = (x - cx) / Math.max(1, hw);
        let v = 3.6 - u * 1.5 + (roof && j === 0 ? 1 : 0) - (j === hgt - 1 ? 1.2 : 0);
        if (hash2(x, y + j, 320) < 0.06) v -= 1;
        px.set(x, y + j, stone[clamp(Math.round(v), 1, 5)]);
      }
    }
  };
  // 아래에서 위로: 기단, 몸돌과 지붕돌 세 층, 꼭대기
  slab(H - 6, 11, 4, false);
  slab(H - 10, 9, 4, false);
  let y = H - 10;
  for (const [body, roof] of [
    [6, 9],
    [5, 7],
    [4, 6],
  ] as const) {
    y -= 7;
    slab(y, body - 1, 7, false);
    y -= 4;
    slab(y, roof, 4, true);
  }
  slab(y - 3, 1, 3, false);
  px.set(cx, y - 5, stone[5]);
  px.set(cx, y - 4, stone[4]);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 13, ay: H - 3, shades: [{ dx: 5, dy: 0, rx: 13, ry: 4, strength: 0.32 }] };
};

// ── 돌등 ─────────────────────────────────────────────────────
export const lantern: Maker = (pal) => {
  const W = 16;
  const H = 28;
  const px = new Px(W, H);
  const { stone } = pal;
  const cx = 8;
  const block = (y: number, half: number, hgt: number, dark = 0): void => {
    for (let j = 0; j < hgt; j++) {
      for (let x = cx - half; x <= cx + half; x++) {
        const u = (x - cx) / Math.max(1, half);
        px.set(x, y + j, stone[clamp(Math.round(3.8 - u * 1.5 - (j === hgt - 1 ? 1 : 0) - dark), 1, 5)]);
      }
    }
  };
  block(H - 5, 5, 3);
  block(H - 13, 1, 8);
  block(H - 16, 4, 3);
  block(H - 21, 3, 5);
  // 불을 넣는 창(비어 있다)
  px.set(cx - 1, H - 19, pal.ink);
  px.set(cx, H - 19, pal.ink);
  px.set(cx - 1, H - 18, pal.ink);
  px.set(cx, H - 18, pal.ink);
  for (let j = 0; j < 3; j++) {
    for (let x = cx - 6 + j * 2; x <= cx + 6 - j * 2; x++) {
      px.set(x, H - 22 - j, stone[clamp(Math.round(4.2 - ((x - cx) / 6) * 1.6 - (j === 0 ? 1 : 0)), 1, 5)]);
    }
  }
  px.set(cx, H - 25, stone[4]);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 8, ay: H - 3, shades: [{ dx: 4, dy: 0, rx: 7, ry: 3, strength: 0.3 }] };
};

// ── 돌 ───────────────────────────────────────────────────────
export const rockS: Maker = (pal, variant) => {
  const px = new Px(12, 9);
  rock(px, pal.stone, 5.5 + (variant % 2), 5, 3.6 + (variant % 3) * 0.6, 2.6, 330 + variant);
  rim(px, pal.inkSoft, pal.inkSoft);
  return { frames: [px], ax: 6, ay: 7, shades: [{ dx: 2, dy: 0, rx: 5, ry: 2, strength: 0.24 }] };
};

export const rockM: Maker = (pal, variant) => {
  const px = new Px(22, 18);
  rock(px, pal.stone, 11, 10, 7.5 + variant * 0.5, 5.6, 340 + variant, variant === 1 ? pal.leaf : undefined);
  if (variant === 2) rock(px, pal.stone, 5, 13, 3.4, 2.6, 345);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 11, ay: 16, shades: [{ dx: 4, dy: 0, rx: 11, ry: 3.5, strength: 0.3 }] };
};

export const rockL: Maker = (pal, variant) => {
  const px = new Px(40, 28);
  rock(px, pal.stone, 17, 15, 14, 9.5, 350 + variant, variant === 0 ? pal.leaf : undefined);
  rock(px, pal.stone, 30, 19, 7.5, 5.5, 355 + variant);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 20, ay: 26, shades: [{ dx: 6, dy: 0, rx: 21, ry: 5, strength: 0.32 }] };
};

// ── 너럭돌(앉는 돌) ────────────────────────────────────────────
export const flatstone: Maker = (pal, variant) => {
  const W = 22;
  const H = 14;
  const px = new Px(W, H);
  const { stone } = pal;
  for (let y = 2; y < 9; y++) {
    for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2 - 1);
      const dy = (y + 0.5 - 5.5) / 3.8;
      const wob = (vnoise(x / 3 + variant * 9, y / 2, 360) - 0.5) * 0.3;
      if (dx * dx + dy * dy > 1 + wob) continue;
      let v = 4.3 - dx * 0.9 + (vnoise(x / 4, y / 3, 361 + variant) - 0.5) * 1.4;
      if (hash2(x, y, 362) < 0.05) v -= 1.2;
      px.set(x, y, stone[clamp(Math.round(v), 3, 5)]);
    }
  }
  // 옆면
  for (let x = 1; x < W - 1; x++) {
    for (let y = 12; y >= 2; y--) {
      if (px.get(x, y) !== 0) {
        px.set(x, y + 1, stone[x < W / 2 ? 3 : 2]);
        px.set(x, y + 2, stone[1]);
        break;
      }
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 11, ay: 11, shades: [{ dx: 3, dy: 1, rx: 11, ry: 3, strength: 0.26 }] };
};

// ── 그루터기와 통나무 ──────────────────────────────────────────
export const stump: Maker = (pal, variant) => {
  const W = 18;
  const H = 16;
  const px = new Px(W, H);
  const { bark, thatch } = pal;
  const cx = 9;
  for (let y = 5; y < H - 2; y++) {
    const half = 6 + (y > H - 5 ? 1 : 0);
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / half;
      let v = 2.6 - u * 1.5;
      if (hash2(x, y >> 1, 370 + variant) < 0.25) v -= 1;
      px.set(x, y, bark[clamp(Math.round(v), 0, 4)]);
    }
  }
  for (let y = 1; y < 9; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      const dx = (x + 0.5 - cx) / 6.6;
      const dy = (y + 0.5 - 5) / 3.4;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c = thatch[clamp(Math.round(5 - dx - dy * 0.6), 4, 6)];
      if (Math.abs(d - 0.45) < 0.09 || Math.abs(d - 0.14) < 0.05) c = thatch[3];
      if (d > 0.82) c = bark[dx + dy > 0 ? 1 : 3];
      px.set(x, y, c);
    }
  }
  if (variant === 1) {
    // 새순
    px.set(cx + 5, 1, pal.leafWarm[4]);
    px.set(cx + 6, 0, pal.leafWarm[5]);
    px.set(cx + 5, 2, pal.leafWarm[2]);
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 9, ay: H - 3, shades: [{ dx: 4, dy: 0, rx: 9, ry: 3, strength: 0.28 }] };
};

export const log: Maker = (pal) => {
  const W = 36;
  const H = 14;
  const px = new Px(W, H);
  const { bark } = pal;
  for (let y = 3; y < 11; y++) {
    for (let x = 5; x < W - 2; x++) {
      const t = (y - 3) / 7;
      let v = 3.4 - t * 2.6;
      if (hash2(x >> 2, y, 380) < 0.25) v -= 0.8;
      if (hash2(x, y, 381) < 0.04) v += 1;
      px.set(x, y, bark[clamp(Math.round(v), 0, 4)]);
    }
  }
  logEnd(px, 5, 7, 4, pal, 3);
  // 잔가지 자른 자리
  px.set(20, 2, bark[2]);
  px.set(21, 2, bark[1]);
  px.set(20, 1, pal.thatch[5]);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 18, ay: H - 3, shades: [{ dx: 4, dy: 0, rx: 18, ry: 3, strength: 0.28 }] };
};

// ── 쓰러져 이끼 낀 나무 ────────────────────────────────────────
export const fallen: Maker = (pal) => {
  const W = 40;
  const H = 18;
  const px = new Px(W, H);
  const { bark } = pal;
  const moss = pal.leaf;
  for (let x = 6; x < W - 3; x++) {
    const sag = Math.round(Math.sin((x - 6) / 30) * 2);
    const half = x > W - 9 ? 2 : 4;
    for (let j = -half; j <= half; j++) {
      const y = 9 + sag + j;
      const t = (j + half) / (2 * half);
      let v = 3.4 - t * 2.8;
      if (hash2(x >> 2, y, 390) < 0.22) v -= 0.8;
      let c = bark[clamp(Math.round(v), 0, 4)];
      // 위쪽에 낀 이끼
      if (j <= -half + 1 && vnoise(x / 3.2, 0.5, 391) > 0.42) c = moss[j === -half ? 4 : 3];
      px.set(x, y, c);
    }
  }
  logEnd(px, 6, 9, 4, pal, 5);
  // 부러진 가지와 버섯
  px.line(22, 5, 26, 1, bark[2]);
  px.line(23, 5, 27, 1, bark[1]);
  px.set(30, 5, pal.plaster[3]);
  px.set(31, 5, pal.plaster[2]);
  px.set(30, 6, pal.plaster[1]);
  px.set(14, 5, pal.plaster[3]);
  px.set(14, 6, pal.plaster[1]);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 20, ay: H - 3, shades: [{ dx: 4, dy: 0, rx: 19, ry: 3.5, strength: 0.28 }] };
};

// ── 길가의 돌무더기 ────────────────────────────────────────────
// 지나는 사람들이 하나씩 얹은 돌. 꾸밈없이 쌓인 돌더미다.
export const cairn: Maker = (pal) => {
  const W = 24;
  const H = 26;
  const px = new Px(W, H);
  const stones: [number, number, number, number, number][] = [
    [6, 20, 4.5, 3, 1],
    [12, 21, 5, 3, 2],
    [18, 20, 4.5, 3, 3],
    [9, 16, 4.5, 3, 4],
    [15, 16, 4.5, 3, 5],
    [12, 12, 4.2, 2.8, 6],
    [12, 8, 3.2, 2.4, 7],
    [12.5, 5, 2.2, 1.8, 8],
  ];
  for (const [x, y, rx, ry, seed] of stones) rock(px, pal.stone, x, y, rx, ry, 395 + seed, seed === 2 ? pal.leaf : undefined);
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 12, ay: H - 3, shades: [{ dx: 4, dy: 0, rx: 12, ry: 3.5, strength: 0.3 }] };
};
