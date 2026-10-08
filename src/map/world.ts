// 맵 위에서 벌어지는 일의 셈: 주인공의 걸음, 마을 사람과 짐승의 움직임, 문 앞에서 뜨는 까닭, 자리에 닿음.
// 캔버스와 화면을 모른다. 그리기(draw.ts)는 이 상태를 읽기만 한다.

import { clamp, rngOf } from '../pixel/px';
import { cameraGoal, follow, type Camera } from './camera';
import { closedGateAt, closedGateNear } from './gates';
import {
  boxFree,
  gridFor,
  lineFree,
  nearestReachable,
  reachFrom,
  routeTo,
  slide,
  tileCenter,
  tileOf,
  walkable,
  type Pt,
  type WalkGrid,
} from './path';
import { dwellerName, spotsFor, TILE, type Dir, type Dweller, type MapData, type Spot, type Who } from './types';

/** 주인공의 걸음(점/초). 초당 다섯 칸 — 맵의 서쪽 끝에서 동쪽 끝까지 19초쯤 걸린다(spec 9.1). */
export const WALK_SPEED = 80;

export type WorldEvent =
  | { type: 'gate'; label: string; reason: string }
  | { type: 'spot'; spot: Spot }
  | { type: 'dweller'; dweller: Dweller; name: string }
  | { type: 'note'; text: string };

export interface Actor {
  id: string;
  sprite: string;
  x: number;
  y: number;
  dir: Dir;
  act: 'idle' | 'walk' | 'work' | 'sit' | 'fly';
  /** 몸짓의 시간(초) */
  t: number;
  route: Pt[];
  speed: number;
  home: Pt;
  def?: Dweller;
  /** 다음에 움직일 때까지 남은 시간 */
  wait: number;
  /** 주인공이 말을 걸러 오는 동안 멈춰 선다 */
  held: boolean;
  /** 날아오른 높이(새) */
  lift: number;
}

type Arrive = { kind: 'spot'; spot: Spot } | { kind: 'dweller'; actor: Actor } | null;

export interface World {
  map: MapData;
  who: Who;
  grid: WalkGrid;
  player: Actor;
  actors: Actor[];
  spots: Spot[];
  cam: Camera;
  /** 화면에 보이는 넓이(그림의 점) */
  view: { w: number; h: number };
  time: number;
  /** 가 본 칸(작은 지도에 채워진다) */
  visited: Uint8Array;
  /** 화살표가 가리키는 자리 */
  guide: string | null;
  /** 누른 곳에 잠깐 뜨는 표시 */
  target: { x: number; y: number; t: number } | null;
  keys: { x: number; y: number };
  arrive: Arrive;
  /** 까닭을 이미 보여 준 문(멀어지면 지운다) */
  shownGate: string | null;
  /** 닫힌 문 너머로 가려고 눌렀는가(지나가기만 할 때는 까닭을 띄우지 않는다) */
  wish: boolean;
  /** 화살표가 피해 갈 화면의 네모들(할 일 쪽지, 작은 지도). 기기 화소. */
  avoid: { x0: number; y0: number; x1: number; y1: number }[];
  shownNote: string | null;
  /** 창이 떠 있는 동안에는 걷지 않는다 */
  paused: boolean;
  rnd: () => number;
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function dirOf(dx: number, dy: number, was: Dir): Dir {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return was;
  // 비스듬히 걸을 때 방향이 떨리지 않게, 이미 보던 쪽을 조금 더 쳐 준다
  const ax = Math.abs(dx) * (was === 'left' || was === 'right' ? 1.25 : 1);
  const ay = Math.abs(dy) * (was === 'up' || was === 'down' ? 1.25 : 1);
  if (ax >= ay) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function actorOf(d: Dweller): Actor {
  const p = tileCenter(d.at[0], d.at[1]);
  return {
    id: d.id,
    sprite: d.sprite,
    x: p.x,
    y: p.y,
    dir: d.facing,
    act: d.act === 'work' ? 'work' : d.act === 'sit' ? 'sit' : 'idle',
    t: (d.at[0] * 7 + d.at[1] * 3) % 5,
    route: [],
    speed: d.animal ? 26 : 30,
    home: p,
    def: d,
    wait: 1 + ((d.at[0] * 13 + d.at[1] * 7) % 30) / 10,
    held: false,
    lift: 0,
  };
}

export function createWorld(map: MapData, who: Who, heroSprite: string): World {
  const [sx, sy] = map.start[who.role];
  const at = tileCenter(sx, sy);
  const player: Actor = {
    id: 'player',
    sprite: heroSprite,
    x: at.x,
    y: at.y,
    dir: 'down',
    act: 'idle',
    t: 0,
    route: [],
    speed: WALK_SPEED,
    home: at,
    wait: 0,
    held: false,
    lift: 0,
  };
  const world: World = {
    map,
    who,
    grid: gridFor(map, who),
    player,
    actors: map.dwellers.map(actorOf),
    spots: spotsFor(map, who),
    cam: { x: 0, y: 0 },
    view: { w: 336, h: 224 },
    time: 0,
    visited: new Uint8Array(map.w * map.h),
    guide: null,
    target: null,
    keys: { x: 0, y: 0 },
    arrive: null,
    shownGate: null,
    wish: false,
    avoid: [],
    shownNote: null,
    paused: false,
    rnd: rngOf(1395 + sx * 31 + sy),
  };
  snapCamera(world);
  reveal(world);
  return world;
}

/**
 * 화면이 바라볼 곳. 보통은 주인공이고, 큰 볼거리(마을 어귀의 느티나무) 가까이에서는 그쪽으로 쏠려
 * 큰 것이 화면에 다 들어오게 한다. 주인공이 화면 가장자리로 밀려나지는 않는다.
 */
export function focusOf(world: World): Pt {
  const { map, player, view } = world;
  const px = player.x;
  const py = player.y - 10;
  let fx = px;
  let fy = py;
  for (const s of map.sights) {
    const d = Math.hypot(px - s.x, py - s.y);
    if (d >= s.r) continue;
    // 반지름의 여섯 푼 안에서는 볼거리의 한가운데를 바라보고, 그 밖에서는 차츰 풀린다
    const u = clamp((s.r - d) / (s.r * 0.42), 0, 1);
    const k = u * u * (3 - 2 * u);
    fx += (s.x - px) * k;
    fy += (s.y - py) * k;
  }
  const mx = Math.max(0, view.w / 2 - 64);
  const my = Math.max(0, view.h / 2 - 50);
  return { x: clamp(fx, px - mx, px + mx), y: clamp(fy, py - my, py + my) };
}

export function snapCamera(world: World): void {
  const { map, view } = world;
  const f = focusOf(world);
  world.cam = cameraGoal(f.x, f.y, view.w, view.h, map.w * TILE, map.h * TILE);
}

/** 주인공 둘레의 칸을 가 본 곳으로 적는다 */
function reveal(world: World): void {
  const { map, player, visited } = world;
  const [tx, ty] = tileOf(player);
  const r = 8;
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      if ((x - tx) * (x - tx) + (y - ty) * (y - ty) > r * r + 2) continue;
      visited[y * map.w + x] = 1;
    }
  }
}

/** 표시가 떠 있는 자리(점). 깃발과 말풍선은 이 위에 뜬다. */
export function spotPoint(spot: Spot): Pt {
  return { x: spot.at[0] * TILE + TILE / 2, y: spot.at[1] * TILE + 4 };
}

function setRoute(world: World, to: [number, number], arrive: Arrive): boolean {
  const route = routeTo(world.grid, world.player, to);
  if (!route) return false;
  world.player.route = route;
  world.arrive = arrive;
  for (const a of world.actors) a.held = false;
  if (arrive?.kind === 'dweller') arrive.actor.held = true;
  return true;
}

/** 자리로 걸어간다(할 일 쪽지나 표시를 눌렀을 때) */
export function walkToSpot(world: World, spot: Spot): void {
  if (world.paused) return;
  setRoute(world, spot.stand, { kind: 'spot', spot });
}

/** 사람 곁의 빈 칸 가운데 걸어서 닿는 가장 가까운 칸 */
function besideOf(world: World, actor: Actor): [number, number] | null {
  const [ax, ay] = tileOf(actor);
  const [px, py] = tileOf(world.player);
  const reach = reachFrom(world.grid, px, py);
  let best: [number, number] | null = null;
  let bestSteps = Infinity;
  for (const [dx, dy] of [
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [0, 2],
    [-2, 0],
    [2, 0],
    [0, -2],
  ]) {
    const x = ax + dx;
    const y = ay + dy;
    if (!walkable(world.grid, x, y)) continue;
    // 두 칸 떨어진 곳은 사이 칸이 비어 있을 때만(담 너머에서 말을 걸지 않는다)
    if (Math.abs(dx) + Math.abs(dy) === 2 && (dx === 0 || dy === 0) && !walkable(world.grid, ax + dx / 2, ay + dy / 2)) continue;
    const steps = reach[y * world.grid.w + x];
    // 바로 옆(위아래·옆)을 먼저 고른다
    const score = steps + (Math.abs(dx) + Math.abs(dy) > 1 ? 1000 : 0);
    if (steps > 0 && score < bestSteps) {
      bestSteps = score;
      best = [x, y];
    }
  }
  return best;
}

/**
 * 맵의 한 곳을 눌렀다(점 좌표). 사람이나 표시를 누르면 그 앞까지 가서 말을 걸고,
 * 그 밖에는 그곳까지(갈 수 없으면 가장 가까운 곳까지) 걸어간다. 걷는 도중에 누르면 바로 바뀐다.
 */
export function tapWorld(world: World, wx: number, wy: number): void {
  if (world.paused) return;
  world.wish = false;
  // 표시(깃발, 말풍선)
  for (const spot of world.spots) {
    const p = spotPoint(spot);
    if (Math.abs(wx - p.x) <= 12 && wy >= p.y - 34 && wy <= p.y + 14) {
      walkToSpot(world, spot);
      world.target = null;
      return;
    }
  }
  // 사람
  let hit: Actor | null = null;
  for (const a of world.actors) {
    if (!a.def || a.def.animal) continue;
    if (Math.abs(wx - a.x) <= 9 && wy >= a.y - 28 && wy <= a.y + 4) {
      if (!hit || a.y > hit.y) hit = a;
    }
  }
  if (hit) {
    const beside = besideOf(world, hit);
    if (beside && setRoute(world, beside, { kind: 'dweller', actor: hit })) {
      world.target = null;
      return;
    }
  }
  const from = tileOf(world.player);
  const to = nearestReachable(world.grid, from, wx / TILE, wy / TILE);
  // 닫힌 문의 칸이나 그 너머(문만 열리면 갈 수 있는 칸)를 눌렀는가
  const wx0 = Math.floor(wx / TILE);
  const wy0 = Math.floor(wy / TILE);
  const { map } = world;
  if (wx0 >= 0 && wy0 >= 0 && wx0 < map.w && wy0 < map.h && (to[0] !== wx0 || to[1] !== wy0)) {
    world.wish = closedGateAt(map, world.who, wx0, wy0) !== null || map.blocked[wy0 * map.w + wx0] === 0;
  }
  if (setRoute(world, to, null)) {
    const p = tileCenter(to[0], to[1]);
    world.target = { x: p.x, y: p.y, t: 0 };
  }
}

/** 자판의 방향(−1, 0, 1). 누르는 동안 그쪽으로 걷는다. */
export function setKeys(world: World, x: number, y: number): void {
  world.keys = { x, y };
}

/** Enter·Space: 가까이 있는 사람이나 자리에 말을 건다. 걸 것이 없으면 false. */
export function interact(world: World): WorldEvent | null {
  if (world.paused) return null;
  const p = world.player;
  let best: WorldEvent | null = null;
  let bestD = TILE * 1.9;
  for (const spot of world.spots) {
    const s = tileCenter(spot.stand[0], spot.stand[1]);
    const at = tileCenter(spot.at[0], spot.at[1]);
    const d = Math.min(Math.hypot(s.x - p.x, s.y - p.y), Math.hypot(at.x - p.x, at.y - p.y));
    if (d < bestD) {
      bestD = d;
      best = { type: 'spot', spot };
    }
  }
  for (const a of world.actors) {
    if (!a.def || a.def.animal) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'dweller', dweller: a.def, name: dwellerName(a.def, world.who) };
      p.dir = dirOf(a.x - p.x, a.y - p.y, p.dir);
      a.dir = OPPOSITE[p.dir];
    }
  }
  return best;
}

function stepPlayer(world: World, dt: number, events: WorldEvent[]): void {
  const p = world.player;
  const { keys, grid } = world;
  let moved = false;
  if (keys.x !== 0 || keys.y !== 0) {
    // 자판으로 걷기 시작하면 누른 곳으로 가던 길은 버린다
    p.route = [];
    world.wish = false;
    world.arrive = null;
    world.target = null;
    for (const a of world.actors) a.held = false;
    const len = Math.hypot(keys.x, keys.y);
    const dist = p.speed * dt;
    // 한 번에 2점씩 나누어 벽을 뚫고 지나가지 않게 한다
    const parts = Math.max(1, Math.ceil(dist / 2));
    for (let i = 0; i < parts; i++) {
      const next = slide(grid, p.x, p.y, ((keys.x / len) * dist) / parts, ((keys.y / len) * dist) / parts);
      if (next.x !== p.x || next.y !== p.y) moved = true;
      p.x = next.x;
      p.y = next.y;
    }
    p.dir = dirOf(keys.x, keys.y, p.dir);
  } else if (p.route.length > 0) {
    let left = p.speed * dt;
    while (left > 0 && p.route.length > 0) {
      const to = p.route[0];
      const dx = to.x - p.x;
      const dy = to.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= left) {
        p.x = to.x;
        p.y = to.y;
        left -= d;
        p.route.shift();
        if (d > 0.01) p.dir = dirOf(dx, dy, p.dir);
      } else {
        p.x += (dx / d) * left;
        p.y += (dy / d) * left;
        p.dir = dirOf(dx, dy, p.dir);
        left = 0;
      }
      moved = true;
    }
    if (p.route.length === 0) {
      const arrive = world.arrive;
      world.arrive = null;
      if (arrive?.kind === 'spot') {
        const at = tileCenter(arrive.spot.at[0], arrive.spot.at[1]);
        p.dir = dirOf(at.x - p.x, at.y - p.y, p.dir);
        events.push({ type: 'spot', spot: arrive.spot });
      } else if (arrive?.kind === 'dweller' && arrive.actor.def) {
        p.dir = dirOf(arrive.actor.x - p.x, arrive.actor.y - p.y, p.dir);
        if (arrive.actor.act !== 'work' && arrive.actor.act !== 'sit') arrive.actor.dir = OPPOSITE[p.dir];
        events.push({ type: 'dweller', dweller: arrive.actor.def, name: dwellerName(arrive.actor.def, world.who) });
      }
    }
  }
  if (moved) {
    if (p.act !== 'walk') p.t = 0;
    p.act = 'walk';
  } else if (p.act === 'walk') {
    p.act = 'idle';
    p.t = 0;
  }
  p.t += dt;

  // 닫힌 문으로 가려 할 때 까닭이 뜬다(한 번 뜨면 멀어질 때까지 다시 뜨지 않는다).
  // 문 앞을 지나가기만 할 때는 뜨지 않는다: 문 너머를 눌러 그 앞에 다다랐거나, 자판으로 문의 칸을 밀 때만.
  const [tx, ty] = tileOf(p);
  const near = closedGateNear(world.map, world.who, tx, ty, 1);
  if (near) {
    let trying = world.wish && p.route.length === 0;
    if (!trying && (keys.x !== 0 || keys.y !== 0)) {
      trying = near.gate.tiles.some(
        ([gx, gy]) => (gx === tx + keys.x && gy === ty + keys.y) || (gx === tx + keys.x && gy === ty) || (gx === tx && gy === ty + keys.y),
      );
    }
    if (trying && world.shownGate !== near.gate.id) {
      world.shownGate = near.gate.id;
      events.push({ type: 'gate', label: near.gate.label, reason: near.reason });
    }
  } else if (world.shownGate && !closedGateNear(world.map, world.who, tx, ty, 3)) {
    world.shownGate = null;
  }
  // 맵 끝의 길목
  const note = world.map.notes.find((n) => tx >= n.rect[0] && tx <= n.rect[2] && ty >= n.rect[1] && ty <= n.rect[3]);
  if (note) {
    if (world.shownNote !== note.id) {
      world.shownNote = note.id;
      events.push({ type: 'note', text: note.text });
    }
  } else world.shownNote = null;
  if (moved) reveal(world);
}

function stepActor(world: World, a: Actor, dt: number): void {
  a.t += dt;
  const def = a.def;
  if (!def) return;
  const p = world.player;
  const nearPlayer = Math.hypot(p.x - a.x, p.y - a.y);

  // 까치는 사람이 다가오면 날아올랐다가 돌아온다
  if (def.sprite === 'magpie') {
    if (a.act === 'fly') {
      a.x += 70 * dt;
      a.y -= 34 * dt;
      a.lift += 40 * dt;
      if (a.lift > 220) {
        a.act = 'idle';
        a.lift = 0;
        a.x = a.home.x;
        a.y = a.home.y;
        a.wait = 9999;
      }
      return;
    }
    if (a.wait > 9000) {
      // 화면 밖에 있을 때 돌아온다
      if (nearPlayer > TILE * 14) a.wait = 1;
      else return;
    }
    if (nearPlayer < TILE * 2.6) {
      a.act = 'fly';
      a.dir = 'right';
      return;
    }
  }

  if (def.act === 'stand') {
    // 가까이 오면 바라보고, 아니면 가끔 둘레를 돌아본다
    if (a.held || nearPlayer < TILE * 2.2) a.dir = dirOf(p.x - a.x, p.y - a.y, a.dir);
    else {
      a.wait -= dt;
      if (a.wait <= 0) {
        a.wait = 2.5 + world.rnd() * 4;
        const dirs: Dir[] = def.animal ? ['left', 'right'] : ['down', 'left', 'right', 'down'];
        a.dir = world.rnd() < 0.45 ? def.facing : dirs[Math.floor(world.rnd() * dirs.length)];
      }
    }
    return;
  }
  if (def.act === 'work' || def.act === 'sit') return;

  if (def.act === 'route' && def.route) {
    // 정해진 두 끝을 오간다
    if (a.route.length === 0) {
      const ends = def.route.map(([x, y]) => tileCenter(x, y));
      const far = Math.hypot(ends[0].x - a.x, ends[0].y - a.y) > Math.hypot(ends[1].x - a.x, ends[1].y - a.y) ? ends[0] : ends[1];
      a.route = [far];
      a.wait = 1.6;
    }
    if (a.wait > 0) {
      a.wait -= dt;
      a.act = 'idle';
      return;
    }
    a.act = 'walk';
    const to = a.route[0];
    const d = Math.hypot(to.x - a.x, to.y - a.y);
    const stepLen = 15 * dt;
    a.dir = to.x < a.x ? 'left' : 'right';
    if (d <= stepLen) {
      a.x = to.x;
      a.y = to.y;
      a.route = [];
    } else {
      a.x += ((to.x - a.x) / d) * stepLen;
      a.y += ((to.y - a.y) / d) * stepLen;
    }
    return;
  }

  // roam: 둘레를 돌아다닌다
  if (a.held || (!def.animal && nearPlayer < TILE * 1.7)) {
    a.route = [];
    a.act = 'idle';
    a.dir = dirOf(p.x - a.x, p.y - a.y, a.dir);
    return;
  }
  if (a.route.length === 0) {
    a.act = 'idle';
    a.wait -= dt;
    if (a.wait > 0) return;
    a.wait = (def.animal ? 0.8 : 1.5) + world.rnd() * (def.animal ? 3 : 4);
    const range = (def.range ?? 2) * TILE;
    for (let tries = 0; tries < 4; tries++) {
      const to = { x: a.home.x + (world.rnd() - 0.5) * 2 * range, y: a.home.y + (world.rnd() - 0.5) * 2 * range };
      // 주인공이 다니는 길을 막지 않는 칸으로, 곧게 갈 수 있을 때만 간다
      const base = world.map.blocked;
      const [tx, ty] = tileOf(to);
      if (tx < 0 || ty < 0 || tx >= world.map.w || ty >= world.map.h || base[ty * world.map.w + tx] === 1) continue;
      if (!boxFree(world.grid, to.x, to.y) || !lineFree(world.grid, a, to)) continue;
      a.route = [to];
      break;
    }
    return;
  }
  const to = a.route[0];
  const d = Math.hypot(to.x - a.x, to.y - a.y);
  const stepLen = a.speed * (def.sprite === 'boyKid' || def.sprite === 'girlKid' || def.sprite === 'dog' ? 1.7 : 1) * dt;
  a.act = 'walk';
  a.dir = def.animal ? (to.x < a.x ? 'left' : 'right') : dirOf(to.x - a.x, to.y - a.y, a.dir);
  if (d <= stepLen) {
    a.x = to.x;
    a.y = to.y;
    a.route = [];
  } else {
    a.x += ((to.x - a.x) / d) * stepLen;
    a.y += ((to.y - a.y) / d) * stepLen;
  }
}

/** 시간을 dt초 흘린다. 그사이에 생긴 일을 돌려준다. */
export function stepWorld(world: World, dt: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.time += dt;
  if (!world.paused) stepPlayer(world, dt, events);
  else {
    // 창이 떠 있는 동안에는 제자리에 서서 숨만 쉰다
    if (world.player.act === 'walk') {
      world.player.act = 'idle';
      world.player.t = 0;
    }
    world.player.t += dt;
  }
  for (const a of world.actors) stepActor(world, a, dt);
  if (world.target) {
    world.target.t += dt;
    if (world.player.route.length === 0 || world.target.t > 6) world.target = null;
  }
  const { map, view } = world;
  const f = focusOf(world);
  const goal = cameraGoal(f.x, f.y, view.w, view.h, map.w * TILE, map.h * TILE);
  world.cam = follow(world.cam, goal, dt);
  return events;
}
