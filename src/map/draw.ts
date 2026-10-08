// 맵을 캔버스에 그린다. 셈은 world.ts가 하고, 여기서는 그 상태를 읽어 그리기만 한다.
//
// 또렷함: 그림의 점 하나를 기기 화소의 정수배(scale)로만 키운다. 화면의 좌표는 모두 정수로 맞춘다.
//   바탕(땅)과 세운 것은 그림의 점 격자에 맞고, 화면 따라가기와 걷는 사람은 기기 화소 단위로 움직여 끊기지 않는다.
// 빠르기: 바뀌지 않는 땅은 미리 한 장으로 그려 두고(ground), 화면에 보이는 것만 그린다.
//   그리는 차례: 물결 → 땅 → 논물의 반짝임 → 세운 것과 사람(아래쪽에 있는 것이 나중) → 구름 그림자 → 날리는 것 → 표시.

import { anchorOf, thingKey } from '../pixel/catalog';
import { groundOf, type Atlas, type Img } from '../pixel/atlas';
import type { Ground } from '../pixel/ground';
import { COL, DIRS, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W } from '../pixel/people';
import { hash2 } from '../pixel/px';
import { closedGates } from './gates';
import { thing } from './things';
import { T, TILE, type MapData } from './types';
import { spotPoint, type Actor, type World } from './world';

interface Static {
  img: Img;
  /** 그림의 왼쪽 위(맵의 점) */
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

export interface Scene {
  map: MapData;
  atlas: Atlas;
  ground: HTMLCanvasElement;
  wet: Uint8Array;
  glint: Uint8Array;
  statics: Static[];
  /** 굴뚝(연기가 나는 곳) */
  chimneys: { x: number; y: number; next: number }[];
  /** 꽃나무(꽃잎이 날리는 곳) */
  blossoms: { x: number; y: number }[];
  puffs: Puff[];
  petals: Petal[];
  flutters: Flutter[];
  clouds: { x: number; y: number; speed: number }[];
  /** 가끔 화면을 가로질러 날아가는 새 떼 */
  flock: { x: number; y: number; vx: number; vy: number; n: number } | null;
  flockWait: number;
  /** 대문이 닫혀 보이는가(주인공에 따라) */
  gateShut: boolean;
  locks: { x: number; y: number }[];
  shown: (Static | Actor)[];
}

export function buildScene(map: MapData, atlas: Atlas, world: World): Scene {
  const { ground, canvas } = groundOf(atlas, map, map.objects);
  return sceneFrom(map, atlas, world, ground, canvas);
}

function sceneFrom(map: MapData, atlas: Atlas, world: World, ground: Ground, canvas: HTMLCanvasElement): Scene {
  const statics: Static[] = [];
  const chimneys: Scene['chimneys'] = [];
  const blossoms: Scene['blossoms'] = [];
  const shut = closedGates(map, world.who).some((c) => c.gate.id === 'manor');
  for (const o of map.objects) {
    const variant = o.kind === 'gate' ? (shut ? 1 : 0) : o.variant;
    const img = atlas.things.get(thingKey(o.kind, variant));
    if (!img) continue;
    const def = thing(o.kind);
    const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
    const x = at.x - img.ax;
    const y = at.y - img.ay;
    statics.push({
      img,
      x,
      y,
      sortY: at.y + img.sort,
      tall: Boolean(def.tall),
      sways: Boolean(def.sways) && img.n > 1,
      phase: hash2(o.tx, o.ty, 5) * 4 + o.tx / 9,
      alpha: 1,
      kind: o.kind,
    });
    if (img.smoke) chimneys.push({ x: x + img.smoke.x, y: y + img.smoke.y, next: hash2(o.tx, o.ty, 6) });
    if (o.kind === 'blossom') blossoms.push({ x: at.x, y: at.y - 30 });
  }
  statics.sort((a, b) => a.sortY - b.sortY);

  // 나비: 꽃이 많은 곳에 산다
  const flutters: Flutter[] = [];
  if (atlas.pal.flowers) {
    for (const o of map.objects) {
      if (o.kind !== 'flower' || hash2(o.tx, o.ty, 9) > 0.16) continue;
      flutters.push({ hx: o.tx * TILE + 8, hy: o.ty * TILE + 4, phase: hash2(o.tx, o.ty, 10) * 30, tone: hash2(o.tx, o.ty, 11) > 0.5 ? 1 : 0 });
    }
  }
  const W = map.w * TILE;
  const H = map.h * TILE;
  const locks: Scene['locks'] = [];
  for (const { gate } of closedGates(map, world.who)) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of gate.tiles) {
      sx += x;
      sy += y;
    }
    locks.push({ x: (sx / gate.tiles.length) * TILE + 8, y: (sy / gate.tiles.length) * TILE + 2 });
  }
  return {
    map,
    atlas,
    ground: canvas,
    wet: ground.wet,
    glint: ground.glint,
    statics,
    chimneys,
    blossoms,
    puffs: [],
    petals: [],
    flutters,
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
    gateShut: shut,
    locks,
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

  // 날리는 꽃잎(가을에는 잎, 겨울에는 눈)
  const n = scene.atlas.drift.length;
  if (n > 0) {
    const want = scene.atlas.pal.drift === 'snow' ? 46 : 16;
    let guard = 0;
    while (scene.petals.length < want && guard++ < 4) {
      const seed = Math.floor(world.time * 60) + scene.petals.length * 17 + guard;
      const fromTree = scene.atlas.pal.drift === 'petal' && hash2(seed, 1, 31) < 0.55;
      let x = cam.x + hash2(seed, 2, 32) * (view.w + 80) - 80;
      let y = cam.y - 10 + hash2(seed, 3, 33) * view.h * 0.6;
      if (fromTree) {
        const near = scene.blossoms.filter((b) => b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1);
        if (near.length > 0) {
          const b = near[Math.floor(hash2(seed, 4, 34) * near.length)];
          x = b.x + (hash2(seed, 5, 35) - 0.5) * 26;
          y = b.y + (hash2(seed, 6, 36) - 0.5) * 16;
        }
      }
      scene.petals.push({
        x,
        y,
        vx: 12 + hash2(seed, 7, 37) * 12,
        vy: 8 + hash2(seed, 8, 38) * 9,
        age: 0,
        life: 4.5 + hash2(seed, 9, 39) * 4,
        sprite: Math.floor(hash2(seed, 10, 40) * n),
        phase: hash2(seed, 11, 41) * 6,
      });
    }
    for (const p of scene.petals) {
      p.age += dt;
      p.x += (p.vx + Math.sin(p.age * 2.2 + p.phase) * 9) * dt;
      p.y += (p.vy + Math.cos(p.age * 1.7 + p.phase) * 4) * dt;
    }
    scene.petals = scene.petals.filter((p) => p.age < p.life && p.x < x1 + 30 && p.y < y1 + 30);
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
    if (p.y < s.sortY && bx1 > s.x && bx0 < s.x + s.img.w && by1 > s.y && by0 < s.y + s.img.h && hides(s.img, bx0 - s.x, by0 - s.y, bx1 - s.x, by1 - s.y)) {
      want = 0.45;
    }
    if (s.alpha !== want) {
      const k = Math.min(1, dt * 9);
      s.alpha += (want - s.alpha) * k;
      if (Math.abs(s.alpha - want) < 0.02) s.alpha = want;
    }
  }
}

/** 그림 안의 네모(점)가 찍힌 점으로 셋에 하나 넘게 덮여 있는가 */
function hides(img: Img, x0: number, y0: number, x1: number, y1: number): boolean {
  const cx0 = Math.max(0, Math.floor(x0 / 4));
  const cy0 = Math.max(0, Math.floor(y0 / 4));
  const cx1 = Math.min(img.mw - 1, Math.floor(x1 / 4));
  const cy1 = Math.min(img.mh - 1, Math.floor(y1 / 4));
  let on = 0;
  let all = 0;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      all++;
      if (img.mask[cy * img.mw + cx] === 1) on++;
    }
  }
  // 몸 네모가 그림 밖으로 나간 몫까지 쳐서 셋에 하나
  const whole = (Math.floor(x1 / 4) - Math.floor(x0 / 4) + 1) * (Math.floor(y1 / 4) - Math.floor(y0 / 4) + 1);
  return all > 0 && on * 3 >= whole;
}

export function render(view: View, world: World, scene: Scene): void {
  const { ctx, scale: s } = view;
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

  // 맵이 화면보다 작을 때의 바깥
  ctx.fillStyle = '#1d2a25';
  if (camX < 0 || camY < 0 || map.w * TILE * s - camX < view.w || map.h * TILE * s - camY < view.h) ctx.fillRect(0, 0, view.w, view.h);

  // 1. 물결
  const wf = Math.floor(world.time * 7) % atlas.waterN;
  const ts = TILE * s;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (scene.wet[ty * map.w + tx] === 0) continue;
      ctx.drawImage(atlas.water, wf * 64 + ((tx * TILE) & 63), (ty * TILE) & 63, TILE, TILE, tx * ts - camX, ty * ts - camY, ts, ts);
    }
  }

  // 2. 땅
  const gx = Math.max(0, Math.floor(vx0));
  const gy = Math.max(0, Math.floor(vy0));
  const gw = Math.min(scene.ground.width - gx, Math.ceil(view.w / s) + 2);
  const gh = Math.min(scene.ground.height - gy, Math.ceil(view.h / s) + 2);
  if (gw > 0 && gh > 0) ctx.drawImage(scene.ground, gx, gy, gw, gh, gx * s - camX, gy * s - camY, gw * s, gh * s);

  // 풀밭을 지나가는 바람결: 밝은 풀결의 띠가 비스듬히 흘러간다. 논물에는 잔물결이 인다.
  const gust = atlas.gust;
  const rip = atlas.ripple;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * map.w + tx;
      const t = map.terrain[i];
      const grassy = t === T.grass || t === T.meadow;
      if (!grassy && scene.glint[i] === 0) continue;
      if (grassy && map.blocked[i] === 1) continue;
      const along = grassy ? tx * 0.9 + ty * 0.5 - world.time * 5.5 : tx * 0.6 - ty * 0.8 - world.time * 2.2;
      const period = grassy ? 19 : 8;
      const u = ((along % period) + period) % period;
      const width = grassy ? 4.5 : 3;
      if (u >= width) continue;
      const turn = Math.floor(along / period);
      if (hash2(tx + turn * 7, ty, 61) > (grassy ? 0.62 : 0.7)) continue;
      const img = grassy ? gust : rip;
      const f = Math.min(img.n - 1, Math.floor((u / width) * img.n));
      const px = tx * TILE + 1 + Math.floor(hash2(tx, ty + turn, 62) * 8);
      const py = ty * TILE + 3 + Math.floor(hash2(tx + turn, ty, 63) * 9);
      ctx.drawImage(img.canvas, f * img.w, 0, img.w, img.h, px * s - camX, py * s - camY, img.w * s, img.h * s);
    }
  }

  // 3. 논물의 반짝임
  const g = atlas.glint;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (scene.glint[ty * map.w + tx] === 0) continue;
      const period = 3.2 + hash2(tx, ty, 51) * 3;
      const t = (world.time + hash2(tx, ty, 52) * period) % period;
      if (t > 0.6) continue;
      const turn = Math.floor((world.time + hash2(tx, ty, 52) * period) / period);
      const px = tx * TILE + 2 + Math.floor(hash2(tx + turn, ty, 53) * 11);
      const py = ty * TILE + 2 + Math.floor(hash2(tx, ty + turn, 54) * 11);
      const f = t < 0.15 ? 0 : t < 0.3 ? 1 : t < 0.45 ? 2 : 1;
      ctx.drawImage(g.canvas, f * g.w, 0, g.w, g.h, (px - g.ax) * s - camX, (py - g.ay) * s - camY, g.w * s, g.h * s);
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
      Math.round((world.target.x - r.ax) * s) - camX,
      Math.round((world.target.y - r.ay) * s) - camY,
      r.w * s,
      r.h * s,
    );
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
    if (it.x > vx1 || it.x + it.img.w < vx0 || it.y > vy1) continue;
    shown.push(it);
  }
  for (const a of world.actors) {
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
      if (it.sways) frame = img.seq[Math.floor(world.time * 1.7 + it.phase) % img.seq.length];
      if (it.alpha < 1) ctx.globalAlpha = it.alpha;
      ctx.drawImage(img.canvas, frame * img.w, 0, img.w, img.h, it.x * s - camX, it.y * s - camY, img.w * s, img.h * s);
      if (it.alpha < 1) ctx.globalAlpha = 1;
    }
  }

  // 5. 구름 그림자
  const cl = atlas.cloud;
  for (const c of scene.clouds) {
    if (c.x > vx1 || c.x + cl.w * 2 < vx0 || c.y > vy1 || c.y + cl.h * 2 < vy0) continue;
    ctx.drawImage(cl.canvas, 0, 0, cl.w, cl.h, Math.round(c.x * s) - camX, Math.round(c.y * s) - camY, cl.w * 2 * s, cl.h * 2 * s);
  }

  // 6. 날리는 것: 연기, 꽃잎, 나비
  for (const p of scene.puffs) {
    const k = p.age / p.life;
    const img = atlas.smoke[k < 0.16 ? 0 : k < 0.45 ? 1 : 2];
    ctx.globalAlpha = (k < 0.12 ? k / 0.12 : Math.max(0, 1 - (k - 0.12) / 0.88)) * 0.85;
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round((p.x - img.ax) * s) - camX, Math.round((p.y - img.ay) * s) - camY, img.w * s, img.h * s);
  }
  ctx.globalAlpha = 1;
  for (const p of scene.petals) {
    const img = atlas.drift[p.sprite];
    const k = p.age / p.life;
    if (k > 0.85) ctx.globalAlpha = Math.max(0, (1 - k) / 0.15);
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round(p.x * s) - camX, Math.round(p.y * s) - camY, img.w * s, img.h * s);
    if (k > 0.85) ctx.globalAlpha = 1;
  }
  for (const f of scene.flutters) {
    const t = world.time * 0.5 + f.phase;
    const x = f.hx + Math.sin(t * 1.3) * 22 + Math.sin(t * 3.1) * 6;
    const y = f.hy + Math.cos(t * 1.7) * 12 + Math.sin(t * 4.3) * 3 - 8;
    if (x < vx0 - 8 || x > vx1 + 8 || y < vy0 - 8 || y > vy1 + 8) continue;
    const img = atlas.butterflies[f.tone];
    const fr = Math.floor(world.time * 9 + f.phase) % 2;
    ctx.drawImage(img.canvas, fr * img.w, 0, img.w, img.h, Math.round(x * s) - camX, Math.round(y * s) - camY, img.w * s, img.h * s);
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
      ctx.drawImage(b.canvas, fr * b.w, 0, b.w, b.h, Math.round(x * s) - camX, Math.round(y * s) - camY, b.w * s, b.h * s);
    }
  }

  // 7. 표시: 깃발과 말풍선, 막힌 길의 표시
  for (const spot of world.spots) {
    const p = spotPoint(spot);
    if (p.x < vx0 - 20 || p.x > vx1 + 20 || p.y < vy0 - 10 || p.y > vy1 + 50) continue;
    const img = spot.kind === 'must' ? atlas.flag : atlas.bubble;
    const bob = Math.round(Math.sin(world.time * 3 + spot.at[0]) * 1.5);
    const guided = world.guide === spot.id;
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, (p.x - img.ax) * s - camX, (p.y - 22 - img.ay + bob) * s - camY, img.w * s, img.h * s);
    if (guided) {
      // 가리키는 자리 위에서 아래로 까딱이는 화살표
      const ar = atlas.arrows[2];
      const hop = Math.round(Math.abs(Math.sin(world.time * 4)) * 4);
      ctx.drawImage(ar.canvas, 0, 0, ar.w, ar.h, (p.x - ar.ax) * s - camX, (p.y - 52 - hop) * s - camY, ar.w * s, ar.h * s);
    }
  }
  for (const l of scene.locks) {
    if (l.x < vx0 - 20 || l.x > vx1 + 20 || l.y < vy0 - 10 || l.y > vy1 + 40) continue;
    const img = atlas.lock;
    const bob = Math.round(Math.sin(world.time * 2.4 + l.x) * 1.2);
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, Math.round(l.x - img.ax) * s - camX, Math.round(l.y - 18 - img.ay + bob) * s - camY, img.w * s, img.h * s);
  }

  // 화면 밖의 자리를 가리키는 화살표(화면 가장자리에)
  if (world.guide) {
    const spot = world.spots.find((sp) => sp.id === world.guide);
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
        const big = s + 1;
        // 할 일 쪽지나 작은 지도에 가려지면 그 옆(가장 가까운 빈 곳)으로 민다
        const m = 14 * big;
        for (const r of world.avoid) {
          if (ax <= r.x0 - m || ax >= r.x1 + m || ay <= r.y0 - m || ay >= r.y1 + m) continue;
          const moves: [number, number, number][] = [];
          if (r.x1 + m < view.w - pad) moves.push([r.x1 + m - ax, r.x1 + m, ay]);
          if (r.x0 - m > pad) moves.push([ax - (r.x0 - m), r.x0 - m, ay]);
          if (r.y1 + m < view.h - pad) moves.push([r.y1 + m - ay, ax, r.y1 + m]);
          if (r.y0 - m > pad) moves.push([ay - (r.y0 - m), ax, r.y0 - m]);
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
}

function drawActor(view: View, world: World, scene: Scene, a: Actor, camX: number, camY: number): void {
  const { ctx, scale: s } = view;
  const { atlas } = scene;
  const x = Math.round(a.x * s) - camX;
  const y = Math.round((a.y - a.lift - (a.act === 'sit' ? 5 : 0)) * s) - camY;
  const sheet = atlas.people.get(a.sprite);
  if (sheet) {
    // 발밑 그림자
    const f = atlas.foot;
    ctx.drawImage(f.canvas, 0, 0, f.w, f.h, x - f.ax * s, y - (f.ay + 1) * s, f.w * s, f.h * s);
    const row = DIRS.indexOf(a.dir);
    const fast = a === world.player;
    let col: number;
    if (a.act === 'walk') col = COL.walk + (Math.floor(a.t * (fast ? 7.6 : 5.2)) % 4);
    else if (a.act === 'work') col = COL.work + (Math.floor(a.t * 3.6) % 4);
    else if (a.act === 'sit') col = COL.sit + (a.t % 3.4 > 2.3 ? 1 : 0);
    else col = COL.idle + (a.t % 2.6 > 1.6 ? 1 : 0);
    ctx.drawImage(sheet, col * PERSON_W, row * PERSON_H, PERSON_W, PERSON_H, x - PERSON_AX * s, y - PERSON_AY * s, PERSON_W * s, PERSON_H * s);
    return;
  }
  const img = atlas.critters.get(a.sprite);
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
      frame = a.act === 'fly' ? 2 + (Math.floor(t * 9) % 2) : t % 2.3 > 1.9 ? 1 : 0;
      break;
  }
  if (a.act !== 'fly') {
    const f = atlas.foot;
    const fw = Math.min(f.w, Math.round(img.w * 0.8));
    ctx.drawImage(f.canvas, 0, 0, f.w, f.h, x - Math.round((fw / 2) * s), y - 3 * s, fw * s, 4 * s);
  }
  const right = a.dir === 'right';
  const src = right ? img.flipped : img.canvas;
  const fx = right ? (img.n - 1 - frame) * img.w : frame * img.w;
  const ax = right ? img.w - 1 - img.ax : img.ax;
  ctx.drawImage(src, fx, 0, img.w, img.h, x - ax * s, y - img.ay * s, img.w * s, img.h * s);
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
        return pal.leaf[2];
      case T.path:
      case T.steps:
        return pal.path[4];
      case T.yard:
        return pal.yard[3];
      case T.ridge:
        return pal.grassTip[1];
      case T.soil:
        return pal.soil[3];
      case T.paddy:
        return pal.paddyState === 'water' ? pal.paddy[3] : pal.crop[2];
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
