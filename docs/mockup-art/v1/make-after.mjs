// 첫 시안(v1 — 2026-11-01. 사용자가 보고 "깔끔하지만 단조롭다"고 해 2차 시안(../make-v2.mjs)을 만들었다. 그림은 그대로 두고 남긴다).
// 시안의 "새 그림" 쪽: 기획서 4.7.5의 규칙대로, 그림을 맵보다 두 배 촘촘하게(타일 32점, 사람 48×64점) 그린다.
// 게임 코드(src/)를 쓰지 않는 독립 스크립트다. 자리(땅의 갈래, 놓은 것, 사람의 발끝)는 make-before.mjs가 쓴
// region.json에서 읽으므로 "지금" 쪽과 같은 자리·같은 것이다. 빛깔 값은 src/pixel/palette.ts의 단계를 바탕으로 손으로 다시 짰다.
//
//   node docs/mockup-art/v1/make-after.mjs
//     → after-scene.png(2046×1536 — 아이패드 1024×768의 기기 화소. 그림 점 하나 = 3화소, 맵 점 하나 = 6화소로 지금과 같다)
//       after-people.png, compare-scene.png, compare-people.png, after-metrics.json
//
// 그림 규칙(기획서 4.7.5의 ㄱ~ㅈ)을 이 파일에서 찾으려면 "규칙 ㄱ" 처럼 찾는다.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { A, Img, checker, colorCount, decodePng, edgeContrast, harshChecker, harshOrphans, encodePng, hash2, hex, monotony, orphans, outlineShare, personVsGround, rgb, spriteOrphans, vnoise } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const region = JSON.parse(readFileSync(join(here, '..', 'region-v1.json'), 'utf8'));

/** 그림 점 / 맵 점(규칙 ㄱ: 그림만 두 배로 촘촘하게. 맵의 좌표·부딪힘·누르는 자리는 16점 칸 그대로) */
const K = 2;
const TILE = 16 * K;
const CAM = { x: region.cam.x * K, y: region.cam.y * K };
const VW = Math.round(region.view.w * K);
const VH = region.view.h * K;

// ── 빛깔(봄). 재질마다 어두움 → 밝음. 규칙 ㄷ: 재질마다 4~6단, 빛 쪽은 누렇게, 그늘 쪽은 푸르게 ─────────
const P = (...l) => l.map((s) => hex(s));
const INK = hex('#241a1b'); // 먹빛 테두리(규칙 ㄴ)
const GRASS = P('#21492f', '#30693b', '#478a45', '#64a54e', '#8dc35d', '#bddc7c');
const DIRT = P('#5a3b2b', '#8a6041', '#ad8256', '#c9a06b', '#dcb983', '#ecd3a4');
const STONE = P('#2f3036', '#4e4f56', '#727174', '#9a968f', '#c2bcae', '#e2dccb');
const ROOF = P('#1b1f28', '#2a313d', '#3f4857', '#5b6676', '#86909b');
const PLASTER = P('#a4977f', '#cbbfa5', '#e3d9c0', '#f4eddb');
const WOOD = P('#2c1f17', '#4a3122', '#6c4730', '#8f6242', '#b5865a');
const THATCH = P('#3d3226', '#5e4b35', '#806849', '#a08760', '#bea67c', '#d9c59c');
const CLAY = P('#6e4c33', '#96704d', '#b99266', '#d4b184');
const PAPER = P('#d9cdb0', '#f1e8d2');
const BLOSSOM = P('#5e2b40', '#a8566f', '#d9849a', '#f2b5c1', '#fde2e2');
const LEAF = P('#3f6a2e', '#6e9f3f', '#a2c656');
const WATER = P('#132a3d', '#1f4664', '#3a7896', '#86c3cc');
const SKIN = P('#9a6346', '#cc9269', '#e8b48a', '#f7d4af');
const HAIR = P('#141011', '#2a2120', '#43362f', '#5e4d43');
const WHITE_HAIR = P('#8a8580', '#b8b3ab', '#dcd7cd', '#f6f2e9');
const COTTON = P('#8e806a', '#b9ab90', '#dcd1b6', '#f3ecd9');
const HEMP = P('#6f6047', '#978562', '#baa781', '#d5c6a0');
const EARTH = P('#523a2b', '#73513a', '#946e4d', '#b48d66');
const ASH = P('#575249', '#79736a', '#9c968a', '#bfb9ab');
const STRAW = P('#78592e', '#a5823e', '#cdab5a', '#e8d08a');
const FLOWERS = P('#f0cf4a', '#f7f2ea', '#c27ac0');
const LIP = hex('#b4574d');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** 땅의 그림자: 바탕 빛을 한 단계 어둡게(먹을 섞지 않는다 — 규칙 ㅂ) */
const SHADE_OF = new Map();
for (const ramp of [GRASS, DIRT, STONE]) for (let i = 1; i < ramp.length; i++) SHADE_OF.set(ramp[i], ramp[i - 1]);
SHADE_OF.set(GRASS[0], GRASS[0]);
SHADE_OF.set(DIRT[0], DIRT[0]);
SHADE_OF.set(FLOWERS[0], GRASS[2]);
SHADE_OF.set(FLOWERS[1], GRASS[2]);
SHADE_OF.set(FLOWERS[2], GRASS[2]);

// ── 낱그림 도구 ────────────────────────────────────────────────
/** 그림 둘레(빈 점 가운데 위·아래·옆에 그림이 닿은 점)에 테두리를 두른다 — 규칙 ㄴ */
function outline(img, color = INK) {
  const src = img.d.slice();
  const { w, h } = img;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(src[y * w + x]) > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) img.d[y * w + x] = color;
}

/**
 * 둥근 덩어리(돌, 잎 뭉치, 단지)를 빛 하나로 칠한다 — 규칙 ㄷ: 빛은 왼쪽 위에서, 단계는 띠로 나뉘고 섞음 무늬가 없다.
 * ramp의 lo~hi 단계를 쓰고, 오른쪽 아래 가장자리는 rim 단계로 그늘 골을 둔다.
 */
function ball(img, cx, cy, rx, ry, ramp, o = {}) {
  const lo = o.lo ?? 1;
  const hi = o.hi ?? ramp.length - 1;
  const rim = o.rim ?? 0;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      if (o.keep && !o.keep(x, y)) continue;
      const nz = Math.sqrt(1 - d2);
      const light = -0.5 * dx - 0.62 * dy + 0.6 * nz;
      const t = clamp(0.42 + 0.62 * light + (o.bias ?? 0), 0, 0.999);
      let i = lo + Math.floor(t * (hi - lo + 1));
      // 오른쪽 아래 가장자리는 그늘 골(한 점 남짓)
      if (d2 > Math.pow(1 - 1.25 / Math.min(rx, ry), 2) && dx + dy > 0.25) i = rim;
      img.set(x, y, ramp[clamp(i, 0, ramp.length - 1)]);
    }
  }
}

const inEllipse = (x, y, cx, cy, rx, ry) => {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
};

// ── 땅(규칙 ㄹ: 잡티 대신 무리 짓기, 규칙 ㅁ: 길은 밝고 풀은 짙게) ─────────────
const { x0: TX0, y0: TY0 } = region.tiles;
const codeAt = (tx, ty) => region.terrain[ty - TY0]?.[tx - TX0] ?? 'g';
const isDirtTile = (tx, ty) => 'py'.includes(codeAt(tx, ty));

function paintGround() {
  const img = new Img(VW, VH);
  const dirt = new Uint8Array(VW * VH);
  const yard = new Uint8Array(VW * VH);
  const field = new Float32Array(VW * VH);
  const sm = (t) => t * t * (3 - 2 * t);
  // 1) 점마다 흙인가 풀인가: 칸 가운데 값을 부드럽게 이어 붙이고 큰 결의 무늬로 가장자리를 구불게(작은 잡티는 만들지 않는다)
  for (let Y = 0; Y < VH; Y++) {
    for (let X = 0; X < VW; X++) {
      const wx = X + CAM.x;
      const wy = Y + CAM.y;
      const u = wx / TILE - 0.5;
      const v = wy / TILE - 0.5;
      const i = Math.floor(u);
      const j = Math.floor(v);
      const fx = sm(u - i);
      const fy = sm(v - j);
      const val = (tx, ty) => (isDirtTile(tx, ty) ? 1 : 0);
      const f = (val(i, j) * (1 - fx) + val(i + 1, j) * fx) * (1 - fy) + (val(i, j + 1) * (1 - fx) + val(i + 1, j + 1) * fx) * fy;
      const n = (vnoise(wx / 15, wy / 15, 7) - 0.5) * 0.42 + (vnoise(wx / 7, wy / 7, 9) - 0.5) * 0.12;
      dirt[Y * VW + X] = f + n > 0.5 ? 1 : 0;
      field[Y * VW + X] = f + n * 0.6;
      yard[Y * VW + X] = codeAt(Math.floor(wx / TILE), Math.floor(wy / TILE)) === 'y' ? 1 : 0;
    }
  }
  // 외톨이가 남지 않게 한 번 고른다(이웃 넷 가운데 셋 이상이 다르면 따른다)
  for (let pass = 0; pass < 2; pass++) {
    const src = dirt.slice();
    for (let Y = 1; Y < VH - 1; Y++) {
      for (let X = 1; X < VW - 1; X++) {
        const k = Y * VW + X;
        const same = (src[k - 1] === src[k]) + (src[k + 1] === src[k]) + (src[k - VW] === src[k]) + (src[k + VW] === src[k]);
        if (same <= 1) dirt[k] = 1 - src[k];
      }
    }
  }
  const D = (X, Y) => (X < 0 || Y < 0 || X >= VW || Y >= VH ? dirt[clamp(Y, 0, VH - 1) * VW + clamp(X, 0, VW - 1)] : dirt[Y * VW + X]);

  // 2) 바탕: 풀은 한 빛, 흙은 한 빛(큰 얼룩을 깔지 않는다 — 얼룩의 경계가 지저분해 보인다)
  for (let Y = 0; Y < VH; Y++) for (let X = 0; X < VW; X++) img.set(X, Y, D(X, Y) ? DIRT[3] : GRASS[2]);
  // 길의 가운데는 많이 밟혀 한 단계 밝다(길을 따라 매끈한 띠 — 길이 눈길을 모은다, 규칙 ㅈ)
  for (let Y = 0; Y < VH; Y++) for (let X = 0; X < VW; X++) if (D(X, Y) && !yard[Y * VW + X] && field[Y * VW + X] > 0.97) img.set(X, Y, DIRT[4]);

  // 3) 잎 무리: 들쭉날쭉한 칸마다 둥근 잎 뭉치 하나(위는 볕, 아래 한 줄은 그늘).
  //    규칙 ㄹ — 한 무리는 같은 빛 두 점 이상이 이어지고, 외톨이 점을 만들지 않는다.
  //    볕이 드는 너른 자리(큰 결의 무늬)에서는 뭉치의 윗줄이 한 단계 더 밝다(얼룩 대신 뭉치의 빛으로 넓은 빛을 낸다).
  const CLUMPS = [
    ['.LL.', 'LLLL', '.DD.'],
    ['.L.', 'LLL', 'DD.'],
    ['.LLL.', 'LLLLL', '.DDD.'],
    ['L..L', 'LLLL', '.DD.'],
  ];
  // 풀 둔덕: 작은 공 두셋을 겹친 도톰한 무리(위는 볕, 오른쪽 아래는 그늘 골) — 바닥에 큰 결을 준다
  for (let gy = Math.floor(CAM.y / 22) - 1; gy <= (CAM.y + VH) / 22 + 1; gy++) {
    for (let gx = Math.floor(CAM.x / 26) - 1; gx <= (CAM.x + VW) / 26 + 1; gx++) {
      if (hash2(gx, gy, 15) > 0.5) continue;
      const X = gx * 26 + Math.floor(hash2(gx, gy, 16) * 14) - CAM.x;
      const Y = gy * 22 + Math.floor(hash2(gx, gy, 17) * 12) - CAM.y;
      let clear = true;
      for (let j = -6; j <= 9 && clear; j++) for (let i = -8; i <= 12; i++) if (D(X + i, Y + j)) { clear = false; break; }
      if (!clear) continue;
      const n = 2 + Math.floor(hash2(gx, gy, 18) * 2);
      for (let k = 0; k < n; k++) {
        const bx = X + k * 4 - (n - 1) * 2 + (k === 1 ? 0 : 0);
        const by = Y + (k === 1 ? -2 : 0);
        ball(img, bx, by, 4.2, 3.4, GRASS, { lo: 2, hi: 4, rim: 1, bias: 0.05 });
      }
    }
  }
  const cellW = 7;
  const cellH = 6;
  for (let gy = Math.floor(CAM.y / cellH) - 1; gy <= (CAM.y + VH) / cellH + 1; gy++) {
    for (let gx = Math.floor(CAM.x / cellW) - 1; gx <= (CAM.x + VW) / cellW + 1; gx++) {
      if (hash2(gx, gy, 11) > 0.78) continue;
      const wx = gx * cellW + Math.floor(hash2(gx, gy, 12) * 3);
      const wy = gy * cellH + Math.floor(hash2(gx, gy, 13) * 3);
      const X = wx - CAM.x;
      const Y = wy - CAM.y;
      const motif = CLUMPS[Math.floor(hash2(gx, gy, 14) * CLUMPS.length)];
      let clear = true;
      for (let j = -1; j <= motif.length + 2 && clear; j++) for (let i = -1; i <= motif[0].length; i++) if (D(X + i, Y + j)) { clear = false; break; }
      if (!clear) continue;
      const sun = vnoise(wx / 40, wy / 34, 3) > 0.56;
      motif.forEach((line, j) => {
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '.') continue;
          img.set(X + i, Y + j, ch === 'D' ? GRASS[1] : sun && j === 0 ? GRASS[4] : GRASS[3]);
        }
      });
    }
  }
  // 들꽃: 두 점짜리 꽃잎 무리(노랑·흰빛·보랏빛)
  for (let gy = Math.floor(CAM.y / 22); gy <= (CAM.y + VH) / 22; gy++) {
    for (let gx = Math.floor(CAM.x / 26); gx <= (CAM.x + VW) / 26; gx++) {
      if (hash2(gx, gy, 21) > 0.2) continue;
      const X = gx * 26 + Math.floor(hash2(gx, gy, 22) * 20) - CAM.x;
      const Y = gy * 22 + Math.floor(hash2(gx, gy, 23) * 16) - CAM.y;
      if (D(X, Y) || D(X + 2, Y + 2) || D(X - 1, Y)) continue;
      const c = FLOWERS[Math.floor(hash2(gx, gy, 24) * 3)];
      img.rect(X, Y, 2, 2, c);
      img.set(X + 3, Y + 1, c);
      img.set(X + 3, Y + 2, c);
      img.rect(X, Y + 2, 2, 1, GRASS[1]);
    }
  }

  // 4) 흙의 결: 잔돌 무리(밝은 윗면 + 몸 + 그늘), 패인 자국
  for (let gy = Math.floor(CAM.y / 14); gy <= (CAM.y + VH) / 14; gy++) {
    for (let gx = Math.floor(CAM.x / 17); gx <= (CAM.x + VW) / 17; gx++) {
      const X = gx * 17 + Math.floor(hash2(gx, gy, 31) * 12) - CAM.x;
      const Y = gy * 14 + Math.floor(hash2(gx, gy, 32) * 10) - CAM.y;
      const inYard = yard[clamp(Y, 0, VH - 1) * VW + clamp(X, 0, VW - 1)];
      if (hash2(gx, gy, 33) > (inYard ? 0.12 : 0.24)) continue;
      if (!D(X - 1, Y - 1) || !D(X + 5, Y + 4) || !D(X - 1, Y + 4) || !D(X + 5, Y - 1)) continue;
      const big = hash2(gx, gy, 34) > 0.5;
      const w = big ? 4 : 3;
      const h = big ? 3 : 2;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.set(X + i, Y + j, j === 0 ? STONE[4] : i === w - 1 || j === h - 1 ? STONE[2] : STONE[3]);
      img.set(X, Y, D(X, Y) ? STONE[4] : STONE[4]);
      // 돌 아래 오른쪽의 그늘(흙을 한 단계 어둡게)
      for (let i = 1; i <= w; i++) img.set(X + i, Y + h, DIRT[2]);
    }
  }
  for (let gy = Math.floor(CAM.y / 11); gy <= (CAM.y + VH) / 11; gy++) {
    for (let gx = Math.floor(CAM.x / 13); gx <= (CAM.x + VW) / 13; gx++) {
      const r = hash2(gx, gy, 41);
      if (r > 0.42) continue;
      const X = gx * 13 + Math.floor(hash2(gx, gy, 42) * 8) - CAM.x;
      const Y = gy * 11 + Math.floor(hash2(gx, gy, 43) * 7) - CAM.y;
      if (!D(X - 2, Y - 3) || !D(X + 6, Y + 3) || !D(X - 2, Y + 3) || !D(X + 6, Y - 3)) continue;
      if (img.get(X, Y) !== DIRT[3] || img.get(X + 3, Y + 1) !== DIRT[3]) continue;
      if (r < 0.16) {
        // 밟혀 패인 자국: 위는 그늘, 아래는 볕(움푹한 꼴)
        img.rect(X, Y, 3, 1, DIRT[2]);
        img.rect(X + 1, Y + 1, 3, 1, DIRT[4]);
      } else {
        // 볕에 마른 흙덩이(밝은 무리, 아래에 그늘 두 점)
        img.rect(X, Y, 3, 2, DIRT[4]);
        img.set(X + 3, Y + 1, DIRT[4]);
        img.rect(X + 1, Y + 2, 3, 1, DIRT[2]);
      }
    }
  }

  // 5) 풀과 흙이 만나는 곳: 풀이 한 뼘 도톰하다 — 위·왼쪽 가장자리는 볕, 아래·오른쪽 가장자리는 짙은 선,
  //    풀 아래의 흙에는 두 점짜리 그늘이 진다(규칙 ㄷ의 빛 하나).
  const out = img.d.slice();
  for (let Y = 0; Y < VH; Y++) {
    for (let X = 0; X < VW; X++) {
      const k = Y * VW + X;
      if (!D(X, Y)) {
        if (D(X, Y + 1)) out[k] = GRASS[0];
        else if (D(X, Y + 2)) out[k] = GRASS[1];
        else if (D(X + 1, Y)) out[k] = GRASS[1];
        else if (D(X, Y - 1) || D(X - 1, Y)) out[k] = GRASS[4];
      } else {
        if (!D(X, Y - 1) || !D(X, Y - 2)) out[k] = DIRT[2];
        else if (!D(X, Y - 3)) out[k] = DIRT[2] === img.d[k] ? DIRT[2] : img.d[k];
        if (!D(X - 1, Y) && D(X, Y - 1)) out[k] = DIRT[2];
      }
    }
  }
  img.d.set(out);
  // 풀이 흙 위로 늘어진 잎: 위쪽 가장자리를 따라 띄엄띄엄
  for (let Y = 1; Y < VH - 4; Y++) {
    for (let X = 1; X < VW - 3; X++) {
      if (D(X, Y) || !D(X, Y + 1) || !D(X + 2, Y + 1)) continue;
      if (hash2(X + CAM.x, Y + CAM.y, 51) > 0.16) continue;
      img.set(X, Y + 1, GRASS[2]);
      img.set(X + 1, Y + 1, GRASS[2]);
      img.set(X + 1, Y + 2, GRASS[1]);
      img.set(X, Y + 2, GRASS[1]);
      img.set(X + 2, Y + 2, DIRT[2]);
    }
  }
  return { img, dirt };
}

/** 그림자 판에 칠한 곳의 바닥 빛을 한 단계 어둡게 */
function applyShadow(ground, mask) {
  for (let i = 0; i < mask.length; i++) if (mask[i]) ground.d[i] = SHADE_OF.get(ground.d[i]) ?? ground.d[i];
}
function shadowEllipse(mask, cx, cy, rx, ry, holes = 0) {
  for (let Y = Math.floor(cy - ry); Y <= cy + ry; Y++) {
    for (let X = Math.floor(cx - rx); X <= cx + rx; X++) {
      if (X < 0 || Y < 0 || X >= VW || Y >= VH || !inEllipse(X, Y, cx, cy, rx, ry)) continue;
      // 잎 사이로 새는 볕(무리 진 구멍)
      if (holes && vnoise((X + CAM.x) / 5, (Y + CAM.y) / 4, 61) > 1 - holes) continue;
      mask[Y * VW + X] = 1;
    }
  }
}
function shadowRect(mask, x, y, w, h) {
  for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) if (X >= 0 && Y >= 0 && X < VW && Y < VH) mask[Y * VW + X] = 1;
}

// ── 세운 것 ────────────────────────────────────────────────────
// 낱그림은 { img, ax, ay } — ax, ay는 그림 안의 발치(그림 점). 둘레 한 점은 테두리 자리로 비워 둔다.

/** 기와 담(가로로 이어진 한 줄) */
function wallRun(tiles) {
  const W = tiles * TILE + 2;
  const H = 62;
  const img = new Img(W, H);
  const x0 = 1;
  const x1 = W - 2;
  // 용마루
  for (let x = x0; x <= x1; x++) {
    img.set(x, 1, ROOF[3]);
    img.set(x, 2, ROOF[2]);
    img.set(x, 3, ROOF[1]);
  }
  // 기왓골: 다섯 점마다 한 골(골의 왼쪽 끝이 볕을 받는다)
  for (let y = 4; y <= 12; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (x - x0) % 5;
      let c = p === 0 ? ROOF[1] : p === 1 ? ROOF[3] : ROOF[2];
      if (y === 4) c = ROOF[1];
      if (y === 5 && p !== 0) c = p === 1 ? ROOF[4] : ROOF[3];
      img.set(x, y, c);
    }
  }
  // 막새(처마 끝의 둥근 기와)
  for (let x = x0; x <= x1; x += 5) {
    for (let y = 13; y <= 16; y++) for (let i = 0; i < 5; i++) img.set(x + i, y, ROOF[0]);
    img.set(x + 2, 13, ROOF[3]);
    img.set(x + 3, 13, ROOF[3]);
    img.set(x + 1, 14, ROOF[3]);
    img.set(x + 2, 14, ROOF[2]);
    img.set(x + 3, 14, ROOF[2]);
    img.set(x + 4, 14, ROOF[1]);
    img.set(x + 1, 15, ROOF[2]);
    img.set(x + 2, 15, ROOF[2]);
    img.set(x + 3, 15, ROOF[1]);
    img.set(x + 4, 15, ROOF[1]);
  }
  // 처마 밑 그늘
  for (let x = x0; x <= x1; x++) {
    img.set(x, 17, ROOF[0]);
    img.set(x, 18, PLASTER[0]);
    img.set(x, 19, PLASTER[1]);
  }
  // 담 몸: 회벽에 돌을 박았다(줄마다 엇갈려)
  for (let y = 20; y <= 50; y++) for (let x = x0; x <= x1; x++) img.set(x, y, PLASTER[2]);
  const courses = [21, 29, 37, 45];
  courses.forEach((cy, row) => {
    let x = x0 + 1 + (row % 2) * 5 - 3;
    let n = 0;
    while (x < x1) {
      const w = 7 + Math.floor(hash2(x, cy, 71 + tiles) * 5);
      const h = 6;
      const sx = Math.max(x0 + 1, x);
      const ex = Math.min(x1 - 1, x + w - 1);
      if (ex - sx >= 3) {
        // 돌 아래·오른쪽의 그늘(회벽이 한 단계 어둡다)
        for (let i = sx + 1; i <= ex + 1 && i <= x1; i++) img.set(i, cy + h, PLASTER[1]);
        for (let j = cy + 1; j <= cy + h; j++) if (ex + 1 <= x1) img.set(ex + 1, j, PLASTER[1]);
        const tone = hash2(x, cy, 72) > 0.6 ? 0 : 1;
        for (let j = 0; j < h; j++) {
          for (let i = sx; i <= ex; i++) {
            const corner = (i === sx || i === ex) && (j === 0 || j === h - 1);
            if (corner) continue;
            let c = STONE[3 - tone];
            if (j === 0 || i === sx) c = STONE[4 - tone];
            if (j === h - 1 || i === ex) c = STONE[2 - tone];
            img.set(i, cy + j, c);
          }
        }
      }
      x += w + 2 + (n++ % 2);
    }
  });
  // 장대석 기단
  let bx = x0;
  let k = 0;
  while (bx <= x1) {
    const bw = 14 + Math.floor(hash2(bx, 7, 73 + tiles) * 8);
    const ex = Math.min(x1, bx + bw - 1);
    for (let y = 51; y <= 59; y++) {
      for (let x = bx; x <= ex; x++) {
        let c = STONE[3];
        if (y === 51) c = STONE[4];
        else if (y === 59) c = STONE[1];
        else if (x === ex) c = STONE[1];
        else if (x === bx) c = STONE[4];
        else if (y >= 57) c = STONE[2];
        img.set(x, y, c);
      }
    }
    bx = ex + 1;
    k++;
  }
  outline(img);
  // 발치: 담의 아랫줄(맵의 칸 아래 끝)
  return { img, ax: 1, ay: 58 };
}

/** 세로로 이어진 기와 담(위에서 내려다본 지붕마루) */
function wallColumn(len) {
  const W = 30;
  const img = new Img(W, len + 2);
  for (let y = 1; y <= len; y++) {
    for (let x = 1; x <= 28; x++) {
      const p = (y - 1) % 5;
      let c;
      if (x === 13) c = ROOF[4];
      else if (x === 14) c = ROOF[3];
      else if (x === 15) c = ROOF[1];
      else if (x < 13) c = p === 0 ? ROOF[1] : p === 1 ? ROOF[4] : ROOF[3];
      else c = p === 0 ? ROOF[0] : p === 1 ? ROOF[2] : ROOF[1];
      if (x === 1) c = ROOF[1];
      if (x === 28) c = ROOF[0];
      img.set(x, y, c);
    }
  }
  outline(img);
  return { img, ax: 15, ay: len };
}

/** 대문(열린 문: 문짝이 안쪽으로 열려 마당이 보인다) */
function gate() {
  const W = 130;
  const H = 126;
  const img = new Img(W, H);
  // 기둥 사이(32~96)가 지나가는 칸(52~53칸)과 맞는다. 바깥은 담에 닿는 옆벽.
  // 옆벽: 회벽과 나무틀
  for (const [a, b] of [
    [3, 28],
    [100, 125],
  ]) {
    for (let y = 52; y <= 110; y++) for (let x = a; x <= b; x++) img.set(x, y, y < 58 ? PLASTER[0] : y > 100 ? STONE[3] : PLASTER[2]);
    for (let x = a; x <= b; x++) {
      img.set(x, 58, WOOD[2]);
      img.set(x, 59, WOOD[1]);
      img.set(x, 100, WOOD[2]);
      img.set(x, 101, STONE[4]);
      img.set(x, 110, STONE[1]);
    }
    for (let y = 102; y <= 109; y++) if ((y - 102) % 4 === 3) for (let x = a; x <= b; x++) img.set(x, y, STONE[2]);
  }
  // 기둥(네모난 나무 기둥, 왼쪽 면이 볕)
  for (const px of [27, 93]) {
    for (let y = 46; y <= 108; y++) {
      for (let x = px; x < px + 9; x++) {
        const i = x - px;
        img.set(x, y, i <= 1 ? WOOD[4] : i >= 7 ? WOOD[1] : WOOD[3]);
      }
    }
    // 주춧돌
    for (let y = 106; y <= 112; y++) for (let x = px - 2; x < px + 11; x++) img.set(x, y, y === 106 ? STONE[5] : y === 112 ? STONE[1] : x === px + 10 ? STONE[2] : STONE[4]);
  }
  // 열린 문짝(안쪽으로 젖혀져 비스듬히 보인다)
  for (const [px, dir] of [
    [36, 1],
    [92, -1],
  ]) {
    for (let y = 56; y <= 104; y++) {
      for (let i = 0; i < 7; i++) {
        const x = px + dir * i;
        const top = 56 + Math.floor(i * 0.9);
        const bot = 104 - Math.floor(i * 0.5);
        if (y < top || y > bot) continue;
        let c = i % 3 === 2 ? WOOD[1] : WOOD[2];
        if (y === top || y === bot) c = WOOD[0];
        if (y === 70 || y === 90) c = WOOD[3];
        img.set(x, y, c);
      }
    }
  }
  // 문지방
  for (let x = 36; x <= 92; x++) {
    img.set(x, 106, WOOD[4]);
    img.set(x, 107, WOOD[3]);
    img.set(x, 108, WOOD[3]);
    img.set(x, 109, WOOD[1]);
  }
  // 창방(기둥 위를 건너지른 나무)
  for (let x = 6; x <= 123; x++) {
    img.set(x, 44, WOOD[4]);
    for (let y = 45; y <= 48; y++) img.set(x, y, WOOD[3]);
    img.set(x, 49, WOOD[2]);
    img.set(x, 50, WOOD[1]);
    img.set(x, 51, WOOD[0]);
  }
  // 지붕: 처마는 가운데가 낮고 끝이 살짝 들린다
  const eaveY = (x) => 33 - Math.round(Math.pow(Math.abs(x - 64.5) / 62, 3) * 6);
  const roofTop = 8;
  for (let x = 2; x <= 127; x++) {
    const ey = eaveY(x);
    // 지붕 면: 위로 갈수록 좁아진다(옆으로 15점)
    for (let y = roofTop; y <= ey; y++) {
      const half = 47 + ((y - roofTop) / (ey - roofTop + 1)) * 16;
      if (Math.abs(x - 64.5) > half) continue;
      const p = (x - 2) % 5;
      let c = p === 0 ? ROOF[1] : p === 1 ? ROOF[3] : ROOF[2];
      if (y === roofTop) c = ROOF[1];
      if (y === roofTop + 1 && p !== 0) c = ROOF[4];
      if (x > 100 && p !== 1) c = c === ROOF[2] ? ROOF[1] : c; // 오른쪽 끝은 조금 어둡게
      img.set(x, y, c);
    }
    // 막새
    for (let y = ey + 1; y <= ey + 3; y++) img.set(x, y, (x - 2) % 5 === 0 ? ROOF[0] : y === ey + 1 ? ROOF[3] : y === ey + 2 ? ROOF[2] : ROOF[1]);
    // 처마 밑: 서까래 끝이 줄지어 보인다
    for (let y = ey + 4; y <= 43; y++) {
      const r = (x - 1) % 6;
      let c = ROOF[0];
      if (y >= ey + 5 && y <= ey + 7 && r >= 1 && r <= 3) c = y === ey + 5 ? WOOD[4] : WOOD[3];
      img.set(x, y, c);
    }
  }
  // 용마루(양 끝이 들린다)
  for (let x = 14; x <= 115; x++) {
    const lift = x < 20 ? 20 - x : x > 109 ? x - 109 : 0;
    const y0 = 3 - Math.min(2, Math.floor(lift / 2));
    for (let y = y0; y <= 7; y++) img.set(x, y, y === y0 ? ROOF[4] : y === 7 ? ROOF[0] : y <= y0 + 1 ? ROOF[3] : ROOF[2]);
  }
  outline(img);
  // 발치: 51칸의 가운데(+8 맵 점) → 그림 점 (1 + 16), 땅에 닿는 줄 = 맵 점 444 → 기둥 밑에서 두 점 위
  return { img, ax: 1 + 16, ay: 110 };
}

/** 초가 세 칸(묵은 짚) */
function choga() {
  const W = 220;
  const H = 192;
  const img = new Img(W, H);
  const L = 18;
  const Rr = 202;
  // 기단(막돌 두 켜)
  for (let y = 166; y <= 182; y++) {
    for (let x = L - 6; x <= Rr + 6; x++) {
      const course = y < 174 ? 0 : 1;
      const off = course * 7;
      const sw = 13;
      const local = (x - L + off + 100) % sw;
      let c = STONE[3];
      if (y === 166 || y === 174) c = STONE[4];
      if (y === 173 || y === 182) c = STONE[1];
      else if (local === sw - 1) c = STONE[1];
      else if (local === 0) c = STONE[4];
      else if (hash2(Math.floor((x - L + off + 100) / sw), course, 81) > 0.6 && c === STONE[3]) c = STONE[2];
      img.set(x, y, c);
    }
  }
  // 툇마루(가운데·오른쪽 칸 앞)
  for (let y = 156; y <= 165; y++) {
    for (let x = 74; x <= Rr; x++) {
      let c = (x - 74) % 8 === 7 ? WOOD[2] : WOOD[3];
      if (y === 156) c = WOOD[4];
      if (y >= 164) c = WOOD[1];
      img.set(x, y, c);
    }
  }
  // 벽: 흙벽, 기둥 다섯
  for (let y = 92; y <= 165; y++) for (let x = L; x <= Rr; x++) if (!(y >= 156 && x >= 74)) img.set(x, y, y > 150 ? CLAY[1] : CLAY[2]);
  // 인방(벽을 가로지른 나무)
  for (let x = L; x <= Rr; x++) {
    img.set(x, 104, WOOD[3]);
    img.set(x, 105, WOOD[2]);
    img.set(x, 106, WOOD[1]);
  }
  const posts = [L, 70, 122, 172, Rr - 6];
  // 부엌 판문
  for (let y = 112; y <= 163; y++) {
    for (let x = 32; x <= 58; x++) {
      let c = (x - 32) % 7 === 6 ? WOOD[1] : WOOD[2];
      if (x === 32) c = WOOD[3];
      if (y === 112) c = WOOD[0];
      if (y === 128 || y === 148) c = WOOD[3];
      img.set(x, y, c);
    }
  }
  // 창호지 띠살문(가운데 칸, 오른쪽 칸): 가는 세로 살을 촘촘히, 위·가운데·아래에 가로 살 세 줄씩
  for (const [a, b] of [
    [84, 112],
    [134, 162],
  ]) {
    for (let y = 112; y <= 152; y++) {
      for (let x = a; x <= b; x++) {
        let c = PAPER[1];
        const fx = x - a;
        const fy = y - 112;
        const band = (fy >= 3 && fy <= 7) || (fy >= 18 && fy <= 22) || (fy >= 33 && fy <= 37);
        if (fx === 0 || fx === b - a || fy === 0 || fy === 40) c = WOOD[2];
        else if (fx % 3 === 0) c = WOOD[3];
        else if (band && fy % 2 === 1) c = WOOD[3];
        else if (fx >= b - a - 3) c = PAPER[0];
        img.set(x, y, c);
      }
    }
    // 문고리
    img.set(b - 4, 132, WOOD[0]);
    img.set(b - 4, 133, WOOD[0]);
  }
  // 작은 봉창(오른쪽 칸 끝)
  for (let y = 116; y <= 128; y++) for (let x = 180; x <= 192; x++) img.set(x, y, x === 180 || x === 192 || y === 116 || y === 128 ? WOOD[1] : (x - 180) % 4 === 0 ? WOOD[2] : PAPER[0]);
  // 기둥
  for (const px of posts) {
    for (let y = 92; y <= 165; y++) {
      for (let i = 0; i < 6; i++) img.set(px + i, y, i === 0 ? WOOD[4] : i >= 4 ? WOOD[1] : WOOD[3]);
    }
  }
  // 처마 그늘(지붕이 벽 위쪽에 드리운다)
  for (let y = 96; y <= 103; y++) for (let x = L; x <= Rr; x++) img.set(x, y, y <= 100 ? INK : CLAY[0]);
  // 지붕: 둥글게 부푼 짚 지붕(우진각). 빛은 왼쪽 위 — 둥근 면을 띠로 나눠 칠하고(섞음 무늬 없이),
  // 짚을 덮은 켜의 금과 새끼줄 그물은 그 자리의 빛보다 한 단계 어둡게, 짚의 결은 짧은 세로 줄 무리로.
  const cx = 110;
  const top = 8;
  const eave = 90; // 처마 두께가 시작하는 줄
  const rim = 98; // 처마 끝(짚 끝)의 아랫줄
  const halfAt = (y) => {
    const t = clamp((y - top) / (eave - top), 0, 1);
    return 70 + 38 * Math.sqrt(Math.min(1, t * 1.6));
  };
  const roofIn = (x, y) => y >= top && y <= rim && Math.abs(x + 0.5 - cx) <= halfAt(Math.min(y, eave)) - (y > rim - 2 ? 1 : 0);
  const toneAt = (x, y) => {
    const t = (y - top) / (eave - top);
    const u = (x + 0.5 - cx) / 108;
    // 둥근 면: 위쪽과 왼쪽이 밝다(띠 다섯)
    const v = 4.3 - u * 1.9 - t * 1.6 - Math.max(0, Math.abs(u) - 0.75) * 3;
    return clamp(Math.round(v), 1, 5);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!roofIn(x, y)) continue;
      if (y > eave) {
        // 처마 끝: 둥근 짚 끝의 두께. 위 두 줄은 볕, 짚 끝의 세로 결, 맨 아래는 그늘
        const k = y - eave;
        let c = k <= 1 ? THATCH[4] : (x + (k > 4 ? 1 : 0)) % 3 === 0 ? THATCH[2] : THATCH[3];
        if (k >= 7) c = THATCH[1];
        if (x > cx + 70 && k > 1) c = c === THATCH[3] ? THATCH[2] : THATCH[1];
        img.set(x, y, c);
        continue;
      }
      let v = toneAt(x, y);
      // 켜의 금: 처마와 나란히 굽은 줄(일곱 점마다)
      const sag = Math.pow((x - cx) / 108, 2) * 6;
      const line = Math.round(y - top - sag);
      if (line > 4 && line % 7 === 0) v -= 1;
      // 짚의 결: 짧은 세로 줄(밝게)
      else if (hash2(Math.floor(x / 2), Math.floor((line + 3) / 7), 82) > 0.72 && line % 7 >= 2 && line % 7 <= 5 && x % 2 === 0) v += 1;
      img.set(x, y, THATCH[clamp(v, 1, 5)]);
    }
  }
  // 새끼줄 그물(비스듬한 두 갈래, 열여덟 점 간격): 그 자리의 빛보다 한 단계 어둡게
  for (let y = top + 8; y < eave - 2; y++) {
    for (let x = 0; x < W; x++) {
      if (!roofIn(x, y) || !roofIn(x - 3, y) || !roofIn(x + 3, y)) continue;
      if ((x + y) % 18 === 0 || (x - y + 540) % 18 === 0) img.set(x, y, THATCH[clamp(toneAt(x, y) - 1, 1, 5)]);
    }
  }
  // 용마름(마루에 얹은 엮은 짚): 둥근 띠에 엇갈린 결
  for (let x = cx - 58; x <= cx + 58; x++) {
    for (let y = top - 4; y <= top + 3; y++) {
      const k = y - (top - 4);
      let c = (x + k) % 4 < 2 ? THATCH[4] : THATCH[3];
      if (k === 0) c = THATCH[5];
      if (k >= 6) c = THATCH[2];
      if (x > cx + 40) c = c === THATCH[4] ? THATCH[3] : c === THATCH[5] ? THATCH[4] : THATCH[2];
      img.set(x, y, c);
    }
  }
  outline(img);
  // 발치: 집의 아래 가운데(맵 점 960, 526) — 그림 점 (110, 182)
  return { img, ax: 110, ay: 182 };
}

/** 꽃나무(살구꽃): 잎 뭉치 대신 꽃 뭉치. 뭉치마다 테두리와 그늘 골이 있다(규칙 ㅅ: 한 그림체) */
function blossomTree(flip) {
  const W = 96;
  const H = 108;
  const img = new Img(W, H);
  const fx = (x) => (flip ? W - 1 - x : x);
  // 줄기와 가지
  const trunk = new Img(W, H);
  for (let y = 58; y <= 102; y++) {
    const t = (102 - y) / 44;
    const wd = 9 - t * 4;
    const c = 47 + Math.sin(t * 3) * 2;
    for (let x = Math.round(c - wd / 2); x < Math.round(c + wd / 2); x++) {
      const i = (x - Math.round(c - wd / 2)) / wd;
      trunk.set(fx(x), y, i < 0.3 ? WOOD[3] : i > 0.72 ? WOOD[1] : WOOD[2]);
    }
  }
  for (const [x0, y0, x1, y1] of [
    [46, 66, 28, 48],
    [49, 64, 66, 46],
    [47, 62, 46, 40],
  ]) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      trunk.set(fx(x), y, WOOD[2]);
      trunk.set(fx(x + 1), y, WOOD[1]);
      trunk.set(fx(x), y + 1, WOOD[2]);
    }
  }
  outline(trunk);
  img.blit(trunk, 0, 0);
  // 꽃 뭉치: 나무갓의 둥근 꼴 안에 작은 뭉치(반지름 5~8)를 촘촘히 채운다. 위(뒤)에서 아래(앞)로 그린다.
  // 뭉치마다 왼쪽 위가 밝고 오른쪽 아래에 그늘 골이 있다. 나무갓 전체로도 왼쪽 위가 밝다(빛 하나 — 규칙 ㄷ).
  const crown = new Img(W, H);
  const CX = 48;
  const CY = 34;
  const RX = 40;
  const RY = 29;
  const clumps = [];
  for (let gy = 0; gy < 9; gy++) {
    for (let gx = 0; gx < 11; gx++) {
      const x = CX - RX + 4 + gx * 7.4 + (gy % 2) * 3.7 + (hash2(gx, gy, 95) - 0.5) * 3;
      const y = CY - RY + 5 + gy * 6.4 + (hash2(gx, gy, 96) - 0.5) * 2.5;
      const dx = (x - CX) / RX;
      const dy = (y - CY) / RY;
      if (dx * dx + dy * dy > 0.86) continue;
      const r = 5.4 + hash2(gx, gy, 97) * 2.6;
      clumps.push({ x: flip ? W - 1 - x : x, y, r, bias: -0.32 * dx - 0.42 * dy });
    }
  }
  clumps.sort((p, q) => p.y - q.y);
  for (const c of clumps) ball(crown, c.x, c.y, c.r, c.r * 0.82, BLOSSOM, { lo: 1, hi: 4, rim: 1, bias: c.bias * 0.5 - 0.06 });
  // 꽃잎의 반짝임(두세 점 무리)과 새잎(연둣빛 무리)
  for (let gy = 0; gy < H; gy += 6) {
    for (let gx = 0; gx < W; gx += 7) {
      const x = gx + Math.floor(hash2(gx, gy, 91) * 4);
      const y = gy + Math.floor(hash2(gx, gy, 92) * 3);
      if (A(crown.get(x - 1, y - 1)) === 0 || A(crown.get(x + 2, y + 2)) === 0) continue;
      const r = hash2(gx, gy, 93);
      if (r < 0.16 && crown.get(x, y) !== BLOSSOM[4]) {
        crown.set(x, y, LEAF[1]);
        crown.set(x + 1, y, LEAF[2]);
        crown.set(x, y + 1, LEAF[0]);
        crown.set(x + 1, y + 1, LEAF[1]);
      } else if (r < 0.55 && crown.get(x, y) === BLOSSOM[3] && crown.get(x + 1, y) === BLOSSOM[3]) {
        crown.set(x, y, BLOSSOM[4]);
        crown.set(x + 1, y, BLOSSOM[4]);
      }
    }
  }
  outline(crown, BLOSSOM[0]);
  img.blit(crown, 0, 0);
  return { img, ax: flip ? W - 1 - 47 : 47, ay: 101 };
}

/** 우물: 돌을 쌓아 올린 둥근 우물, 두레박 */
function well() {
  const W = 80;
  const H = 72;
  const img = new Img(W, H);
  const cx = 38;
  const topY = 20;
  const rx = 32;
  const ry = 12;
  const wallH = 24;
  // 앞면(둥근 벽): 돌 켜 셋
  for (let y = topY; y <= topY + wallH + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const bottom = topY + wallH + ry * Math.sqrt(1 - dx * dx);
      const front = topY + ry * Math.sqrt(1 - dx * dx);
      if (y < front - 1 || y > bottom) continue;
      const k = Math.floor((y - front) / 8);
      const off = k % 2 === 0 ? 0 : 5;
      const sw = 10;
      // 둥근 면을 따라 돌의 너비가 줄어 보이게
      const ang = Math.asin(clamp(dx, -1, 1));
      const s = Math.floor((ang * 30 + off + 100) / sw);
      const local = (ang * 30 + off + 100) % sw;
      const ly = (y - front) % 8;
      let c = STONE[3];
      if (dx > 0.45) c = STONE[2];
      if (dx < -0.55) c = STONE[4];
      if (ly === 0) c = dx > 0.45 ? STONE[3] : STONE[4];
      if (ly === 7 || local < 1) c = STONE[1];
      if (hash2(s, k, 101) > 0.65 && c !== STONE[1] && ly !== 0) c = STONE[2];
      img.set(x, y, c);
    }
  }
  // 위 테두리(돌 고리)와 물
  for (let y = topY - ry - 2; y <= topY + ry + 2; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (!inEllipse(x, y, cx, topY, rx, ry + 1)) continue;
      const inner = inEllipse(x, y, cx, topY + 1, rx - 6, ry - 4);
      if (inner) {
        // 물: 안쪽 벽의 그늘, 물빛, 하늘의 반짝임
        const deep = inEllipse(x, y, cx + 2, topY + 3, rx - 9, ry - 6);
        let c = deep ? WATER[1] : WATER[0];
        if (deep && inEllipse(x, y, cx - 6, topY + 4, 6, 1.6)) c = WATER[3];
        else if (deep && inEllipse(x, y, cx - 4, topY + 3, 11, 3)) c = WATER[2];
        img.set(x, y, c);
      } else {
        const ang = Math.atan2(y - topY, x - cx);
        const s = Math.floor((ang + Math.PI) * 6);
        let c = (s % 2 === 0 ? STONE[4] : STONE[3]);
        if (y > topY + 2) c = s % 2 === 0 ? STONE[3] : STONE[2];
        if (y < topY - ry + 3 && x < cx) c = STONE[5];
        if (Math.abs(((ang + Math.PI) * 6) % 1) < 0.12) c = STONE[1];
        img.set(x, y, c);
      }
    }
  }
  // 두레박(오른쪽 테두리 위)
  const bx = cx + 18;
  const by = topY - 6;
  for (let y = by; y <= by + 9; y++) {
    for (let x = bx; x <= bx + 9; x++) {
      const i = x - bx;
      let c = i <= 1 ? WOOD[4] : i >= 8 ? WOOD[1] : WOOD[3];
      if (y === by) c = WOOD[1];
      if (y === by + 3 || y === by + 7) c = WOOD[0];
      img.set(x, y, c);
    }
  }
  for (let x = bx + 1; x <= bx + 8; x++) img.set(x, by - 3, WOOD[2]);
  img.set(bx + 1, by - 2, WOOD[2]);
  img.set(bx + 8, by - 2, WOOD[2]);
  img.set(bx + 1, by - 1, WOOD[2]);
  img.set(bx + 8, by - 1, WOOD[2]);
  outline(img);
  return { img, ax: cx, ay: topY + wallH + ry - 2, rope: { x: bx + 5, y: by - 3 } };
}

/** 너럭돌 */
function flatstone() {
  const img = new Img(48, 30);
  for (let y = 4; y <= 24; y++) {
    for (let x = 3; x <= 44; x++) {
      if (!inEllipse(x, y, 24, 12, 21, 9)) continue;
      const top = inEllipse(x, y, 23, 10, 19, 6);
      let c = top ? STONE[4] : STONE[2];
      if (top && inEllipse(x, y, 17, 8, 9, 3)) c = STONE[5];
      if (!top && x > 30) c = STONE[1];
      img.set(x, y, c);
    }
  }
  outline(img);
  return { img, ax: 24, ay: 22 };
}

/** 돌담(낮게 쌓은 막돌) 한 줄: 돌 사이의 틈은 짙고, 돌마다 크기와 빛이 다르다 */
function stonewallRun(tiles, seed) {
  const W = tiles * TILE + 2;
  const img = new Img(W, 38);
  // 틈(짙은 그늘)을 먼저 깔고 돌을 얹는다
  for (let y = 6; y <= 35; y++) for (let x = 1; x < W - 1; x++) img.set(x, y, STONE[0]);
  let row = 0;
  for (let cy = 30; cy >= 9; cy -= 8) {
    let x = 1 + (row % 2) * 5 - 5;
    while (x < W - 1) {
      const w = 8 + Math.floor(hash2(x, cy, seed) * 7);
      const h = 4.2 + hash2(x, cy, seed + 1) * 1.6;
      const shade = hash2(x, cy, seed + 2);
      ball(img, x + w / 2, cy + (hash2(x, cy, seed + 3) - 0.5), w / 2 - 0.2, h, STONE, { lo: shade < 0.3 ? 1 : 2, hi: shade < 0.3 ? 3 : 4, rim: 1, keep: (px, py) => px >= 1 && px <= W - 2 && py >= 5 });
      x += w;
    }
    row++;
  }
  // 맨 위 돌의 윗면은 볕
  for (let x = 1; x < W - 1; x++) {
    for (let y = 0; y < 38; y++) {
      const c = img.get(x, y);
      if (A(c) === 0) continue;
      if (c !== STONE[0]) img.set(x, y, c === STONE[3] ? STONE[4] : c === STONE[2] ? STONE[3] : c);
      break;
    }
  }
  outline(img);
  return { img, ax: 1, ay: 34 };
}

/** 싸리 울타리 한 줄 */
function fenceRun(tiles) {
  const W = tiles * TILE + 2;
  const img = new Img(W, 46);
  for (let x = 1; x < W - 1; x++) {
    const tip = 4 + Math.floor(hash2(x >> 1, 3, 111) * 6);
    for (let y = tip; y <= 40; y++) {
      const k = (x >> 1) % 3;
      img.set(x, y, k === 0 ? WOOD[3] : k === 1 ? WOOD[2] : WOOD[1]);
    }
    img.set(x, tip, WOOD[4]);
  }
  for (const by of [14, 30]) {
    for (let x = 1; x < W - 1; x++) {
      img.set(x, by, WOOD[3]);
      img.set(x, by + 1, WOOD[2]);
      img.set(x, by + 2, WOOD[0]);
    }
  }
  outline(img);
  return { img, ax: 1, ay: 38 };
}

/** 풀포기(맵의 tuft): 끝이 뾰족한 잎 대여섯(바닥의 잎 무리와 같은 빛 단계 — 한 그림체) */
function tuft(v) {
  const img = new Img(24, 20);
  const blades = [
    [6, 16, 3, 7],
    [9, 16, 7, 3],
    [12, 16, 12, 2],
    [15, 16, 17, 4],
    [18, 16, 21, 8],
  ];
  const use = blades.filter((_, i) => (v + i) % 4 !== 3);
  for (const [x0, y0, x1, y1] of use) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      const tip = i > n * 0.55;
      img.set(x, y, tip ? GRASS[4] : GRASS[3]);
      if (i < n - 1) img.set(x + 1, y, tip ? GRASS[3] : GRASS[2]);
    }
  }
  for (let x = 6; x <= 19; x++) img.set(x, 17, GRASS[1]);
  outline(img, GRASS[0]);
  return { img, ax: 12, ay: 17 };
}

/** 들꽃: 잎 뭉치 위에 두 점짜리 꽃 서넛 */
function flower(v) {
  const img = new Img(22, 18);
  ball(img, 11, 11, 7, 4.6, GRASS, { lo: 2, hi: 4, rim: 1 });
  const c = FLOWERS[v % 3];
  const c2 = v % 3 === 0 ? hex('#fbe79a') : v % 3 === 1 ? rgb(255, 255, 255) : hex('#e3a6dd');
  for (const [x, y] of [
    [6, 7],
    [11, 5],
    [15, 8],
    [9, 10],
  ].slice(0, 3 + (v % 2))) {
    img.set(x, y, c2);
    img.set(x + 1, y, c);
    img.set(x, y + 1, c);
    img.set(x + 1, y + 1, c);
  }
  outline(img, GRASS[0]);
  return { img, ax: 11, ay: 15 };
}

/** 잔돌 */
function rockS(v) {
  const img = new Img(24, 18);
  ball(img, 12, 10, 7 + (v % 2), 4.6, STONE, { lo: 2, hi: 5, rim: 1 });
  outline(img);
  return { img, ax: 12, ay: 14 };
}

// ── 사람(48×64 그림 점 = 맵 점 24×32 — 화면 크기는 지금과 같다) ───────────────
// 규칙 ㄴ: 바깥은 먹빛 테두리, 덩어리(머리·얼굴·옷·팔) 사이는 그 덩어리의 가장 어두운 단계로 한 점 선.
// 규칙 ㅂ: 발밑에 바닥 빛을 한 단계 어둡게 한 그림자.

/** 줄마다 [왼쪽 끝, 오른쪽 끝]을 주면 그 사이를 빛 하나로 칠한다(왼쪽 두 점은 볕, 오른쪽 세 점은 그늘) */
function slab(img, rows, ramp, o = {}) {
  const lit = o.lit ?? 2;
  const shade = o.shade ?? 3;
  const base = o.base ?? 2;
  for (const [y, a, b] of rows) {
    for (let x = a; x <= b; x++) {
      let i = base;
      if (x - a < lit) i = base + 1;
      if (b - x < shade) i = base - 1;
      if (o.bottom && y >= o.bottom) i = Math.min(i, base - 1);
      img.set(x, y, ramp[clamp(i, 0, ramp.length - 1)]);
    }
  }
}
/** 덩어리 사이의 선: 이미 그린 다른 덩어리에 닿은 이 덩어리의 가장자리를 ramp[0]으로 */
function seam(img, before, ramp0, test) {
  const { w, h } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!test(x, y)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!test(nx, ny) && A(before.get(nx, ny)) > 0) {
          img.set(x, y, ramp0);
          break;
        }
      }
    }
  }
}

function face(img, y0, o) {
  // y0: 얼굴의 맨 윗줄. 얼굴은 x 13~34(22점), 높이 o.h
  const { skin } = o;
  const rows = [];
  for (let r = 0; r < o.h; r++) {
    const inset = r === 0 ? 3 : r === 1 ? 1 : r >= o.h - 1 ? 5 : r === o.h - 2 ? 3 : r === o.h - 3 ? 1 : 0;
    rows.push([y0 + r, 13 + inset, 34 - inset]);
  }
  slab(img, rows, skin, { lit: 3, shade: 3 });
  // 볕 받는 이마와 뺨(왼쪽 위)
  for (let r = 1; r < 5; r++) for (let x = 15; x < 20; x++) img.set(x, y0 + r, skin[3]);
  // 귀
  if (o.ears) {
    for (let y = o.eyeY - 1; y <= o.eyeY + 2; y++) {
      img.set(12, y, skin[2]);
      img.set(11, y, skin[1]);
      img.set(35, y, skin[1]);
      img.set(36, y, skin[0]);
    }
  }
  // 눈(2×3, 위 왼쪽에 반짝임 한 점) 또는 노인의 가는 눈
  const ey = o.eyeY;
  for (const ex of [18, 28]) {
    if (o.old) {
      img.set(ex, ey + 1, INK);
      img.set(ex + 1, ey + 1, INK);
      img.set(ex - 1, ey + 2, skin[1]);
      img.set(ex + 2, ey + 2, skin[1]);
    } else {
      img.set(ex, ey, INK);
      img.set(ex + 1, ey, INK);
      img.set(ex, ey + 1, INK);
      img.set(ex + 1, ey + 1, INK);
      img.set(ex, ey + 2, INK);
      img.set(ex + 1, ey + 2, HAIR[2]);
      img.set(ex, ey, rgb(250, 246, 236));
    }
    // 눈썹
    const bc = o.brow ?? HAIR[1];
    img.set(ex - 1, ey - 2, bc);
    img.set(ex, ey - 2, bc);
    img.set(ex + 1, ey - 2, bc);
    if (o.old) img.set(ex + 2, ey - 2, bc);
  }
  // 코와 입
  img.set(24, ey + 3, skin[1]);
  img.set(23, ey + 3, skin[2]);
  if (!o.noMouth) {
    img.set(22, ey + 6, LIP);
    img.set(23, ey + 6, LIP);
    img.set(24, ey + 6, LIP);
  }
  if (o.blush) {
    img.set(15, ey + 4, hex('#e9978a'));
    img.set(16, ey + 4, hex('#e9978a'));
    img.set(31, ey + 4, hex('#e9978a'));
    img.set(32, ey + 4, hex('#e9978a'));
  }
  if (o.wrinkle) {
    img.set(16, ey + 4, skin[1]);
    img.set(31, ey + 4, skin[1]);
    img.set(21, ey - 4, skin[1]);
    img.set(22, ey - 4, skin[1]);
    img.set(25, ey - 4, skin[1]);
    img.set(26, ey - 4, skin[1]);
  }
}

/** 주인공(농민 집 아이, 남자아이): 무명 저고리, 삼베 바지, 땋아 넘긴 머리, 짚신 */
function heroBoy() {
  const img = new Img(48, 64);
  // 바지(무릎께가 부풀고 대님을 맨 발목은 좁다)
  const legs = [];
  for (let y = 46; y <= 55; y++) {
    const swell = y >= 48 && y <= 52 ? 1 : 0;
    const narrow = y >= 54 ? 1 : 0;
    legs.push([y, 15 - swell + narrow, 23]);
    legs.push([y, 24, 32 + swell - narrow]);
  }
  slab(img, legs, HEMP, { lit: 2, shade: 2 });
  for (let y = 50; y <= 55; y++) img.set(23, y, HEMP[0]); // 가랑이
  for (let x = 16; x <= 31; x++) img.set(x, 54, x === 23 || x === 24 ? HEMP[0] : HEMP[1]); // 대님
  for (let y = 47; y <= 52; y++) {
    img.set(19, y, HEMP[1]);
    img.set(28, y, HEMP[1]);
  }
  // 짚신
  for (const sx of [15, 25]) {
    for (let y = 56; y <= 59; y++) for (let x = sx; x < sx + 8; x++) img.set(x, y, y === 56 ? STRAW[3] : y === 59 ? STRAW[0] : (x + y) % 2 === 0 ? STRAW[2] : STRAW[1]);
  }
  // 저고리
  const body = [];
  for (let y = 36; y <= 46; y++) body.push([y, y === 36 ? 17 : 16, y === 36 ? 30 : 31]);
  const before = img.crop(0, 0, 48, 64);
  slab(img, body, COTTON, { lit: 2, shade: 3 });
  seam(img, before, COTTON[0], (x, y) => y >= 36 && y <= 46 && x >= 16 && x <= 31);
  for (let x = 16; x <= 31; x++) img.set(x, 46, COTTON[1]); // 저고리 아랫단
  // 동정과 깃(왼쪽 깃이 오른쪽 위로 덮인다)
  for (let k = 0; k <= 6; k++) {
    img.set(19 + k, 36 + k, COTTON[3]);
    img.set(20 + k, 36 + k, COTTON[3]);
    img.set(21 + k, 36 + k, COTTON[1]);
  }
  for (let k = 0; k <= 3; k++) img.set(29 - k, 36 + k, COTTON[1]);
  img.set(23, 36, SKIN[1]);
  img.set(24, 36, SKIN[1]);
  img.set(25, 36, SKIN[1]);
  img.set(24, 37, SKIN[1]);
  // 고름
  img.set(26, 42, COTTON[3]);
  img.set(27, 42, COTTON[3]);
  img.set(26, 43, COTTON[2]);
  img.set(26, 44, COTTON[2]);
  img.set(27, 44, COTTON[1]);
  img.set(27, 45, COTTON[1]);
  // 팔(왼팔은 볕, 오른팔은 그늘)과 손
  const arms = [];
  for (let y = 37; y <= 45; y++) {
    arms.push([y, 12, 15]);
  }
  const beforeArms = img.crop(0, 0, 48, 64);
  slab(img, arms, COTTON, { lit: 2, shade: 1 });
  const armsR = [];
  for (let y = 37; y <= 45; y++) armsR.push([y, 32, 35]);
  slab(img, armsR, COTTON, { lit: 0, shade: 2, base: 1 });
  seam(img, beforeArms, COTTON[0], (x, y) => y >= 37 && y <= 45 && ((x >= 12 && x <= 15) || (x >= 32 && x <= 35)));
  for (const [hx, tone] of [
    [12, 2],
    [32, 1],
  ]) {
    for (let y = 46; y <= 48; y++) for (let x = hx; x < hx + 4; x++) if (!(y === 48 && (x === hx || x === hx + 3))) img.set(x, y, SKIN[tone]);
  }
  // 목
  for (let y = 33; y <= 35; y++) for (let x = 20; x <= 27; x++) img.set(x, y, SKIN[1]);
  // 얼굴과 머리
  face(img, 18, { skin: SKIN, h: 17, eyeY: 25, ears: true });
  // 머리카락: 가운데 가르마, 이마가 드러나고 귀 위로 넘겨 뒤로 땋았다
  const hair = [];
  hair.push([14, 19, 28]);
  hair.push([15, 16, 31]);
  hair.push([16, 14, 33]);
  hair.push([17, 13, 34]);
  hair.push([18, 12, 35]);
  hair.push([19, 12, 35]);
  hair.push([20, 12, 35]);
  slab(img, hair, HAIR, { lit: 3, shade: 3 });
  for (const [y, a, b] of [
    [21, 12, 15],
    [21, 32, 35],
    [22, 12, 14],
    [22, 33, 35],
    [23, 12, 13],
    [23, 34, 35],
    [24, 12, 12],
    [24, 35, 35],
  ])
    for (let x = a; x <= b; x++) img.set(x, y, x < 24 ? HAIR[2] : HAIR[1]);
  // 앞머리 몇 가닥과 머리의 볕(둥근 윤)
  for (const [x, y] of [
    [20, 21],
    [21, 21],
    [21, 22],
    [26, 21],
    [27, 21],
  ])
    img.set(x, y, HAIR[1]);
  for (let x = 17; x <= 22; x++) img.set(x, 17, HAIR[3]);
  for (let x = 16; x <= 19; x++) img.set(x, 18, HAIR[3]);
  // 가르마와 빗어 넘긴 결(가르마에서 양옆으로)
  for (let y = 14; y <= 18; y++) img.set(24, y, HAIR[0]);
  for (const [x, y] of [[21, 16], [20, 17], [19, 18], [27, 16], [28, 17], [29, 18], [30, 19]]) img.set(x, y, HAIR[1]);
  outline(img);
  return { img, ax: 24, ay: 60 };
}

/** 마을 어른(할아버지): 흰 상투, 흰 수염, 무명 두루마기에 잿빛 띠, 지팡이 */
function elderMan() {
  const img = new Img(48, 64);
  // 두루마기(발목까지)
  const robe = [];
  for (let y = 37; y <= 57; y++) {
    const half = 8 + Math.min(3, Math.floor((y - 37) / 6));
    robe.push([y, 24 - half, 23 + half]);
  }
  slab(img, robe, COTTON, { lit: 2, shade: 3 });
  for (let y = 46; y <= 57; y++) {
    img.set(20, y, COTTON[1]);
    img.set(27, y, COTTON[1]);
  }
  for (let y = 44; y <= 57; y++) img.set(24, y, COTTON[1]); // 섶
  for (let x = 13; x <= 34; x++) img.set(x, 57, COTTON[1]);
  // 띠
  for (let x = 16; x <= 31; x++) {
    img.set(x, 45, ASH[2]);
    img.set(x, 46, ASH[1]);
  }
  img.set(19, 47, ASH[2]);
  img.set(19, 48, ASH[1]);
  img.set(20, 47, ASH[1]);
  // 짚신 끝
  for (const sx of [17, 26]) for (let y = 58; y <= 59; y++) for (let x = sx; x < sx + 6; x++) img.set(x, y, y === 58 ? STRAW[2] : STRAW[0]);
  // 팔과 손(왼손은 지팡이를 짚는다)
  const before = img.crop(0, 0, 48, 64);
  const armL = [];
  for (let y = 38; y <= 46; y++) armL.push([y, 12, 15]);
  slab(img, armL, COTTON, { lit: 2, shade: 1 });
  const armR = [];
  for (let y = 38; y <= 47; y++) armR.push([y, 32, 35]);
  slab(img, armR, COTTON, { lit: 0, shade: 2, base: 1 });
  seam(img, before, COTTON[0], (x, y) => y >= 38 && y <= 47 && ((x >= 12 && x <= 15) || (x >= 32 && x <= 35)));
  for (let y = 47; y <= 49; y++) for (let x = 11; x <= 14; x++) img.set(x, y, SKIN[2]);
  for (let y = 48; y <= 50; y++) for (let x = 32; x <= 35; x++) if (!(y === 50 && x === 35)) img.set(x, y, SKIN[1]);
  // 지팡이
  for (let y = 44; y <= 60; y++) {
    img.set(9, y, WOOD[3]);
    img.set(10, y, WOOD[1]);
  }
  img.set(9, 43, WOOD[4]);
  img.set(10, 43, WOOD[2]);
  // 목, 얼굴
  for (let y = 34; y <= 36; y++) for (let x = 20; x <= 27; x++) img.set(x, y, SKIN[1]);
  face(img, 19, { skin: SKIN, h: 16, eyeY: 26, ears: true, old: true, brow: WHITE_HAIR[3], wrinkle: true, noMouth: true });
  // 흰 수염(턱에서 가슴까지)과 콧수염
  const beard = [];
  for (let y = 31; y <= 41; y++) {
    const half = y <= 34 ? 7 : 7 - Math.floor((y - 34) * 0.8);
    if (half < 1) break;
    beard.push([y, 24 - half, 23 + half]);
  }
  slab(img, beard, WHITE_HAIR, { lit: 2, shade: 2, base: 2 });
  for (let y = 33; y <= 40; y += 2) img.set(22, y, WHITE_HAIR[1]);
  for (let y = 34; y <= 40; y += 2) img.set(26, y, WHITE_HAIR[1]);
  for (const x of [19, 20, 21, 26, 27, 28]) img.set(x, 30, WHITE_HAIR[2]);
  img.set(22, 31, WHITE_HAIR[1]);
  img.set(25, 31, WHITE_HAIR[1]);
  // 머리(흰머리를 빗어 올리고 정수리에 상투)
  const hair = [
    [16, 18, 29],
    [17, 15, 32],
    [18, 14, 33],
    [19, 13, 34],
    [20, 12, 35],
  ];
  slab(img, hair, WHITE_HAIR, { lit: 3, shade: 3 });
  for (const [y, a, b] of [
    [21, 12, 13],
    [21, 34, 35],
    [22, 12, 12],
    [22, 35, 35],
    [23, 12, 12],
    [23, 35, 35],
  ])
    for (let x = a; x <= b; x++) img.set(x, y, x < 24 ? WHITE_HAIR[2] : WHITE_HAIR[1]);
  // 상투와 동곳
  for (let y = 11; y <= 15; y++) for (let x = 21; x <= 26; x++) if (!((y === 11 || y === 15) && (x === 21 || x === 26))) img.set(x, y, x <= 22 ? WHITE_HAIR[3] : x >= 25 ? WHITE_HAIR[1] : WHITE_HAIR[2]);
  for (let x = 19; x <= 28; x++) img.set(x, 13, x === 19 || x === 28 ? WOOD[1] : img.get(x, 13));
  for (let x = 17; x <= 22; x++) img.set(x, 17, WHITE_HAIR[3]);
  outline(img);
  return { img, ax: 24, ay: 60 };
}

/** 우물가 아주머니: 머릿수건, 무명 저고리, 흙빛 치마, 두 손으로 두레박 줄을 잡았다 */
function wellWoman() {
  const img = new Img(48, 64);
  // 치마(가슴께부터 발까지, 아래로 퍼진다)
  const skirt = [];
  for (let y = 40; y <= 58; y++) {
    const half = 8 + Math.min(4, Math.floor((y - 40) / 4));
    skirt.push([y, 24 - half, 23 + half]);
  }
  slab(img, skirt, EARTH, { lit: 2, shade: 3 });
  for (let y = 44; y <= 58; y++) {
    img.set(19 - Math.floor((y - 44) / 6), y, EARTH[1]);
    img.set(24, y, EARTH[1]);
    img.set(29 + Math.floor((y - 44) / 6), y, EARTH[1]);
  }
  for (let x = 12; x <= 35; x++) img.set(x, 58, EARTH[1]);
  // 짚신 끝
  for (const sx of [17, 26]) for (let x = sx; x < sx + 5; x++) img.set(x, 59, STRAW[2]);
  // 저고리(짧다)
  const before = img.crop(0, 0, 48, 64);
  const top = [];
  for (let y = 33; y <= 40; y++) top.push([y, y === 33 ? 17 : 16, y === 33 ? 30 : 31]);
  slab(img, top, COTTON, { lit: 2, shade: 3 });
  seam(img, before, COTTON[0], (x, y) => y >= 33 && y <= 40 && x >= 16 && x <= 31);
  for (let k = 0; k <= 4; k++) {
    img.set(19 + k, 33 + k, COTTON[3]);
    img.set(20 + k, 33 + k, COTTON[3]);
    img.set(21 + k, 33 + k, COTTON[1]);
  }
  for (let k = 0; k <= 3; k++) img.set(29 - k, 33 + k, COTTON[1]);
  img.set(24, 33, SKIN[1]);
  img.set(23, 33, SKIN[1]);
  // 팔: 앞으로 모아 두 손으로 줄을 잡았다
  const beforeArms = img.crop(0, 0, 48, 64);
  const arms = [];
  for (let y = 34; y <= 41; y++) {
    const k = y - 34;
    arms.push([y, 13 + Math.floor(k * 0.6), 16 + Math.floor(k * 0.6)]);
  }
  slab(img, arms, COTTON, { lit: 2, shade: 1 });
  const armsR = [];
  for (let y = 34; y <= 41; y++) {
    const k = y - 34;
    armsR.push([y, 31 - Math.floor(k * 0.6), 34 - Math.floor(k * 0.6)]);
  }
  slab(img, armsR, COTTON, { lit: 0, shade: 2, base: 1 });
  seam(img, beforeArms, COTTON[0], (x, y) => {
    if (y < 34 || y > 41) return false;
    const k = y - 34;
    return (x >= 13 + Math.floor(k * 0.6) && x <= 16 + Math.floor(k * 0.6)) || (x >= 31 - Math.floor(k * 0.6) && x <= 34 - Math.floor(k * 0.6));
  });
  for (let y = 42; y <= 44; y++) for (let x = 18; x <= 29; x++) if (!(x === 23 || x === 24) || y === 44) img.set(x, y, x < 24 ? SKIN[2] : SKIN[1]);
  // 줄(짚을 꼰 줄): 손에서 왼쪽 위 우물의 두레박으로
  for (let k = 0; k <= 5; k++) img.set(18 - k, 43 - k, STRAW[1]);
  // 목, 얼굴
  for (let y = 31; y <= 33; y++) for (let x = 20; x <= 27; x++) img.set(x, y, SKIN[1]);
  face(img, 16, { skin: SKIN, h: 16, eyeY: 23, ears: false, blush: true });
  // 귀밑머리(검은 머리가 뺨 옆으로)
  for (let y = 19; y <= 25; y++) {
    img.set(13, y, HAIR[2]);
    img.set(34, y, HAIR[1]);
  }
  for (let x = 14; x <= 33; x++) img.set(x, 19, x < 24 ? HAIR[2] : HAIR[1]);
  for (const [x, y] of [
    [14, 20],
    [15, 20],
    [32, 20],
    [33, 20],
  ])
    img.set(x, y, HAIR[1]);
  // 머릿수건(무명): 머리를 감싸고 뒤에서 묶었다
  // 머리를 감싼 둥근 꼴, 이마 위로 감아 돈 단(한 단계 어둡게), 접힌 주름 두 줄
  const scarf = [
    [9, 19, 28],
    [10, 16, 31],
    [11, 14, 33],
    [12, 13, 34],
    [13, 12, 35],
    [14, 12, 35],
    [15, 12, 35],
    [16, 12, 35],
    [17, 12, 35],
    [18, 12, 35],
  ];
  slab(img, scarf, COTTON, { lit: 3, shade: 3 });
  for (let x = 12; x <= 35; x++) img.set(x, 17, x < 30 ? COTTON[1] : COTTON[0]);
  for (let x = 12; x <= 35; x++) img.set(x, 18, x < 30 ? COTTON[2] : COTTON[1]);
  for (let x = 17; x <= 23; x++) img.set(x, 10, COTTON[3]);
  for (const [x, y] of [[18, 13], [19, 14], [20, 15], [27, 12], [28, 13], [29, 14]]) img.set(x, y, COTTON[1]);
  // 수건 끝(뒤에서 묶은 매듭이 오른쪽 옆으로 비어져 나왔다)
  for (const [x, y, c] of [
    [36, 14, COTTON[2]],
    [37, 14, COTTON[1]],
    [36, 15, COTTON[1]],
    [37, 15, COTTON[1]],
    [38, 16, COTTON[0]],
    [37, 16, COTTON[1]],
  ])
    img.set(x, y, c);
  outline(img);
  return { img, ax: 24, ay: 60, hand: { x: 18, y: 43 } };
}

// ── 장면 ──────────────────────────────────────────────────────
const { img: ground } = paintGround();
const shadowMask = new Uint8Array(VW * VH);
const sprites = [];
const at = (mx, my) => ({ x: mx * K - CAM.x, y: my * K - CAM.y });
const place = (s, mx, my, sortY, extra = {}) => sprites.push({ ...s, x: Math.round(mx * K - CAM.x - s.ax), y: Math.round(my * K - CAM.y - s.ay), sortY, ...extra });

// 담: 같은 줄에 이어진 칸을 한 그림으로
const things = region.things;
const runs = (kind, axis) => {
  const list = things.filter((t) => t.kind === kind).sort((a, b) => (axis === 'x' ? a.ty - b.ty || a.tx - b.tx : a.tx - b.tx || a.ty - b.ty));
  const out = [];
  for (const t of list) {
    const last = out[out.length - 1];
    if (last && (axis === 'x' ? last.ty === t.ty && last.tx1 === t.tx - 1 : last.tx === t.tx && last.ty1 === t.ty - 1)) {
      if (axis === 'x') last.tx1 = t.tx;
      else last.ty1 = t.ty;
    } else out.push({ ...t, tx1: t.tx, ty1: t.ty });
  }
  return out;
};
for (const r of runs('wallH', 'x')) {
  const s = wallRun(r.tx1 - r.tx + 1);
  sprites.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: (r.ty + 1) * TILE - 2 - CAM.y - s.ay, sortY: (r.ty * 16 + 12) * K });
  shadowRect(shadowMask, r.tx * TILE + 6 - CAM.x, (r.ty + 1) * TILE - CAM.y, (r.tx1 - r.tx + 1) * TILE, 5);
}
for (const r of runs('wallV', 'y')) {
  const len = (r.ty1 - r.ty + 1) * TILE + 20;
  const s = wallColumn(len);
  sprites.push({ ...s, x: r.tx * TILE + 16 - 15 - CAM.x, y: (r.ty1 + 1) * TILE - 4 - CAM.y - s.ay, sortY: (r.ty1 * 16 + 12) * K - 1 });
}
for (const r of runs('stonewallH', 'x')) {
  const s = stonewallRun(r.tx1 - r.tx + 1, r.tx);
  sprites.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: (r.ty + 1) * TILE - 6 - CAM.y - s.ay, sortY: (r.ty * 16 + 12) * K });
  shadowRect(shadowMask, r.tx * TILE + 4 - CAM.x, (r.ty + 1) * TILE - 6 - CAM.y, (r.tx1 - r.tx + 1) * TILE, 4);
}
for (const r of runs('fenceH', 'x')) {
  const s = fenceRun(r.tx1 - r.tx + 1);
  sprites.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: (r.ty + 1) * TILE - 8 - CAM.y - s.ay, sortY: (r.ty * 16 + 12) * K });
  shadowRect(shadowMask, r.tx * TILE + 4 - CAM.x, (r.ty + 1) * TILE - 8 - CAM.y, (r.tx1 - r.tx + 1) * TILE, 4);
}
let wellRope = null;
for (const t of things) {
  if (['wallH', 'wallV', 'stonewallH', 'fenceH'].includes(t.kind)) continue;
  const sortY = t.ay * K;
  if (t.kind === 'gate') {
    const s = gate();
    place(s, t.ax, t.ay, sortY + 6, { kind: 'gate' });
    const p = at(t.ax, t.ay);
    shadowRect(shadowMask, p.x + 18, p.y + 1, 62, 3);
  } else if (t.kind === 'choga') {
    const s = choga();
    place(s, t.ax, t.ay, sortY, { kind: 'choga' });
    const p = at(t.ax, t.ay);
    // 집 그림자: 오른쪽 옆과 아래로(규칙 ㅂ)
    shadowRect(shadowMask, p.x - 92, p.y + 1, 210, 8);
    for (let k = 0; k < 30; k++) shadowRect(shadowMask, p.x + 98, p.y - 70 + k * 2 + 0, 18 - Math.floor(k / 3), 2);
  } else if (t.kind === 'blossom') {
    const s = blossomTree(t.variant === 2);
    place(s, t.ax, t.ay, sortY, { kind: 'blossom' });
    const p = at(t.ax, t.ay);
    shadowEllipse(shadowMask, p.x + 12, p.y + 1, 34, 10, 0.18);
  } else if (t.kind === 'well') {
    const s = well();
    place(s, t.ax, t.ay, sortY, { kind: 'well' });
    const p = at(t.ax, t.ay);
    shadowEllipse(shadowMask, p.x + 8, p.y + 1, 36, 9);
    wellRope = { x: p.x - s.ax + s.rope.x, y: p.y - s.ay + s.rope.y };
  } else if (t.kind === 'flatstone') {
    const s = flatstone();
    place(s, t.ax, t.ay, sortY);
    const p = at(t.ax, t.ay);
    shadowEllipse(shadowMask, p.x + 6, p.y + 2, 22, 5);
  } else if (t.kind === 'tuft') place(tuft(t.variant), t.ax, t.ay, sortY);
  else if (t.kind === 'flower') place(flower(t.variant), t.ax, t.ay, sortY);
  else if (t.kind === 'rockS') {
    place(rockS(t.variant), t.ax, t.ay, sortY);
    const p = at(t.ax, t.ay);
    shadowEllipse(shadowMask, p.x + 3, p.y + 1, 8, 3);
  }
}
const objectMask = shadowMask.slice();
const PEOPLE = { hero: heroBoy(), elder: elderMan(), woman: wellWoman() };
for (const p of region.people) {
  const s = PEOPLE[p.id];
  place(s, p.x, p.y, p.y * K, { person: p.id });
  const q = at(p.x, p.y);
  shadowEllipse(shadowMask, q.x + 2, q.y - 1, 14, 4.5);
}
// (2차에서 고친 잼: 사람의 대비는 사람 자신의 그림자를 빼고 잰다 — 그림은 그대로다)
const floorForPeople = ground.crop(0, 0, VW, VH);
applyShadow(floorForPeople, objectMask);
applyShadow(ground, shadowMask);
const groundOnly = ground.crop(0, 0, VW, VH);
const scene = ground.crop(0, 0, VW, VH);
sprites.sort((a, b) => a.sortY - b.sortY);
for (const s of sprites) scene.blit(s.img, s.x, s.y);
// 두레박 줄: 우물의 두레박에서 아주머니의 손으로(사람 위에 한 줄)
const woman = sprites.find((s) => s.person === 'woman');
if (wellRope && woman) {
  const hx = woman.x + PEOPLE.woman.hand.x - 6;
  const hy = woman.y + PEOPLE.woman.hand.y - 6;
  const n = Math.max(Math.abs(hx - wellRope.x), Math.abs(hy - wellRope.y));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(wellRope.x + ((hx - wellRope.x) * i) / n);
    const y = Math.round(wellRope.y + ((hy - wellRope.y) * i) / n + Math.sin((i / n) * Math.PI) * 3);
    scene.set(x, y, STRAW[1]);
  }
}

writeFileSync(join(here, 'after-scene.png'), encodePng(scene.scale(3)));

// ── 사람 셋 둘레를 크게(지금 쪽과 같은 넓이: 맵 점 40×48) ──
const C = region.close;
const closeups = region.people.map((p) => scene.crop(p.x * K - CAM.x - C.w, p.y * K - CAM.y - C.up * K, C.w * K, C.h * K).scale(6));
const gap = 24;
const row = new Img(closeups.length * closeups[0].w + (closeups.length - 1) * gap, closeups[0].h);
row.rect(0, 0, row.w, row.h, rgb(244, 236, 217));
closeups.forEach((c, i) => row.blit(c, i * (c.w + gap), 0));
writeFileSync(join(here, 'after-people.png'), encodePng(row));

// ── 수치(기획서 4.7.5의 Review 기준) ──
const people = {};
for (const s of sprites.filter((s) => s.person)) {
  people[s.person] = { outlineShare: outlineShare(s.img), orphansPer1000: spriteOrphans(s.img), edgeContrast: edgeContrast(s.img, s.x, s.y, groundOnly), ...personVsGround(s.img, s.x, s.y, floorForPeople, 4 * K) };
}
const metrics = {
  note: '새 그림(2배, 타일 32점). 그림 점 단위로 잰다. 외톨이 점은 맵 칸(그림 점 32×32)마다.',
  groundOrphans: orphans(groundOnly, TILE),
  groundChecker: checker(groundOnly),
  groundHarsh: harshOrphans(groundOnly),
  groundHarshChecker: harshChecker(groundOnly),
  monotony: monotony(groundOnly, region, K),
  sceneColors: colorCount(scene),
  thingOrphansPer1000: Object.fromEntries(sprites.filter((s) => s.kind).map((s) => [s.kind, spriteOrphans(s.img)])),
  thingHarshPer1000: Object.fromEntries(sprites.filter((s) => s.kind).map((s) => [s.kind, harshOrphans(s.img)])),
  people,
};
writeFileSync(join(here, 'after-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics, null, 2));

// ── 견주기: 지금(위) · 새 그림(아래) ──
const LABEL_BG = rgb(244, 236, 217);
function stack(a, b, pad = 24) {
  const out = new Img(Math.max(a.w, b.w), a.h + b.h + pad);
  out.rect(0, 0, out.w, out.h, LABEL_BG);
  out.blit(a, 0, 0);
  out.blit(b, 0, a.h + pad);
  return out;
}
function side(a, b, pad = 24) {
  const out = new Img(a.w + b.w + pad, Math.max(a.h, b.h));
  out.rect(0, 0, out.w, out.h, LABEL_BG);
  out.blit(a, 0, 0);
  out.blit(b, a.w + pad, 0);
  return out;
}
const beforeScene = join(here, 'before-scene.png');
const beforePeople = join(here, 'before-people.png');
// (v1의 견주기 그림은 첫 시안 때의 "지금" 쪽과 함께 이 폴더에 남겨 두었다. 셋을 나란히 놓는 것은 ../make-compare.mjs)
if (existsSync(beforeScene) && existsSync(beforePeople)) {
  const bs = decodePng(readFileSync(beforeScene));
  const as = scene.scale(3);
  // 둘 다 기기 화소 그대로(맵 점 하나 = 6화소) 나란히 — 줄이면 새 그림의 점 크기가 고르지 않게 된다
  writeFileSync(join(here, 'compare-scene.png'), encodePng(side(bs, as, 36)));
  writeFileSync(join(here, 'compare-people.png'), encodePng(stack(decodePng(readFileSync(beforePeople)), row)));
  console.log('→ after-scene.png, after-people.png, compare-scene.png, compare-people.png, after-metrics.json');
} else console.log('make-before.mjs를 먼저 돌리면 견주기 그림(compare-*.png)도 만든다');
