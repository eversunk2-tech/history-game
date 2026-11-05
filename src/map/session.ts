// 맵의 한 판: 그림 벌(atlas), 맵 위의 상태(world), 그려 둔 것(scene)을 화면 밖에 들고 있는다.
// 화면 컴포넌트가 내려갔다 올라와도(계절 닫기, 처음으로 → 이어 하기) 다시 짓지 않고,
// 대화 장면은 맵을 내리지 않고 그 위에 얹히므로 돌아올 때 멈칫거리지 않는다(review 19번).
//
// 무게(spec 4.7.5의 ㅋ): 그림 벌은 지금 계절의 한 벌만 들고, 그 맵에 놓인 것과 나오는 사람만 짓는다.
// 땅은 화면 둘레부터 조각으로 칠하고 나머지는 쉬는 틈에 칠한다. 이야기를 여는 동안("나를 소개합니다")
// 첫 맵을 미리 짓는다(prepareMap → stepPrepare).

import type { Season } from '../engine/types';
import { anchorOf, thingKey } from '../pixel/catalog';
import {
  GROUND_CHUNK,
  baseSteps,
  buildAtlas,
  critterSteps,
  ensureAll,
  nearestChunk,
  needsOf,
  personSteps,
  thingMetaOf,
  thingSteps,
  tilesOver,
  undoneBox,
  workGround,
  workView,
  type Atlas,
  type GroundCanvas,
  type Needs,
  type Step,
} from '../pixel/atlas';
import { ART } from '../pixel/px';
import { cameraGoal } from './camera';
import { buildScene, groundFor, miniColors, type Scene } from './draw';
import { TILE, isWater, type MapData, type Weather, type Who } from './types';
import { createWorld, type World } from './world';

export interface MapSession {
  key: string;
  map: MapData;
  atlas: Atlas;
  world: World;
  scene: Scene;
  /** 작은 지도의 칸 빛깔 */
  mini: Uint32Array;
  /** 맵을 연 뒤 쉬는 틈에 지을 그림(걷는 쪽에 가까운 것부터) */
  later: Later[];
}

let held: { key: string; atlas: Atlas } | null = null;

const atlasKey = (season: Season, weather: Weather): string => `${season}/${season === 'summer' ? weather : 'clear'}`;

/**
 * 계절(과 날씨)의 그림 벌. 지금 계절의 한 벌만 든다 — 다른 계절을 부르면 들고 있던 벌을 놓는다.
 * needs를 주면 그것을 짓는다(이미 지은 것은 다시 짓지 않는다).
 */
export function atlasFor(season: Season, weather: Weather = 'clear', needs?: Needs): Atlas {
  const key = atlasKey(season, weather);
  if (!held || held.key !== key) {
    held = { key, atlas: buildAtlas(season, weather, { things: [], people: [], critters: [] }) };
    // 들고 있던 맵의 판과 미리 지은 땅도 그 벌의 것이라 함께 놓는다
    if (session && session.atlas !== held.atlas) session = null;
    if (prep && prep.atlas !== held.atlas) prep = null;
  }
  if (needs) ensureAll(held.atlas, needs);
  return held.atlas;
}

let session: MapSession | null = null;

// ── 미리 짓기 ─────────────────────────────────────────────
// 그림 올리기 ②의 고침(Review 권고 1의 길 2): 맵을 열기 전에는 처음 보이는 화면(+ 땅 조각 하나)에 걸치는 그림만 짓고,
// 나머지는 맵을 연 뒤 쉬는 틈에 걷는 쪽에 가까운 것부터 짓는다(땅을 칠하는 것과 같은 자리 — paintIdle).
// 판(그리는 차례·가림·굴뚝·땅의 그림자)은 그림을 짓기 전에 꼴의 표로 세우므로, 다 지은 판과 점 하나까지 같다.

/** 맵을 연 뒤에 할 일감 하나: 그 그림이 놓이는 자리들(맵 점 — 가장 가까운 것으로 잰다)과 일감들 */
export interface Later {
  at: readonly (readonly [number, number])[];
  steps: Step[];
}

interface Prep {
  map: MapData;
  atlas: Atlas;
  /** 맵을 열기 전에 다 해 둘 일감(벌의 바탕, 처음 화면 둘레의 세운 것·사람·짐승) */
  steps: Step[];
  /** 맵을 연 뒤 쉬는 틈에 해도 되는 일감(미리 짓는 화면이 오래 떠 있으면 그동안 이어 한다) */
  later: Later[];
  ground: GroundCanvas | null;
  /** 땅을 먼저 칠할 자리(맵 점) */
  focus: { x: number; y: number };
  /** 맵을 열 때 다 칠해 두어야 하는 네모(맵 점 — 처음 보이는 화면). 없으면 focus 둘레 한 화면쯤 */
  need: [number, number, number, number];
}

let prep: Prep | null = null;

/** 처음 보이는 화면의 어림(맵 점): 아이패드 가로 화면에 보이는 넓이보다 조금 넓게 */
const VIEW_GUESS = { w: 420, h: 260 };

/** 처음 보이는 화면 둘레의 넉넉함(맵 점): 땅 조각 하나 */
export const NEAR_PAD = GROUND_CHUNK / ART;

const overlaps = (a: readonly number[], b: readonly number[]): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** 사람·짐승이 서거나 오가는 자리들(맵 점) */
function placesOf(d: MapData['dwellers'][number]): [number, number][] {
  const out: [number, number][] = [[d.at[0] * TILE + 8, d.at[1] * TILE + 8]];
  for (const [x, y] of d.route ?? []) out.push([x * TILE + 8, y * TILE + 8]);
  if (d.range) {
    const r = d.range * TILE;
    out.push([out[0][0] - r, out[0][1] - r], [out[0][0] + r, out[0][1] + r]);
  }
  return out;
}

/**
 * 그 맵의 지을 것을 둘로 가른다: 처음 보이는 화면(near — 맵 점의 네모)에 그림이 걸치는 것(앞, focus에 가까운 차례)과
 * 나머지(뒤 — 자리와 함께). 벌의 바탕은 앞에 두되, 물결은 그 화면에 물이 없으면 뒤로 미룬다.
 */
export function splitNeeds(map: MapData, atlas: Atlas, heroes: readonly string[], near: readonly number[], focus: { x: number; y: number }): { now: Step[]; later: Later[] } {
  const needs = needsOf(map, heroes);
  const at = new Map<string, [number, number][]>();
  const close = new Set<string>();
  for (const o of map.objects) {
    const keys = o.gate ? [thingKey(o.kind, 0), thingKey(o.kind, 1)] : [thingKey(o.kind, o.variant)];
    const a = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
    for (const key of keys) {
      const meta = thingMetaOf(atlas, key);
      if (!meta) continue;
      const box = [a.x - meta.ax / ART, a.y - meta.ay / ART, a.x + (meta.w - meta.ax) / ART, a.y + (meta.h - meta.ay) / ART];
      if (overlaps(box, near)) close.add(key);
      let list = at.get(key);
      if (!list) at.set(key, (list = []));
      list.push([a.x, a.y]);
    }
  }
  const dist = (pts: readonly (readonly [number, number])[]): number => Math.min(...pts.map(([x, y]) => (x - focus.x) ** 2 + (y - focus.y) ** 2));
  const people = new Map<string, [number, number][]>();
  for (const d of map.dwellers) {
    let list = people.get(d.sprite);
    if (!list) people.set(d.sprite, (list = []));
    list.push(...placesOf(d));
  }
  const nearPlace = (pts: readonly (readonly [number, number])[]): boolean => pts.some(([x, y]) => x >= near[0] && x < near[2] && y >= near[1] && y < near[3]);
  const now: Step[] = [];
  const later: Later[] = [];
  // 벌의 바탕: 처음 화면(과 그 둘레 한 칸)에 물이 있으면 물결까지
  let wet = false;
  for (let ty = Math.max(0, Math.floor(near[1] / TILE) - 1); ty <= Math.min(map.h - 1, Math.floor(near[3] / TILE) + 1) && !wet; ty++) {
    for (let tx = Math.max(0, Math.floor(near[0] / TILE) - 1); tx <= Math.min(map.w - 1, Math.floor(near[2] / TILE) + 1); tx++) {
      if (isWater(map.terrain[ty * map.w + tx])) {
        wet = true;
        break;
      }
    }
  }
  now.push(...baseSteps(atlas, 'rest'));
  if (wet) now.push(...baseSteps(atlas, 'water'));
  else later.push({ at: [[focus.x, focus.y]], steps: baseSteps(atlas, 'water') });
  // 세운 것: 처음 화면에 걸치는 것은 focus에 가까운 차례로 지금, 나머지는 뒤로
  const things = [...needs.things].sort((a, b) => dist(at.get(a) ?? [[0, 0]]) - dist(at.get(b) ?? [[0, 0]]));
  for (const key of things) {
    const steps = thingSteps(atlas, key);
    if (steps.length === 0) continue;
    if (close.has(key) || !at.has(key)) now.push(...steps);
    else later.push({ at: at.get(key) ?? [[focus.x, focus.y]], steps });
  }
  // 사람(주인공은 늘 지금)과 짐승: 처음 화면에 서거나 오가는 이는 지금, 나머지는 뒤로
  for (const name of needs.people) {
    const steps = personSteps(atlas, name);
    if (steps.length === 0) continue;
    const pts = people.get(name);
    if (!pts || heroes.includes(name) || nearPlace(pts)) now.push(...steps);
    else later.push({ at: pts, steps });
  }
  for (const name of needs.critters) {
    const steps = critterSteps(atlas, name);
    if (steps.length === 0) continue;
    const pts = people.get(name);
    if (!pts || nearPlace(pts)) now.push(...steps);
    else later.push({ at: pts, steps });
  }
  return { now, later };
}

/** 뒤로 미룬 일감 가운데 (x, y)에 가장 가까운 것의 번호(없으면 −1) */
function nearestLater(later: readonly Later[], x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < later.length; i++) {
    for (const [px, py] of later[i].at) {
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

/** 뒤로 미룬 일감을 (x, y)에 가까운 것부터 budget 밀리초쯤 한다(t0부터 잰다 — 적어도 한 걸음은 한다). 남았으면 true */
function workLater(later: Later[], x: number, y: number, t0: number, budgetMs: number): boolean {
  let first = true;
  while (later.length > 0 && (first || performance.now() - t0 < budgetMs)) {
    const i = nearestLater(later, x, y);
    const job = later[i];
    // 한 그림의 일감은 이어서 한다(다른 자리로 옮겨 가지 않게)
    while (job.steps.length > 0 && (first || performance.now() - t0 < budgetMs)) {
      first = false;
      if (job.steps[0]() !== true) job.steps.shift();
    }
    if (job.steps.length === 0) later.splice(i, 1);
  }
  return later.length > 0;
}

/**
 * 이 맵을 미리 짓기 시작한다(처음 보이는 화면에 걸치는 그림 → 그 화면의 땅 → 나머지 그림 → 나머지 땅, 처음 설 자리에 가까운 것부터).
 * 한 번에 다 하지 않는다 — stepPrepare를 쉬는 틈마다 부른다. view는 처음 보이는 화면의 크기(맵 점).
 */
export function prepareMap(map: MapData, heroes: readonly string[], start?: [number, number], view: { w: number; h: number } = VIEW_GUESS): void {
  const atlas = atlasFor(map.season, map.weather);
  const focus = start ? { x: start[0] * TILE + 8, y: start[1] * TILE + 8 } : { x: (map.w * TILE) / 2, y: (map.h * TILE) / 2 };
  // 처음 보이는 화면: 맵 화면의 카메라처럼 주인공(칸 안의 발치 y + 10)에서 10점 위를 바라본다. 카메라가 조금 달리 서도
  // (볼거리 쪽으로 쏠리기 시작하거나 화면 크기가 한두 점 다르거나) 첫 장에 칠하지 않은 땅이 들지 않게 둘레 한 칸을 더 칠해 둔다
  const cam = cameraGoal(focus.x, focus.y - 8, view.w, view.h, map.w * TILE, map.h * TILE);
  const need: Prep['need'] = [cam.x - TILE, cam.y - TILE, cam.x + view.w + TILE, cam.y + view.h + TILE];
  const near = [need[0] - NEAR_PAD, need[1] - NEAR_PAD, need[2] + NEAR_PAD, need[3] + NEAR_PAD];
  if (prep && prep.map === map && prep.atlas === atlas) {
    // 처음 보이는 화면이 바뀌었다(맵 화면이 실제 크기로 다시 부른다): 아직 미뤄 둔 것 가운데 새 화면에 걸치는 것을 앞으로 당긴다
    if (prep.need.some((v, i) => v !== need[i])) {
      const again = splitNeeds(map, atlas, heroes, near, focus);
      prep.steps = again.now;
      prep.later = again.later;
    }
    prep.focus = focus;
    prep.need = need;
    return;
  }
  const { now, later } = splitNeeds(map, atlas, heroes, near, focus);
  prep = { map, atlas, steps: now, later, ground: null, focus, need };
}

/** 미리 짓기를 budget 밀리초쯤 한다. 다 지었으면(뒤로 미룬 그림과 땅까지 모두) true. */
export function stepPrepare(budgetMs = 8): boolean {
  if (!prep) return true;
  const p = prep;
  const t0 = performance.now();
  while (performance.now() - t0 < budgetMs) {
    const step = p.steps[0];
    if (step) {
      // 일감이 아직 남았다고 하면(true) 다음에 다시 부른다
      if (step() !== true) p.steps.shift();
      continue;
    }
    if (!p.ground) {
      p.ground = groundFor(p.map, p.atlas);
      continue;
    }
    const g = p.ground;
    // 처음 보이는 화면의 땅(그 화면에 걸친 칸만 네모 하나로) → 미뤄 둔 그림(처음 설 자리에 가까운 것부터) → 나머지 땅(조각마다)
    const left = Math.max(0.5, budgetMs - (performance.now() - t0));
    if (!workView(g, left, p.need)) continue;
    if (p.later.length > 0) {
      workLater(p.later, p.focus.x, p.focus.y, t0, budgetMs);
      continue;
    }
    if (g.left === 0) return true;
    // 조각은 잘게 나눠 칠한다 — 한 번에 오래 막지 않는다
    workGround(g, Math.max(0.5, budgetMs - (performance.now() - t0)), () => nearestChunk(g, p.focus.x, p.focus.y));
  }
  return prep.ground !== null && prep.ground.left === 0 && prep.later.length === 0;
}

/** 이 맵을 열 준비가 되었는가: 처음 보이는 화면에 걸치는 그림을 다 짓고 그 화면의 땅을 다 칠했다 */
export function prepReady(map: MapData): boolean {
  if (!prep || prep.map !== map || !held || prep.atlas !== held.atlas || prep.steps.length > 0 || !prep.ground) return false;
  const g = prep.ground;
  return !undoneBox(g, tilesOver(g, prep.need[0], prep.need[1], prep.need[2], prep.need[3]));
}

/** 쉬는 틈을 잇는다: MessageChannel이 있으면 그것으로(setTimeout의 4ms 밀림 없이 — Review 권고 1의 길 1), 없으면 setTimeout으로 */
export function idleLoop(): { next(run: () => void, ms?: number): void; stop(): void } {
  let timer = 0;
  let stopped = false;
  let channel: MessageChannel | null = null;
  // 쉬는 틈의 일감은 하나만 걸어 둔다(앞의 것이 돌기 전에 또 부르면 새것으로 바꾼다)
  let queued: (() => void) | null = null;
  if (typeof MessageChannel !== 'undefined') {
    channel = new MessageChannel();
    channel.port1.onmessage = () => {
      const run = queued;
      queued = null;
      if (!stopped && run) run();
    };
  }
  return {
    next(run, ms = 0) {
      if (stopped) return;
      if (channel && ms === 0) {
        queued = run;
        channel.port2.postMessage(0);
      } else timer = setTimeout(() => !stopped && run(), ms) as unknown as number;
    },
    stop() {
      stopped = true;
      queued = null;
      clearTimeout(timer);
      if (channel) {
        channel.port1.onmessage = null;
        channel.port1.close();
        channel.port2.close();
      }
    },
  };
}

/**
 * 쉬는 틈마다 미리 짓기를 이어 가는 고리(제목 화면, 계절 닫기, 소개 화면이 쓴다). 한 번에 budget 밀리초만 하고 쉰다.
 * 돌려주는 함수를 부르면 멈춘다.
 */
export function prewarm(map: MapData, heroes: readonly string[], start?: [number, number], budgetMs = 6): () => void {
  const loop = idleLoop();
  const step = (): void => {
    if (!stepPrepare(budgetMs)) loop.next(step);
  };
  loop.next(() => {
    prepareMap(map, heroes, start);
    step();
  }, 60);
  return () => loop.stop();
}

// ── 판 ───────────────────────────────────────────────────

export interface SessionSpec {
  /** 같은 판·같은 계절·같은 사람이면 같은 열쇠 */
  key: string;
  /** 그 계절(과 날씨)의 모습으로 지은 맵. 그림 벌도 이 맵의 계절을 따른다. */
  map: MapData;
  who: Who;
  hero: string;
  /** 이어 할 때: 마지막에 서 있던 칸 */
  at?: [number, number];
  /** 이어 할 때: 가 본 칸(칸마다 0/1) */
  walked?: Uint8Array;
}

/** 열쇠가 같으면 들고 있던 판을 그대로 돌려주고, 다르면 새로 짓는다. */
export function openSession(spec: SessionSpec): MapSession {
  if (session && session.key === spec.key && held && session.atlas === held.atlas) return session;
  // 그림은 짓지 않는다(판은 꼴의 표로 세운다) — 미리 지은 것은 이어 쓰고, 남은 것은 맵을 연 뒤 쉬는 틈에 짓는다
  const atlas = atlasFor(spec.map.season, spec.map.weather);
  const world = createWorld(spec.map, spec.who, spec.hero, spec.at);
  if (spec.walked && spec.walked.length === world.visited.length) {
    for (let i = 0; i < world.visited.length; i++) if (spec.walked[i]) world.visited[i] = 1;
  }
  const same = prep !== null && prep.map === spec.map && prep.atlas === atlas;
  // 미리 칠해 둔 땅이 있으면 그것을 이어 쓴다(같은 맵, 같은 벌)
  const ground = same && prep?.ground ? prep.ground : groundFor(spec.map, atlas);
  let later: Later[];
  if (same && prep) {
    // 다 짓지 못한 앞의 일감도 뒤로(주인공 둘레부터)
    later = [...(prep.steps.length > 0 ? [{ at: [[world.player.x, world.player.y]] as [number, number][], steps: prep.steps }] : []), ...prep.later];
    prep.steps = [];
    prep.later = [];
    prep.ground = ground;
  } else {
    // 미리 짓지 않고 바로 열었다: 모두 뒤로 미루고(벌의 바탕·주인공은 주인공 자리에), 처음 보이는 것은 그리기가 그 자리에서 짓는다
    const p = world.player;
    const all = splitNeeds(spec.map, atlas, [spec.hero], [-1, -1, -1, -1], { x: p.x, y: p.y });
    later = [{ at: [[p.x, p.y]], steps: all.now }, ...all.later];
  }
  session = { key: spec.key, map: spec.map, atlas, world, scene: buildScene(spec.map, atlas, world, ground), mini: miniColors(spec.map, atlas), later };
  return session;
}

/**
 * 맵을 연 뒤에 남은 그림과 땅을 budget 밀리초만 짓고 칠한다(spec 4.7.5의 ㅋ — 한 장의 시간 안에 나눠). 걷는 쪽으로 앞선 자리(ahead, 맵 점)에서
 * 가까운 것부터 해, 화면이 닿기 전에 해 둔다. 그림을 먼저(땅의 그림자는 그림 없이도 안다), 다음에 땅. 다 했으면 false.
 */
export function paintIdle(s: MapSession, budgetMs: number, ahead: { x: number; y: number } = s.world.player): boolean {
  const t0 = performance.now();
  if (s.later.length > 0 && workLater(s.later, ahead.x, ahead.y, t0, budgetMs)) return true;
  const g = s.scene.ground;
  if (g.left === 0) return s.later.length > 0;
  const left = budgetMs - (performance.now() - t0);
  if (left > 0.5) workGround(g, left, () => nearestChunk(g, ahead.x, ahead.y));
  return g.left > 0 || s.later.length > 0;
}

/** 맵을 연 뒤 쉬는 틈에 할 것(그림·땅)이 남았는가 */
export function idleLeft(s: MapSession): boolean {
  return s.later.length > 0 || s.scene.ground.left > 0;
}

/** 지금 들고 있는 판(없으면 null) */
export function heldSession(): MapSession | null {
  return session;
}

export function dropSession(): void {
  session = null;
}
