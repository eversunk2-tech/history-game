// 맵을 캔버스에 그린다. 셈은 world.ts가 하고, 여기서는 그 상태를 읽어 그리기만 한다.
//
// 또렷함: 맵 점 하나는 기기 화소 scale개(짝수), 그림 점 하나는 scale ÷ ART개(정수)다. 화면의 좌표는 모두 정수로 맞춘다.
//   자리(발치, 사람의 발, 날리는 것)는 맵 점으로 셈하고, 그림의 크기와 그림 안의 발치는 그림 점으로 셈한다(spec 4.7.5).
//   바탕(땅)과 세운 것은 그림의 점 격자에 맞고, 화면 따라가기와 걷는 사람은 기기 화소 단위로 움직여 끊기지 않는다.
// 빠르기: 바뀌지 않는 땅은 미리 한 장으로 그려 두고(ground), 화면에 보이는 것만 그린다.
//   그리는 차례: 물결 → 땅 → 바람결과 논물의 반짝임 → 땅바닥에 깔린 것 → 세운 것과 사람(아래쪽에 있는 것이 나중)
//     → 구름 그림자 → 날리는 것(연기, 꽃잎·가랑잎·눈, 나비·잠자리, 비) → 표시 → 계절과 하루의 빛.
// 계절: 그림 벌(atlas)과 맵이 그 계절의 것이다. 여기서는 그 계절의 날림만 가른다(봄 꽃잎, 여름 잠자리, 가을 가랑잎, 겨울 눈, 큰비).

import { anchorOf, thingKey } from '../pixel/catalog';
import { MASK_CELL, WATER_TILE, critterImg, groundCanvas, paintAround, personCanvas, shadesOf, thingImg, type Atlas, type GroundCanvas, type Img } from '../pixel/atlas';
import { GROUND_TILE } from '../pixel/ground';
import { COL, DIRS, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W } from '../pixel/people';
import { ART, clamp, hash2, mix } from '../pixel/px';
import { closedGates } from './gates';
import { thing } from './things';
import { T, TILE, type MapData } from './types';
import { spotPoint, type Actor, type World } from './world';

interface Static {
  img: Img;
  /** 그림의 왼쪽 위(맵의 점 — 그림 점의 반이 남을 수 있다) */
  x: number;
  y: number;
  sortY: number;
  tall: boolean;
  sways: boolean;
  phase: number;
  /** 주인공이 뒤에 있을 때 비쳐 보이는 정도(1 = 가리지 않음) */
  alpha: number;
  kind: string;
}

interface Puff {
  x: number;
  y: number;
  age: number;
  life: number;
  drift: number;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  sprite: number;
  phase: number;
}

interface Flutter {
  hx: number;
  hy: number;
  phase: number;
  tone: number;
}

/** 빗방울 하나: (gx, gy)의 땅에 떨어진다 */
interface Drop {
  gx: number;
  gy: number;
  /** 땅까지 남은 높이(점) */
  up: number;
  sprite: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
}

export interface Scene {
  map: MapData;
  atlas: Atlas;
  /** 땅(그림 점의 한 장 — 조각으로 나눠 칠한다) */
  ground: GroundCanvas;
  wet: Uint8Array;
  glint: Uint8Array;
  statics: Static[];
  /** 땅바닥에 깔린 것(씨름판의 모래, 멍석): 사람과 세운 것보다 먼저 그린다 */
  flats: Static[];
  /** 칸마다: 벼가 서 있는 논인가(바람에 물결친다) */
  crop: Uint8Array;
  /** 굴뚝(연기가 나는 곳) */
  chimneys: { x: number; y: number; next: number }[];
  /** 꽃나무(꽃잎이 날리는 곳) */
  blossoms: { x: number; y: number }[];
  /** 가을: 잎이 지는 나무(가랑잎이 날리기 시작하는 곳) */
  leafy: { x: number; y: number }[];
  puffs: Puff[];
  petals: Petal[];
  flutters: Flutter[];
  /** 여름: 논과 물가 위를 떠다니는 잠자리 */
  hovers: Flutter[];
  /** 비 */
  drops: Drop[];
  splashes: Splash[];
  rainDebt: number;
  /** 날리는 것의 자리를 뽑는 수(씨앗) */
  dice: number;
  clouds: { x: number; y: number; speed: number }[];
  /** 가끔 화면을 가로질러 날아가는 새 떼 */
  flock: { x: number; y: number; vx: number; vy: number; n: number } | null;
  flockWait: number;
  shown: (Static | Actor)[];
}

/** 맵의 땅 캔버스(아직 칠하지 않았다 — 그리기가 보이는 조각부터 칠한다) */
export function groundFor(map: MapData, atlas: Atlas): GroundCanvas {
  return groundCanvas(atlas, map, shadesOf(atlas, map.objects));
}

export function buildScene(map: MapData, atlas: Atlas, world: World, ground: GroundCanvas = groundFor(map, atlas)): Scene {
  return sceneFrom(map, atlas, world, ground);
}

function sceneFrom(map: MapData, atlas: Atlas, world: World, ground: GroundCanvas): Scene {
  const statics: Static[] = [];
  const flats: Static[] = [];
  const chimneys: Scene['chimneys'] = [];
  const blossoms: Scene['blossoms'] = [];
  const leafy: Scene['leafy'] = [];
  const sheds = atlas.pal.drift === 'leaf';
  // 문에 딸린 문짝은 그 문이 닫힌 사람에게 닫힌 모습(variant 1)으로 보인다
  const shutIds = new Set(closedGates(map, world.who).map((c) => c.gate.id));
  for (const o of map.objects) {
    const variant = o.gate ? (shutIds.has(o.gate) ? 1 : 0) : o.variant;
    const img = thingImg(atlas, thingKey(o.kind, variant));
    if (!img) continue;
    const def = thing(o.kind);
    const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
    const x = at.x - img.ax / ART;
    const y = at.y - img.ay / ART;
    (def.flat ? flats : statics).push({
      img,
      x,
      y,
      sortY: at.y + img.sort,
      tall: Boolean(def.tall),
      sways: Boolean(def.sways || def.moves) && img.n > 1,
      phase: def.moves ? 0 : hash2(o.tx, o.ty, 5) * 4 + o.tx / 9,
      alpha: 1,
      kind: o.kind,
    });
    if (img.smoke) chimneys.push({ x: x + img.smoke.x / ART, y: y + img.smoke.y / ART, next: hash2(o.tx, o.ty, 6) });
    if (o.kind === 'blossom') blossoms.push({ x: at.x, y: at.y - 30 });
    // 가을: 넓은 잎 나무에서 잎이 진다(솔은 지지 않는다)
    if (sheds && LEAF_TREES.has(o.kind)) leafy.push({ x: at.x, y: at.y - (img.h / ART) * 0.55 });
  }
  statics.sort((a, b) => a.sortY - b.sortY);
  flats.sort((a, b) => a.sortY - b.sortY);

  // 나비: 꽃이 많은 곳에 산다
  const flutters: Flutter[] = [];
  if (atlas.pal.flowers) {
    for (const o of map.objects) {
      if (o.kind !== 'flower' || hash2(o.tx, o.ty, 9) > 0.16) continue;
      flutters.push({ hx: o.tx * TILE + 8, hy: o.ty * TILE + 4, phase: hash2(o.tx, o.ty, 10) * 30, tone: hash2(o.tx, o.ty, 11) > 0.5 ? 1 : 0 });
    }
  }
  // 잠자리: 맑은 여름의 논과 물가 위에 떠 있다
  const hovers: Flutter[] = [];
  if (atlas.season === 'summer' && !atlas.pal.rain) {
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const t = map.terrain[ty * map.w + tx];
        const over = t === T.paddy || t === T.soil ? 0.05 : t === T.shallow || t === T.ridge ? 0.028 : t === T.meadow ? 0.012 : 0;
        if (hash2(tx, ty, 14) >= over) continue;
        hovers.push({ hx: tx * TILE + 8, hy: ty * TILE + 2, phase: hash2(tx, ty, 15) * 40, tone: hash2(tx, ty, 16) > 0.45 ? 0 : 1 });
      }
    }
  }
  const W = map.w * TILE;
  const H = map.h * TILE;
  return {
    map,
    atlas,
    ground,
    wet: ground.wet,
    glint: ground.glint,
    statics,
    flats,
    crop: ground.crop,
    chimneys,
    blossoms,
    leafy,
    puffs: [],
    petals: [],
    flutters,
    hovers,
    drops: [],
    splashes: [],
    rainDebt: 0,
    dice: 1395,
    clouds: [
      { x: W * 0.1, y: H * 0.2, speed: 14 },
      { x: W * 0.55, y: H * 0.5, speed: 18 },
      { x: W * 0.8, y: H * 0.1, speed: 12 },
      { x: W * 0.3, y: H * 0.8, speed: 16 },
      { x: W * 0.02, y: H * 0.45, speed: 20 },
      { x: W * 0.65, y: H * 0.28, speed: 15 },
    ],
    flock: null,
    flockWait: 5,
    shown: [],
  };
}

export interface View {
  ctx: CanvasRenderingContext2D;
  /** 캔버스 크기(기기 화소) */
  w: number;
  h: number;
  /** 그림의 점 하나가 기기 화소 몇 개인가(정수) */
  scale: number;
}

const isActor = (it: Static | Actor): it is Actor => 'sprite' in it;

/** 가을에 잎이 지는 나무 */
const LEAF_TREES = new Set(['oak', 'young', 'blossom', 'willow', 'zelkova', 'bigtree']);

/** 0 이상 1 미만의 수를 차례로 뽑는다(날리는 것의 자리. 맵의 셈에는 쓰지 않는다) */
function roll(scene: Scene): number {
  scene.dice = (Math.imul(scene.dice, 1664525) + 1013904223) >>> 0;
  return scene.dice / 4294967296;
}

/** 움직이는 것들(연기, 꽃잎)의 시간을 흘린다 */
export function stepScene(scene: Scene, world: World, dt: number): void {
  const { cam, view } = world;
  const x0 = cam.x - 40;
  const x1 = cam.x + view.w + 40;
  const y0 = cam.y - 40;
  const y1 = cam.y + view.h + 60;
  // 굴뚝 연기
  for (const c of scene.chimneys) {
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    c.next -= dt;
    if (c.next <= 0) {
      c.next = 0.3 + hash2(Math.floor(world.time * 10), c.x, 21) * 0.3;
      scene.puffs.push({ x: c.x, y: c.y, age: 0, life: 4.4, drift: (hash2(Math.floor(world.time * 7), c.y, 22) - 0.3) * 6 });
    }
  }
  for (const p of scene.puffs) {
    p.age += dt;
    p.y -= Math.max(3, 17 - p.age * 3) * dt;
    p.x += (4 + p.drift + p.age * 4) * dt;
  }
  scene.puffs = scene.puffs.filter((p) => p.age < p.life);

  // 날리는 것: 봄에는 꽃잎이 꽃나무에서, 가을에는 가랑잎이 나무에서 떨어지고, 겨울에는 눈이 화면 가득 내린다
  const n = scene.atlas.drift.length;
  const drift = scene.atlas.pal.drift;
  if (n > 0) {
    const snow = drift === 'snow';
    const want = snow ? Math.min(150, Math.round((view.w * view.h) / 620)) : drift === 'leaf' ? 22 : 16;
    const sources = drift === 'petal' ? scene.blossoms : drift === 'leaf' ? scene.leafy : [];
    let guard = 0;
    while (scene.petals.length < want && guard++ < (snow ? 10 : 4)) {
      const seed = Math.floor(world.time * 60) + scene.petals.length * 17 + guard;
      const fromTree = sources.length > 0 && hash2(seed, 1, 31) < (drift === 'leaf' ? 0.7 : 0.55);
      let x = cam.x + hash2(seed, 2, 32) * (view.w + 80) - 80;
      let y = cam.y - 10 + hash2(seed, 3, 33) * view.h * (snow ? 0.95 : 0.6);
      if (fromTree) {
        const near = sources.filter((b) => b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1);
        if (near.length > 0) {
          const b = near[Math.floor(hash2(seed, 4, 34) * near.length)];
          x = b.x + (hash2(seed, 5, 35) - 0.5) * 26;
          y = b.y + (hash2(seed, 6, 36) - 0.5) * 16;
        }
      }
      scene.petals.push({
        x,
        y,
        vx: snow ? -7 + hash2(seed, 7, 37) * 9 : 12 + hash2(seed, 7, 37) * 12,
        vy: snow ? 13 + hash2(seed, 8, 38) * 13 : 8 + hash2(seed, 8, 38) * 9,
        age: 0,
        life: 4.5 + hash2(seed, 9, 39) * 4,
        sprite: Math.floor(hash2(seed, 10, 40) * n),
        phase: hash2(seed, 11, 41) * 6,
      });
    }
    const swing = snow ? 5 : 9;
    for (const p of scene.petals) {
      p.age += dt;
      p.x += (p.vx + Math.sin(p.age * 2.2 + p.phase) * swing) * dt;
      p.y += (p.vy + Math.cos(p.age * 1.7 + p.phase) * 4) * dt;
    }
    scene.petals = scene.petals.filter((p) => p.age < p.life && p.x < x1 + 30 && p.x > x0 - 60 && p.y < y1 + 30);
  }

  // 비: 빗줄기가 비스듬히 떨어져 땅에 닿으면 물방울이 튄다. 화면의 넓이만큼만 뿌린다.
  // 큰비가 온 해라도 단옷날에는 비가 잠깐 멎는다(맵이 정한다 — map.raining)
  if (scene.map.raining) {
    const FALL = 330;
    scene.rainDebt += dt * Math.min(520, (view.w * view.h) / 190);
    let guard = 0;
    while (scene.rainDebt >= 1 && guard++ < 24) {
      scene.rainDebt -= 1;
      scene.drops.push({
        gx: cam.x - 20 + roll(scene) * (view.w + 60),
        gy: cam.y - 10 + roll(scene) * (view.h + 40),
        up: 70 + roll(scene) * 90,
        sprite: Math.floor(roll(scene) * scene.atlas.rain.length),
      });
    }
    if (guard >= 24) scene.rainDebt = 0;
    let kept = 0;
    for (const d of scene.drops) {
      d.up -= FALL * dt;
      if (d.up > 0) scene.drops[kept++] = d;
      else if (roll(scene) < 0.55 && scene.splashes.length < 160) scene.splashes.push({ x: d.gx, y: d.gy, age: 0 });
    }
    scene.drops.length = kept;
    kept = 0;
    for (const sp of scene.splashes) {
      sp.age += dt;
      if (sp.age < 0.27) scene.splashes[kept++] = sp;
    }
    scene.splashes.length = kept;
  }

  // 새 떼: 화면 왼쪽 밖에서 나타나 오른쪽으로 날아간다
  if (scene.flock) {
    scene.flock.x += scene.flock.vx * dt;
    scene.flock.y += scene.flock.vy * dt;
    if (scene.flock.x > x1 + 120) {
      scene.flock = null;
      scene.flockWait = 9 + hash2(Math.floor(world.time), 3, 71) * 9;
    }
  } else {
    scene.flockWait -= dt;
    if (scene.flockWait <= 0) {
      const seed = Math.floor(world.time * 10);
      scene.flock = {
        x: cam.x - 20,
        y: cam.y + view.h * (0.12 + hash2(seed, 1, 72) * 0.5),
        vx: 52 + hash2(seed, 2, 73) * 22,
        vy: (hash2(seed, 3, 74) - 0.6) * 12,
        n: 3 + Math.floor(hash2(seed, 4, 75) * 4),
      };
    }
  }

  // 구름 그림자
  const W = scene.map.w * TILE;
  for (const c of scene.clouds) {
    c.x += c.speed * dt;
    if (c.x > W + 40) c.x = -340;
  }

  // 주인공이 뒤에 선 큰 것은 비쳐 보이게
  // (곁에 서기만 해서는 비치지 않는다. 주인공의 몸이 그림의 찍힌 점과 실제로 겹칠 때만)
  const p = world.player;
  const bx0 = p.x - 6;
  const bx1 = p.x + 6;
  const by0 = p.y - 24;
  const by1 = p.y - 2;
  for (const s of scene.statics) {
    if (!s.tall) continue;
    let want = 1;
    if (p.y < s.sortY && bx1 > s.x && bx0 < s.x + s.img.w / ART && by1 > s.y && by0 < s.y + s.img.h / ART && hides(s.img, bx0 - s.x, by0 - s.y, bx1 - s.x, by1 - s.y)) {
      want = 0.45;
    }
    if (s.alpha !== want) {
      const k = Math.min(1, dt * 9);
      s.alpha += (want - s.alpha) * k;
      if (Math.abs(s.alpha - want) < 0.02) s.alpha = want;
    }
  }
}

/** 그림 안의 네모(맵 점 — 그림의 왼쪽 위에서)가 찍힌 점으로 셋에 하나 넘게 덮여 있는가. 마스크는 그림 점이다. */
function hides(img: Img, mx0: number, my0: number, mx1: number, my1: number): boolean {
  const x0 = mx0 * ART;
  const y0 = my0 * ART;
  const x1 = mx1 * ART;
  const y1 = my1 * ART;
  const C = MASK_CELL;
  const cx0 = Math.max(0, Math.floor(x0 / C));
  const cy0 = Math.max(0, Math.floor(y0 / C));
  const cx1 = Math.min(img.mw - 1, Math.floor(x1 / C));
  const cy1 = Math.min(img.mh - 1, Math.floor(y1 / C));
  let on = 0;
  let all = 0;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      all++;
      if (img.mask[cy * img.mw + cx] === 1) on++;
    }
  }
  // 몸 네모가 그림 밖으로 나간 몫까지 쳐서 셋에 하나
  const whole = (Math.floor(x1 / C) - Math.floor(x0 / C) + 1) * (Math.floor(y1 / C) - Math.floor(y0 / C) + 1);
  return all > 0 && on * 3 >= whole;
}

export function render(view: View, world: World, scene: Scene): void {
  const { ctx, scale: s } = view;
  /** 그림 점 하나의 기기 화소 */
  const m = s / ART;
  const { atlas, map } = scene;
  // 화면과 주인공을 따로 반올림하면 큰 배율에서 주인공이 한 화소씩 떨린다.
  // 주인공이 화면의 어디에 찍힐지를 먼저 정수로 정하고, 거기서 화면 자리를 거꾸로 셈한다.
  const hero = world.player;
  const camX = Math.round(hero.x * s) - Math.round((hero.x - world.cam.x) * s);
  const camY = Math.round(hero.y * s) - Math.round((hero.y - world.cam.y) * s);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;

  const vx0 = world.cam.x;
  const vy0 = world.cam.y;
  const vx1 = vx0 + view.w / s;
  const vy1 = vy0 + view.h / s;
  const tx0 = Math.max(0, Math.floor(vx0 / TILE));
  const ty0 = Math.max(0, Math.floor(vy0 / TILE));
  const tx1 = Math.min(map.w - 1, Math.floor(vx1 / TILE));
  const ty1 = Math.min(map.h - 1, Math.floor(vy1 / TILE));

  // 보이는 땅의 조각을 아직 칠하지 않았으면 지금 칠한다(물결을 깔 칸도 칠한 뒤에야 안다)
  paintAround(scene.ground, vx0, vy0, vx1, vy1);

  // 맵이 화면보다 작을 때의 바깥
  ctx.fillStyle = '#1d2a25';
  if (camX < 0 || camY < 0 || map.w * TILE * s - camX < view.w || map.h * TILE * s - camY < view.h) ctx.fillRect(0, 0, view.w, view.h);

  // 1. 물결
  // 불어난 냇물은 빠르게 흐른다
  const wf = Math.floor(world.time * (atlas.pal.rain ? 12 : 7)) % atlas.waterN;
  const ts = TILE * s;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (scene.wet[ty * map.w + tx] === 0) continue;
      ctx.drawImage(atlas.water, wf * WATER_TILE + ((tx * GROUND_TILE) % WATER_TILE), (ty * GROUND_TILE) % WATER_TILE, GROUND_TILE, GROUND_TILE, tx * ts - camX, ty * ts - camY, ts, ts);
    }
  }

  // 2. 땅
  const gc = scene.ground.canvas;
  const gx = Math.max(0, Math.floor(vx0));
  const gy = Math.max(0, Math.floor(vy0));
  const gw = Math.min(gc.width / ART - gx, Math.ceil(view.w / s) + 2);
  const gh = Math.min(gc.height / ART - gy, Math.ceil(view.h / s) + 2);
  if (gw > 0 && gh > 0) ctx.drawImage(gc, gx * ART, gy * ART, gw * ART, gh * ART, gx * s - camX, gy * s - camY, gw * s, gh * s);

  // 풀밭을 지나가는 바람결: 밝은 풀결의 띠가 비스듬히 흘러간다. 논물에는 잔물결이 인다.
  const gust = atlas.gust;
  const rip = atlas.ripple;
  const cropGust = atlas.cropGust;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * map.w + tx;
      const t = map.terrain[i];
      const grassy = t === T.grass || t === T.meadow;
      const rice = scene.crop[i] === 1;
      if (!grassy && !rice && scene.glint[i] === 0) continue;
      if (grassy && map.blocked[i] === 1) continue;
      // 풀밭의 바람결은 넓고 성기게, 논의 벼는 잦고 촘촘하게 물결친다
      const along = grassy ? tx * 0.9 + ty * 0.5 - world.time * 5.5 : rice ? tx * 0.8 + ty * 0.4 - world.time * 4.4 : tx * 0.6 - ty * 0.8 - world.time * 2.2;
      const period = grassy ? 19 : rice ? 11 : 8;
      const u = ((along % period) + period) % period;
      const width = grassy ? 4.5 : rice ? 4 : 3;
      if (u >= width) continue;
      const turn = Math.floor(along / period);
      if (hash2(tx + turn * 7, ty, 61) > (grassy ? 0.62 : rice ? 0.86 : 0.7)) continue;
      const img = grassy ? gust : rice ? cropGust : rip;
      const f = Math.min(img.n - 1, Math.floor((u / width) * img.n));
      const px = tx * TILE + 1 + Math.floor(hash2(tx, ty + turn, 62) * 8);
      const py = ty * TILE + 3 + Math.floor(hash2(tx + turn, ty, 63) * 9);
      ctx.drawImage(img.canvas, f * img.w, 0, img.w, img.h, px * s - camX, py * s - camY, img.w * m, img.h * m);
    }
  }

  // 3. 논물의 반짝임(비 오는 날에는 볕이 없어 반짝이지 않는다)
  const g = atlas.glint;
  for (let ty = ty0; ty <= ty1 && !atlas.pal.rain; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (scene.glint[ty * map.w + tx] === 0) continue;
      const period = 3.2 + hash2(tx, ty, 51) * 3;
      const t = (world.time + hash2(tx, ty, 52) * period) % period;
      if (t > 0.6) continue;
      const turn = Math.floor((world.time + hash2(tx, ty, 52) * period) / period);
      const px = tx * TILE + 2 + Math.floor(hash2(tx + turn, ty, 53) * 11);
      const py = ty * TILE + 2 + Math.floor(hash2(tx, ty + turn, 54) * 11);
      const f = t < 0.15 ? 0 : t < 0.3 ? 1 : t < 0.45 ? 2 : 1;
      ctx.drawImage(g.canvas, f * g.w, 0, g.w, g.h, px * s - g.ax * m - camX, py * s - g.ay * m - camY, g.w * m, g.h * m);
    }
  }

  // 누른 곳의 표시(땅 위)
  if (world.target) {
    const r = atlas.rings;
    const f = Math.floor(world.target.t * 5) % 2;
    ctx.drawImage(
      r.canvas,
      f * r.w,
      0,
      r.w,
      r.h,
      Math.round(world.target.x * s - r.ax * m) - camX,
      Math.round(world.target.y * s - r.ay * m) - camY,
      r.w * m,
      r.h * m,
    );
  }

  // 땅바닥에 깔린 것(씨름판의 모래, 멍석)
  for (const it of scene.flats) {
    if (it.x > vx1 || it.x + it.img.w / ART < vx0 || it.y > vy1 || it.y + it.img.h / ART < vy0) continue;
    ctx.drawImage(it.img.canvas, 0, 0, it.img.w, it.img.h, it.x * s - camX, it.y * s - camY, it.img.w * m, it.img.h * m);
  }

  // 4. 세운 것과 사람: 아래쪽에 있는 것을 나중에 그린다
  const shown = scene.shown;
  shown.length = 0;
  const list = scene.statics;
  // sortY가 화면 위 끝보다 조금 위인 것부터
  let lo = 0;
  let hi = list.length;
  const top = vy0 - 6;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].sortY < top) lo = mid + 1;
    else hi = mid;
  }
  const bottom = vy1 + 150;
  for (let i = lo; i < list.length; i++) {
    const it = list[i];
    if (it.sortY > bottom) break;
    if (it.x > vx1 || it.x + it.img.w / ART < vx0 || it.y > vy1) continue;
    shown.push(it);
  }
  for (const a of world.actors) {
    if (a.hidden) continue;
    if (a.x < vx0 - 50 || a.x > vx1 + 50 || a.y < vy0 - 20 || a.y - a.lift > vy1 + 60) continue;
    shown.push(a);
  }
  shown.push(world.player);
  // 앉은 사람은 깔고 앉은 돌보다 나중에 그린다
  const keyOf = (it: Static | Actor): number => (isActor(it) ? it.y + (it.act === 'sit' ? 8 : 0) : it.sortY);
  shown.sort((a, b) => keyOf(a) - keyOf(b));
  for (const it of shown) {
    if (isActor(it)) drawActor(view, world, scene, it, camX, camY);
    else {
      const img = it.img;
      let frame = 0;
      if (it.sways) frame = img.seq[Math.floor(world.time * img.rate + it.phase) % img.seq.length];
      if (it.alpha < 1) ctx.globalAlpha = it.alpha;
      ctx.drawImage(img.canvas, frame * img.w, 0, img.w, img.h, it.x * s - camX, it.y * s - camY, img.w * m, img.h * m);
      if (it.alpha < 1) ctx.globalAlpha = 1;
    }
  }

  // 5. 구름 그림자(비 오는 날에는 하늘이 온통 흐려 따로 지지 않는다)
  const cl = atlas.cloud;
  for (const c of scene.clouds) {
    // 구름 그림자는 그 그림을 맵 점 두 배로 넓게 깐다(그림 점 하나 = 맵 점 하나)
    if (atlas.pal.rain || c.x > vx1 || c.x + cl.w < vx0 || c.y > vy1 || c.y + cl.h < vy0) continue;
    ctx.drawImage(cl.canvas, 0, 0, cl.w, cl.h, Math.round(c.x * s) - camX, Math.round(c.y * s) - camY, cl.w * s, cl.h * s);
  }

  // 6. 날리는 것: 연기, 꽃잎, 나비
  for (const p of scene.puffs) {
    const k = p.age / p.life;
    const img = atlas.smoke[k < 0.16 ? 0 : k < 0.45 ? 1 : 2];
    ctx.globalAlpha = (k < 0.12 ? k / 0.12 : Math.max(0, 1 - (k - 0.12) / 0.88)) * 0.85;
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round(p.x * s - img.ax * m) - camX, Math.round(p.y * s - img.ay * m) - camY, img.w * m, img.h * m);
  }
  ctx.globalAlpha = 1;
  for (const p of scene.petals) {
    const img = atlas.drift[p.sprite];
    const k = p.age / p.life;
    if (k > 0.85) ctx.globalAlpha = Math.max(0, (1 - k) / 0.15);
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round(p.x * s) - camX, Math.round(p.y * s) - camY, img.w * m, img.h * m);
    if (k > 0.85) ctx.globalAlpha = 1;
  }
  for (const f of scene.flutters) {
    const t = world.time * 0.5 + f.phase;
    const x = f.hx + Math.sin(t * 1.3) * 22 + Math.sin(t * 3.1) * 6;
    const y = f.hy + Math.cos(t * 1.7) * 12 + Math.sin(t * 4.3) * 3 - 8;
    if (x < vx0 - 8 || x > vx1 + 8 || y < vy0 - 8 || y > vy1 + 8) continue;
    const img = atlas.butterflies[f.tone];
    const fr = Math.floor(world.time * 9 + f.phase) % 2;
    ctx.drawImage(img.canvas, fr * img.w, 0, img.w, img.h, Math.round(x * s) - camX, Math.round(y * s) - camY, img.w * m, img.h * m);
  }

  // 잠자리: 한자리에 떠 있다가 휙 옮겨 가기를 되풀이한다
  for (const f of scene.hovers) {
    if (f.hx < vx0 - 60 || f.hx > vx1 + 60 || f.hy < vy0 - 50 || f.hy > vy1 + 50) continue;
    const t = world.time / 1.7 + f.phase;
    const k = Math.floor(t);
    const u = t - k;
    // 처음 5분의 1 동안 휙 날아가고 나머지는 떠 있다
    const e = u < 0.2 ? 1 - (1 - u / 0.2) * (1 - u / 0.2) : 1;
    const ax = (hash2(k, f.hx, 81) - 0.5) * 64;
    const ay = (hash2(k, f.hy, 82) - 0.5) * 34;
    const bx = (hash2(k + 1, f.hx, 81) - 0.5) * 64;
    const by = (hash2(k + 1, f.hy, 82) - 0.5) * 34;
    const x = f.hx + ax + (bx - ax) * e + Math.sin(world.time * 9 + f.phase) * 0.6;
    const y = f.hy - 9 + ay + (by - ay) * e;
    if (x < vx0 - 8 || x > vx1 + 8 || y < vy0 - 8 || y > vy1 + 8) continue;
    const img = atlas.dragonflies[f.tone];
    const fr = Math.floor(world.time * 16 + f.phase) % 2;
    ctx.drawImage(img.canvas, fr * img.w, 0, img.w, img.h, Math.round(x * s - img.ax * m) - camX, Math.round(y * s - img.ay * m) - camY, img.w * m, img.h * m);
  }

  // 비: 땅에 튀는 물방울과 빗줄기
  if (scene.map.raining) {
    const sp = atlas.splash;
    for (const p of scene.splashes) {
      const fr = Math.min(sp.n - 1, Math.floor(p.age / 0.09));
      ctx.drawImage(sp.canvas, fr * sp.w, 0, sp.w, sp.h, Math.round(p.x * s - sp.ax * m) - camX, Math.round(p.y * s - sp.ay * m) - camY, sp.w * m, sp.h * m);
    }
    for (const d of scene.drops) {
      const img = atlas.rain[d.sprite];
      // 왼쪽 아래로 비스듬히 떨어진다(빗줄기의 아래 끝이 땅의 자리로 다가간다)
      const x = d.gx + d.up * 0.33;
      const y = d.gy - d.up;
      ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round(x * s) - camX, Math.round(y * s - img.h * m) - camY, img.w * m, img.h * m);
    }
  }

  // 가끔 날아가는 새 떼
  if (scene.flock) {
    const b = atlas.bird;
    const fl = scene.flock;
    for (let k = 0; k < fl.n; k++) {
      const row = Math.ceil(k / 2);
      const side = k % 2 === 0 ? 1 : -1;
      const x = fl.x - row * 9 - (k % 3);
      const y = fl.y + side * row * 5 + Math.sin(world.time * 2 + k) * 1.5;
      const fr = Math.floor(world.time * 6 + k * 0.7) % b.n;
      ctx.drawImage(b.canvas, fr * b.w, 0, b.w, b.h, Math.round(x * s) - camX, Math.round(y * s) - camY, b.w * m, b.h * m);
    }
  }

  // 7. 표시: 깃발과 말풍선, 막힌 길의 표시
  for (const mark of world.marks) {
    const spot = mark.spot;
    const p = spotPoint(spot);
    if (p.x < vx0 - 20 || p.x > vx1 + 20 || p.y < vy0 - 10 || p.y > vy1 + 50) continue;
    const img = mark.must ? atlas.flag : atlas.bubble;
    // 지금 할 수 없는 일의 표시는 엷고 까딱이지 않는다
    const bob = mark.faded ? 0 : Math.round(Math.sin(world.time * 3 + spot.at[0]) * 1.5);
    const guided = world.guide === spot.id;
    if (mark.faded) ctx.globalAlpha = 0.5;
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, p.x * s - img.ax * m - camX, (p.y - 22 + bob) * s - img.ay * m - camY, img.w * m, img.h * m);
    ctx.globalAlpha = 1;
    if (guided) {
      // 가리키는 자리 위에서 아래로 까딱이는 화살표
      const ar = atlas.arrows[2];
      const hop = Math.round(Math.abs(Math.sin(world.time * 4)) * 4);
      ctx.drawImage(ar.canvas, 0, 0, ar.w, ar.h, p.x * s - ar.ax * m - camX, (p.y - 52 - hop) * s - ar.ay * m - camY, ar.w * m, ar.h * m);
    }
  }
  for (const l of world.locks) {
    if (l.x < vx0 - 20 || l.x > vx1 + 20 || l.y < vy0 - 10 || l.y > vy1 + 40) continue;
    const img = atlas.lock;
    const bob = Math.round(Math.sin(world.time * 2.4 + l.x) * 1.2);
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round(l.x) * s - img.ax * m - camX, Math.round(l.y - 18 + bob) * s - img.ay * m - camY, img.w * m, img.h * m);
  }

  // 화면 밖의 자리를 가리키는 화살표(화면 가장자리에)
  if (world.guide) {
    const spot = world.marks.find((m) => m.spot.id === world.guide)?.spot;
    if (spot) {
      const p = spotPoint(spot);
      const sx = p.x * s - camX;
      const sy = (p.y - 20) * s - camY;
      const pad = 26 * s;
      if (sx < pad || sx > view.w - pad || sy < pad || sy > view.h - pad) {
        const cx = view.w / 2;
        const cy = view.h / 2;
        const ang = Math.atan2(sy - cy, sx - cx);
        const k = Math.min((view.w / 2 - pad) / Math.max(1e-6, Math.abs(Math.cos(ang))), (view.h / 2 - pad) / Math.max(1e-6, Math.abs(Math.sin(ang))));
        const pulse = Math.round(Math.sin(world.time * 5) * 2) * s;
        let ax = Math.round(cx + Math.cos(ang) * (k + pulse));
        let ay = Math.round(cy + Math.sin(ang) * (k + pulse));
        const ar = atlas.arrows[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
        // 그림 점 하나를 기기 화소 m + 1개로(맵의 그림보다 조금 크게)
        const big = m + 1;
        // 할 일 쪽지나 작은 지도에 가려지면 그 옆(가장 가까운 빈 곳)으로 민다
        const gap = 14 * (s + 1);
        for (const r of world.avoid) {
          if (ax <= r.x0 - gap || ax >= r.x1 + gap || ay <= r.y0 - gap || ay >= r.y1 + gap) continue;
          const moves: [number, number, number][] = [];
          if (r.x1 + gap < view.w - pad) moves.push([r.x1 + gap - ax, r.x1 + gap, ay]);
          if (r.x0 - gap > pad) moves.push([ax - (r.x0 - gap), r.x0 - gap, ay]);
          if (r.y1 + gap < view.h - pad) moves.push([r.y1 + gap - ay, ax, r.y1 + gap]);
          if (r.y0 - gap > pad) moves.push([ay - (r.y0 - gap), ax, r.y0 - gap]);
          moves.sort((a, b) => a[0] - b[0]);
          if (moves.length > 0) {
            ax = Math.round(moves[0][1]);
            ay = Math.round(moves[0][2]);
          }
        }
        ctx.drawImage(ar.canvas, 0, 0, ar.w, ar.h, ax - ar.ax * big, ay - ar.ay * big, ar.w * big, ar.h * big);
      }
    }
  }

  // 계절의 빛
  if (atlas.pal.wash) {
    ctx.fillStyle = atlas.pal.wash;
    ctx.fillRect(0, 0, view.w, view.h);
  }
  // 하루의 빛: 아침은 엷은 노란빛, 해거름은 붉은빛이 위에서 보랏빛으로 내려앉는다(그림 견본의 빛과 같은 빛깔)
  // 눈 온 겨울과 비 오는 날에는 볕이 엷다: 눈이 누렇게 물들지 않고, 흐린 하늘에 노을이 짙게 지지 않는다
  const sun = atlas.pal.rain ? 0.35 : atlas.season === 'winter' ? 0.5 : 1;
  const morning = world.glow.morning * sun;
  const dusk = world.glow.dusk * (atlas.pal.rain ? 0.6 : 1);
  if (morning > 0.01 || dusk > 0.01) {
    ctx.globalCompositeOperation = 'multiply';
    if (morning > 0.01) {
      const g = ctx.createLinearGradient(0, 0, 0, view.h);
      g.addColorStop(0, '#fff3cf');
      g.addColorStop(1, '#ffe9d2');
      ctx.globalAlpha = morning;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (dusk > 0.01) {
      const g = ctx.createLinearGradient(0, 0, 0, view.h);
      g.addColorStop(0, '#f6b37f');
      g.addColorStop(1, '#c78fb0');
      // 견본(0.85)보다 엷게: 걸어 다니며 표시와 사람을 알아보는 데 걸리지 않게
      ctx.globalAlpha = dusk * 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** 발밑의 따뜻한 그림자: 바닥 빛을 곱해 한 단계 어둡게(검은 반투명을 얹지 않는다 — spec 4.7.5의 ㅂ) */
function drawFoot(ctx: CanvasRenderingContext2D, f: Img, x: number, y: number, w: number, h: number): void {
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(f.canvas, 0, 0, f.w, f.h, x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function drawActor(view: View, world: World, scene: Scene, a: Actor, camX: number, camY: number): void {
  const { ctx, scale: s } = view;
  const m = s / ART;
  const { atlas } = scene;
  const x = Math.round(a.x * s) - camX;
  const y = Math.round((a.y - a.lift - (a.act === 'sit' ? 5 : 0)) * s) - camY;
  const sheet = atlas.people.get(a.sprite) ?? personCanvas(atlas, a.sprite);
  if (sheet) {
    // 논에 들어선 사람: 벼가 자란 논에서는 종아리까지, 물에 잠긴 논에서는 발목까지 가린다
    const { map } = scene;
    const tile = map.terrain[clamp(Math.floor(a.y / TILE), 0, map.h - 1) * map.w + clamp(Math.floor(a.x / TILE), 0, map.w - 1)];
    const state = atlas.pal.paddyState;
    const sink = tile === T.paddy ? (state === 'green' ? 6 : state === 'gold' ? 7 : 0) : tile === T.soil && state === 'green' ? 4 : 0;
    // 발밑 그림자(가운데가 발치에서 조금 오른쪽 아래 — 빛은 왼쪽 위에서 온다, ㅂ)
    const f = atlas.foot;
    if (sink === 0) drawFoot(ctx, f, x - f.ax * m, y - f.ay * m, f.w * m, f.h * m);
    const row = DIRS.indexOf(a.dir);
    const fast = a === world.player;
    let col: number;
    if (a.act === 'walk') col = COL.walk + (Math.floor(a.t * (fast ? 7.6 : 5.2)) % 4);
    else if (a.act === 'work') col = COL.work + (Math.floor(a.t * 3.6) % 4);
    else if (a.act === 'sit') col = COL.sit + (a.t % 3.4 > 2.3 ? 1 : 0);
    else col = COL.idle + (a.t % 2.6 > 1.6 ? 1 : 0);
    // 잠기는 깊이는 맵 점(sink)이고, 시트는 그림 점이다
    const rows = PERSON_AY + ART - sink * ART;
    ctx.drawImage(sheet, col * PERSON_W, row * PERSON_H, PERSON_W, sink > 0 ? rows : PERSON_H, x - PERSON_AX * m, y - PERSON_AY * m, PERSON_W * m, (sink > 0 ? rows : PERSON_H) * m);
    if (sink > 0) {
      const front = atlas.cropFront;
      ctx.drawImage(front.canvas, 0, 0, front.w, front.h, x - front.ax * m, y - sink * s - (front.ay - ART) * m, front.w * m, front.h * m);
    }
    return;
  }
  const img = atlas.critters.get(a.sprite) ?? critterImg(atlas, a.sprite);
  if (!img) return;
  let frame = 0;
  const t = a.t;
  switch (a.sprite) {
    case 'hen':
    case 'rooster':
      frame = a.act === 'walk' ? Math.floor(t * 7) % 2 : t % 3.1 > 2.2 ? 2 : 0;
      break;
    case 'chick':
      frame = a.act === 'walk' ? Math.floor(t * 9) % 2 : 0;
      break;
    case 'dog':
      frame = a.act === 'walk' ? 1 + (Math.floor(t * 7) % 2) : Math.floor(t * 5) % 4 === 0 ? 3 : 0;
      break;
    case 'ox':
      frame = t % 4.5 > 3.6 ? 1 : 0;
      break;
    case 'plowTeam':
      frame = a.act === 'walk' ? Math.floor(t * 2.6) % 2 : 0;
      break;
    case 'magpie':
    case 'sparrow':
      frame = a.act === 'fly' ? 2 + (Math.floor(t * 9) % 2) : t % 2.3 > 1.9 ? 1 : 0;
      break;
  }
  if (a.act !== 'fly') {
    const f = atlas.foot;
    const fw = Math.min(f.w, Math.round(img.w * 0.8));
    // 짐승의 그림자도 발치에서 조금 오른쪽 아래(3.1차 시안과 같이 맵 점 하나 오른쪽)
    drawFoot(ctx, f, x + s - Math.round((fw / 2) * m), y - 2 * s, fw * m, 4 * s);
  }
  const right = a.dir === 'right';
  const src = right && img.flipped ? img.flipped : img.canvas;
  const fx = right ? (img.n - 1 - frame) * img.w : frame * img.w;
  // 뒤집은 그림의 발치: 1배 그림을 키운 것이라 발치 점(ART 칸)이 통째로 뒤집힌다
  const ax = right ? img.w - ART - img.ax : img.ax;
  ctx.drawImage(src, fx, 0, img.w, img.h, x - ax * m, y - img.ay * m, img.w * m, img.h * m);
}

/** 작은 지도의 바탕 빛깔(칸마다) */
export function miniColors(map: MapData, atlas: Atlas): Uint32Array {
  const { pal } = atlas;
  const out = new Uint32Array(map.w * map.h);
  const of = (t: number): number => {
    switch (t) {
      case T.grass:
        return pal.grass[4];
      case T.meadow:
        return pal.grass[5];
      case T.forest:
        return pal.forest[3];
      case T.thicket:
        // 가을 숲의 단풍빛은 꼭 할 일의 붉은 표시와 헷갈리므로 솔빛을 섞어 가라앉힌다(1-라 review 26번 ㉦)
        return pal.drift === 'leaf' ? mix(pal.leaf[1], pal.pine[2], 0.6) : pal.leaf[2];
      case T.path:
      case T.steps:
        return pal.path[4];
      case T.yard:
        return pal.yard[3];
      case T.ridge:
        return pal.grassTip[1];
      case T.soil:
        // 논의 다른 모습: 갈아엎은 논(봄) · 큰비에 잠긴 논(여름) · 벼를 벤 논(가을) · 눈 덮인 빈 논(겨울)
        return pal.paddyState === 'green' ? pal.paddy[3] : pal.paddyState === 'bare' ? pal.grass[5] : pal.paddyState === 'gold' ? pal.soil[4] : pal.soil[3];
      case T.paddy:
        return pal.paddyState === 'water' ? pal.paddy[3] : pal.paddyState === 'bare' ? pal.grass[5] : pal.crop[2];
      case T.field:
        return pal.soil[4];
      case T.shallow:
      case T.ford:
        return pal.water[3];
      case T.deep:
        return pal.water[2];
      case T.bridge:
        return pal.wood[4];
      case T.rock:
        return pal.stone[4];
      case T.bank:
        return pal.path[1];
      default:
        return pal.grass[4];
    }
  };
  for (let i = 0; i < out.length; i++) out[i] = atlas.snap.nearest(of(map.terrain[i]));
  const roof: Record<string, number> = {
    choga: pal.thatch[4],
    hut: pal.thatch[4],
    hall: pal.thatch[4],
    shed: pal.thatch[3],
    manor: pal.tile[2],
    wing: pal.tile[2],
    temple: pal.tile[2],
    wallH: pal.tile[3],
    wallV: pal.tile[3],
    zelkova: pal.leaf[3],
    bigtree: pal.leaf[3],
  };
  for (const o of map.objects) {
    const raw = roof[o.kind];
    if (raw === undefined) continue;
    const c = atlas.snap.nearest(raw);
    const def = thing(o.kind);
    for (let j = 0; j < Math.max(1, def.fh); j++) {
      for (let i = 0; i < Math.max(1, def.fw); i++) {
        const x = o.tx + i;
        const y = o.ty - j;
        if (x >= 0 && y >= 0 && x < map.w && y < map.h) out[y * map.w + x] = c;
      }
    }
  }
  return out;
}
