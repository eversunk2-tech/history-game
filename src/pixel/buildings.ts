// 집과 건물. 초가(볏짚 지붕), 기와를 얹은 양반 댁과 절, 담과 대문.
// 생김새는 꾸민 것이다. 고증이 확인되지 않은 것이 많으므로 꾸밈없고 수수하게 그린다(글씨·현판·화려한 단청 없음).
// 빛은 왼쪽 위에서 온다: 지붕의 왼쪽 비탈이 밝고 오른쪽이 어둡다. 처마 아래 벽에는 그늘이 진다.

import { CLOTH, type Palette, type Ramp } from './palette';
import { Px, clamp, hash2, shadeOf, vnoise, type Color } from './px';
import { rim, type SpriteDef } from './shapes';

type Maker = (pal: Palette, variant: number) => SpriteDef;

// ── 볏짚 지붕 ────────────────────────────────────────────────
// 모서리가 둥근 우진각 지붕을 앞에서 비스듬히 내려다본 모습. 용마름, 겹겹이 이은 이엉의 층, 처마 끝의 삐죽한 짚.
function thatchRoof(px: Px, x0: number, y0: number, w: number, h: number, pal: Palette, seed: number, old = false): void {
  // 새로 이은 지붕은 누런 볏짚 빛, 묵은 지붕은 비바람에 잿빛이 돈다
  const ramp = old ? pal.thatchOld : pal.thatch;
  const n = ramp.length - 1;
  const half = w / 2;
  const cx = x0 + half;
  const ridgeY = y0 + Math.round(h * 0.2);
  for (let x = x0; x < x0 + w; x++) {
    const u = (x + 0.5 - cx) / half;
    const au = Math.abs(u);
    const top = y0 + h * 0.4 * Math.pow(au, 2.6);
    const droop = (hash2(x, 0, seed + 1) - 0.5) * 1.6;
    const eave = y0 + h - 1 - 4.2 * Math.pow(au, 3.4) + droop;
    for (let y = Math.round(top); y <= Math.round(eave); y++) {
      const v = clamp((y - ridgeY) / Math.max(1, eave - ridgeY), -0.4, 1);
      let tone: number;
      const hip = au - (0.5 + 0.47 * Math.max(0, v));
      if (y < ridgeY - 1) tone = 0.54 - au * 0.12; // 용마루 뒤로 넘어가는 면
      else tone = 0.7 - 0.2 * Math.max(0, v);
      if (hip > 0) tone += u < 0 ? 0.1 : -0.22; // 왼쪽 추녀 쪽은 밝고 오른쪽은 어둡다
      tone -= u * 0.15;
      // 짚이 뭉친 자리마다 조금씩 밝고 어둡다
      tone += (vnoise(x / 9.5, y / 6.5, seed + 8) - 0.5) * 0.16;
      // 이엉의 층: 위 층의 끝이 아래 층에 그늘을 드리운다
      const wob = Math.round(vnoise(x / 5.5, seed * 0.7, seed + 2) * 2.4);
      const course = (((y - ridgeY + wob) % 7) + 7) % 7;
      if (y > ridgeY + 2) {
        if (course === 0) tone -= 0.15;
        else if (course === 1) tone += 0.07;
        else if (course === 6) tone -= 0.05;
      }
      // 짚의 결: 세로로 짧은 줄
      const strand = hash2(x, Math.floor((y + hash2(x, 7, seed + 3) * 5) / 5), seed + 4);
      tone += (strand - 0.5) * 0.2;
      if (hash2(x, y, seed + 5) < 0.03) tone += 0.16;
      // 처마 끝은 두껍고 어둡다
      const fromEave = eave - y;
      if (fromEave < 1) tone = 0.05;
      else if (fromEave < 2.2) tone = Math.min(tone, 0.22);
      else if (fromEave < 3.4) tone -= 0.14;
      px.set(x, y, ramp[clamp(Math.round(tone * n), 0, n)]);
    }
  }
  // 용마름: 지붕 꼭대기를 덮은 엮은 짚
  const rx0 = Math.round(cx - half * 0.56);
  const rx1 = Math.round(cx + half * 0.56);
  for (let x = rx0; x <= rx1; x++) {
    const sag = Math.round(Math.pow(Math.abs((x - cx) / (half * 0.56)), 2) * 1.5);
    const y = ridgeY + sag;
    const t = (x - rx0) / Math.max(1, rx1 - rx0);
    px.set(x, y - 2, ramp[clamp(n - (t > 0.7 ? 1 : 0), 0, n)]);
    px.set(x, y - 1, ramp[n - 1 - (x % 3 === 0 ? 1 : 0)]);
    px.set(x, y, ramp[x % 3 === 1 ? 2 : 3]);
    px.set(x, y + 1, ramp[2]);
  }
}

interface Bay {
  kind: 'door' | 'window' | 'kitchen' | 'blank' | 'open';
}

// ── 흙벽 ─────────────────────────────────────────────────────
// 나무 기둥과 인방 사이를 흙으로 메운 벽. 아래는 막돌을 쌓은 기단.
function clayWall(px: Px, x0: number, y0: number, w: number, h: number, pal: Palette, bays: Bay[], seed: number): void {
  const { clay, wood, stone, ink } = pal;
  const base = 5; // 기단 높이
  const wallBot = y0 + h - base - 1;
  // 벽
  for (let y = y0; y <= wallBot; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const m = vnoise(x / 6.1, y / 4.7, seed + 11);
      let v = 2.5 + (m - 0.5) * 2.2;
      const fleck = hash2(x, y, seed + 12);
      if (fleck < 0.03) v -= 1;
      else if (fleck > 0.975) v += 1;
      // 처마 그늘
      const shadeEdge = y0 + 5 + Math.round(vnoise(x / 4, 0, seed + 13) * 1.6);
      if (y < y0 + 2) v = 0;
      else if (y < shadeEdge) v -= 1.4;
      // 오른쪽 끝은 조금 어둡다
      if (x > x0 + w - 5) v -= 0.6;
      px.set(x, y, clay[clamp(Math.round(v), 0, 4)]);
    }
  }
  // 기단(막돌)
  for (let x = x0 - 2; x < x0 + w + 2; x++) {
    for (let y = wallBot + 1; y < y0 + h; y++) {
      const cell = Math.floor((x + (y - wallBot > 2 ? 3 : 0)) / 6);
      const inCell = (x + (y - wallBot > 2 ? 3 : 0)) % 6;
      const top = y === wallBot + 1 || y === wallBot + 3;
      let v = 3 + (hash2(cell, y > wallBot + 2 ? 1 : 0, seed + 14) - 0.5) * 1.6;
      if (top) v += 1;
      if (inCell === 5 || inCell === -1) v = 1;
      if (y === y0 + h - 1) v = Math.min(v, 1.4);
      px.set(x, y, stone[clamp(Math.round(v), 1, 5)]);
    }
  }
  // 기둥과 인방
  const bayW = w / bays.length;
  const post = (x: number): void => {
    for (let y = y0 + 1; y <= wallBot; y++) {
      const dark = y < y0 + 5 ? 1 : 0;
      px.set(x, y, wood[clamp(4 - dark, 0, 5)]);
      px.set(x + 1, y, wood[clamp(3 - dark, 0, 5)]);
      px.set(x + 2, y, wood[clamp(1, 0, 5)]);
    }
  };
  const rail = Math.round(y0 + (wallBot - y0) * 0.44);
  for (let x = x0; x < x0 + w; x++) {
    px.set(x, y0 + 1, wood[1]);
    px.set(x, rail, wood[3]);
    px.set(x, rail + 1, wood[1]);
  }
  for (let b = 0; b <= bays.length; b++) post(clamp(Math.round(x0 + b * bayW) - (b === bays.length ? 3 : 0), x0, x0 + w - 3));

  bays.forEach((bay, b) => {
    const bx = Math.round(x0 + b * bayW) + 3;
    const bw = Math.round(bayW) - 4;
    const mid = bx + Math.floor(bw / 2);
    if (bay.kind === 'door') {
      // 널문: 세로 널에 띠장 둘
      const dw = Math.min(13, bw - 4);
      const dx = mid - Math.floor(dw / 2);
      const dy = y0 + 6;
      for (let y = dy; y <= wallBot; y++) {
        for (let x = dx; x < dx + dw; x++) {
          const edge = x === dx || x === dx + dw - 1 || y === dy;
          const plank = (x - dx) % 3 === 0;
          let v = edge ? 1 : plank ? 2 : 3 + (hash2(x, y >> 2, seed + 21) > 0.7 ? 1 : 0);
          if (!edge && (y === dy + 5 || y === wallBot - 4)) v = 4;
          if (!edge && (y === dy + 6 || y === wallBot - 3)) v = 1;
          px.set(x, y, wood[clamp(v, 0, 5)]);
        }
      }
      px.set(dx + dw - 3, Math.round((dy + wallBot) / 2), ink);
      px.set(dx + dw - 3, Math.round((dy + wallBot) / 2) + 1, wood[5]);
      // 댓돌
      for (let x = dx - 1; x <= dx + dw; x++) {
        px.set(x, wallBot + 1, stone[5]);
        px.set(x, wallBot + 2, stone[4]);
        px.set(x, wallBot + 3, stone[2]);
      }
    } else if (bay.kind === 'window') {
      // 살창: 나무 살을 세로로 박은 창
      const ww = Math.min(11, bw - 4);
      const wx = mid - Math.floor(ww / 2);
      const wy = y0 + 8;
      for (let y = wy; y < wy + 8; y++) {
        for (let x = wx; x < wx + ww; x++) {
          const edge = x === wx || x === wx + ww - 1 || y === wy || y === wy + 7;
          px.set(x, y, edge ? wood[2] : (x - wx) % 2 === 0 ? wood[3] : ink);
        }
      }
      for (let x = wx; x < wx + ww; x++) px.set(x, wy + 8, wood[4]);
    } else if (bay.kind === 'kitchen') {
      // 부엌: 어두운 문간과 반쯤 열린 널문
      const dw = Math.min(14, bw - 3);
      const dx = mid - Math.floor(dw / 2);
      const dy = y0 + 5;
      for (let y = dy; y <= wallBot; y++) {
        for (let x = dx; x < dx + dw; x++) {
          const edge = x === dx || x === dx + dw - 1 || y === dy;
          let c: Color = edge ? wood[1] : pal.bark[0];
          if (!edge && x < dx + 5) c = wood[(x - dx) % 2 === 0 ? 2 : 3]; // 열어 젖힌 문짝
          if (!edge && x >= dx + 5 && y > wallBot - 5 && hash2(x, y, seed + 25) < 0.5) c = pal.wood[0];
          px.set(x, y, c);
        }
      }
      // 부뚜막의 불빛 한 점
      px.set(dx + dw - 4, wallBot - 2, pal.thatch[4]);
      px.set(dx + dw - 5, wallBot - 2, pal.clay[1]);
    } else if (bay.kind === 'open') {
      // 헛간: 앞이 트인 칸. 안은 어둡고 짚단이 쌓여 있다
      for (let y = y0 + 3; y <= wallBot; y++) {
        for (let x = bx - 1; x < bx + bw + 1; x++) {
          let c: Color = pal.bark[0];
          const pile = wallBot - y < 7 + Math.round(vnoise(x / 3, 0, seed + 31) * 5);
          if (pile) c = pal.thatch[clamp(2 + Math.round((hash2(x, y, seed + 32) - 0.3) * 2), 1, 4)];
          px.set(x, y, c);
        }
      }
    }
  });
}

/** 낮은 굴뚝. 연기가 피어오르는 자리(그림 안의 점)를 돌려준다. */
function chimney(px: Px, x: number, yBot: number, pal: Palette): { x: number; y: number } {
  const { clay, ink } = pal;
  for (let y = yBot - 12; y <= yBot; y++) {
    for (let i = 0; i < 6; i++) {
      const v = i < 2 ? 3 : i < 4 ? 2 : 1;
      px.set(x + i, y, y === yBot - 12 ? ink : clay[clamp(v - (y > yBot - 3 ? 1 : 0), 0, 4)]);
    }
  }
  for (let i = 1; i < 5; i++) px.set(x + i, yBot - 12, pal.bark[0]);
  return { x: x + 3, y: yBot - 13 };
}

function finish(px: Px, pal: Palette): Px {
  rim(px, pal.ink, pal.inkSoft);
  return px;
}

// ── 초가 ─────────────────────────────────────────────────────
export const choga: Maker = (pal, variant) => {
  const W = 108;
  const H = 94;
  const px = new Px(W, H);
  const layouts: Bay['kind'][][] = [
    ['kitchen', 'door', 'window'],
    ['window', 'door', 'kitchen'],
    ['door', 'window', 'door'],
  ];
  const bays = layouts[variant % 3].map((kind) => ({ kind }));
  const chimneyX = variant % 3 === 1 ? 3 : W - 9;
  const smoke = chimney(px, chimneyX, 84, pal);
  clayWall(px, 10, 50, 88, 40, pal, bays, 40 + variant * 5);
  // 툇마루: 방문 앞의 좁은 마루
  const doorBay = layouts[variant % 3].indexOf('door');
  const mx = 10 + Math.round((88 / 3) * doorBay) + 2;
  for (let x = mx; x < mx + 27; x++) {
    px.set(x, 79, pal.wood[5]);
    px.set(x, 80, pal.wood[4]);
    px.set(x, 81, pal.wood[2]);
    px.set(x, 82, pal.wood[1]);
    if ((x - mx) % 9 === 1) {
      px.set(x, 83, pal.wood[2]);
      px.set(x, 84, pal.wood[1]);
      px.set(x + 1, 83, pal.wood[1]);
      px.set(x + 1, 84, pal.wood[0]);
    }
  }
  thatchRoof(px, 0, 3, W, 56, pal, 60 + variant * 9, variant >= 3);
  finish(px, pal);
  return {
    frames: [px],
    smoke,
    ax: 54,
    ay: 91,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -46, x1: 46, h: 40, side: 13, depth: 5, ragged: true } }],
  };
};

// ── 작은 초가(노비 집, 절의 살림채) ─────────────────────────────
function hutOf(pal: Palette, variant: number, seed: number, old = false): SpriteDef {
  const W = 76;
  const H = 76;
  const px = new Px(W, H);
  const bays: Bay[] = variant % 2 === 0 ? [{ kind: 'door' }, { kind: 'window' }] : [{ kind: 'window' }, { kind: 'door' }];
  const smoke = chimney(px, variant % 2 === 0 ? W - 8 : 2, 67, pal);
  clayWall(px, 9, 36, 58, 37, pal, bays, seed);
  thatchRoof(px, 0, 3, W, 42, pal, seed + 3, old);
  finish(px, pal);
  return {
    frames: [px],
    smoke,
    ax: 38,
    ay: 73,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -31, x1: 31, h: 36, side: 11, depth: 4, ragged: true } }],
  };
}

export const hut: Maker = (pal, variant) => hutOf(pal, variant, 80 + variant * 7, variant >= 2);
export const hall: Maker = (pal) => hutOf(pal, 1, 95, true);

// ── 헛간 ─────────────────────────────────────────────────────
export const shed: Maker = (pal) => {
  const W = 58;
  const H = 52;
  const px = new Px(W, H);
  clayWall(px, 7, 28, 44, 21, pal, [{ kind: 'open' }, { kind: 'open' }], 120);
  thatchRoof(px, 0, 3, W, 32, pal, 123, true);
  finish(px, pal);
  return {
    frames: [px],
    ax: 29,
    ay: 49,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -23, x1: 23, h: 22, side: 9, depth: 4, ragged: true } }],
  };
};

// ── 기와지붕 ──────────────────────────────────────────────────
// 골이 진 기와(수키와의 줄), 용마루, 처마 끝의 막새, 살짝 들린 추녀.
function tileRoof(px: Px, x0: number, y0: number, w: number, h: number, pal: Palette, seed: number): void {
  const ramp = pal.tile;
  const n = ramp.length - 1;
  const half = w / 2;
  const cx = x0 + half;
  const ridgeHalf = half * 0.6;
  const ridgeY = y0 + 5;
  for (let x = x0; x < x0 + w; x++) {
    const u = (x + 0.5 - cx) / half;
    const au = Math.abs(u);
    // 지붕의 윗선: 용마루에서 양쪽으로 내려간다
    const top = au < 0.6 ? ridgeY - 2 : ridgeY - 2 + ((au - 0.6) / 0.4) * (h * 0.52);
    // 처마선: 가운데가 낮고 추녀 끝이 들린다
    const eave = y0 + h - 1 - 5 * Math.pow(au, 2.4);
    for (let y = Math.round(top); y <= Math.round(eave); y++) {
      const v = clamp((y - ridgeY) / Math.max(1, eave - ridgeY), 0, 1);
      const hip = au - (0.6 + 0.4 * v);
      const rib = (((x - Math.round(cx)) % 4) + 4) % 4;
      let tone = 0.52 - 0.14 * v;
      if (hip > -0.02) tone += u < 0 ? 0.14 : -0.2;
      else tone += rib === 0 ? 0.26 : rib === 1 ? 0.1 : rib === 2 ? -0.04 : -0.2;
      tone -= u * 0.08;
      // 기와 이음매
      if (hip <= -0.02 && (y + (Math.floor((x - Math.round(cx)) / 4) % 2) * 3) % 6 === 0 && rib < 2) tone -= 0.12;
      if (hash2(x, y, seed + 1) < 0.02) tone += 0.14;
      const fromEave = eave - y;
      if (fromEave < 1) tone = rib < 2 ? 0.86 : 0.18; // 막새
      else if (fromEave < 2) tone = rib < 2 ? 0.6 : 0.12;
      px.set(x, y, ramp[clamp(Math.round(tone * n), 0, n)]);
    }
    // 처마 밑(서까래 끝)
    const e = Math.round(eave);
    px.set(x, e + 1, x % 3 === 0 ? pal.wood[3] : pal.wood[0]);
    px.set(x, e + 2, pal.wood[0]);
  }
  // 추녀마루: 용마루 끝에서 처마 귀퉁이로
  for (const side of [-1, 1]) {
    const xs = cx + side * ridgeHalf;
    const xe = cx + side * (half - 2);
    const ys = ridgeY;
    const ye = y0 + h - 7;
    const steps = Math.round(Math.abs(xe - xs));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(xs + (xe - xs) * t);
      const y = Math.round(ys + (ye - ys) * t);
      px.set(x, y - 1, ramp[side < 0 ? n : n - 2]);
      px.set(x, y, ramp[side < 0 ? n - 1 : 2]);
      px.set(x, y + 1, ramp[1]);
    }
  }
  // 용마루
  for (let x = Math.round(cx - ridgeHalf) - 1; x <= Math.round(cx + ridgeHalf) + 1; x++) {
    const t = (x - (cx - ridgeHalf)) / (2 * ridgeHalf);
    px.set(x, ridgeY - 3, ramp[n]);
    px.set(x, ridgeY - 2, ramp[t > 0.75 ? n - 2 : n - 1]);
    px.set(x, ridgeY - 1, ramp[x % 4 === 0 ? 2 : 3]);
    px.set(x, ridgeY, ramp[2]);
    px.set(x, ridgeY + 1, ramp[1]);
  }
}

interface FrontOpts {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** 칸마다: 'lattice' 살문, 'hall' 트인 대청, 'wall' 벽 */
  bays: ('lattice' | 'hall' | 'wall' | 'door')[];
  /** 기둥의 빛깔 단계 */
  post: Ramp;
  /** 기단 높이 */
  base: number;
  seed: number;
  band?: Ramp; // 처마 밑의 띠(절)
}

// 기와집의 앞면: 돌 기단, 나무 기둥, 회벽, 살문, 툇마루
function timberFront(px: Px, pal: Palette, o: FrontOpts): void {
  const { plaster, stone, wood } = pal;
  const wallBot = o.y0 + o.h - o.base - 1;
  for (let y = o.y0; y <= wallBot; y++) {
    for (let x = o.x0; x < o.x0 + o.w; x++) {
      let v = 2.4 + (vnoise(x / 7, y / 5, o.seed) - 0.5) * 1.4;
      const shadeEdge = o.y0 + 6 + Math.round(vnoise(x / 5, 0, o.seed + 1) * 1.5);
      if (y < o.y0 + 2) v = 0;
      else if (y < shadeEdge) v -= 1.3;
      px.set(x, y, plaster[clamp(Math.round(v), 0, 3)]);
    }
  }
  if (o.band) {
    for (let x = o.x0; x < o.x0 + o.w; x++) {
      px.set(x, o.y0 + 1, o.band[1]);
      px.set(x, o.y0 + 2, o.band[x % 4 < 2 ? 2 : 1]);
      px.set(x, o.y0 + 3, o.band[0]);
    }
  }
  // 기단: 다듬은 긴 돌
  for (let y = wallBot + 1; y < o.y0 + o.h; y++) {
    for (let x = o.x0 - 4; x < o.x0 + o.w + 4; x++) {
      const row = Math.floor((y - wallBot - 1) / 4);
      const off = row % 2 === 0 ? 0 : 6;
      const inCell = (((x + off) % 12) + 12) % 12;
      let v = 3.4 + (hash2(Math.floor((x + off) / 12), row, o.seed + 3) - 0.5) * 1.2;
      if ((y - wallBot - 1) % 4 === 0) v += 1;
      if (inCell === 11 || (y - wallBot - 1) % 4 === 3) v = 1.6;
      if (x > o.x0 + o.w - 2) v -= 1;
      px.set(x, y, stone[clamp(Math.round(v), 1, 5)]);
    }
  }
  const bayW = o.w / o.bays.length;
  const rail = o.y0 + 5;
  for (let x = o.x0; x < o.x0 + o.w; x++) {
    px.set(x, rail, o.post[1]);
    px.set(x, rail + 1, o.post[0]);
  }
  o.bays.forEach((kind, b) => {
    const bx = Math.round(o.x0 + b * bayW) + 3;
    const bw = Math.round(bayW) - 3;
    const top = o.y0 + 8;
    if (kind === 'lattice' || kind === 'door') {
      // 살문: 한지를 바른 문에 나무 살
      const half = Math.floor(bw / 2);
      for (let y = top; y <= wallBot - (kind === 'lattice' ? 5 : 0); y++) {
        for (let x = bx; x < bx + bw; x++) {
          const lx = (x - bx) % half;
          const edge = lx === 0 || x === bx + bw - 1 || y === top || y === wallBot - (kind === 'lattice' ? 5 : 0);
          const bar = lx % 3 === 0 || (y - top) % 4 === 0;
          let c: Color = edge ? wood[2] : bar ? wood[4] : plaster[3];
          if (!edge && !bar && y < top + 3) c = plaster[2];
          px.set(x, y, c);
        }
      }
      if (kind === 'lattice') {
        // 머름(문 아래의 낮은 널벽)
        for (let y = wallBot - 4; y <= wallBot; y++) {
          for (let x = bx; x < bx + bw; x++) px.set(x, y, wood[(x - bx) % 6 === 0 ? 1 : y === wallBot - 4 ? 4 : 3]);
        }
      }
    } else if (kind === 'hall') {
      // 대청: 앞이 트인 마루방
      for (let y = top - 1; y <= wallBot; y++) {
        for (let x = bx; x < bx + bw; x++) {
          let c: Color = pal.bark[0];
          if (y > wallBot - 6) c = wood[y === wallBot - 5 ? 5 : (x - bx) % 5 === 0 ? 2 : 4]; // 마룻바닥
          else if (y > top + 6 && hash2(x >> 1, y >> 1, o.seed + 5) < 0.2) c = wood[0];
          px.set(x, y, c);
        }
      }
    }
  });
  // 기둥
  for (let b = 0; b <= o.bays.length; b++) {
    const x = clamp(Math.round(o.x0 + b * bayW) - (b === o.bays.length ? 3 : 0), o.x0, o.x0 + o.w - 3);
    for (let y = o.y0 + 2; y <= wallBot; y++) {
      const dark = y < o.y0 + 6 ? 1 : 0;
      px.set(x, y, o.post[clamp(3 - dark, 0, 3)]);
      px.set(x + 1, y, o.post[clamp(2 - dark, 0, 3)]);
      px.set(x + 2, y, o.post[0]);
    }
    // 주춧돌
    px.set(x - 1, wallBot + 1, stone[5]);
    px.set(x, wallBot + 1, stone[5]);
    px.set(x + 1, wallBot + 1, stone[4]);
    px.set(x + 2, wallBot + 1, stone[3]);
    px.set(x + 3, wallBot + 1, stone[2]);
  }
  // 가운데 섬돌(층계)
  const sx = Math.round(o.x0 + o.w / 2) - 9;
  for (let k = 0; k < o.base + 2; k++) {
    const y = wallBot + 1 + k;
    const inset = k < o.base / 2 ? 2 : 0;
    for (let x = sx + inset; x < sx + 18 - inset; x++) {
      px.set(x, y, stone[k % 3 === 0 ? 5 : k % 3 === 1 ? 4 : 2]);
    }
  }
}

const WOOD_POST = (pal: Palette): Ramp => [pal.wood[0], pal.wood[2], pal.wood[3], pal.wood[4]];

// ── 양반 댁 안채 ──────────────────────────────────────────────
export const manor: Maker = (pal) => {
  const W = 160;
  const H = 106;
  const px = new Px(W, H);
  timberFront(px, pal, {
    x0: 14,
    y0: 62,
    w: 132,
    h: 40,
    bays: ['lattice', 'lattice', 'hall', 'hall', 'lattice', 'wall'],
    post: WOOD_POST(pal),
    base: 7,
    seed: 150,
  });
  tileRoof(px, 0, 4, W, 62, pal, 160);
  finish(px, pal);
  return {
    frames: [px],
    ax: 80,
    ay: 103,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -70, x1: 70, h: 46, side: 16, depth: 5 } }],
  };
};

// ── 사랑채 ───────────────────────────────────────────────────
export const wing: Maker = (pal) => {
  const W = 94;
  const H = 86;
  const px = new Px(W, H);
  timberFront(px, pal, {
    x0: 10,
    y0: 48,
    w: 74,
    h: 35,
    bays: ['lattice', 'hall', 'lattice'],
    post: WOOD_POST(pal),
    base: 6,
    seed: 170,
  });
  tileRoof(px, 0, 4, W, 48, pal, 175);
  finish(px, pal);
  return {
    frames: [px],
    ax: 47,
    ay: 83,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -41, x1: 41, h: 40, side: 13, depth: 5 } }],
  };
};

// ── 작은 절의 법당 ─────────────────────────────────────────────
// 높은 돌 기단 위의 기와집. 기둥은 붉은 기가 도는 나무 빛, 처마 밑에 수수한 푸른 띠 하나.
export const temple: Maker = (pal) => {
  const W = 146;
  const H = 112;
  const px = new Px(W, H);
  const post: Ramp = [CLOTH.madder[0], shadeOf(CLOTH.madder[1], 0.9), CLOTH.madder[1], CLOTH.madder[2]];
  timberFront(px, pal, {
    x0: 16,
    y0: 64,
    w: 114,
    h: 44,
    bays: ['door', 'door', 'door'],
    post,
    base: 10,
    seed: 190,
    band: CLOTH.jade,
  });
  tileRoof(px, 0, 4, W, 64, pal, 195);
  finish(px, pal);
  return {
    frames: [px],
    ax: 73,
    ay: 109,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -61, x1: 61, h: 50, side: 16, depth: 5 } }],
  };
};

// ── 담 ───────────────────────────────────────────────────────
// 돌과 흙을 켜켜이 쌓고 기와를 얹은 담.
function wallBody(px: Px, x0: number, y0: number, w: number, h: number, pal: Palette, seed: number): void {
  // 흙과 막돌을 켜켜이 쌓은 담: 잿빛 돌 사이에 누런 흙빛이 섞인다(붉은 벽돌 빛은 쓰지 않는다)
  const { stone } = pal;
  const clay = pal.yard;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const row = Math.floor((y - y0) / 4);
      const off = row % 2 === 0 ? 0 : 4;
      const cell = Math.floor((x + off + seed * 3) / 8);
      const inCell = (((x + off + seed * 3) % 8) + 8) % 8;
      const iy = (y - y0) % 4;
      const lower = y >= y0 + h - 5;
      let c: Color;
      if (iy === 3 || inCell === 7) c = lower ? stone[1] : clay[1]; // 흙 줄눈
      else {
        const tone = 3 + (hash2(cell, row, seed + 41) - 0.5) * 1.8 + (iy === 0 ? 0.8 : 0) - (inCell > 4 ? 0.5 : 0);
        c = stone[clamp(Math.round(tone - (lower ? 0.4 : 0)), 1, 5)];
        if (!lower && hash2(cell, row, seed + 42) < 0.24) c = clay[clamp(Math.round(tone - 2), 0, 2)];
      }
      if (y < y0 + 2) c = shadeOf(c, 0.72);
      px.set(x, y, c);
    }
  }
}

function wallCap(px: Px, x0: number, y0: number, w: number, pal: Palette): void {
  const t = pal.tile;
  for (let x = x0; x < x0 + w; x++) {
    const rib = ((x % 4) + 4) % 4;
    px.set(x, y0, t[5]);
    px.set(x, y0 + 1, t[4]);
    px.set(x, y0 + 2, t[rib === 0 ? 4 : rib === 3 ? 1 : 3]);
    px.set(x, y0 + 3, t[rib === 0 ? 4 : rib === 3 ? 1 : 2]);
    px.set(x, y0 + 4, t[rib === 0 ? 3 : rib === 3 ? 0 : 2]);
    px.set(x, y0 + 5, t[rib < 2 ? 5 : 1]);
    px.set(x, y0 + 6, t[0]);
  }
}

export const wallH: Maker = (pal, variant) => {
  const W = 16;
  const H = 30;
  const px = new Px(W, H);
  wallBody(px, 0, 8, W, 21, pal, variant);
  wallCap(px, 0, 1, W, pal);
  for (let x = 0; x < W; x++) {
    px.set(x, 0, pal.ink);
    px.set(x, H - 1, pal.ink);
  }
  return { frames: [px], ax: 8, ay: 26, shades: [{ dx: 3, dy: 2, rx: 10, ry: 4, strength: 0.3 }] };
};

export const wallV: Maker = (pal, variant) => {
  const W = 14;
  const H = 38;
  const px = new Px(W, H);
  const t = pal.tile;
  // 위에서 본 기와 지붕(세로로 뻗는다)
  for (let y = 0; y < H - 14; y++) {
    const rib = y % 4;
    for (let x = 1; x < W - 1; x++) {
      const side = x < 6 ? 0 : x > 7 ? 2 : 1;
      let v = side === 1 ? 5 : side === 0 ? 3.4 : 2;
      if (side !== 1) v += rib === 0 ? 0.8 : rib === 3 ? -1.2 : 0;
      if (x === 1 || x === W - 2) v = side === 0 ? 4 : 1;
      px.set(x, y, t[clamp(Math.round(v), 0, 5)]);
    }
  }
  // 남쪽 끝의 마구리면
  wallBody(px, 2, H - 14, W - 4, 13, pal, variant + 5);
  for (let x = 1; x < W - 1; x++) px.set(x, H - 15, t[0]);
  for (let y = 0; y < H; y++) {
    px.under(0, y, pal.ink);
    px.under(W - 1, y, pal.ink);
  }
  for (let x = 2; x < W - 2; x++) px.set(x, H - 1, pal.ink);
  return { frames: [px], ax: 7, ay: 34, shades: [{ dx: 5, dy: -6, rx: 7, ry: 10, strength: 0.3 }] };
};

// ── 대문 ─────────────────────────────────────────────────────
// 기둥 둘에 작은 기와지붕을 얹은 문. 0은 열린 문, 1은 닫힌 문.
export const gate: Maker = (pal, variant) => {
  const W = 64;
  const H = 62;
  const px = new Px(W, H);
  const { wood } = pal;
  const yBot = H - 4;
  // 문짝
  if (variant === 1) {
    for (let y = 30; y <= yBot; y++) {
      for (let x = 17; x <= 46; x++) {
        const leaf = x < 32 ? x - 17 : x - 32;
        const edge = leaf === 0 || leaf === 14 || y === 30;
        let v = edge ? 1 : leaf % 4 === 0 ? 2 : 3 + (hash2(x, y >> 2, 221) > 0.75 ? 1 : 0);
        if (!edge && (y === 38 || y === yBot - 8)) v = 4;
        if (!edge && (y === 39 || y === yBot - 7)) v = 1;
        px.set(x, y, wood[clamp(v, 0, 5)]);
      }
    }
    for (const x of [29, 34]) {
      px.set(x, 45, pal.ink);
      px.set(x, 46, pal.tile[4]);
    }
  } else {
    // 안으로 열어 젖힌 문짝이 기둥 곁에 비스듬히 보인다
    for (let y = 30; y <= yBot; y++) {
      for (let k = 0; k < 5; k++) {
        px.set(17 + k, y - Math.round(k * 0.6), wood[k === 4 ? 1 : k % 2 === 0 ? 3 : 2]);
        px.set(46 - k, y - Math.round(k * 0.6), wood[k === 4 ? 0 : k % 2 === 0 ? 2 : 1]);
      }
    }
    // 문지방
    for (let x = 17; x <= 46; x++) {
      px.set(x, yBot, wood[2]);
      px.set(x, yBot + 1, wood[0]);
    }
  }
  // 기둥과 인방
  for (const x of [12, 47]) {
    for (let y = 24; y <= yBot + 1; y++) {
      for (let k = 0; k < 5; k++) px.set(x + k, y, wood[k < 2 ? 4 : k < 4 ? 3 : 1]);
    }
    for (let k = -1; k < 6; k++) {
      px.set(x + k, yBot + 2, pal.stone[k < 3 ? 5 : 3]);
      px.set(x + k, yBot + 3, pal.stone[2]);
    }
  }
  for (let x = 10; x <= 53; x++) {
    px.set(x, 26, wood[4]);
    px.set(x, 27, wood[3]);
    px.set(x, 28, wood[1]);
    px.set(x, 29, wood[0]);
  }
  tileRoof(px, 2, 4, 60, 22, pal, 230);
  finish(px, pal);
  return { frames: [px], ax: 8, ay: H - 6, sort: 3, shades: [{ dx: 30, dy: 2, rx: 30, ry: 4, strength: 0.28 }] };
};
