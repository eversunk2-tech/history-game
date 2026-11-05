// 맵의 한 판: 그림 벌(atlas), 맵 위의 상태(world), 그려 둔 것(scene)을 화면 밖에 들고 있는다.
// 화면 컴포넌트가 내려갔다 올라와도(계절 닫기, 처음으로 → 이어 하기) 다시 짓지 않고,
// 대화 장면은 맵을 내리지 않고 그 위에 얹히므로 돌아올 때 멈칫거리지 않는다(review 19번).
//
// 무게(spec 4.7.5의 ㅋ): 그림 벌은 지금 계절의 한 벌만 들고, 그 맵에 놓인 것과 나오는 사람만 짓는다.
// 땅은 화면 둘레부터 조각으로 칠하고 나머지는 쉬는 틈에 칠한다. 이야기를 여는 동안("나를 소개합니다")
// 첫 맵을 미리 짓는다(prepareMap → stepPrepare).

import type { Season } from '../engine/types';
import { buildAtlas, ensureAll, nearestChunk, needsOf, prepareSteps, workGround, type Atlas, type GroundCanvas, type Needs, type Step } from '../pixel/atlas';
import { cameraGoal } from './camera';
import { buildScene, groundFor, miniColors, type Scene } from './draw';
import { TILE, type MapData, type Weather, type Who } from './types';
import { createWorld, type World } from './world';

export interface MapSession {
  key: string;
  map: MapData;
  atlas: Atlas;
  world: World;
  scene: Scene;
  /** 작은 지도의 칸 빛깔 */
  mini: Uint32Array;
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

interface Prep {
  map: MapData;
  atlas: Atlas;
  steps: Step[];
  ground: GroundCanvas | null;
  /** 땅을 먼저 칠할 자리(맵 점) */
  focus: { x: number; y: number };
  /** 맵을 열 때 다 칠해 두어야 하는 네모(맵 점 — 처음 보이는 화면). 없으면 focus 둘레 한 화면쯤 */
  need: [number, number, number, number];
}

let prep: Prep | null = null;

/** 처음 보이는 화면의 어림(맵 점): 아이패드 가로 화면에 보이는 넓이보다 조금 넓게 */
const VIEW_GUESS = { w: 420, h: 260 };

/**
 * 이 맵을 미리 짓기 시작한다(그림 벌의 낱그림 → 처음 보이는 화면의 땅 → 나머지 땅, 처음 설 자리에 가까운 것부터).
 * 한 번에 다 하지 않는다 — stepPrepare를 쉬는 틈마다 부른다. view는 처음 보이는 화면의 크기(맵 점).
 */
export function prepareMap(map: MapData, heroes: readonly string[], start?: [number, number], view: { w: number; h: number } = VIEW_GUESS): void {
  const atlas = atlasFor(map.season, map.weather);
  const focus = start ? { x: start[0] * TILE + 8, y: start[1] * TILE + 8 } : { x: (map.w * TILE) / 2, y: (map.h * TILE) / 2 };
  const cam = cameraGoal(focus.x, focus.y, view.w, view.h, map.w * TILE, map.h * TILE);
  const need: Prep['need'] = [cam.x, cam.y, cam.x + view.w, cam.y + view.h];
  if (prep && prep.map === map && prep.atlas === atlas) {
    prep.focus = focus;
    prep.need = need;
    return;
  }
  const needs = needsOf(map, heroes);
  prep = { map, atlas, steps: prepareSteps(atlas, needs), ground: null, focus, need };
}

/** 미리 짓기를 budget 밀리초쯤 한다. 다 지었으면(땅까지 모두) true. */
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
    if (g.left === 0) return true;
    const left = budgetMs - (performance.now() - t0);
    // 처음 보이는 화면의 조각부터, 그다음 가까운 것부터(조각은 잘게 나눠 칠한다 — 한 번에 오래 막지 않는다)
    workGround(g, Math.max(0.5, left), () => {
      const i = nearestChunk(g, p.focus.x, p.focus.y, p.need);
      return i >= 0 ? i : nearestChunk(g, p.focus.x, p.focus.y);
    });
  }
  return prep.ground !== null && prep.ground.left === 0;
}

/** 이 맵을 열 준비가 되었는가: 그림 벌을 다 짓고 처음 보이는 화면의 땅을 다 칠했다 */
export function prepReady(map: MapData): boolean {
  if (!prep || prep.map !== map || !held || prep.atlas !== held.atlas || prep.steps.length > 0 || !prep.ground) return false;
  const g = prep.ground;
  return nearestChunk(g, prep.focus.x, prep.focus.y, prep.need) < 0;
}

/**
 * 쉬는 틈마다 미리 짓기를 이어 가는 고리(제목 화면, 계절 닫기, 소개 화면이 쓴다). 한 번에 budget 밀리초만 하고 쉰다.
 * 돌려주는 함수를 부르면 멈춘다.
 */
export function prewarm(map: MapData, heroes: readonly string[], start?: [number, number], budgetMs = 6): () => void {
  let stopped = false;
  let timer = 0;
  const step = (): void => {
    if (stopped) return;
    if (!stepPrepare(budgetMs)) timer = window.setTimeout(step, 4);
  };
  timer = window.setTimeout(() => {
    if (stopped) return;
    prepareMap(map, heroes, start);
    step();
  }, 60);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
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
  const atlas = atlasFor(spec.map.season, spec.map.weather, needsOf(spec.map, [spec.hero]));
  const world = createWorld(spec.map, spec.who, spec.hero, spec.at);
  if (spec.walked && spec.walked.length === world.visited.length) {
    for (let i = 0; i < world.visited.length; i++) if (spec.walked[i]) world.visited[i] = 1;
  }
  // 미리 칠해 둔 땅이 있으면 그것을 이어 쓴다(같은 맵, 같은 벌)
  const ground = prep && prep.map === spec.map && prep.atlas === atlas && prep.ground ? prep.ground : groundFor(spec.map, atlas);
  if (prep && prep.map === spec.map) {
    prep.steps = [];
    prep.ground = ground;
  }
  session = { key: spec.key, map: spec.map, atlas, world, scene: buildScene(spec.map, atlas, world, ground), mini: miniColors(spec.map, atlas) };
  return session;
}

/**
 * 맵을 연 뒤에 남은 땅을 budget 밀리초만 칠한다(spec 4.7.5의 ㅋ — 한 장의 시간 안에 나눠). 걷는 쪽으로 앞선 자리(ahead, 맵 점)에서
 * 가까운 조각부터 칠해, 화면이 닿기 전에 칠해 둔다. 다 칠했으면 false.
 */
export function paintIdle(s: MapSession, budgetMs: number, ahead: { x: number; y: number } = s.world.player): boolean {
  const g = s.scene.ground;
  if (g.left === 0) return false;
  workGround(g, budgetMs, () => nearestChunk(g, ahead.x, ahead.y));
  return g.left > 0;
}

/** 지금 들고 있는 판(없으면 null) */
export function heldSession(): MapSession | null {
  return session;
}

export function dropSession(): void {
  session = null;
}
