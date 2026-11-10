// 맵 위에서 벌어지는 일의 셈: 주인공의 걸음, 마을 사람과 짐승의 움직임, 문 앞에서 뜨는 까닭, 자리에 닿음.
// 캔버스와 화면을 모른다. 그리기(draw.ts)는 이 상태를 읽기만 한다.

import { clamp, rngOf } from '../pixel/px';
import { cameraGoal, follow, type Camera } from './camera';
import { closedGateNear, closedGates, type ClosedGate } from './gates';
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
import { dwellerName, T, TILE, type Dir, type Dweller, type MapData, type Spot, type Who } from './types';

/** 주인공의 걸음(점/초). 초당 다섯 칸 — 맵의 서쪽 끝에서 동쪽 끝까지 19초쯤 걸린다(spec 9.1). */
export const WALK_SPEED = 80;

/**
 * 맵에 떠 있는 표시 하나: 지금 할 수 있는 일(Happening)과 그 일이 벌어지는 자리.
 * 무엇이 뜰지는 규칙 엔진이 정하고(openHappenings), 맵은 그 자리에 깃발이나 말풍선을 세울 뿐이다.
 */
export interface Mark {
  /** 일(Happening)의 id */
  id: string;
  spot: Spot;
  /** 꼭 푸는 미션의 일인가(깃발). 아니면 덤(말풍선). */
  must: boolean;
  /** 지금은 할 수 없는 일인가(해 ☀가 다 졌다). 표시가 엷게 보인다 — 닿으면 까닭이 뜬다. */
  faded?: boolean;
}

export type DayLight = 'morning' | 'noon' | 'dusk';

/** 남은 해 ☀로 하루의 때를 정한다: 하나도 쓰지 않았으면 아침, 다 썼으면 해거름, 그 사이는 한낮 */
export function dayLight(sunsLeft: number, sunsAll: number): DayLight {
  if (sunsAll <= 0 || sunsLeft >= sunsAll) return 'morning';
  return sunsLeft <= 0 ? 'dusk' : 'noon';
}

/** 닫힌 문 위에 뜨는 표시 */
export interface Lock {
  closed: ClosedGate;
  x: number;
  y: number;
}

export type WorldEvent =
  | { type: 'gate'; label: string; reason: string }
  | { type: 'mark'; mark: Mark }
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
  /** 지금은 이 자리에 없다(이야기가 흘러 다른 곳에 가 있다). 그리지도, 말을 걸지도, 길을 막지도 않는다. */
  hidden: boolean;
}

type Arrive = { kind: 'mark'; mark: Mark } | { kind: 'dweller'; actor: Actor } | null;

/**
 * 주인공 곁에 작게 떠 다니는 동료(느티나무 정령 — spec 6.2). 그 시대 사람에게는 보이지 않으므로 맵의 셈에 끼지 않는다:
 * 부딪힘·길 찾기·누르기·문 판정·말 걸기가 이것을 보지 않는다(actors에 넣지 않는다). 주인공을 조금 늦게 따라와
 * 주인공이 보는 쪽의 뒤·옆(가리지 않는 자리)에 떠 있고, 주인공이 보는 쪽을 따라 방향을 바꾼다.
 */
export interface Companion {
  sprite: string;
  /** 떠 있는 자리 밑의 땅(맵 점 — 그림의 발치. 그리는 차례도 이 줄로 정한다) */
  x: number;
  y: number;
  dir: Dir;
  /** 떠 있기의 시간(초) */
  t: number;
  /** 따라가는 동료라는 표(그리기가 사람과 가른다) */
  follow: true;
}

export interface World {
  map: MapData;
  who: Who;
  grid: WalkGrid;
  player: Actor;
  actors: Actor[];
  /** 지금 떠 있는 표시(할 수 있는 일) */
  marks: Mark[];
  /** 닫힌 문의 표시 */
  locks: Lock[];
  /** 칸마다: 닫힌 문 너머라서 못 가는 칸이면 그 문의 차례(locks의), 아니면 -1 */
  beyond: Int8Array;
  cam: Camera;
  /** 큰 볼거리 쪽으로 화면이 쏠린 만큼(0~1). 천천히 차고 빠진다. */
  pull: number;
  /** 하루의 때: 해 ☀를 쓸 때마다 아침 → 한낮 → 해거름으로 바뀐다(맵 화면이 정해 준다) */
  light: DayLight;
  /** 지금 화면에 깔린 빛(0~1). light 쪽으로 천천히 바뀐다. */
  glow: { morning: number; dusk: number };
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
  /**
   * 닫힌 문이나 그 너머를 눌렀는가. 이때만 문 앞에 멈춰 서면 까닭이 뜬다
   * (다른 곳을 누르고 가다가 문 곁에 멈췄을 때는 뜨지 않는다 — 1-라 review 23번).
   */
  wish: boolean;
  /** 화살표가 피해 갈 화면의 네모들(할 일 쪽지, 작은 지도). 기기 화소. */
  avoid: { x0: number; y0: number; x1: number; y1: number }[];
  shownNote: string | null;
  /** 창이 떠 있는 동안에는 걷지 않는다 */
  paused: boolean;
  rnd: () => number;
  /** 곁에 떠 있는 동료(없으면 null — setCompanion) */
  companion?: Companion | null;
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
    hidden: false,
  };
}

/** 닫힌 문마다 그 너머(문만 열리면 갈 수 있는 칸)를 적는다 */
function beyondOf(map: MapData, grid: WalkGrid, from: [number, number], locks: Lock[]): Int8Array {
  const out = new Int8Array(map.w * map.h).fill(-1);
  const reach = reachFrom(grid, from[0], from[1]);
  locks.forEach((lock, index) => {
    const queue: [number, number][] = [];
    for (const [x, y] of lock.closed.gate.tiles) {
      out[y * map.w + x] = index;
      queue.push([x, y]);
    }
    while (queue.length > 0) {
      const [x, y] = queue.pop() as [number, number];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const i = ny * map.w + nx;
        // 맵에서 걸을 수 있는 칸인데 이 사람은 닿지 못하는 칸만 문 너머로 친다
        if (out[i] !== -1 || map.blocked[i] === 1 || reach[i] > 0) continue;
        out[i] = index;
        queue.push([nx, ny]);
      }
    }
  });
  return out;
}

function locksOf(map: MapData, who: Who): Lock[] {
  return closedGates(map, who).map((closed) => {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of closed.gate.tiles) {
      sx += x;
      sy += y;
    }
    const n = closed.gate.tiles.length;
    return { closed, x: (sx / n) * TILE + 8, y: (sy / n) * TILE + 2 };
  });
}

/**
 * 맵에 주인공을 세운다. at을 주면 그 칸에서(이어 하기), 아니면 그 역할이 처음 서는 칸에서 시작한다.
 * at이 걸을 수 없는 칸이면(맵이 바뀌었을 때) 처음 서는 칸으로 돌아간다.
 */
export function createWorld(map: MapData, who: Who, heroSprite: string, startAt?: [number, number]): World {
  const grid = gridFor(map, who);
  const first = map.start[who.role] ?? map.start[Object.keys(map.start)[0]];
  const usable =
    startAt && walkable(grid, startAt[0], startAt[1]) && reachFrom(grid, first[0], first[1])[startAt[1] * map.w + startAt[0]] > 0;
  const [sx, sy] = usable && startAt ? startAt : first;
  const at = tileCenter(sx, sy);
  const locks = locksOf(map, who);
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
    hidden: false,
  };
  const world: World = {
    map,
    who,
    grid,
    player,
    actors: map.dwellers.map(actorOf),
    marks: [],
    locks,
    beyond: beyondOf(map, grid, first, locks),
    cam: { x: 0, y: 0 },
    pull: 0,
    light: 'noon',
    glow: { morning: 0, dusk: 0 },
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
    rnd: rngOf(1395 + first[0] * 31 + first[1]),
  };
  world.pull = pullGoal(world);
  snapCamera(world);
  reveal(world);
  return world;
}

/** 동료가 떠 있을 자리: 주인공이 보는 쪽의 뒤·옆(맵 점). 사람 몸과 겹치지 않을 만큼 옆으로 비켜 있다 */
export const COMPANION_SPOT: Record<Dir, { x: number; y: number }> = {
  down: { x: -13, y: -6 },
  up: { x: 13, y: 5 },
  left: { x: 14, y: -4 },
  right: { x: -14, y: -4 },
};

/** 이만큼(맵 점) 넘게 떨어지면 따라가지 않고 곧장 곁으로 옮긴다(이어 하기·문 너머로 옮겨 섰을 때) */
const COMPANION_JUMP = 96;

/**
 * 동료를 세우거나(이름) 거둔다(null). 세우면 주인공 곁의 자리에 곧장 선다. 맵의 셈(걷기·부딪힘·길 찾기)은 바뀌지 않는다.
 */
export function setCompanion(world: World, name: string | null): void {
  if (!name) {
    world.companion = null;
    return;
  }
  const p = world.player;
  const at = COMPANION_SPOT[p.dir];
  world.companion = { sprite: name, x: p.x + at.x, y: p.y + at.y, dir: p.dir, t: 0, follow: true };
}

/** 동료가 주인공을 조금 늦게 따라간다(0.2초쯤 — 지수로 다가간다) */
function stepCompanion(world: World, dt: number): void {
  const c = world.companion;
  if (!c) return;
  const p = world.player;
  const at = COMPANION_SPOT[p.dir];
  const gx = p.x + at.x;
  const gy = p.y + at.y;
  if (Math.hypot(gx - c.x, gy - c.y) > COMPANION_JUMP) {
    c.x = gx;
    c.y = gy;
  } else {
    const k = 1 - Math.exp(-dt * 5);
    c.x += (gx - c.x) * k;
    c.y += (gy - c.y) * k;
  }
  c.dir = p.dir;
  c.t += dt;
}

/**
 * 화면이 바라볼 곳. 보통은 주인공이고, 큰 볼거리(마을 어귀의 느티나무) 가까이에서는 그쪽으로 쏠려
 * 큰 것이 화면에 다 들어오게 한다. 주인공이 화면 가장자리로 밀려나지는 않는다.
 */
export function focusOf(world: World): Pt {
  const { player, view } = world;
  const px = player.x;
  const py = player.y - 10;
  let fx = px;
  let fy = py;
  const s = sightOf(world);
  if (s && world.pull > 0) {
    const k = world.pull * world.pull * (3 - 2 * world.pull);
    fx += (s.x - px) * k;
    fy += (s.y - py) * k;
  }
  const mx = Math.max(0, view.w / 2 - 64);
  const my = Math.max(0, view.h / 2 - 50);
  return { x: clamp(fx, px - mx, px + mx), y: clamp(fy, py - my, py + my) };
}

/** 주인공이 지금 그 마당에 들어서 있는 볼거리 */
function sightOf(world: World): MapData['sights'][number] | null {
  const [tx, ty] = tileOf(world.player);
  for (const s of world.map.sights) {
    const [x0, y0, x1, y1] = s.yard;
    if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) return s;
  }
  return world.pull > 0 ? (world.map.sights[0] ?? null) : null;
}

/** 화면이 쏠려야 하는 만큼: 볼거리의 마당 안에 서 있으면 1, 아니면 0(큰길을 지나가기만 할 때는 쏠리지 않는다) */
function pullGoal(world: World): number {
  const [tx, ty] = tileOf(world.player);
  return world.map.sights.some((s) => tx >= s.yard[0] && tx <= s.yard[2] && ty >= s.yard[1] && ty <= s.yard[3]) ? 1 : 0;
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

/**
 * 지금 자리에 없는 사람들을 정한다(맵의 사람 id). 제자리에 서서 길을 막던 사람이면 그 칸도 함께 트이고 막힌다.
 * 주인공이 서 있는 칸에는 사람이 돌아와 서지 않는다(끼이지 않게 — 주인공이 비켜난 뒤에 다시 부르면 선다).
 *
 * 한 칸에 막는 사람(solid)이 둘 적힌 때가 있다(가을의 형 — 아버지가 돌아오기 전의 형과 가을걷이 뒤의 형이 같은 칸에 서고 하나는 늘 숨는다).
 * 그래서 사람을 다 정한 뒤 막는 사람이 서는 칸마다 다시 셈한다: 보이는 막는 사람이 하나라도 있으면 막고, 없으면 튼다
 * (4-1 ㉡, ㉠ 고침 바퀴 Review 권고 ㄱ — 앞에는 숨는 쪽이 칸을 터 버려 가을에 형을 뚫고 지나갔다).
 */
export function setHidden(world: World, ids: ReadonlySet<string>): void {
  const [px, py] = tileOf(world.player);
  for (const a of world.actors) {
    if (!a.def) continue;
    const hide = ids.has(a.id);
    const [tx, ty] = a.def.at;
    if (!hide && a.hidden && a.def.solid && tx === px && ty === py) continue;
    if (a.hidden === hide) continue;
    a.hidden = hide;
    if (hide) {
      a.held = false;
      if (world.arrive?.kind === 'dweller' && world.arrive.actor === a) world.arrive = null;
    }
  }
  blockByStanders(world);
}

/** 막는 사람(solid)이 서는 칸마다: 보이는 막는 사람이 하나라도 있으면 막고, 모두 숨었으면 튼다 */
function blockByStanders(world: World): void {
  const standing = new Map<number, boolean>();
  for (const a of world.actors) {
    if (!a.def?.solid) continue;
    const i = a.def.at[1] * world.grid.w + a.def.at[0];
    standing.set(i, (standing.get(i) ?? false) || !a.hidden);
  }
  for (const [i, shown] of standing) world.grid.blocked[i] = shown ? 1 : 0;
}

/**
 * 떠 있는 표시를 바꾼다(일을 하나 마쳤을 때, 새 일이 열렸을 때).
 * 한 자리에 일이 둘이면 꼭 푸는 미션의 것 하나만 남긴다.
 */
export function setMarks(world: World, marks: Mark[]): void {
  const bySpot = new Map<string, Mark>();
  for (const mark of marks) {
    const had = bySpot.get(mark.spot.id);
    if (!had || (mark.must && !had.must)) bySpot.set(mark.spot.id, mark);
  }
  world.marks = [...bySpot.values()];
  if (world.arrive?.kind === 'mark') {
    const id = world.arrive.mark.id;
    if (!world.marks.some((m) => m.id === id)) world.arrive = null;
  }
  if (world.guide && !world.marks.some((m) => m.spot.id === world.guide)) world.guide = null;
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

/** 표시가 선 자리로 걸어간다(할 일 쪽지나 표시를 눌렀을 때). 다다르면 그 일이 열린다. */
export function walkToMark(world: World, mark: Mark): void {
  if (world.paused) return;
  world.wish = false;
  setRoute(world, mark.spot.stand, { kind: 'mark', mark });
}

/** 닫힌 문 앞까지 걸어간다. 다다르면 까닭이 뜬다. */
function walkToGate(world: World, lock: Lock): void {
  const from = tileOf(world.player);
  const to = nearestReachable(world.grid, from, lock.x / TILE, lock.y / TILE);
  world.wish = true;
  world.shownGate = null;
  world.target = null;
  setRoute(world, to, null);
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

/** 문 너머를 눌렀다고 치는 거리의 바탕(문마다 Gate.aim으로 정한다): 문 바로 뒤까지 */
const AIM_AT_GATE = 2;

/** (fx, fy)칸에서 가장 가까운 문의 칸까지의 거리(칸, 가로세로 가운데 큰 쪽) */
function gateDistance(world: World, index: number, fx: number, fy: number): number {
  let best = Infinity;
  for (const [x, y] of world.locks[index].closed.gate.tiles) best = Math.min(best, Math.max(Math.abs(x + 0.5 - fx), Math.abs(y + 0.5 - fy)));
  return best;
}

/** (fx, fy)칸에서 `within`보다 가까운 문 너머의 칸이 있으면 그 문의 차례를, 없으면 -1을 돌려준다(세 칸 안에서만 찾는다) */
function beyondNear(world: World, fx: number, fy: number, within: number): number {
  const { map, beyond } = world;
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  let best = -1;
  let bestD = Math.min(within, 3.5);
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      const index = beyond[y * map.w + x];
      if (index < 0) continue;
      const d = x === cx && y === cy ? 0 : Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
      if (d < bestD) {
        bestD = d;
        best = index;
      }
    }
  }
  return best;
}

/** 표시의 누름 칸: 표시의 자리에서 왼쪽·오른쪽으로(맵 점) */
export const MARK_LEFT = 8;
export const MARK_RIGHT = 12;

/**
 * 맵의 한 곳을 눌렀다(점 좌표). 사람이나 표시를 누르면 그 앞까지 가서 말을 걸고,
 * 그 밖에는 그곳까지(갈 수 없으면 가장 가까운 곳까지) 걸어간다. 걷는 도중에 누르면 바로 바뀐다.
 */
export function tapWorld(world: World, wx: number, wy: number): void {
  if (world.paused) return;
  world.wish = false;
  // 다시 누르면 문 앞의 까닭도 다시 뜬다
  world.shownGate = null;
  // 표시(깃발, 말풍선). 누름 칸은 그림처럼 오른쪽으로 치우친다(깃발 −3~+11, 말풍선 −5~+8 — 맵 점): 가로 −8~+12.
  // 4-1 ㉠(1-라 11.8 ③): 왼쪽이 ±12였을 때 여름 「이웃집 논」의 말풍선 칸이 곁의 논둑길(44,57)에 4점 걸쳐, 길을 누르다 덤이 열렸다
  for (const mark of world.marks) {
    const p = spotPoint(mark.spot);
    if (wx - p.x >= -MARK_LEFT && wx - p.x <= MARK_RIGHT && wy >= p.y - 34 && wy <= p.y + 14) {
      walkToMark(world, mark);
      world.target = null;
      return;
    }
  }
  // 막힌 길의 표시: 그 문을 누른 것으로 친다
  for (const lock of world.locks) {
    if (Math.abs(wx - lock.x) <= 12 && wy >= lock.y - 34 && wy <= lock.y + 10) {
      walkToGate(world, lock);
      return;
    }
  }
  // 사람. 논 안에 들어선 사람(종아리까지 벼와 물에 잠겨 보인다)은 머리와 가슴만 누름 자리로 친다
  // (논둑길을 누르다 곁의 논 안 사람이 눌리지 않게 — 1-라 review 24번)
  let hit: Actor | null = null;
  for (const a of world.actors) {
    if (!a.def || a.def.animal || a.hidden) continue;
    const t = world.map.terrain[Math.floor(a.y / TILE) * world.map.w + Math.floor(a.x / TILE)];
    const sunk = t === T.paddy || t === T.soil;
    if (Math.abs(wx - a.x) <= (sunk ? 6 : 9) && wy >= a.y - 28 && wy <= a.y + (sunk ? -10 : 4)) {
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
  // 닫힌 문의 칸이나 그 너머(문만 열리면 갈 수 있는 칸)를 눌렀으면 그 문 앞으로 간다.
  // 문 너머의 지붕이나 담을 눌렀을 때도 그렇다: 누른 곳에서 갈 수 있는 칸보다 문 너머의 칸이 더 가까우면 문 너머를 누른 것이다.
  const behind = beyondNear(world, wx / TILE, wy / TILE, Math.hypot(to[0] + 0.5 - wx / TILE, to[1] + 0.5 - wy / TILE));
  if (behind >= 0 && gateDistance(world, behind, wx / TILE, wy / TILE) <= (world.locks[behind].closed.gate.aim ?? AIM_AT_GATE)) {
    walkToGate(world, world.locks[behind]);
    return;
  }
  if (setRoute(world, to, null)) {
    const p = tileCenter(to[0], to[1]);
    world.target = { x: p.x, y: p.y, t: 0 };
  }
}

/** 자판의 방향(−1, 0, 1). 누르는 동안 그쪽으로 걷는다. */
export function setKeys(world: World, x: number, y: number): void {
  // 자판을 새로 누르기 시작하면 문 앞의 까닭도 다시 뜰 수 있다(까닭이 사라진 뒤 다시 밀어 볼 때 — review 15번)
  if (world.keys.x === 0 && world.keys.y === 0 && (x !== 0 || y !== 0)) world.shownGate = null;
  world.keys = { x, y };
}

/** Enter·Space: 가까이 있는 사람이나 자리에 말을 건다. 걸 것이 없으면 false. */
export function interact(world: World): WorldEvent | null {
  if (world.paused) return null;
  const p = world.player;
  let best: WorldEvent | null = null;
  let bestD = TILE * 1.9;
  for (const mark of world.marks) {
    const s = tileCenter(mark.spot.stand[0], mark.spot.stand[1]);
    const at = tileCenter(mark.spot.at[0], mark.spot.at[1]);
    const d = Math.min(Math.hypot(s.x - p.x, s.y - p.y), Math.hypot(at.x - p.x, at.y - p.y));
    if (d < bestD) {
      bestD = d;
      best = { type: 'mark', mark };
    }
  }
  // 표시가 선 자리에서는 사람보다 그 일이 먼저다(사람이 표시 바로 곁에 서 있을 때가 많다)
  if (best) return best;
  for (const a of world.actors) {
    if (!a.def || a.def.animal || a.hidden) continue;
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
      if (arrive?.kind === 'mark') {
        const at = tileCenter(arrive.mark.spot.at[0], arrive.mark.spot.at[1]);
        p.dir = dirOf(at.x - p.x, at.y - p.y, p.dir);
        events.push({ type: 'mark', mark: arrive.mark });
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

  // 문이나 그 너머를 누르고 와서 닫힌 문 한 칸 안에 멈춰 서면 까닭이 뜬다. 문 앞을 지나가거나, 다른 곳을 누르고 가다가
  // 문 곁에 멈췄을 때는 뜨지 않는다. 한 번 뜬 까닭은 다시 누르거나(tapWorld) 세 칸 넘게 물러났다 오면 다시 뜬다.
  // 자판으로는 문의 칸을 밀 때 뜬다.
  const [tx, ty] = tileOf(p);
  const near = closedGateNear(world.map, world.who, tx, ty, 1);
  const still = p.route.length === 0 && keys.x === 0 && keys.y === 0;
  if (near) {
    let trying = still && world.wish;
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
  // 멈춰 선 뒤에는 바람을 거둔다(그다음에 문 곁에 서는 것은 문을 누르고 온 것이 아니다)
  if (still) world.wish = false;
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
  if (!def || a.hidden) return;
  const p = world.player;
  const nearPlayer = Math.hypot(p.x - a.x, p.y - a.y);

  // 까치와 참새는 사람이 다가오면 날아올랐다가 돌아온다
  if (def.sprite === 'magpie' || def.sprite === 'sparrow') {
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
  stepCompanion(world, dt);
  if (world.target) {
    world.target.t += dt;
    if (world.player.route.length === 0 || world.target.t > 6) world.target = null;
  }
  // 하루의 빛은 2초쯤에 걸쳐 바뀐다. 창이 떠 있는 동안에는 멈춰 있다가, 맵으로 돌아오면 눈앞에서 바뀐다.
  if (!world.paused) {
    const ease = (now: number, goal: number): number => (goal > now ? Math.min(goal, now + dt / 2) : Math.max(goal, now - dt / 2));
    world.glow.morning = ease(world.glow.morning, world.light === 'morning' ? 1 : 0);
    world.glow.dusk = ease(world.glow.dusk, world.light === 'dusk' ? 1 : 0);
  }
  // 화면의 쏠림은 한 번에 바뀌지 않고 1.4초쯤에 걸쳐 차고 빠진다
  const want = pullGoal(world);
  const rate = dt / 1.4;
  world.pull = want > world.pull ? Math.min(want, world.pull + rate) : Math.max(want, world.pull - rate);
  const { map, view } = world;
  const f = focusOf(world);
  const goal = cameraGoal(f.x, f.y, view.w, view.h, map.w * TILE, map.h * TILE);
  world.cam = follow(world.cam, goal, dt);
  return events;
}
