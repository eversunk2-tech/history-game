// 3차 시안(v3): 사용자가 2차 시안을 보고 "훨씬 괜찮아졌지만 너무 차갑다, 기존 것은 따뜻한 동화 느낌이 있었다,
// 얼룩이나 명암 표현이 더 있으면 좋겠고 테두리 선은 없는 것이 나을까 싶다, 기존 것은 수채화 느낌인데 수정본은
// 자로 잰 듯한 명암과 무늬라 기하학적이다"라고 했다. 그래서 2차를 고치지 않고 **지금 그림에서 출발**한다.
//
//   땅: 게임의 땅 그림 코드(src/pixel/ground.ts의 paintGround)를 그대로, 칸을 둘로 쪼갠 맵에 돌려 같은 결을 2배로 곱게 칠한다
//       (그 코드의 무늬는 점 단위라 칸을 쪼개면 같은 맛이 반 크기로 고와진다). 그 위에 따뜻한 큰 얼룩(볕은 금빛, 그늘은 갈색)을 한 번 더 입힌다.
//   나무: 게임의 나무갓 코드(src/pixel/shapes.ts의 canopy·trunk·branch)를 크기만 두 배로 불러 그린다(잎 뭉치의 결·골·반짝임이 그대로).
//   집·담·우물·장독대·소품: 2차의 꼴을 쓰되 먹빛 테두리를 빼고, 재질마다 이웃 단계로만 옮겨 가는 수채화 같은 얼룩을 입힌다.
//       초가는 새끼줄 그물을 빼고 짚 결이 흐르게, 담 돌은 크기와 빛을 들쭉날쭉하게.
//   빛깔: 마지막에 모든 점을 지금 게임의 봄 64색 벌(src/pixel/master.ts)에 맞춘다 — 따뜻함이 지금과 같은 벌에서 온다.
//   사람: 첫 시안의 꼴 그대로, 테두리만 두 안 — (가) 테두리 없음 (나) 제 빛깔을 짙게 한 부드러운 테두리.
//
// src/는 고치지 않는다. 읽어서 함수를 부를 뿐이다(scripts/make-icons.mjs, make-before.mjs와 같은 길 — Vite로 TypeScript를 읽는다).
//
//   node docs/mockup-art/v3/make-v3.mjs   (3차 시안 — 사용자가 보고 "때와 큰 얼룩을 덜자"고 해 3.1(../make-v31.mjs)을 만들었다. 그림은 그대로 남긴다)
//     → v3-scene.png((나) — 권하는 안), v3-scene-a.png((가)), v3-people-a.png, v3-people-b.png, v3-metrics.json

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { A, Img, blotch, checker, colorCount, edgeContrast, encodePng, grime, harshChecker, harshOrphans, hex, luma, mix, monotony, orphans, outlineShare, personVsGround, rgb, spriteOrphans, warmth } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const region = JSON.parse(readFileSync(join(here, '..', 'region.json'), 'utf8'));

const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
let G;
try {
  G = {
    ground: await server.ssrLoadModule('/src/pixel/ground.ts'),
    palette: await server.ssrLoadModule('/src/pixel/palette.ts'),
    master: await server.ssrLoadModule('/src/pixel/master.ts'),
    quant: await server.ssrLoadModule('/src/pixel/quant.ts'),
    shapes: await server.ssrLoadModule('/src/pixel/shapes.ts'),
    px: await server.ssrLoadModule('/src/pixel/px.ts'),
    catalog: await server.ssrLoadModule('/src/pixel/catalog.ts'),
    types: await server.ssrLoadModule('/src/map/types.ts'),
  };
} catch (e) {
  await server.close();
  throw e;
}
await server.close();

const pal = G.palette.paletteOf('spring');
const snapper = new G.quant.Snapper(G.master.MASTER.spring);
const snap = (c) => (A(c) === 255 ? snapper.nearest(c) : c);
const { hash2, vnoise } = G.px;

/** 그림 점 / 맵 점(규칙 ㄱ) */
const K = 2;
const TILE = 16 * K;
const CAM = { x: region.cam.x * K, y: region.cam.y * K };
const VW = Math.round(region.view.w * K);
const VH = region.view.h * K;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ── 빛깔: 지금 게임의 봄 단계(src/pixel/palette.ts)를 그대로 쓴다 ─────────────
const INK = hex('#2a2422'); // 눈동자에만 쓴다(테두리에는 쓰지 않는다)
const GRASS = pal.grass;
const STONE = pal.stone;
const ROOF = pal.tile;
const PLASTER = pal.plaster;
const WOOD = pal.wood;
const THATCH = pal.thatchOld;
const CLAY = pal.clay;
const PAPER = [pal.plaster[1], pal.plaster[3]];
const WATER = pal.water;
const BLOSSOM = pal.blossom;
const FLOWERS = [pal.yellow[2], pal.blossomWhite[2], pal.azalea[3]];
const ONGGI = [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4], CLAY[3]];
const SKIN = G.palette.SKIN.fair;
const HAIR = G.palette.HAIR.black;
const WHITE_HAIR = G.palette.HAIR.white;
const COTTON = G.palette.CLOTH.cotton;
const HEMP = G.palette.CLOTH.hemp;
const EARTH = G.palette.CLOTH.earth;
const ASH = G.palette.CLOTH.ash;
const STRAW = G.palette.CLOTH.straw;
const LIP = hex('#b5564d');
const HEN = [WOOD[1], WOOD[3], WOOD[4], STRAW[2], STRAW[3]];
const COMB = [LIP, hex('#c8463a')];
const BEAK = STRAW[2];
const MAGPIE = [ROOF[0], ROOF[1], ROOF[2], STONE[4], PLASTER[3]];
const WARM_DARK = hex('#4a3020'); // 그늘·테두리를 짙게 할 때 섞는 따뜻한 밤빛(푸름으로 옮기지 않는다 — 규칙 ㅇ)
const WARM_LIGHT = hex('#fff0c4'); // 볕을 밝게 할 때 섞는 금빛

/** 빛깔 → [단계, 자리]: 수채화 얼룩(이웃 단계로만 옮김)과 제 빛깔 테두리를 셈할 때 쓴다 */
const RAMP_OF = new Map();
for (const ramp of [ROOF, PLASTER, STONE, WOOD, THATCH, CLAY, WATER, ONGGI, COTTON, HEMP, EARTH, ASH, STRAW, HAIR, WHITE_HAIR, SKIN, GRASS, BLOSSOM]) {
  ramp.forEach((c, i) => {
    if (!RAMP_OF.has(c)) RAMP_OF.set(c, [ramp, i]);
  });
}

// ── 테두리: 땅·집·나무·소품에는 두르지 않는다. 사람(과 짐승)만 OUTLINE에 따라 ─────────
// 'none' — 두르지 않는다(가). 'soft' — 바깥 한 점을 곁의 빛깔을 짙게 한 빛으로(나 — 검은 선이 아니다).
let OUTLINE = 'none';
function outline(img) {
  if (OUTLINE === 'none') {
    // (가) 선을 두르지 않고, 옷·머리의 가장 바깥 한 점을 제 단계에서 한 칸 어둡게(옷의 그늘로 가른다)
    const src = img.d.slice();
    const { w, h } = img;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(src[y * w + x]) > 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!on(x, y) || (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) continue;
        const info = RAMP_OF.get(src[y * w + x]);
        if (info) img.d[y * w + x] = info[0][Math.max(0, info[1] - 1)];
      }
    }
    return;
  }
  const src = img.d.slice();
  const { w, h } = img;
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (A(at(x, y)) !== 0) continue;
      // 곁의 점: 위(그림의 아랫줄 밑)가 먼저, 다음 옆, 아래
      const near = [at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)].find((c) => A(c) !== 0);
      if (!near) continue;
      const info = RAMP_OF.get(near);
      const dark = info ? info[0][0] : near;
      img.d[y * w + x] = mix(dark, WARM_DARK, 0.6);
    }
  }
}

/**
 * 수채화 같은 얼룩(규칙 ㅌ): 낱그림의 점마다 큰 결과 고운 결의 무늬로 단계를 한 칸 오르내린다(이웃 단계로만 — 규칙 ㄹ).
 * streak가 있으면 그 방향으로 길게 늘인 결(짚, 나뭇결)을 더한다.
 */
function watercolor(img, seed, o = {}) {
  const { w, h } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = img.d[y * w + x];
      if (A(c) !== 255) continue;
      const info = RAMP_OF.get(c);
      if (!info) continue;
      const [ramp, i] = info;
      let n = (vnoise(x / (o.big ?? 8), y / (o.bigY ?? 6.5), seed) - 0.5) * (o.amp ?? 1.7) + (vnoise(x / 2.7, y / 2.3, seed + 1) - 0.5) * (o.fine ?? 0.8);
      if (o.streak) n += (vnoise(x / o.streak[0], y / o.streak[1], seed + 2) - 0.5) * o.streak[2];
      const j = clamp(i + Math.round(n), Math.max(0, i - 1), Math.min(ramp.length - 1, i + 1));
      img.d[y * w + x] = ramp[j];
    }
  }
}

/** 제 빛깔 그늘: 그림의 아래·오른쪽 가장자리는 한 단계 어둡게, 위·왼쪽 가장자리는 한 단계 밝게(그림 안쪽에서 — 선을 두르지 않는다) */
function selfRim(img) {
  const src = img.d.slice();
  const { w, h } = img;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(src[y * w + x]) > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const c = src[y * w + x];
      const info = RAMP_OF.get(c);
      if (!on(x, y + 1) || !on(x + 1, y)) img.d[y * w + x] = info ? info[0][Math.max(0, info[1] - 1)] : mix(c, WARM_DARK, 0.3);
      else if (!on(x, y - 1) || !on(x - 1, y)) img.d[y * w + x] = info ? info[0][Math.min(info[0].length - 1, info[1] + 1)] : mix(c, WARM_LIGHT, 0.2);
    }
  }
}

/** 세운 것 하나를 마무리한다: 수채화 얼룩 → 제 빛깔 그늘 */
const finish = (s, seed, o) => {
  // 때를 잰다(4차): 얼룩을 입히기 전과 견주어 한 칸 어두워진 점의 몫(%)
  const clean = s.img.d.slice();
  watercolor(s.img, seed, o);
  let on = 0;
  let darker = 0;
  for (let i = 0; i < clean.length; i++) {
    if (A(clean[i]) === 0) continue;
    on++;
    const a = RAMP_OF.get(clean[i]);
    const b = RAMP_OF.get(s.img.d[i]);
    if (a && b && b[1] < a[1]) darker++;
  }
  s.washDark = on ? +((darker * 100) / on).toFixed(1) : 0;
  selfRim(s.img);
  calmSprite(s.img);
  return s;
};

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
  // (3차) 담 돌은 크기·높이·빛이 들쭉날쭉하다(손으로 쌓은 맛). 돌 셋에 하나쯤은 누런 흙빛 돌
  const courses = [21, 29, 37, 45];
  courses.forEach((cy0, row) => {
    let x = x0 + 1 + (row % 2) * 5 - 3 - Math.floor(hash2(row, tiles, 70) * 4);
    while (x < x1) {
      const w = 6 + Math.floor(hash2(x, cy0, 71 + tiles) * 11);
      const h = 5 + Math.floor(hash2(x + 3, cy0, 74) * 3);
      const cy = cy0 + (hash2(x, cy0, 75) > 0.66 ? 1 : 0);
      const sx = Math.max(x0 + 1, x);
      const ex = Math.min(x1 - 1, x + w - 1);
      if (ex - sx >= 3) {
        for (let i = sx + 1; i <= ex + 1 && i <= x1; i++) img.set(i, cy + h, PLASTER[1]);
        for (let j = cy + 1; j <= cy + h; j++) if (ex + 1 <= x1) img.set(ex + 1, j, PLASTER[1]);
        const pick = hash2(x, cy0, 72);
        const R = pick > 0.72 ? [CLAY[1], CLAY[2], CLAY[3]] : pick > 0.36 ? [STONE[1], STONE[2], STONE[3]] : [STONE[2], STONE[3], STONE[4]];
        for (let j = 0; j < h; j++) {
          for (let i = sx; i <= ex; i++) {
            const corner = (i === sx || i === ex) && (j === 0 || j === h - 1);
            if (corner) continue;
            let c = R[1];
            if (j === 0 || i === sx) c = R[2];
            if (j === h - 1 || i === ex) c = R[0];
            img.set(i, cy + j, c);
          }
        }
      }
      x += w + 2 + Math.floor(hash2(x, cy0, 76) * 2);
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
  // (3차) 새끼줄 그물은 그리지 않는다 — 짚 결이 흐르게 하는 것은 watercolor의 결(streak)이 맡는다
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


// ── 나무: 지금 게임의 나무갓 코드를 크기만 두 배로 ─────────────────────────────
// (src/pixel/trees.ts의 blossom·oak·leafMasses와 같은 셈. 덩어리의 좌표·반지름·잎 뭉치 크기·줄기 굵기만 두 배)
const { Px } = G.px;
const { canopy, trunk, branch } = G.shapes;
const pxToImg = (px) => {
  const img = new Img(px.w, px.h);
  img.d.set(px.d);
  return img;
};
function jitter(blobs, seed, amount) {
  const rnd = G.px.rngOf(seed * 7919 + 13);
  return blobs.map((b) => ({ ...b, x: b.x + (rnd() - 0.5) * amount * 2, y: b.y + (rnd() - 0.5) * amount, r: b.r + (rnd() - 0.5) * amount }));
}
function blossomTree(variant) {
  const W = 92;
  const H = 104;
  const petals = variant === 1 ? pal.blossomWhite : pal.blossom;
  let blobs = [
    { x: 23, y: 20, r: 12.5, lift: 4 },
    { x: 12, y: 24, r: 8.5, lift: 2 },
    { x: 34, y: 23, r: 8.5, lift: 1 },
    { x: 20, y: 11, r: 8.5, lift: 3 },
    { x: 30, y: 13, r: 7.5, lift: 2 },
    { x: 17, y: 31, r: 6, lift: 5 },
    { x: 30, y: 31, r: 6, lift: 4 },
  ];
  blobs = jitter(blobs, 91 + variant, 1.8).map((b) => ({ x: b.x * 2, y: b.y * 2, r: b.r * 2, lift: b.lift * 2 }));
  if (variant === 2) blobs = blobs.map((b) => ({ ...b, x: W - b.x }));
  const base = new Px(W, H);
  trunk(base, pal.bark, { x: 46, yTop: 56, yBot: 96, wTop: 6, wBot: 10, roots: false, seed: 17 + variant, curve: 2.2 });
  branch(base, pal.bark, 44, 72, 28, 56, 4);
  branch(base, pal.bark, 48, 76, 64, 58, 4);
  const leaves = new Px(W, H);
  canopy(leaves, blobs, petals, { seed: 400 + variant * 23, clump: [10, 8], accent: { ramp: pal.leafWarm, share: 0.07 }, bias: 0.06, crease: 0.13, sparkle: 0.05 });
  base.blit(leaves, 0, 0);
  const img = pxToImg(base);
  selfRim(img);
  calmSprite(img);
  return { img, ax: 46, ay: 97 };
}
const OAK0 = [
  { x: 28, y: 13, r: 11, bias: -0.04 },
  { x: 15, y: 23, r: 10 },
  { x: 41, y: 22, r: 10, bias: -0.06 },
  { x: 28, y: 25, r: 10, bias: 0.04 },
  { x: 19, y: 34, r: 8.5, bias: 0.02 },
  { x: 37, y: 35, r: 8.5, bias: -0.03 },
];
function leafMasses(px, masses, ramp, bark, opts) {
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
  const cx = (x1 + x0) / 2;
  const cy = (y1 + y0) / 2;
  const k = 0.4;
  canopy(px, [{ x: cx, y: cy + 2, r: (x1 - x0) * k, squash: ((y1 - y0) * k) / ((x1 - x0) * k) }], ramp, { seed: opts.seed + 1, clump: opts.clump, bias: -0.36, crease: 0.1 });
  const [fx, fy] = opts.from;
  for (const m of masses) if (m.y <= fy - 8) branch(px, bark, fx, fy, m.x, m.y + m.r * 0.3, m.r > 28 ? 6 : 4);
  [...masses]
    .sort((a, b) => a.y - b.y)
    .forEach((m, i) => {
      const rnd = G.px.rngOf(opts.seed * 31 + i * 7 + 3);
      const blobs = [
        { x: m.x, y: m.y, r: m.r * 0.98, squash: 0.84, lift: 4 },
        { x: m.x - m.r * (0.46 + rnd() * 0.2), y: m.y + m.r * (0.15 + rnd() * 0.2), r: m.r * 0.66, lift: 2 },
        { x: m.x + m.r * (0.46 + rnd() * 0.2), y: m.y + m.r * (0.05 + rnd() * 0.3), r: m.r * 0.66, lift: 0 },
      ];
      const tmp = new Px(px.w, px.h);
      canopy(tmp, blobs, ramp, { seed: opts.seed + 11 * i + 5, clump: opts.clump, bias: m.bias ?? 0, sparkle: 0.03 });
      px.blit(tmp, 0, 0);
    });
}
function oakTree() {
  const W = 112;
  const H = 132;
  const rnd = G.px.rngOf(900);
  const masses = OAK0.map((m) => ({ ...m, x: (m.x + (rnd() - 0.5) * 2) * 2, y: (m.y + (rnd() - 0.5) * 2) * 2, r: m.r * 2 }));
  const base = new Px(W, H);
  trunk(base, pal.bark, { x: 56, yTop: 68, yBot: 124, wTop: 10, wBot: 14, roots: true, seed: 3, curve: 1.4 });
  const leaves = new Px(W, H);
  leafMasses(leaves, masses, pal.leaf, pal.bark, { seed: 100, clump: [10, 8], from: [56, 84] });
  base.blit(leaves, 0, 0);
  const img = pxToImg(base);
  selfRim(img);
  calmSprite(img);
  return { img, ax: 56, ay: 125 };
}

// ── 땅: 지금 게임의 땅 그림 코드를 칸을 둘로 쪼갠 맵에 돌린다 ─────────────────
const CODES = region.tiles.codes;
const TX0 = region.tiles.x0;
const TY0 = region.tiles.y0;
const tw = region.terrain[0].length;
const th = region.terrain.length;
const terr2 = new Uint8Array(tw * 2 * th * 2);
for (let y = 0; y < th * 2; y++) for (let x = 0; x < tw * 2; x++) terr2[y * tw * 2 + x] = CODES.indexOf(region.terrain[y >> 1][x >> 1]);
/** 그림자(맵 점의 Shade)를 쪼갠 맵의 점으로 */
const toLocal = (s) => ({
  ...s,
  cx: (s.cx - TX0 * 16) * 2,
  cy: (s.cy - TY0 * 16) * 2,
  rx: s.rx * 2,
  ry: s.ry * 2,
  cast: s.cast ? { ...s.cast, x0: (s.cast.x0 - TX0 * 16) * 2, x1: (s.cast.x1 - TX0 * 16) * 2, y: (s.cast.y - TY0 * 16) * 2, h: s.cast.h * 2, side: s.cast.side * 2, depth: s.cast.depth * 2 } : undefined,
});
// 세운 것의 그림자는 게임의 것(그 갈래·생김새의 ShadeSpec)을 그대로 쓴다. 사람·짐승의 발밑 그림자도 땅에 칠한다(반투명을 얹지 않는다 — 규칙 ㅂ)
const defs = G.catalog.thingDefs(pal);
const objShades = G.catalog.shadesFor((key) => defs.get(key)?.shades, region.things.map((t) => ({ kind: t.kind, tx: t.tx, ty: t.ty, variant: t.variant })));
const footShades = [
  ...region.people.map((p) => ({ cx: p.x + 1.5, cy: p.y - 0.5, rx: 8, ry: 2.6, strength: 0.42 })),
  ...(region.critters ?? []).map((c) => ({ cx: c.x + 1, cy: c.y, rx: 5, ry: 1.8, strength: 0.38 })),
];
const painted = G.ground.paintGround({ w: tw * 2, h: th * 2, terrain: terr2 }, pal, [...objShades, ...footShades].map(toLocal));
const OX = (region.cam.x - TX0 * 16) * 2;
const OY = (region.cam.y - TY0 * 16) * 2;
const flat = pxToImg(painted.px);
// 칸을 쪼갠 맵이라 길과 풀의 경계가 칸 금을 따라 곧다 — 부드러운 휨(맵 점 ±3)으로 경계를 손으로 그은 듯 구불게 한다.
// 점을 옮겨 놓을 뿐 새 빛을 만들지 않는다
const ground = new Img(VW, VH);
for (let Y = 0; Y < VH; Y++) {
  for (let X = 0; X < VW; X++) {
    const wx = X + CAM.x;
    const wy = Y + CAM.y;
    const dx = Math.round((vnoise(wx / 19, wy / 17, 41) - 0.5) * 12);
    const dy = Math.round((vnoise(wx / 17 + 5, wy / 19, 42) - 0.5) * 10);
    ground.d[Y * VW + X] = flat.get(OX + X + dx, OY + Y + dy);
  }
}
// 따뜻한 큰 얼룩(규칙 ㅌ): 맵 점 스무 칸 남짓의 큰 결로 볕 드는 곳은 금빛으로, 그늘진 곳은 갈색으로 한 단계씩
for (let Y = 0; Y < VH; Y++) {
  for (let X = 0; X < VW; X++) {
    const wx = X + CAM.x;
    const wy = Y + CAM.y;
    const n = vnoise(wx / 46, wy / 38, 31) * 0.6 + vnoise(wx / 20, wy / 17, 32) * 0.4 + (vnoise(wx / 4.5, wy / 3.8, 33) - 0.5) * 0.06;
    const k = Y * VW + X;
    let c = ground.d[k];
    const isDirt = (c & 255) > ((c >> 8) & 255);
    // 풀의 볕은 노란 연두 쪽으로(빛이 바래지 않게), 풀의 그늘은 올리브 갈색 쪽으로 — 푸름으로 옮기지 않는다(규칙 ㅍ)
    if (n > 0.63) c = mix(c, isDirt ? WARM_LIGHT : hex('#d6dc62'), isDirt ? 0.28 : 0.22);
    else if (n < 0.35) c = mix(c, isDirt ? WARM_DARK : hex('#3c4a22'), isDirt ? 0.22 : 0.2);
    // 흙(빨강 > 초록 > 파랑)에는 불그레한 얼룩과 누런 얼룩을 따로 — 흙빛의 색조가 옮겨 간다
    const r = c & 255;
    const g = (c >> 8) & 255;
    const b = (c >> 16) & 255;
    if (r > g && g > b && r - b > 40) {
      const hue = vnoise(wx / 34 + 9, wy / 28, 34);
      if (hue > 0.6) c = mix(c, hex('#a85a36'), 0.26);
      else if (hue < 0.34) c = mix(c, hex('#9c8c78'), 0.2); // 잿빛이 도는 흙(서늘하되 푸르지 않다)
    }
    ground.d[k] = snap(c);
  }
}
// 대비 큰 외톨이 점을 이웃의 빛으로 고른다(고운 결은 남긴다 — 규칙 ㄹ)
function calmHarsh(img, big = 0.12) {
  const { w, h } = img;
  const src = img.d.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = src[y * w + x];
      const votes = new Map();
      let alone = true;
      let nearest = 1;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const q = src[(y + j) * w + x + i];
          if (q === c) alone = false;
          nearest = Math.min(nearest, Math.abs(luma(q) - luma(c)));
          votes.set(q, (votes.get(q) ?? 0) + 1);
        }
      }
      if (alone && nearest > big) img.d[y * w + x] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }
}
calmHarsh(ground);
// 대비 큰 체크무늬(두 빛이 2×2로 엇갈리고 밝기 차가 큰 곳)는 한 빛으로 모은다 — 이웃 단계의 고운 섞임은 남긴다(규칙 ㄷ)
for (let Y = 0; Y < VH - 1; Y++) {
  for (let X = 0; X < VW - 1; X++) {
    const k = Y * VW + X;
    const a = ground.d[k];
    const b = ground.d[k + 1];
    if (a !== b && ground.d[k + VW] === b && ground.d[k + VW + 1] === a && Math.abs(luma(a) - luma(b)) > 0.1) {
      ground.d[k + 1] = a;
      ground.d[k + VW] = a;
    }
  }
}
/** 낱그림 안의 대비 큰 외톨이 점도 고른다(빈 점은 이웃으로 치지 않는다) */
function calmSprite(img, big = 0.14) {
  const { w, h } = img;
  const src = img.d.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = src[y * w + x];
      if (A(c) === 0) continue;
      const votes = new Map();
      let alone = true;
      let nearest = 1;
      let opaque = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const q = src[(y + j) * w + x + i];
          if (A(q) === 0) continue;
          opaque++;
          if (q === c) alone = false;
          nearest = Math.min(nearest, Math.abs(luma(q) - luma(c)));
          votes.set(q, (votes.get(q) ?? 0) + 1);
        }
      }
      if (alone && opaque >= 3 && nearest > big) img.d[y * w + x] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }
}
// 꽃나무 아래 떨어진 꽃잎(두세 점 무리)
function petals(img, cx, cy, ramp) {
  for (let q = 0; q < 26; q++) {
    const a = hash2(q, cx, 71) * Math.PI * 2;
    const r = 10 + hash2(q, cy, 72) * 40;
    const X = Math.round(cx + Math.cos(a) * r * 1.2 + 8);
    const Y = Math.round(cy + Math.sin(a) * r * 0.45 + 4);
    if (X < 1 || Y < 1 || X >= VW - 3 || Y >= VH - 3) continue;
    const c = hash2(q, 3, 73) > 0.4 ? ramp[2] : ramp[3];
    img.set(X, Y, c);
    img.set(X + 1, Y, c);
    if (hash2(q, 4, 74) > 0.5) img.set(X + 1, Y + 1, c);
  }
}

// ── 장면 ──────────────────────────────────────────────────────
const at = (mx, my) => ({ x: mx * K - CAM.x, y: my * K - CAM.y });
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
const statics = [];
const place = (s, mx, my, sortY, extra = {}) => statics.push({ ...s, x: Math.round(mx * K - CAM.x - s.ax), y: Math.round(my * K - CAM.y - s.ay), sortY, ...extra });
let seed = 500;
for (const r of runs('wallH', 'x')) {
  const s = finish(wallRun(r.tx1 - r.tx + 1), seed++, { big: 10, bigY: 5, amp: 1.5 });
  statics.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: (r.ty + 1) * TILE - 2 - CAM.y - s.ay, sortY: (r.ty * 16 + 12) * K, wall: true });
}
for (const r of runs('wallV', 'y')) {
  const len = (r.ty1 - r.ty + 1) * TILE + 20;
  const s = finish(wallColumn(len), seed++, { big: 6, bigY: 10 });
  statics.push({ ...s, x: r.tx * TILE + 16 - 15 - CAM.x, y: (r.ty1 + 1) * TILE - 4 - CAM.y - s.ay, sortY: (r.ty1 * 16 + 12) * K - 1 });
}
for (const r of runs('stonewallH', 'x')) {
  const s = finish(stonewallRun(r.tx1 - r.tx + 1, r.tx), seed++, { big: 5, bigY: 4 });
  statics.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: (r.ty + 1) * TILE - 6 - CAM.y - s.ay, sortY: (r.ty * 16 + 12) * K });
}
for (const r of runs('fenceH', 'x')) {
  const s = finish(fenceRun(r.tx1 - r.tx + 1), seed++, { big: 3, bigY: 12, streak: [1.2, 9, 1.2] });
  statics.push({ ...s, x: r.tx * TILE - 1 - CAM.x, y: (r.ty + 1) * TILE - 8 - CAM.y - s.ay, sortY: (r.ty * 16 + 12) * K });
}
let wellRope = null;
const blossomsAt = [];
for (const t of things) {
  if (['wallH', 'wallV', 'stonewallH', 'fenceH'].includes(t.kind)) continue;
  const sortY = t.ay * K;
  const p = at(t.ax, t.ay);
  if (t.kind === 'gate') place(finish(gate(), seed++, { big: 9, bigY: 6 }), t.ax, t.ay, sortY + 6, { kind: 'gate' });
  else if (t.kind === 'choga') place(finish(choga(), seed++, { big: 9, bigY: 7, amp: 1.5, streak: [1.4, 7, 1.6] }), t.ax, t.ay, sortY, { kind: 'choga' });
  else if (t.kind === 'blossom') {
    place(blossomTree(t.variant), t.ax, t.ay, sortY, { kind: 'blossom' });
    blossomsAt.push({ x: p.x, y: p.y, white: t.variant === 1 });
  } else if (t.kind === 'oak') place(oakTree(), t.ax, t.ay, sortY, { kind: 'oak' });
  else if (t.kind === 'jars') place(finish(jars(t.variant), seed++, { big: 6, bigY: 9, amp: 1.2 }), t.ax, t.ay, sortY, { kind: 'jars' });
  else if (t.kind === 'well') {
    const s = finish(well(), seed++, { big: 6, bigY: 5 });
    place(s, t.ax, t.ay, sortY, { kind: 'well' });
    wellRope = { x: p.x - s.ax + s.rope.x, y: p.y - s.ay + s.rope.y };
  } else if (t.kind === 'flatstone') place(finish(flatstone(), seed++, { big: 7, bigY: 4 }), t.ax, t.ay, sortY);
  else if (t.kind === 'tuft') place(finish(tuft(t.variant), seed++, { big: 4, bigY: 4, amp: 1 }), t.ax, t.ay, sortY);
  else if (t.kind === 'flower') place(finish(flower(t.variant), seed++, { big: 4, bigY: 4, amp: 1 }), t.ax, t.ay, sortY);
  else if (t.kind === 'rockS') place(finish(rockS(t.variant), seed++, { big: 4, bigY: 3 }), t.ax, t.ay, sortY);
}
for (const b of blossomsAt) petals(ground, b.x, b.y, b.white ? pal.blossomWhite : pal.blossom);

/** 사람과 짐승을 그 테두리 안(가·나)으로 그려 장면을 맞춘다 */
function render(mode) {
  OUTLINE = mode;
  const sprites = [...statics];
  const PEOPLE = { hero: heroBoy(), elder: elderMan(), woman: wellWoman() };
  for (const p of region.people) {
    const s = PEOPLE[p.id];
    sprites.push({ ...s, x: Math.round(p.x * K - CAM.x - s.ax), y: Math.round(p.y * K - CAM.y - s.ay), sortY: p.y * K, person: p.id });
  }
  // 짐승은 두 안 모두 부드러운 테두리(작아서 테두리 없이는 바닥에 묻힌다)
  OUTLINE = 'soft';
  const CRITTERS = { hen: hen(), magpie: magpie() };
  for (const c of region.critters ?? []) {
    const s = CRITTERS[c.sprite];
    if (!s) continue;
    const flip = c.sprite === 'hen' ? c.flip : !c.flip;
    const img = flip
      ? (() => {
          const o = new Img(s.img.w, s.img.h);
          o.blit(s.img, 0, 0, true);
          return o;
        })()
      : s.img;
    const ax = flip ? s.img.w - 1 - s.ax : s.ax;
    sprites.push({ img, ax, ay: s.ay, x: Math.round(c.x * K - CAM.x - ax), y: Math.round(c.y * K - CAM.y - s.ay), sortY: c.y * K });
  }
  OUTLINE = mode;
  const scene = ground.crop(0, 0, VW, VH);
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const s of sprites) scene.blit(s.img, s.x, s.y);
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
  // 모든 점을 지금 게임의 봄 64색 벌에 맞춘다(규칙 ㅇ)
  for (let i = 0; i < scene.d.length; i++) scene.d[i] = snap(scene.d[i]);
  for (const s of sprites) for (let i = 0; i < s.img.d.length; i++) s.img.d[i] = snap(s.img.d[i]);
  return { scene, sprites };
}

const closeRow = (scene) => {
  const C = region.close;
  const closeups = region.people.map((p) => scene.crop(p.x * K - CAM.x - C.w, p.y * K - CAM.y - C.up * K, C.w * K, C.h * K).scale(6));
  const gap = 24;
  const row = new Img(closeups.length * closeups[0].w + (closeups.length - 1) * gap, closeups[0].h);
  row.rect(0, 0, row.w, row.h, rgb(244, 236, 217));
  closeups.forEach((c, i) => row.blit(c, i * (c.w + gap), 0));
  return row;
};
const peopleMetrics = (sprites) => {
  const out = {};
  for (const s of sprites.filter((q) => q.person)) out[s.person] = { outlineShare: outlineShare(s.img), orphansPer1000: spriteOrphans(s.img), edgeContrast: edgeContrast(s.img, s.x, s.y, groundSnapped), ...personVsGround(s.img, s.x, s.y, groundSnapped, 4 * K) };
  return out;
};
const groundSnapped = ground.crop(0, 0, VW, VH);
for (let i = 0; i < groundSnapped.d.length; i++) groundSnapped.d[i] = snap(groundSnapped.d[i]);
const A_ = render('none');
const B_ = render('soft');
writeFileSync(join(here, 'v3-scene-a.png'), encodePng(A_.scene.scale(3)));
writeFileSync(join(here, 'v3-scene.png'), encodePng(B_.scene.scale(3)));
writeFileSync(join(here, 'v3-people-a.png'), encodePng(closeRow(A_.scene)));
writeFileSync(join(here, 'v3-people-b.png'), encodePng(closeRow(B_.scene)));

const metrics = {
  note: '3차 시안(2배, 타일 32점). 그림 점 단위로 잰다. 장면은 (나) 부드러운 테두리 안. 사람은 (가)·(나) 둘 다.',
  warmth: warmth(B_.scene.scale(3)),
  warmthA: warmth(A_.scene.scale(3)),
  groundOrphans: orphans(ground, TILE),
  groundHarsh: harshOrphans(ground),
  groundChecker: checker(ground),
  groundHarshChecker: harshChecker(ground),
  monotony: monotony(ground, region, K),
  sceneColors: colorCount(B_.scene),
  thingOrphansPer1000: Object.fromEntries(B_.sprites.filter((s) => s.kind).map((s) => [s.kind, spriteOrphans(s.img)])),
  thingHarshPer1000: Object.fromEntries(B_.sprites.filter((s) => s.kind).map((s) => [s.kind, harshOrphans(s.img)])),
  thingGrime: { gate: grime(B_.sprites.find((s) => s.kind === 'gate').img, K), choga: grime(B_.sprites.find((s) => s.kind === 'choga').img, K), wall: grime(B_.sprites.find((s) => s.wall).img, K) },
  washDarkPct: { gate: B_.sprites.find((s) => s.kind === 'gate').washDark, choga: B_.sprites.find((s) => s.kind === 'choga').washDark, wall: B_.sprites.find((s) => s.wall).washDark },
  blotch: blotch(ground, region, K),
  peopleA: peopleMetrics(A_.sprites),
  peopleB: peopleMetrics(B_.sprites),
};
writeFileSync(join(here, 'v3-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics, null, 2));
console.log('→ v3-scene.png((나)), v3-scene-a.png((가)), v3-people-a.png, v3-people-b.png, v3-metrics.json');
