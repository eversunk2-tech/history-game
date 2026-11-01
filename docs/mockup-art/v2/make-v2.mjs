// 2차 시안(v2): 사용자가 첫 시안(v1)을 보고 "깔끔해졌지만 너무 단조롭다, 지금 맵의 동화 속 같은 분위기가 사라졌다,
// 깔끔하면서도 그 분위기가 있게"라고 했다. 그래서 잡티(외톨이 점·체크무늬)는 계속 막고, 결과 빛의 갈래를 "큰 무리"로 되살린다:
//   땅의 큰 얼룩(명암·색조 두세 단), 여러 꼴로 바뀌는 풀 뭉치와 들꽃 무리, 길에 걸친 풀, 떨어진 꽃잎,
//   빛 하나로 짙어진 그림자(닿는 곳 두 단), 그 자리의 소품(장독대, 참나무, 꽃나무, 닭과 까치),
//   따뜻한 봄빛(밝은 쪽은 노랑으로, 어두운 쪽은 푸름으로 색조를 옮긴다), 밝은 끝이 있는 폭신한 나무.
// 사람은 첫 시안 그대로다. 그림 규칙은 기획서 4.7.5(ㄱ~ㅌ). 게임 코드(src/)를 쓰지 않는 독립 스크립트다.
//
//   node docs/mockup-art/v2/make-v2.mjs   → v2/v2-scene.png, v2-people.png, v2-metrics.json
//   (2차 때 셋(지금·v1·v2)을 나란히 놓은 견주기는 v2/make-compare.mjs. 3차의 견주기는 ../make-compare.mjs)
// (2차 시안 — 사용자가 보고 "차갑고 기하학적"이라 해 3차(../make-v3.mjs)를 만들었다. 그림은 그대로 두고 남긴다.)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { A, Img, checker, colorCount, edgeContrast, harshChecker, harshOrphans, encodePng, hash2, hex, monotony, orphans, outlineShare, personVsGround, rgb, spriteOrphans, vnoise } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const region = JSON.parse(readFileSync(join(here, '..', 'region.json'), 'utf8'));

/** 그림 점 / 맵 점(규칙 ㄱ: 그림만 두 배로 촘촘하게. 맵의 좌표·부딪힘·누르는 자리는 16점 칸 그대로) */
const K = 2;
const TILE = 16 * K;
const CAM = { x: region.cam.x * K, y: region.cam.y * K };
const VW = Math.round(region.view.w * K);
const VH = region.view.h * K;

// ── 빛깔(봄). 재질마다 어두움 → 밝음. 규칙 ㄷ: 재질마다 4~7단, 빛 쪽은 누렇게, 그늘 쪽은 푸르게(색조를 옮긴다 — ㅌ) ─────────
const P = (...l) => l.map((s) => hex(s));
const INK = hex('#241a1b'); // 먹빛 테두리(규칙 ㄴ)
// 풀: 짙은 쪽은 푸른 초록, 밝은 쪽은 노란 연두. 땅의 큰 얼룩은 그늘(SHADE)·바탕(2)·볕(3)·따뜻한 볕(WARM) 네 갈래
const GRASS = P('#1c3d34', '#285a3c', '#377642', '#4e9046', '#6eaa4d', '#97c45a', '#c6dd7a');
const GRASS_SHADE = hex('#2f6a3f');
const GRASS_WARM = hex('#5f9a45');
// 흙: 짙은 쪽은 서늘한 밤빛, 밝은 쪽은 볕에 마른 누런 흙. 불그레한 얼룩(RUDDY)을 더한다
const DIRT = P('#4b3226', '#77523a', '#9a7150', '#bf966a', '#d3ae7e', '#e4c796', '#f1dfb4');
const DIRT_RUDDY = hex('#bb8659'); // 불그레한 흙(따뜻한 쪽)
const DIRT_COOL = hex('#a38d70'); // 그늘지고 축축한 흙(서늘한 쪽)
const STONE = P('#2f3036', '#4e4f56', '#727174', '#9a968f', '#c2bcae', '#e2dccb');
const ROOF = P('#1b1f28', '#2a313d', '#3f4857', '#5b6676', '#86909b');
const PLASTER = P('#a4977f', '#cbbfa5', '#e3d9c0', '#f4eddb');
const WOOD = P('#2c1f17', '#4a3122', '#6c4730', '#8f6242', '#b5865a');
const THATCH = P('#3d3226', '#5e4b35', '#806849', '#a08760', '#bea67c', '#d9c59c');
const CLAY = P('#6e4c33', '#96704d', '#b99266', '#d4b184');
const PAPER = P('#d9cdb0', '#f1e8d2');
// 꽃나무: 0은 테두리, 6은 꽃 뭉치의 밝은 끝. 흰 꽃나무는 따로
const BLOSSOM = P('#5e2b40', '#8e4560', '#bf6b84', '#de93a6', '#f1b9c4', '#fbd9de', '#fff1f0');
const BLOSSOM_WHITE = [BLOSSOM[0], BLOSSOM[2], BLOSSOM[3], BLOSSOM[4], BLOSSOM[5], BLOSSOM[6], BLOSSOM[6]]; // 흰 꽃나무는 분홍 단계의 밝은 쪽을 빌린다
// 잎(참나무와 새잎): 풀의 단계를 그대로 쓴다(0은 테두리, 6은 잎 뭉치의 밝은 끝) — 빛깔 벌을 아낀다(규칙 ㅇ)
const LEAF = GRASS;
const WATER = P('#132a3d', '#1f4664', '#3a7896', '#86c3cc');
// 옹기·닭·까치는 다른 재질의 단계를 빌린다(빛깔 벌 96색 이하 — 규칙 ㅇ)
const ONGGI = [hex('#2c1f17'), hex('#4a3122'), hex('#6c4730'), hex('#8f6242'), hex('#b5865a'), hex('#d4b184')];
const HEN = [hex('#4a3122'), hex('#8f6242'), hex('#b5865a'), hex('#cdab5a'), hex('#e8d08a')];
const MAGPIE = [hex('#1b1f28'), hex('#2a313d'), hex('#3f4857'), hex('#c2bcae'), hex('#f4eddb')];
const COMB = [hex('#b4574d'), hex('#d8473a')];
const BEAK = hex('#cdab5a');
const SKIN = P('#9a6346', '#cc9269', '#e8b48a', '#f7d4af');
const HAIR = P('#141011', '#2a2120', '#43362f', '#5e4d43');
const WHITE_HAIR = P('#8a8580', '#b8b3ab', '#dcd7cd', '#f6f2e9');
const COTTON = P('#8e806a', '#b9ab90', '#dcd1b6', '#f3ecd9');
const HEMP = P('#6f6047', '#978562', '#baa781', '#d5c6a0');
const EARTH = P('#523a2b', '#73513a', '#946e4d', '#b48d66');
const ASH = P('#575249', '#79736a', '#9c968a', '#bfb9ab');
const STRAW = P('#78592e', '#a5823e', '#cdab5a', '#e8d08a');
const FLOWERS = P('#f0cf4a', '#f7f2ea', '#c68ad0');
const LIP = hex('#b4574d');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** 땅의 그림자: 바탕 빛을 한 단계 어둡게(먹을 섞지 않는다 — 규칙 ㅂ). 같은 갈래 안에서 밝기 순으로 한 칸 아래 */
const SHADE_OF = new Map();
const lum = (c) => 0.2126 * (c & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * ((c >> 16) & 255);
for (const family of [[...GRASS, GRASS_SHADE, GRASS_WARM], [...DIRT, DIRT_RUDDY, DIRT_COOL], STONE]) {
  const order = [...family].sort((a, b) => lum(a) - lum(b));
  order.forEach((c, i) => SHADE_OF.set(c, order[Math.max(0, i - 1)]));
}
for (const c of FLOWERS) SHADE_OF.set(c, GRASS[2]);
for (const c of [BLOSSOM[4], BLOSSOM[5], BLOSSOM_WHITE[4], BLOSSOM_WHITE[5]]) SHADE_OF.set(c, BLOSSOM[3]);
SHADE_OF.set(BLOSSOM[3], BLOSSOM[2]);

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

/**
 * 폭신한 뭉치(잎·꽃·풀 둔덕) — 규칙 ㅅ. 공처럼 빛을 받되(lo~hi 단계, 띠로), 오른쪽 아래 가장자리는 그늘 골(rim),
 * 왼쪽 위 가장자리에는 밝은 끝(tip)이 초승달처럼 걸린다. 반지름이 작아도 밝은 끝은 두 점 이상 이어진다.
 */
function puff(img, cx, cy, r, ramp, o = {}) {
  const rx = r;
  const ry = r * (o.squash ?? 0.86);
  const lo = o.lo ?? 2;
  const hi = o.hi ?? 4;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      let dx = (x + 0.5 - cx) / rx;
      let dy = (y + 0.5 - cy) / ry;
      // 가장자리가 조금 울퉁불퉁하다(잎·꽃이 뭉친 꼴)
      if (o.wobble) {
        const k = 1 + (vnoise(Math.atan2(dy, dx) * 1.9 + 7, (o.seed ?? 0) * 0.37, o.seed ?? 0) - 0.5) * o.wobble;
        dx /= k;
        dy /= k;
      }
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      if (o.keep && !o.keep(x, y)) continue;
      const nz = Math.sqrt(1 - d2);
      const light = -0.5 * dx - 0.62 * dy + 0.6 * nz;
      const t = clamp(0.4 + 0.62 * light + (o.bias ?? 0), 0, 0.999);
      let i = lo + Math.floor(t * (hi - lo + 1));
      const edge = d2 > Math.pow(1 - 1.25 / r, 2);
      if (edge && dx + dy > 0.3) i = o.rim ?? lo - 1;
      else if (o.tip !== undefined && d2 > Math.pow(1 - 2.3 / r, 2) && dy < -0.2 && dx < 0.45 && dx + dy < -0.35) i = o.tip;
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
  // 1) 점마다 흙인가 풀인가(첫 시안과 같다): 칸 가운데 값을 부드럽게 잇고 큰 결의 무늬로 가장자리를 구불게
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
  const smoothMask = (m, passes) => {
    for (let pass = 0; pass < passes; pass++) {
      const src = m.slice();
      for (let Y = 1; Y < VH - 1; Y++) {
        for (let X = 1; X < VW - 1; X++) {
          const k = Y * VW + X;
          const same = (src[k - 1] === src[k]) + (src[k + 1] === src[k]) + (src[k - VW] === src[k]) + (src[k + VW] === src[k]);
          if (same <= 1) {
            // 이웃 넷 가운데 가장 많은 것을 따른다
            const votes = new Map();
            for (const q of [src[k - 1], src[k + 1], src[k - VW], src[k + VW]]) votes.set(q, (votes.get(q) ?? 0) + 1);
            m[k] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
          }
        }
      }
    }
  };
  smoothMask(dirt, 2);
  const D = (X, Y) => (X < 0 || Y < 0 || X >= VW || Y >= VH ? dirt[clamp(Y, 0, VH - 1) * VW + clamp(X, 0, VW - 1)] : dirt[Y * VW + X]);

  // 2) 큰 얼룩(규칙 ㅌ): 풀은 그늘·바탕·볕·따뜻한 볕, 흙은 불그레한 곳·바탕·마른 곳·밟혀 밝은 곳.
  //    얼룩의 가장자리는 네 점 남짓한 결로 구불고, 외톨이가 남지 않게 고른다(규칙 ㄹ). 섞음 무늬는 쓰지 않는다(규칙 ㄷ).
  const zone = new Uint8Array(VW * VH);
  for (let Y = 0; Y < VH; Y++) {
    for (let X = 0; X < VW; X++) {
      const wx = X + CAM.x;
      const wy = Y + CAM.y;
      const k = Y * VW + X;
      const big = vnoise(wx / 44, wy / 36, 3) * 0.62 + vnoise(wx / 19, wy / 16, 4) * 0.38 + (vnoise(wx / 4.2, wy / 3.6, 5) - 0.5) * 0.08;
      if (dirt[k]) {
        // 흙: 0 서늘한 그늘 · 1 바탕 · 2 마른 흙 · 3 밟혀 밝은 곳 · 4 불그레한 곳(바탕 자리에 색조만 옮긴다)
        const v = big + (field[k] - 0.8) * 0.5 + (yard[k] ? 0.06 : 0);
        const hue = vnoise(wx / 52 + 3, wy / 44, 8) + (vnoise(wx / 4.4, wy / 3.8, 12) - 0.5) * 0.07;
        zone[k] = v < 0.32 ? 0 : v < 0.6 ? (hue > 0.56 ? 4 : 1) : v < 0.9 || yard[k] ? 2 : 3;
      } else {
        const warm = vnoise(wx / 60 + 11, wy / 50, 6);
        zone[k] = big < 0.36 ? 0 : big < 0.6 ? 1 : warm > 0.52 ? 3 : 2;
      }
    }
  }
  smoothMask(zone, 3);
  const GRASS_BASE = [GRASS_SHADE, GRASS[2], GRASS[3], GRASS_WARM];
  // 뭉치의 빛(얼룩마다): [볕, 밝은 끝, 그늘]
  const GRASS_TONE = [
    [GRASS[2], GRASS[3], GRASS[1]],
    [GRASS[3], GRASS[4], GRASS[1]],
    [GRASS[4], GRASS[5], GRASS[2]],
    [GRASS[5], GRASS[6], GRASS[3]],
  ];
  const DIRT_BASE = [DIRT_COOL, DIRT[3], DIRT[4], DIRT[5], DIRT_RUDDY];
  for (let Y = 0; Y < VH; Y++) for (let X = 0; X < VW; X++) {
    const k = Y * VW + X;
    img.set(X, Y, dirt[k] ? DIRT_BASE[zone[k]] : GRASS_BASE[zone[k]]);
  }
  const Z = (X, Y) => zone[clamp(Y, 0, VH - 1) * VW + clamp(X, 0, VW - 1)];

  // 3) 풀 뭉치: 크기가 다른 두 겹의 칸에, 꼴 여섯을 뒤집어 가며(같은 도장이 줄지어 보이지 않게 — ㅌ)
  const CLUMPS = [
    ['.LL.', 'LLLL', '.DD.'],
    ['.L.', 'LLL', 'DD.'],
    ['.LLL.', 'LLLLL', '.DDD.'],
    ['L..L', 'LLLL', '.DD.'],
    ['.T.L', 'LLLL', 'LLL.', '.DD.'],
    ['..T..', '.LLL.', 'LLLLL', '.DDDD'],
  ];
  const stamp = (X, Y, motif, flip, z) => {
    const [lit, tip, dark] = GRASS_TONE[z];
    motif.forEach((line, j) => {
      for (let i = 0; i < line.length; i++) {
        const ch = flip ? line[line.length - 1 - i] : line[i];
        if (ch === '.') continue;
        img.set(X + i, Y + j, ch === 'D' ? dark : ch === 'T' ? tip : lit);
      }
    });
  };
  for (const [cw, ch, seed, share, pick] of [
    [8, 7, 11, 0.62, [0, 1, 3]],
    [13, 11, 61, 0.5, [2, 4, 5]],
  ]) {
    for (let gy = Math.floor(CAM.y / ch) - 1; gy <= (CAM.y + VH) / ch + 1; gy++) {
      for (let gx = Math.floor(CAM.x / cw) - 1; gx <= (CAM.x + VW) / cw + 1; gx++) {
        if (hash2(gx, gy, seed) > share) continue;
        const X = gx * cw + Math.floor(hash2(gx, gy, seed + 1) * (cw - 3)) - CAM.x;
        const Y = gy * ch + Math.floor(hash2(gx, gy, seed + 2) * (ch - 2)) - CAM.y;
        const motif = CLUMPS[pick[Math.floor(hash2(gx, gy, seed + 3) * pick.length)]];
        let clear = true;
        for (let j = -1; j <= motif.length + 2 && clear; j++) for (let i = -1; i <= motif[0].length; i++) if (D(X + i, Y + j)) { clear = false; break; }
        if (!clear) continue;
        stamp(X, Y, motif, hash2(gx, gy, seed + 4) > 0.5, Z(X + 1, Y + 1));
      }
    }
  }
  // 풀 둔덕: 작은 공 두셋을 겹친 도톰한 무리. 볕 드는 얼룩에는 밝은 끝이 있다
  for (let gy = Math.floor(CAM.y / 21) - 1; gy <= (CAM.y + VH) / 21 + 1; gy++) {
    for (let gx = Math.floor(CAM.x / 25) - 1; gx <= (CAM.x + VW) / 25 + 1; gx++) {
      if (hash2(gx, gy, 15) > 0.55) continue;
      const X = gx * 25 + Math.floor(hash2(gx, gy, 16) * 14) - CAM.x;
      const Y = gy * 21 + Math.floor(hash2(gx, gy, 17) * 12) - CAM.y;
      let clear = true;
      for (let j = -7; j <= 9 && clear; j++) for (let i = -9; i <= 13; i++) if (D(X + i, Y + j)) { clear = false; break; }
      if (!clear) continue;
      const z = Z(X, Y);
      const lo = [1, 2, 2, 3][z];
      const n = 2 + Math.floor(hash2(gx, gy, 18) * 3);
      for (let k = 0; k < n; k++) {
        const r = 3.6 + hash2(gx + k, gy, 19) * 2.4;
        puff(img, X + k * 4 - (n - 1) * 2, Y + (k % 2 === 1 ? -2 : 0), r, GRASS, { lo, hi: lo + 2, rim: lo - 1, tip: z >= 2 ? lo + 3 : lo + 2 });
      }
    }
  }
  // 들꽃 무리: 셋에서 일곱 송이(노랑·흰빛·보랏빛), 한 송이는 다섯 점 십자 또는 네 점. 아래에 두 점짜리 그늘
  for (let gy = Math.floor(CAM.y / 34); gy <= (CAM.y + VH) / 34; gy++) {
    for (let gx = Math.floor(CAM.x / 38); gx <= (CAM.x + VW) / 38; gx++) {
      if (hash2(gx, gy, 21) > 0.42) continue;
      const cx = gx * 38 + Math.floor(hash2(gx, gy, 22) * 26) - CAM.x;
      const cy = gy * 34 + Math.floor(hash2(gx, gy, 23) * 22) - CAM.y;
      const c = FLOWERS[Math.floor(hash2(gx, gy, 24) * 3)];
      const n = 3 + Math.floor(hash2(gx, gy, 25) * 5);
      for (let q = 0; q < n; q++) {
        const fx = cx + Math.round((hash2(q, gx, 26) - 0.5) * 16);
        const fy = cy + Math.round((hash2(q, gy, 27) - 0.5) * 10);
        if (D(fx - 2, fy - 2) || D(fx + 3, fy + 3) || D(fx - 2, fy + 3) || D(fx + 3, fy - 2)) continue;
        if (hash2(q, gx + gy, 28) > 0.5) {
          for (const [i, j] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) img.set(fx + i, fy + j, c);
          img.set(fx + 1, fy + 3, GRASS[1]);
          img.set(fx + 2, fy + 3, GRASS[1]);
        } else {
          img.rect(fx, fy, 2, 2, c);
          img.set(fx, fy + 2, GRASS[1]);
          img.set(fx + 1, fy + 2, GRASS[1]);
        }
      }
    }
  }

  // 4) 흙의 결: 잔돌 무리(둘에서 넷), 흙덩이, 패인 자국 — 얼룩마다 빛을 맞춘다
  const dirtLadder = [...DIRT, DIRT_RUDDY, DIRT_COOL].sort((a, b) => lum(a) - lum(b));
  const step = (c, d) => dirtLadder[clamp(dirtLadder.indexOf(c) + d, 0, dirtLadder.length - 1)];
  const pebble = (X, Y, big) => {
    const w = big ? 4 : 3;
    const h = big ? 3 : 2;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.set(X + i, Y + j, j === 0 ? STONE[4] : i === w - 1 || j === h - 1 ? STONE[2] : STONE[3]);
    for (let i = 1; i <= w; i++) img.set(X + i, Y + h, step(img.get(X + i, Y + h + 1), -1));
  };
  const inDirt = (X, Y, r) => D(X - r, Y - r) && D(X + r + 3, Y + r) && D(X - r, Y + r) && D(X + r + 3, Y - r);
  for (let gy = Math.floor(CAM.y / 26); gy <= (CAM.y + VH) / 26; gy++) {
    for (let gx = Math.floor(CAM.x / 30); gx <= (CAM.x + VW) / 30; gx++) {
      if (hash2(gx, gy, 31) > 0.5) continue;
      const cx = gx * 30 + Math.floor(hash2(gx, gy, 32) * 20) - CAM.x;
      const cy = gy * 26 + Math.floor(hash2(gx, gy, 33) * 16) - CAM.y;
      const n = 2 + Math.floor(hash2(gx, gy, 34) * 3);
      for (let q = 0; q < n; q++) {
        const X = cx + Math.round((hash2(q, gx, 35) - 0.5) * 14);
        const Y = cy + Math.round((hash2(q, gy, 36) - 0.5) * 8);
        if (!inDirt(X, Y, 3)) continue;
        pebble(X, Y, q === 0 && hash2(gx, gy, 37) > 0.4);
      }
    }
  }
  for (let gy = Math.floor(CAM.y / 10); gy <= (CAM.y + VH) / 10; gy++) {
    for (let gx = Math.floor(CAM.x / 11); gx <= (CAM.x + VW) / 11; gx++) {
      const r = hash2(gx, gy, 41);
      if (r > 0.55) continue;
      const X = gx * 11 + Math.floor(hash2(gx, gy, 42) * 7) - CAM.x;
      const Y = gy * 10 + Math.floor(hash2(gx, gy, 43) * 6) - CAM.y;
      if (!inDirt(X, Y, 3)) continue;
      const base = img.get(X, Y);
      if (base !== img.get(X + 3, Y + 1) || base !== img.get(X + 1, Y + 2)) continue;
      if (r < 0.15) {
        img.rect(X, Y, 3, 1, step(base, -1));
        img.rect(X + 1, Y + 1, 3, 1, step(base, 1));
      } else {
        img.rect(X, Y, 3, 2, step(base, 1));
        img.set(X + 3, Y + 1, step(base, 1));
        img.rect(X + 1, Y + 2, 3, 1, step(base, -1));
      }
    }
  }

  // 흙의 잔결: 두 점짜리 무리(한 단계 밝거나 어둡게) — 넓은 한 빛 판을 덜되 외톨이 점은 만들지 않는다
  for (let gy = Math.floor(CAM.y / 8); gy <= (CAM.y + VH) / 8; gy++) {
    for (let gx = Math.floor(CAM.x / 9); gx <= (CAM.x + VW) / 9; gx++) {
      const r = hash2(gx, gy, 45);
      if (r > 0.34) continue;
      const X = gx * 9 + Math.floor(hash2(gx, gy, 46) * 7) - CAM.x;
      const Y = gy * 8 + Math.floor(hash2(gx, gy, 47) * 6) - CAM.y;
      if (!inDirt(X, Y, 2)) continue;
      const base = img.get(X, Y);
      if (base !== img.get(X + 1, Y) || base !== img.get(X, Y + 1)) continue;
      const c = step(base, r < 0.17 ? 1 : -1);
      img.set(X, Y, c);
      img.set(X + 1, Y, c);
    }
  }

  // 5) 풀과 흙이 만나는 곳: 풀이 한 뼘 도톰하다(볕 쪽은 밝은 테, 아래는 짙은 테), 풀 아래 흙에 그늘 두 점
  const out = img.d.slice();
  for (let Y = 0; Y < VH; Y++) {
    for (let X = 0; X < VW; X++) {
      const k = Y * VW + X;
      if (!D(X, Y)) {
        if (D(X, Y + 1)) out[k] = GRASS[0];
        else if (D(X, Y + 2)) out[k] = GRASS[1];
        else if (D(X + 1, Y)) out[k] = GRASS[1];
        else if (D(X, Y - 1) || D(X - 1, Y)) out[k] = GRASS[5];
      } else {
        if (!D(X, Y - 1) || !D(X, Y - 2)) out[k] = step(img.d[k], -2);
        else if (!D(X - 1, Y)) out[k] = step(img.d[k], -1);
      }
    }
  }
  img.d.set(out);
  // 길에 걸친 풀: 위쪽 가장자리에서 흙 위로 늘어진 잎(크기가 여러 가지), 길가에 돋은 작은 풀 싹
  for (let Y = 1; Y < VH - 6; Y++) {
    for (let X = 1; X < VW - 6; X++) {
      if (D(X, Y) || !D(X, Y + 1) || !D(X + 3, Y + 1)) continue;
      const h = hash2(X + CAM.x, Y + CAM.y, 51);
      if (h > 0.2) continue;
      const big = h < 0.07;
      const w = big ? 4 : 2;
      for (let i = 0; i < w; i++) {
        img.set(X + i, Y + 1, GRASS[2]);
        img.set(X + i, Y + 2, GRASS[1]);
        if (big && i > 0 && i < 3) img.set(X + i, Y + 3, GRASS[1]);
      }
      if (big) img.set(X + 1, Y + 1, GRASS[3]);
      if (big) img.set(X + 2, Y + 1, GRASS[3]);
      for (let i = 1; i <= w; i++) img.set(X + i, Y + (big ? 4 : 3), step(img.get(X + i, Y + (big ? 5 : 4)), -1));
    }
  }
  for (let gy = Math.floor(CAM.y / 17); gy <= (CAM.y + VH) / 17; gy++) {
    for (let gx = Math.floor(CAM.x / 19); gx <= (CAM.x + VW) / 19; gx++) {
      if (hash2(gx, gy, 55) > 0.35) continue;
      const X = gx * 19 + Math.floor(hash2(gx, gy, 56) * 12) - CAM.x;
      const Y = gy * 17 + Math.floor(hash2(gx, gy, 57) * 10) - CAM.y;
      // 흙 안이되 풀 가장자리에서 여덟 점 안
      if (!inDirt(X, Y, 2)) continue;
      let nearGrass = false;
      for (let r = 4; r <= 8 && !nearGrass; r += 2) if (!D(X - r, Y) || !D(X + r, Y) || !D(X, Y - r) || !D(X, Y + r)) nearGrass = true;
      if (!nearGrass) continue;
      for (const [i, j, c] of [[0, 0, GRASS[3]], [0, 1, GRASS[3]], [2, 0, GRASS[4]], [2, 1, GRASS[3]], [1, 1, GRASS[3]], [0, 2, GRASS[1]], [1, 2, GRASS[1]], [2, 2, GRASS[1]]]) img.set(X + i, Y + j, c);
    }
  }
  return { img, dirt, D };
}

/** 꽃나무 아래에 떨어진 꽃잎 무리(봄): 두세 점짜리 무리, 나무 둘레의 오른쪽 아래로 더 많이 */
function petals(img, D, cx, cy, ramp) {
  for (let q = 0; q < 26; q++) {
    const a = hash2(q, cx, 71) * Math.PI * 2;
    const r = 10 + hash2(q, cy, 72) * 40;
    const X = Math.round(cx + Math.cos(a) * r * 1.2 + 8);
    const Y = Math.round(cy + Math.sin(a) * r * 0.45 + 4);
    if (X < 1 || Y < 1 || X >= VW - 3 || Y >= VH - 3) continue;
    const c = hash2(q, 3, 73) > 0.4 ? ramp[4] : ramp[5];
    img.set(X, Y, c);
    img.set(X + 1, Y, c);
    if (hash2(q, 4, 74) > 0.5) img.set(X + 1, Y + 1, c);
    void D;
  }
}

/** 그림자 판(점마다 0·1·2)에 칠한 곳의 바닥 빛을 그 수만큼 어둡게 — 닿는 곳은 두 단, 드리운 곳은 한 단(규칙 ㅂ) */
function applyShadow(ground, mask) {
  for (let i = 0; i < mask.length; i++) for (let k = 0; k < mask[i]; k++) ground.d[i] = SHADE_OF.get(ground.d[i]) ?? ground.d[i];
}
function shadowEllipse(mask, cx, cy, rx, ry, holes = 0, level = 1) {
  for (let Y = Math.floor(cy - ry); Y <= cy + ry; Y++) {
    for (let X = Math.floor(cx - rx); X <= cx + rx; X++) {
      if (X < 0 || Y < 0 || X >= VW || Y >= VH || !inEllipse(X, Y, cx, cy, rx, ry)) continue;
      // 잎 사이로 새는 볕(무리 진 구멍)
      if (holes && vnoise((X + CAM.x) / 5, (Y + CAM.y) / 4, 61) > 1 - holes) continue;
      mask[Y * VW + X] = Math.max(mask[Y * VW + X], level);
    }
  }
}
function shadowRect(mask, x, y, w, h, level = 1) {
  for (let Y = y; Y < y + h; Y++) for (let X = x; X < x + w; X++) if (X >= 0 && Y >= 0 && X < VW && Y < VH) mask[Y * VW + X] = Math.max(mask[Y * VW + X], level);
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
      // 켜: 처마와 나란히 굽은 짚 켜(여덟 점마다). 켜의 아랫단은 볕을 받아 밝고 그 아래 한 줄은 그늘 —
      // 짚을 겹겹이 덮은 꼴. 단은 열두 점마다 한 점씩 오르내려 자로 그은 줄이 되지 않게 한다.
      const sag = Math.pow((x - cx) / 108, 2) * 6;
      const wob = hash2(Math.floor(x / 12), 3, 83) > 0.5 ? 1 : 0;
      const line = Math.round(y - top - sag) + wob;
      const m = ((line % 8) + 8) % 8;
      if (line > 6 && m === 0) v -= 1;
      else if (line > 6 && m === 7) v += 1;
      // 짚의 결: 짧은 세로 줄 무리(세 점 길이, 띄엄띄엄)
      else if (m >= 2 && m <= 4 && hash2(Math.floor(x / 3), Math.floor(line / 8), 82) > 0.78 && x % 3 === 1) v += 1;
      img.set(x, y, THATCH[clamp(v, 1, 5)]);
    }
  }
  // 새끼줄 그물(비스듬한 두 갈래): 첫 시안의 열여덟 점 간격은 누비이불처럼 보여 서른두 점으로 성기게 하고,
  // 그 자리의 빛보다 한 단계만 어둡게 한다
  for (let y = top + 8; y < eave - 2; y++) {
    for (let x = 0; x < W; x++) {
      if (!roofIn(x, y) || !roofIn(x - 3, y) || !roofIn(x + 3, y)) continue;
      if ((x + y) % 32 === 0 || (x - y + 640) % 32 === 0) img.set(x, y, THATCH[clamp(toneAt(x, y) - 1, 1, 5)]);
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

/**
 * 폭신한 나무(규칙 ㅅ): 나무갓의 둥근 꼴(가장자리가 물결치는) 안에 작은 뭉치를 촘촘히 채운다.
 * 위(뒤)에서 아래(앞)로 그리고, 뭉치마다 밝은 끝과 그늘 골이 있다. 나무갓 전체로도 왼쪽 위가 밝다(빛 하나).
 * o: { W, H, cx, cy, rx, ry, r: [작은, 큰 반지름], cell, ramp, trunk: { x, top, bot, wTop, wBot }, branches, seed, flip, accent }
 */
function fluffyTree(o) {
  const { W, H } = o;
  const img = new Img(W, H);
  const fx = (x) => (o.flip ? W - 1 - x : x);
  // 줄기·뿌리·가지
  const trunk = new Img(W, H);
  const t0 = o.trunk;
  for (let y = t0.top; y <= t0.bot; y++) {
    const t = (t0.bot - y) / (t0.bot - t0.top);
    let wd = t0.wBot + (t0.wTop - t0.wBot) * t;
    if (t < 0.12) wd += (0.12 - t) * 30;
    const c = t0.x + Math.sin(t * 3 + o.seed) * 1.6;
    const a = Math.round(c - wd / 2);
    const b = Math.round(c + wd / 2) - 1;
    for (let x = a; x <= b; x++) {
      const u = (x - a) / Math.max(1, b - a);
      const grain = hash2(x, Math.floor(y / 3), o.seed + 5) > 0.82;
      trunk.set(fx(x), y, u < 0.28 ? WOOD[4] : u > 0.7 ? WOOD[1] : grain ? WOOD[2] : WOOD[3]);
    }
  }
  for (const [x0, y0, x1, y1, th] of o.branches) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let k = 0; k < th; k++) trunk.set(fx(x + k), y, k === 0 ? WOOD[3] : WOOD[1]);
    }
  }
  outline(trunk);
  img.blit(trunk, 0, 0);
  // 나무갓
  const crown = new Img(W, H);
  const clumps = [];
  const [rMin, rMax] = o.r;
  const [cw, ch] = o.cell;
  for (let gy = 0; gy * ch < o.ry * 2 + ch; gy++) {
    for (let gx = 0; gx * cw < o.rx * 2 + cw; gx++) {
      const x = o.cx - o.rx + gx * cw + (gy % 2) * (cw / 2) + (hash2(gx, gy, o.seed + 1) - 0.5) * cw * 0.5;
      const y = o.cy - o.ry + gy * ch + (hash2(gx, gy, o.seed + 2) - 0.5) * ch * 0.4;
      const dx = (x - o.cx) / o.rx;
      const dy = (y - o.cy) / o.ry;
      const ang = Math.atan2(dy, dx);
      const lim = 0.84 + 0.12 * Math.sin(ang * 5 + o.seed);
      if (dx * dx + dy * dy > lim * lim) continue;
      const r = rMin + hash2(gx, gy, o.seed + 3) * (rMax - rMin);
      clumps.push({ x: fx(x), y, r, bias: -0.45 * (o.flip ? -dx : dx) - 0.55 * dy });
    }
  }
  clumps.sort((p, q) => p.y - q.y);
  // 나무갓 전체가 한 덩어리로 읽히게: 왼쪽 위의 뭉치는 밝은 단계(3~5)에 밝은 끝, 가운데는 2~4, 오른쪽 아래는 2~3.
  // 뭉치 사이의 골은 한 단계만 어둡게(가장 어두운 단계는 나무갓의 바깥 테두리에만 — 거품처럼 보이지 않게)
  clumps.forEach((c, i) => {
    const lit = c.bias > 0.12;
    const dim = c.bias < -0.22;
    const lo = lit ? 3 : 2;
    const hi = lit ? 5 : dim ? 3 : 4;
    puff(crown, c.x, c.y, c.r, o.ramp, { lo, hi, rim: lo - 1, tip: dim ? undefined : lit ? 6 : 5, bias: c.bias * 0.3, wobble: 0.22, seed: o.seed + i });
  });
  // 섞인 빛깔의 무리(꽃나무의 새잎, 참나무의 새순): 두 점 × 두 점
  if (o.accent) {
    for (let gy = 0; gy < H; gy += 6) {
      for (let gx = 0; gx < W; gx += 7) {
        const x = gx + Math.floor(hash2(gx, gy, o.seed + 7) * 4);
        const y = gy + Math.floor(hash2(gx, gy, o.seed + 8) * 3);
        if (A(crown.get(x - 1, y - 1)) === 0 || A(crown.get(x + 2, y + 2)) === 0) continue;
        if (hash2(gx, gy, o.seed + 9) > o.accent.share) continue;
        const [a, b, c] = o.accent.tones;
        crown.set(x, y, b);
        crown.set(x + 1, y, c);
        crown.set(x, y + 1, a);
        crown.set(x + 1, y + 1, b);
      }
    }
  }
  outline(crown, o.ramp[0]);
  img.blit(crown, 0, 0);
  return { img, ax: fx(t0.x), ay: t0.bot - 1 };
}

/** 꽃나무(살구꽃 · 흰 꽃) */
function blossomTree(variant) {
  const white = variant === 1;
  return fluffyTree({
    W: 100,
    H: 112,
    cx: 50,
    cy: 38,
    rx: 44,
    ry: 33,
    r: [7.5, 11],
    cell: [12, 10],
    ramp: white ? BLOSSOM_WHITE : BLOSSOM,
    trunk: { x: 50, top: 60, bot: 105, wTop: 5, wBot: 9 },
    branches: [
      [49, 72, 30, 54, 3],
      [51, 70, 70, 52, 3],
      [50, 66, 49, 44, 2],
    ],
    seed: 400 + variant * 31,
    flip: variant === 2,
    accent: { share: 0.2, tones: [LEAF[3], LEAF[4], LEAF[5]] },
  });
}

/** 참나무(넓은 잎): 큰 나무갓, 밝은 끝이 연두로 빛난다 */
function oakTree(variant) {
  return fluffyTree({
    W: 116,
    H: 136,
    cx: 58,
    cy: 50,
    rx: 52,
    ry: 44,
    r: [10, 14],
    cell: [15, 12],
    ramp: LEAF,
    trunk: { x: 58, top: 78, bot: 129, wTop: 8, wBot: 13 },
    branches: [
      [57, 92, 34, 70, 4],
      [60, 90, 82, 68, 4],
      [58, 84, 58, 62, 3],
    ],
    seed: 100 + variant * 17,
    flip: false,
    accent: { share: 0.12, tones: [LEAF[4], LEAF[5], LEAF[6]] },
  });
}

/** 장독대: 납작한 돌을 깐 단 위에 크고 작은 독(옹기)과 뚜껑 */
function jars(variant) {
  const W = 70;
  const H = 62;
  const img = new Img(W, H);
  // 돌 단
  for (let y = 46; y <= 56; y++) {
    for (let x = 3; x <= 66; x++) {
      const top = y <= 49;
      const sw = 14;
      const local = (x + (top ? 0 : 7)) % sw;
      let c = top ? STONE[4] : STONE[2];
      if (y === 46) c = STONE[5];
      if (!top && local === 0) c = STONE[1];
      if (y === 56) c = STONE[1];
      if (top && local === 0 && y > 46) c = STONE[3];
      img.set(x, y, c);
    }
  }
  // 독: 뒤(위)에서 앞으로. [가운데 x, 바닥 y, 반지름, 높이]
  const pots = variant === 0 ? [[22, 47, 11, 26], [44, 47, 10, 22], [58, 50, 6, 13]] : [[16, 50, 7, 14], [33, 47, 12, 28], [54, 48, 9, 19]];
  for (const [cx, by, r, h] of pots) {
    const top = by - h;
    for (let y = top; y <= by; y++) {
      const t = (y - top) / h; // 0 어깨 → 1 바닥
      const bulge = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.35 + 0.72;
      const half = r * (t < 0.12 ? 0.62 + t * 2.4 : bulge);
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const u = (x + 0.5 - cx) / half; // −1 왼쪽 → 1 오른쪽
        let i = u < -0.55 ? 4 : u < 0.1 ? 3 : u < 0.6 ? 2 : 1;
        if (u > -0.5 && u < -0.25 && t > 0.15 && t < 0.7) i = 5; // 윤이 나는 세로 빛줄
        if (t > 0.9) i = Math.min(i, 1);
        img.set(x, y, ONGGI[i]);
      }
    }
    // 뚜껑
    for (let y = top - 4; y <= top; y++) {
      const half = r * 0.66 - (top - y) * 0.6;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const u = (x + 0.5 - cx) / half;
        img.set(x, y, y === top ? ONGGI[1] : u < -0.3 ? ONGGI[4] : u < 0.4 ? ONGGI[3] : ONGGI[2]);
      }
    }
    img.set(cx, top - 5, ONGGI[3]);
    img.set(cx + 1, top - 5, ONGGI[2]);
  }
  outline(img);
  return { img, ax: 35, ay: 54 };
}

/** 닭(오른쪽을 본다) */
function hen() {
  const img = new Img(32, 30);
  // 꽁지
  for (const [x, y, c] of [[5, 6, HEN[2]], [6, 5, HEN[3]], [5, 7, HEN[1]], [6, 6, HEN[2]], [6, 7, HEN[2]], [7, 6, HEN[1]], [4, 8, HEN[1]], [5, 8, HEN[2]], [6, 8, HEN[2]], [7, 8, HEN[1]], [8, 7, HEN[1]]]) img.set(x, y, c);
  ball(img, 14, 16, 9, 7, HEN, { lo: 1, hi: 4, rim: 0 });
  // 날개
  for (let x = 10; x <= 18; x++) {
    const y = 15 + Math.round(Math.abs(x - 14) * 0.3);
    img.set(x, y, HEN[1]);
    if (x < 17) img.set(x, y + 1, HEN[2]);
  }
  ball(img, 22, 9, 4.5, 4.5, HEN, { lo: 2, hi: 4, rim: 1 });
  // 볏과 부리, 눈, 턱볏
  for (const [x, y, c] of [[21, 3, COMB[1]], [22, 3, COMB[1]], [22, 4, COMB[0]], [23, 4, COMB[1]], [20, 4, COMB[0]], [24, 5, COMB[0]], [27, 9, BEAK], [27, 10, BEAK], [28, 10, BEAK], [26, 12, COMB[0]], [26, 13, COMB[1]], [24, 8, INK]]) img.set(x, y, c);
  // 다리
  for (const lx of [12, 16]) {
    for (let y = 23; y <= 26; y++) img.set(lx, y, BEAK);
    img.set(lx + 1, 26, BEAK);
    img.set(lx - 1, 26, BEAK);
  }
  outline(img);
  return { img, ax: 14, ay: 26 };
}

/** 까치(왼쪽을 본다): 검은 몸에 푸른 윤, 흰 배와 흰 날개 깃, 긴 꽁지 */
function magpie() {
  const img = new Img(34, 22);
  // 꽁지(오른쪽 뒤로 길게)
  for (let i = 0; i <= 11; i++) {
    const x = 18 + i;
    const y = 11 - Math.round(i * 0.35);
    img.set(x, y, i % 3 === 0 ? MAGPIE[2] : MAGPIE[1]);
    img.set(x, y + 1, MAGPIE[0]);
  }
  ball(img, 15, 12, 6.5, 4.8, MAGPIE, { lo: 0, hi: 2, rim: 0 });
  // 흰 배와 날개의 흰 깃
  for (const [x, y] of [[11, 13], [12, 13], [12, 14], [13, 14], [14, 15], [13, 15], [12, 15]]) img.set(x, y, MAGPIE[4]);
  for (const [x, y] of [[16, 10], [17, 10], [18, 11], [17, 11]]) img.set(x, y, MAGPIE[3]);
  ball(img, 9, 8, 3.4, 3.4, MAGPIE, { lo: 0, hi: 2, rim: 0 });
  img.set(8, 7, MAGPIE[4]);
  img.set(5, 8, MAGPIE[2]);
  img.set(4, 8, MAGPIE[2]);
  for (const lx of [13, 16]) for (let y = 16; y <= 18; y++) img.set(lx, y, MAGPIE[1]);
  outline(img);
  return { img, ax: 15, ay: 18 };
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
  const c2 = v % 3 === 0 ? hex('#fbe79a') : v % 3 === 1 ? PLASTER[3] : hex('#e3a6dd');
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
const { img: ground, D } = paintGround();
const shadowMask = new Uint8Array(VW * VH);
const sprites = [];
const at = (mx, my) => ({ x: mx * K - CAM.x, y: my * K - CAM.y });
const place = (s, mx, my, sortY, extra = {}) => sprites.push({ ...s, x: Math.round(mx * K - CAM.x - s.ax), y: Math.round(my * K - CAM.y - s.ay), sortY, ...extra });

// 담·돌담·울타리: 같은 줄에 이어진 칸을 한 그림으로
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
// 그림자: 닿는 곳은 두 단(level 2), 드리운 곳은 한 단(level 1). 빛이 왼쪽 위에서 오므로 오른쪽 아래로 진다(규칙 ㅂ)
for (const r of runs('wallH', 'x')) {
  const s = wallRun(r.tx1 - r.tx + 1);
  const bottom = (r.ty + 1) * TILE - CAM.y;
  sprites.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: bottom - 2 - s.ay, sortY: (r.ty * 16 + 12) * K });
  const w = (r.tx1 - r.tx + 1) * TILE;
  shadowRect(shadowMask, r.tx * TILE + 2 - CAM.x, bottom - 2, w, 4, 2);
  shadowRect(shadowMask, r.tx * TILE + 7 - CAM.x, bottom - 2, w, 10, 1);
}
for (const r of runs('wallV', 'y')) {
  const len = (r.ty1 - r.ty + 1) * TILE + 20;
  const s = wallColumn(len);
  const x = r.tx * TILE + 16 - 15 - CAM.x;
  const y = (r.ty1 + 1) * TILE - 4 - CAM.y - s.ay;
  sprites.push({ ...s, x, y, sortY: (r.ty1 * 16 + 12) * K - 1 });
  shadowRect(shadowMask, x + 30, y, 7, len, 1);
}
for (const r of runs('stonewallH', 'x')) {
  const s = stonewallRun(r.tx1 - r.tx + 1, r.tx);
  const bottom = (r.ty + 1) * TILE - 6 - CAM.y;
  sprites.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: bottom - s.ay, sortY: (r.ty * 16 + 12) * K });
  shadowRect(shadowMask, r.tx * TILE + 2 - CAM.x, bottom - 1, (r.tx1 - r.tx + 1) * TILE, 3, 2);
  shadowRect(shadowMask, r.tx * TILE + 6 - CAM.x, bottom - 1, (r.tx1 - r.tx + 1) * TILE, 7, 1);
}
for (const r of runs('fenceH', 'x')) {
  const s = fenceRun(r.tx1 - r.tx + 1);
  const bottom = (r.ty + 1) * TILE - 8 - CAM.y;
  sprites.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: bottom - s.ay, sortY: (r.ty * 16 + 12) * K });
  shadowRect(shadowMask, r.tx * TILE + 2 - CAM.x, bottom - 1, (r.tx1 - r.tx + 1) * TILE, 2, 2);
  shadowRect(shadowMask, r.tx * TILE + 6 - CAM.x, bottom - 1, (r.tx1 - r.tx + 1) * TILE, 7, 1);
}
let wellRope = null;
const blossomsAt = [];
for (const t of things) {
  if (['wallH', 'wallV', 'stonewallH', 'fenceH'].includes(t.kind)) continue;
  const sortY = t.ay * K;
  const p = at(t.ax, t.ay);
  if (t.kind === 'gate') {
    const s = gate();
    place(s, t.ax, t.ay, sortY + 6, { kind: 'gate' });
    // 지붕이 문간 바닥에 드리운 그늘과 오른쪽 옆벽의 그림자
    shadowRect(shadowMask, p.x + 18, p.y - 12, 62, 14, 1);
    shadowRect(shadowMask, p.x + 18, p.y, 62, 3, 2);
    shadowRect(shadowMask, p.x + 110, p.y - 4, 12, 12, 1);
  } else if (t.kind === 'choga') {
    const s = choga();
    place(s, t.ax, t.ay, sortY, { kind: 'choga' });
    shadowRect(shadowMask, p.x - 96, p.y, 200, 4, 2);
    shadowRect(shadowMask, p.x - 90, p.y, 214, 13, 1);
    for (let k = 0; k < 44; k++) shadowRect(shadowMask, p.x + 98, p.y - 86 + k * 2, 26 - Math.floor(k / 4), 2, 1);
  } else if (t.kind === 'blossom') {
    const s = blossomTree(t.variant);
    place(s, t.ax, t.ay, sortY, { kind: 'blossom' });
    shadowEllipse(shadowMask, p.x + 14, p.y + 2, 38, 11, 0.2, 1);
    shadowEllipse(shadowMask, p.x + 3, p.y, 9, 3, 0, 2);
    blossomsAt.push({ x: p.x, y: p.y, white: t.variant === 1 });
  } else if (t.kind === 'oak') {
    const s = oakTree(t.variant);
    place(s, t.ax, t.ay, sortY, { kind: 'oak' });
    shadowEllipse(shadowMask, p.x + 18, p.y + 2, 48, 13, 0.16, 1);
    shadowEllipse(shadowMask, p.x + 4, p.y, 12, 4, 0, 2);
  } else if (t.kind === 'jars') {
    const s = jars(t.variant);
    place(s, t.ax, t.ay, sortY, { kind: 'jars' });
    shadowRect(shadowMask, p.x - 30, p.y + 1, 64, 3, 2);
    shadowRect(shadowMask, p.x - 26, p.y + 1, 68, 8, 1);
  } else if (t.kind === 'well') {
    const s = well();
    place(s, t.ax, t.ay, sortY, { kind: 'well' });
    shadowEllipse(shadowMask, p.x + 10, p.y + 2, 38, 10, 0, 1);
    shadowEllipse(shadowMask, p.x + 3, p.y, 31, 5, 0, 2);
    wellRope = { x: p.x - s.ax + s.rope.x, y: p.y - s.ay + s.rope.y };
  } else if (t.kind === 'flatstone') {
    const s = flatstone();
    place(s, t.ax, t.ay, sortY);
    shadowEllipse(shadowMask, p.x + 7, p.y + 2, 23, 6, 0, 1);
    shadowEllipse(shadowMask, p.x + 2, p.y + 1, 18, 3, 0, 2);
  } else if (t.kind === 'tuft') place(tuft(t.variant), t.ax, t.ay, sortY);
  else if (t.kind === 'flower') place(flower(t.variant), t.ax, t.ay, sortY);
  else if (t.kind === 'rockS') {
    place(rockS(t.variant), t.ax, t.ay, sortY);
    shadowEllipse(shadowMask, p.x + 3, p.y + 1, 9, 3, 0, 1);
  }
}
// 꽃나무 아래 떨어진 꽃잎(그림자를 칠하기 전에 — 그늘에 든 꽃잎은 한 단계 어둡다)
for (const b of blossomsAt) petals(ground, D, b.x, b.y, b.white ? BLOSSOM_WHITE : BLOSSOM);
const objectMask = shadowMask.slice();
const PEOPLE = { hero: heroBoy(), elder: elderMan(), woman: wellWoman() };
for (const p of region.people) {
  const s = PEOPLE[p.id];
  place(s, p.x, p.y, p.y * K, { person: p.id });
  const q = at(p.x, p.y);
  shadowEllipse(shadowMask, q.x + 1, q.y - 1, 10, 3.2, 0, 2);
  shadowEllipse(shadowMask, q.x + 4, q.y, 16, 4.8, 0, 1);
}
const CRITTERS = { hen: hen(), magpie: magpie() };
for (const c of region.critters ?? []) {
  const s = CRITTERS[c.sprite];
  if (!s) continue;
  // 지금 쪽(make-before)의 뒤집기를 따른다: 닭은 그대로, 까치는 뒤집었다
  const flip = c.sprite === 'hen' ? c.flip : !c.flip;
  const img = flip ? (() => { const o = new Img(s.img.w, s.img.h); o.blit(s.img, 0, 0, true); return o; })() : s.img;
  const ax = flip ? s.img.w - 1 - s.ax : s.ax;
  sprites.push({ img, ax, ay: s.ay, x: Math.round(c.x * K - CAM.x - ax), y: Math.round(c.y * K - CAM.y - s.ay), sortY: c.y * K, critter: c.id });
  const q = at(c.x, c.y);
  shadowEllipse(shadowMask, q.x + 1, q.y, 7, 2.4, 0, 2);
  shadowEllipse(shadowMask, q.x + 3, q.y + 1, 11, 3.4, 0, 1);
}
// 사람의 대비(ㅁ)는 "지금" 쪽처럼 사람 자신의 그림자를 빼고 잰다: 세운 것의 그림자만 드리운 바닥을 따로 둔다
const floorForPeople = ground.crop(0, 0, VW, VH);
applyShadow(floorForPeople, objectMask);
applyShadow(ground, shadowMask);
const groundOnly = ground.crop(0, 0, VW, VH);
const scene = ground.crop(0, 0, VW, VH);
sprites.sort((a, b) => a.sortY - b.sortY);
for (const s of sprites) scene.blit(s.img, s.x, s.y);
// 두레박 줄: 우물의 두레박에서 아주머니의 손으로
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

writeFileSync(join(here, 'v2-scene.png'), encodePng(scene.scale(3)));

// ── 사람 셋 둘레를 크게(지금 쪽과 같은 넓이: 맵 점 40×48) ──
const C = region.close;
const closeups = region.people.map((p) => scene.crop(p.x * K - CAM.x - C.w, p.y * K - CAM.y - C.up * K, C.w * K, C.h * K).scale(6));
const gap = 24;
const row = new Img(closeups.length * closeups[0].w + (closeups.length - 1) * gap, closeups[0].h);
row.rect(0, 0, row.w, row.h, rgb(244, 236, 217));
closeups.forEach((c, i) => row.blit(c, i * (c.w + gap), 0));
writeFileSync(join(here, 'v2-people.png'), encodePng(row));

// ── 수치(기획서 4.7.5의 Review 기준) ──
const people = {};
for (const s of sprites.filter((s) => s.person)) {
  people[s.person] = { outlineShare: outlineShare(s.img), orphansPer1000: spriteOrphans(s.img), edgeContrast: edgeContrast(s.img, s.x, s.y, groundOnly), ...personVsGround(s.img, s.x, s.y, floorForPeople, 4 * K) };
}
const metrics = {
  note: '2차 시안(2배, 타일 32점). 그림 점 단위로 잰다. 외톨이 점은 맵 칸(그림 점 32×32)마다.',
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
writeFileSync(join(here, 'v2-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics, null, 2));
console.log('→ v2/v2-scene.png, v2-people.png, v2-metrics.json');
