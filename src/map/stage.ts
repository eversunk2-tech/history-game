// 맵 틀(4-1 ㉢ — MapScreen에서 떼었다. spec 11.1 나): 미리 짓기 → 세션 열기 → 놀이 고리(걷기·그리기·남은 땅 칠하기) → 누름과 자판 → 작은 지도 → 화살표.
// 현장(screens/MapScreen.tsx)과 ㉣의 거점 맵이 함께 쓴다. 이 틀은 맵에 무엇이 서 있는지(일·사람의 뜻)를 모른다 —
// 그 판의 일(표시·알림·자리 적기)은 부르는 쪽이 hooks로 받는다. 화면(Preact)도 모른다: DOM 요소 셋과 hooks만 받는다.
//
// 판을 새로 지을 때 누름을 넘기는 셈(4-1 ㉠ 고침 바퀴, Review 권고 ㄴ): 대화가 닫힌 뒤 맵의 모습이 바뀌면(가을걷이 뒤 등) 판을 새로 짓는다.
// 짓는 동안 화면에는 앞 판이 남아 있어, 그동안 누른 것은 앞 판의 카메라로 맵의 점으로 옮겨 적었다가 새 판이 열리면 한 번만 쓰고 비운다(마지막 누름 하나).
// 넘긴 누름에는 맵 이름을 함께 적어 새 판의 맵이 다르면 버린다(㉣에서 거점 ↔ 현장을 한 화면에서 바꿔 짓게 될 때 — Review 기록 4).
// 눌려 있는 화살표는 새 판에 이어 간다. 판을 몇 번 지어도 이어 가는 것(눌린 화살표·넘길 누름·마지막에 그린 화면)은 부르는 쪽이 StageKeep으로 들고 있다.

import { artScale, scaleFor } from './camera';
import { render, stepScene, type View } from './draw';
import { tileOf } from './path';
import { idleLeft, idleLoop, openSession, paintIdle, prepReady, prepareMap, stepPrepare, type MapSession } from './session';
import { TILE, zoneAt, type MapData, type Spot } from './types';
import { interact, setKeys, snapCamera, stepWorld, tapWorld, walkToMark, type World, type WorldEvent } from './world';
import type { Look, RoleId } from '../engine/types';
import { ART, hex } from '../pixel/px';
import { packBits, unpackBits } from '../state/storage';

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, -1],
  s: [0, 1],
};

/** 마지막으로 그린 화면: 주인공의 점, 카메라, 배율(누른 화면의 점을 맵의 점으로 옮기는 셈의 재료) */
export interface Shown {
  px: number;
  py: number;
  cx: number;
  cy: number;
  s: number;
}

/** 새 판에 넘길 누름 하나(맵의 점)와 그 누름을 받은 맵의 이름 */
export interface Carried {
  map: string;
  x: number;
  y: number;
}

/** 판(주인공·카메라)과 배율에서 지금 그린 화면을 적는다 */
export function shownOf(world: Pick<World, 'player' | 'cam'>, scale: number): Shown {
  return { px: world.player.x, py: world.player.y, cx: world.cam.x, cy: world.cam.y, s: scale };
}

/** 화면의 점(캔버스 왼쪽 위에서 기기 화소)을 맵의 점으로: 그리기(render)와 같은 셈 — 주인공이 찍히는 화소를 먼저 정수로 정한다 */
export function mapPointOf(dx: number, dy: number, shown: Shown): { x: number; y: number } {
  const { px, py, cx, cy, s } = shown;
  const camX = Math.round(px * s) - Math.round((px - cx) * s);
  const camY = Math.round(py * s) - Math.round((py - cy) * s);
  return { x: (dx + camX) / s, y: (dy + camY) / s };
}

/**
 * 판을 짓는 동안 누른 화면의 점: 그때 화면에 남아 있는 앞 판(shown — 마지막으로 그린 화면)의 카메라로 맵의 점으로 옮겨 적는다.
 * 앞 화면이 없으면(처음 열 때 — 아직 아무것도 그리지 않았다) null(버린다).
 */
export function carryTap(map: string, dx: number, dy: number, shown: Shown | null): Carried | null {
  if (!shown) return null;
  const p = mapPointOf(dx, dy, shown);
  return { map, x: p.x, y: p.y };
}

/** 앞 판을 내릴 때: 그 판에서 마지막으로 누른 길을 아직 걷는 중이면 그 누름을 새 판에 넘긴다 */
export function carryWalk(map: string, tapped: { x: number; y: number } | null, walking: boolean): Carried | null {
  return tapped && walking ? { map, x: tapped.x, y: tapped.y } : null;
}

/**
 * 새 판을 열 때 넘긴 누름을 꺼낸다 — 한 번만 쓰고 비운다(다음 다시 짓기에 또 걷지 않게).
 * 새 판의 맵이 누름을 받은 맵과 다르면, 또는 창(대화 장면 등)이 떠 있으면 비우기만 하고 버린다.
 */
export function takeCarried(holder: { current: Carried | null }, map: string, overlaid: boolean): { x: number; y: number } | null {
  const carried = holder.current;
  holder.current = null;
  if (!carried || overlaid || carried.map !== map) return null;
  return { x: carried.x, y: carried.y };
}

/** 눌려 있는 자판들로 걷는 쪽(-1·0·1). 화살표가 아닌 것은 셈하지 않는다 */
export function keysOf(held: ReadonlySet<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const k of held) {
    const d = KEY_DIRS[k];
    if (d) {
      x += d[0];
      y += d[1];
    }
  }
  return { x: Math.sign(x), y: Math.sign(y) };
}

/**
 * 새 판을 열 때 걸 것: 지금 눌려 있는 화살표대로의 걷기(판을 짓는 동안 누른 것도 — 없으면 선다)와, 넘겨받은 누름(한 번만 — takeCarried).
 * 맵 틀은 이것을 새 판에 그대로 건다.
 */
export function openingInput(
  held: ReadonlySet<string>,
  holder: { current: Carried | null },
  map: string,
  overlaid: boolean,
): { keys: { x: number; y: number }; tap: { x: number; y: number } | null } {
  return { keys: keysOf(held), tap: takeCarried(holder, map, overlaid) };
}

/**
 * 걷는 쪽으로 앞선 자리(맵 점) — 남은 땅을 칠할 차례를 고를 때 쓴다. 가는 길이 있으면 그 길을 따라 200점쯤 앞,
 * 화살표 자판으로 걸으면 그쪽으로 200점, 서 있으면 제자리.
 */
function aheadOf(world: World): { x: number; y: number } {
  const p = world.player;
  const AHEAD = 200;
  if (p.route.length > 0) {
    let left = AHEAD;
    let x = p.x;
    let y = p.y;
    for (const q of p.route) {
      const d = Math.hypot(q.x - x, q.y - y);
      if (d >= left) return { x: x + ((q.x - x) * left) / d, y: y + ((q.y - y) * left) / d };
      left -= d;
      x = q.x;
      y = q.y;
    }
    return { x, y };
  }
  const { x: kx, y: ky } = world.keys;
  if (kx !== 0 || ky !== 0) {
    const len = Math.hypot(kx, ky);
    return { x: p.x + (kx / len) * AHEAD, y: p.y + (ky / len) * AHEAD };
  }
  return { x: p.x, y: p.y };
}

/** 판을 몇 번 지어도 이어 가는 것(부르는 쪽 — 화면의 컴포넌트가 useRef로 들고 있다) */
export interface StageKeep {
  /** 눌려 있는 화살표 */
  heldRef: { current: Set<string> };
  /** 새 판에 넘길 누름(맵의 점) */
  carryRef: { current: Carried | null };
  /** 마지막에 그린 화면(누른 자리를 맵의 점으로 옮기는 셈) */
  shownRef: { current: Shown | null };
}

export function newStageKeep(): StageKeep {
  return { heldRef: { current: new Set<string>() }, carryRef: { current: null }, shownRef: { current: null } };
}

export interface StageEls {
  canvas: HTMLCanvasElement;
  /** 캔버스가 놓인 무대(크기를 잰다) */
  stage: HTMLElement;
  /** 작은 지도의 캔버스(맵 칸 하나 = 점 하나) */
  mini: HTMLCanvasElement;
  /** 화살표가 피해 갈 자리(할 일 쪽지·작은 지도 등 — 캔버스 위에 얹힌 것) */
  avoid: () => readonly (HTMLElement | null)[];
}

export interface StageHooks {
  /** 판의 열쇠(바뀌면 부르는 쪽이 틀을 새로 연다) */
  key: string;
  map: MapData;
  who: { role: RoleId; look: Look };
  /** 주인공의 그림 이름 · 곁에 떠 있는 동료(정령 'neuti' — 없으면 혼자) */
  hero: string;
  companion?: string;
  /** 처음 설 칸(저장의 서 있던 칸 — 없으면 맵이 정한 첫 칸) */
  startAt: () => [number, number] | undefined;
  /** 가 본 칸을 묶은 글자 */
  walked: () => string;
  /** 맵 위에 창이 떠 있어 걷기·자판을 멈출 때 */
  overlaid: () => boolean;
  /** 맵이 창에 다 덮여 그리지 않아도 될 때(대화 장면) */
  covered: () => boolean;
  /** 판이 열렸을 때(표시·사람 가리기·첫 알림을 건다) */
  onOpen: (world: World, session: MapSession) => void;
  /** 걷다 생긴 일(문·표시·사람·글) */
  onEvents: (world: World, events: WorldEvent[]) => void;
  /** 한 장마다(그린 뒤): 지금 시각·몇 번째 장·창이 떠 있는가 */
  onFrame: (world: World, now: number, tick: number, busy: boolean) => void;
  /** 작은 지도가 서 있는 구역을 알 때(여덟 장마다) */
  onZone: (zone: { id: string; label: string } | null) => void;
  /** 누르거나 화살표로 걷기 시작했을 때(쪽지를 접는다) */
  onWalk: () => void;
  /** 판을 내릴 때(서 있던 자리를 적는다) */
  onClose: (world: World) => void;
  /** 작은 지도의 배율 · 초당 장 수(?fps) */
  onMiniScale?: (scale: number) => void;
  onFps?: (fps: number) => void;
}

/** 만드는 사람이 재고 찍어 볼 때 쓰는 값들. 개발 때만 창에 걸어 둔다(빌드에는 들어가지 않는다). */
interface DevHooks {
  __world?: World;
  __scene?: MapSession['scene'];
  __fps?: number;
  __ms?: number;
  __overview?: () => string;
}

/** 맵 틀을 연다. 멈추는 함수를 돌려준다(부르는 쪽의 효과가 정리할 때 부른다) */
export function openStage(els: StageEls, hooks: StageHooks, keep: StageKeep): () => void {
  const { canvas, stage, mini } = els;
  const { map, key } = hooks;
  const { carryRef, shownRef } = keep;
  // 눌려 있는 화살표는 판을 새로 지어도 이어 간다(heldRef — 새 판을 열 때 openingInput). 틀을 여는 처음에 둔다
  // (뒤에 두면 판을 바로 열 때 앞에서 쓰게 되어 TDZ 오류가 난다 — ㉡ Review 기록 5)
  const held = keep.heldRef.current;
  const overlaid = hooks.overlaid;
  const ctx = canvas.getContext('2d', { alpha: false });
  const mctx = mini.getContext('2d');
  if (!ctx || !mctx) return () => undefined;

  let stopped = false;
  let raf = 0;
  let session: MapSession | null = null;
  const view: View = { ctx, w: 0, h: 0, scale: 3 };
  // 주소의 매개변수(?fps, ?awake, ?at=칸,칸)는 개발 때만 먹는다
  const query = new URLSearchParams(import.meta.env.DEV ? window.location.search : '');
  const showFps = query.has('fps');
  // 만드는 사람이 가려진 창에서 돌려 볼 때 쓴다(?awake). 보통은 화면이 가려지면 멈춘다.
  const stayAwake = query.has('awake');
  const dev = window as unknown as DevHooks;

  /** 이 화면에 그린 맵의 자리(누른 자리를 맵의 점으로 옮길 때 — 판을 새로 짓는 동안에도 그 화면이 남아 있다) */
  const remember = (world: World): void => {
    shownRef.current = shownOf(world, view.scale);
  };
  /** 이 판에서 마지막으로 누른 맵의 점(그 길을 걷는 동안 판이 바뀌면 새 판에 넘긴다) */
  let tapped: { x: number; y: number } | null = null;

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const hadW = canvas.width;
    const hadH = canvas.height;
    const rect = stage.getBoundingClientRect();
    const w = Math.max(64, Math.round(rect.width * dpr));
    const h = Math.max(64, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    // 캔버스의 화소와 화면의 화소를 하나씩 맞춘다(흐려지지 않게).
    // 위쪽 띠의 높이가 소수로 떨어지는 화면에서는 캔버스를 화소 금에 맞게 조금 당겨 놓는다.
    canvas.style.width = `${w / dpr}px`;
    canvas.style.height = `${h / dpr}px`;
    const offX = (rect.left * dpr) % 1;
    const offY = (rect.top * dpr) % 1;
    canvas.style.left = `${-offX / dpr}px`;
    canvas.style.top = `${-offY / dpr}px`;
    view.w = w;
    view.h = h;
    // 그림 점(ART)이 기기 화소의 정수배가 되게 짝수 배율로(spec 13.1의 53번)
    view.scale = artScale(scaleFor(w, h, dpr), dpr, ART);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    hooks.onMiniScale?.(Math.max(2, Math.round(rem / 8)));
    if (session) {
      session.world.view = { w: w / view.scale, h: h / view.scale };
      snapCamera(session.world);
      // 크기가 바뀌면 캔버스가 비워진다. 바로 다시 그려 한 장이 비어 보이지 않게 한다
      // (대화 장면을 여닫을 때 위쪽 띠의 높이가 바뀌어 무대의 크기가 달라진다).
      if ((hadW !== w || hadH !== h) && !hooks.covered()) {
        render(view, session.world, session.scene);
        remember(session.world);
      }
    }
  };

  /** 화살표가 피해 갈 자리: 캔버스 위에 얹힌 것들이 화면에서 차지한 네모(캔버스의 화소) */
  const measureAvoid = (world: World): void => {
    const base = canvas.getBoundingClientRect();
    const k = canvas.width / base.width;
    const out: World['avoid'] = [];
    for (const el of els.avoid()) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      out.push({ x0: (r.left - base.left) * k, y0: (r.top - base.top) * k, x1: (r.right - base.left) * k, y1: (r.bottom - base.top) * k });
    }
    world.avoid = out;
  };

  // 작은 지도
  const miniImage = mctx.createImageData(mini.width, mini.height);
  const miniData = new Uint32Array(miniImage.data.buffer);
  const fog = hex('#d9cdb3');
  const drawMini = (world: World, miniBase: Uint32Array): void => {
    const { visited } = world;
    for (let i = 0; i < miniData.length; i++) {
      const c = miniBase[i];
      if (visited[i]) miniData[i] = c;
      else {
        // 아직 가 보지 않은 곳은 한지 빛에 엷게
        const r = ((c & 255) * 0.22 + (fog & 255) * 0.78) | 0;
        const gg = (((c >> 8) & 255) * 0.22 + ((fog >> 8) & 255) * 0.78) | 0;
        const b = (((c >> 16) & 255) * 0.22 + ((fog >> 16) & 255) * 0.78) | 0;
        miniData[i] = (255 << 24) | (b << 16) | (gg << 8) | r;
      }
    }
    mctx.putImageData(miniImage, 0, 0);
    // 자리 표시: 꼭 할 일은 붉은 네모, 덤은 흰 네모(크기도 다르다)
    for (const mark of world.marks) {
      const [x, y] = mark.spot.at;
      const on = world.guide === mark.spot.id;
      mctx.fillStyle = '#2a2422';
      mctx.fillRect(x - 2, y - 2, 4, 4);
      mctx.fillStyle = mark.must ? '#d9482f' : '#fbf6e9';
      mctx.fillRect(x - 1, y - 1, 2, 2);
      if (on && Math.floor(world.time * 3) % 2 === 0) {
        mctx.strokeStyle = '#f6c843';
        mctx.lineWidth = 1;
        mctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
      }
    }
    // 지금 있는 곳
    const [px, py] = tileOf(world.player);
    mctx.fillStyle = '#2a2422';
    mctx.fillRect(px - 2, py - 2, 5, 5);
    mctx.fillStyle = Math.floor(world.time * 2.5) % 2 === 0 ? '#ffe98a' : '#f6c843';
    mctx.fillRect(px - 1, py - 1, 3, 3);
    hooks.onZone(zoneAt(world.map, px, py) ?? null);
  };

  let last = 0;
  let workMs = 0;
  let frames = 0;
  let fpsAt = 0;
  let tick = 0;
  const loop = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    if (!session) return;
    const { world, scene } = session;
    // 화면이 가려지면 멈춘다. 돌아왔을 때 한꺼번에 건너뛰지 않게 한 번에 0.05초까지만 흘린다.
    if (document.hidden && !stayAwake) {
      last = now;
      return;
    }
    const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    const busyNow = overlaid();
    world.paused = busyNow;
    const began = performance.now();
    const events = stepWorld(world, dt);
    if (events.length > 0) hooks.onEvents(world, events);
    stepScene(scene, world, dt);
    const covered = hooks.covered();
    // 대화 장면이 맵을 다 덮고 있는 동안에는 그리지 않는다(돌아올 때는 바로 이어 그린다)
    if (!covered) {
      render(view, world, scene);
      remember(world);
      if (tick % 8 === 0) drawMini(world, session.mini);
      if (tick % 12 === 0) measureAvoid(world);
    }
    hooks.onFrame(world, now, tick, busyNow);
    // 땅의 남은 조각(spec 4.7.5의 ㅋ): 이 장에서 쓰고 남은 시간만큼만 잘게 나눠 칠한다(한 장 16.7ms 가운데 셈과 그리기를 빼고
    // 걸을 때는 많아야 6ms, 서 있을 때는 많아야 10ms(4-1 ㉠ — 연 직후 화면 둘레를 빨리 칠해 두게), 적어도 1.5ms).
    // 화면 둘레 띠부터, 걷는 쪽으로 앞선 자리에서 가까운 것부터 칠해 화면이 닿기 전에 칠해 둔다(paintIdle).
    // 그래도 칠하지 않은 칸이 화면에 들면 그리기가 그 칸만 그 자리에서 칠한다.
    if (idleLeft(session)) {
      const spent = performance.now() - began;
      const still = world.player.route.length === 0 && world.keys.x === 0 && world.keys.y === 0;
      const budget = covered ? 8 : still ? Math.max(1.5, Math.min(10, 13 - spent)) : Math.max(1.5, Math.min(6, 11 - spent));
      paintIdle(session, budget, aheadOf(world));
    }
    tick++;
    // 한 장을 셈하고 그리는 데 든 시간(밀리초)의 흐름 평균
    workMs = workMs * 0.9 + (performance.now() - began) * 0.1;
    frames++;
    if (now - fpsAt >= 1000) {
      const value = Math.round((frames * 1000) / (now - fpsAt));
      if (import.meta.env.DEV) {
        dev.__fps = value;
        dev.__ms = workMs;
      }
      if (showFps) hooks.onFps?.(value);
      frames = 0;
      fpsAt = now;
    }
  };

  // 그림을 처음 찍을 때는 잠깐 걸린다. "그리는 중"(처음)이나 앞 장(계절이 바뀔 때)을 띄워 둔 채,
  // 처음 보이는 화면에 걸치는 그림과 그 화면의 땅을 나눠 짓고(한 번에 12ms쯤 — 2배 그림의 일감 하나가 낮은 사양에서 30ms 남짓이라, 일감이 넘쳐도
  // 50ms 넘는 긴 일을 만들지 않으면서 쉬는 틈을 줄인다) 다 되면 판을 연다. 나머지 그림은 판을 연 뒤 쉬는 틈에 걷는 쪽부터 짓는다(paintIdle).
  // 쉬는 틈은 MessageChannel로 잇는다(setTimeout은 다섯 번째부터 4ms씩 밀린다 — Review 권고 1의 길 1). 없는 환경이면 setTimeout.
  // 제목 화면·소개 화면에서 미리 지어 두었으면 바로 연다.
  const pump = idleLoop();
  const heroes = hooks.companion ? [hooks.hero, hooks.companion] : [hooks.hero];
  const openNow = (): void => {
    session = openSession({
      key,
      map,
      who: hooks.who,
      hero: hooks.hero,
      companion: hooks.companion,
      at: hooks.startAt(),
      walked: unpackBits(hooks.walked(), map.w * map.h),
    });
    const { world, scene } = session;
    // 화면을 찍어 볼 때(개발 때만): ?at=칸,칸 으로 서 있는 곳을 옮긴다
    const at = query.get('at');
    if (at) {
      const [ax, ay] = at.split(',').map(Number);
      if (Number.isFinite(ax) && Number.isFinite(ay) && world.grid.blocked[ay * map.w + ax] === 0) {
        world.player.x = ax * TILE + 8;
        world.player.y = ay * TILE + 10;
      }
    }
    world.player.route = [];
    world.arrive = null;
    // 새 판에 걸 것(openingInput): 자판은 지금 눌려 있는 화살표대로(판을 짓는 동안 누른 것도 — 없으면 선다),
    // 판을 짓는 동안(또는 앞 판이 내려가기 바로 앞에) 누른 자리는 한 번만 꺼내 쓴다(맵이 다르거나 창이 떠 있으면 버린다)
    const start = openingInput(held, carryRef, map.id, overlaid());
    setKeys(world, start.keys.x, start.keys.y);
    resize();
    hooks.onOpen(world, session);
    // 넘겨받은 누름이 있으면 새 판에서 그리로 걷는다 — 누름 하나로 걷는다(Review 권고 나).
    // 새 판에서 막힌 칸이면 여느 누름과 같이 가까운 칸으로 가거나 무시한다(tapWorld)
    if (start.tap) {
      tapWorld(world, start.tap.x, start.tap.y);
      tapped = start.tap;
    }
    if (import.meta.env.DEV) {
      dev.__world = world;
      dev.__scene = scene;
      // 맵 전체를 한 장으로 떠 본다(그림 점 하나 = 화소 하나)
      dev.__overview = () => {
        const whole = document.createElement('canvas');
        whole.width = map.w * TILE * ART;
        whole.height = map.h * TILE * ART;
        const wctx = whole.getContext('2d');
        if (!wctx) return '';
        const keepCam = world.cam;
        world.cam = { x: 0, y: 0 };
        render({ ctx: wctx, w: whole.width, h: whole.height, scale: ART }, world, scene);
        world.cam = keepCam;
        return whole.toDataURL('image/png');
      };
    }
    // 대화 장면이 떠 있는 동안 판을 새로 지었으면(가을에 맵의 모습이 바뀔 때) 초점은 대화 장면의 것이다
    if (!overlaid()) canvas.focus({ preventScroll: true });
    raf = requestAnimationFrame(loop);
  };
  const openWhenReady = (): void => {
    if (stopped) return;
    if (!prepReady(map)) {
      stepPrepare(12);
      pump.next(openWhenReady);
      return;
    }
    openNow();
  };
  const startTimer = window.setTimeout(() => {
    if (stopped) return;
    // 처음 보이는 화면: 무대의 크기와 배율로 셈한다(resize와 같은 셈)
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const s0 = artScale(scaleFor(Math.max(64, Math.round(rect.width * dpr)), Math.max(64, Math.round(rect.height * dpr)), dpr), dpr, ART);
    const devAt = query.get('at')?.split(',').map(Number);
    const startAt: [number, number] | undefined =
      devAt && devAt.length === 2 && devAt.every(Number.isFinite) ? [devAt[0], devAt[1]] : (hooks.startAt() ?? map.start[hooks.who.role]);
    prepareMap(map, heroes, startAt, { w: (rect.width * dpr) / s0 + 2, h: (rect.height * dpr) / s0 + 2 });
    openWhenReady();
  }, 30);

  const observer = new ResizeObserver(resize);
  observer.observe(stage);

  const onPointer = (ev: PointerEvent): void => {
    canvas.classList.remove('keyed');
    if (overlaid()) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const dx = (ev.clientX - rect.left) * dpr;
    const dy = (ev.clientY - rect.top) * dpr;
    if (!session) {
      // 판을 새로 짓는 중(대화가 닫힌 뒤 맵의 모습이 바뀔 때 등 — 그동안 화면에는 앞 판이 남아 있다): 그 화면에서 누른 맵의 점을
      // 적어 두었다가 새 판이 열리면 그리로 걷는다(마지막 누름 하나)
      const carried = carryTap(map.id, dx, dy, shownRef.current);
      if (carried) carryRef.current = carried;
      hooks.onWalk();
      return;
    }
    const { world } = session;
    // 그리기와 같은 셈으로 화면의 점을 맵의 점으로 옮긴다
    const p = mapPointOf(dx, dy, shownOf(world, view.scale));
    tapWorld(world, p.x, p.y);
    tapped = p;
    // 걷기 시작하면 쪽지는 접힌다(길을 가리지 않게)
    hooks.onWalk();
  };
  canvas.addEventListener('pointerdown', onPointer);

  const applyKeys = (): void => {
    if (!session) return;
    const keys = keysOf(held);
    setKeys(session.world, keys.x, keys.y);
  };
  const onKeyDown = (ev: KeyboardEvent): void => {
    // 대화 장면이나 창이 떠 있으면 자판은 그쪽의 것이다
    if (overlaid()) {
      if (held.size > 0) {
        held.clear();
        applyKeys();
      }
      return;
    }
    // Tab으로 단추에 가서 누르는 것은 그 단추의 일이다(마우스로 누른 뒤에는 초점이 캔버스로 돌아와 있다)
    if (ev.target instanceof HTMLButtonElement && (ev.key === 'Enter' || ev.key === ' ')) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (KEY_DIRS[k]) {
      held.add(k);
      applyKeys();
      hooks.onWalk();
      ev.preventDefault();
      // 띠의 단추나 쪽지에 초점이 있어도 걷기 시작하면 초점이 맵으로 온다(그 뒤의 Enter가 단추를 누르지 않고 말을 건다).
      // 자판으로 걷는 동안에는 맵에도 다른 단추와 같은 초점 테를 두른다(누르기로 돌아오면 지운다).
      if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
      canvas.classList.add('keyed');
      return;
    }
    if (k === 'Enter' || k === ' ') {
      ev.preventDefault();
      if (!session || ev.repeat) return;
      const e = interact(session.world);
      if (e) hooks.onEvents(session.world, [e]);
    }
  };
  const onKeyUp = (ev: KeyboardEvent): void => {
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    held.delete(k);
    applyKeys();
  };
  const onBlur = (): void => {
    held.clear();
    applyKeys();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(startTimer);
    pump.stop();
    observer.disconnect();
    canvas.removeEventListener('pointerdown', onPointer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    if (session) {
      // 이 판에서 누른 길을 아직 걷는 중이면(대화를 닫자마자 누르고 곧바로 맵의 모습이 바뀌어 판을 새로 짓는다) 새 판에 넘긴다
      const kept = carryWalk(map.id, tapped, session.world.player.route.length > 0);
      if (kept) carryRef.current = kept;
      setKeys(session.world, 0, 0);
      session.world.player.route = [];
      hooks.onClose(session.world);
    }
    if (import.meta.env.DEV) {
      dev.__world = undefined;
      dev.__scene = undefined;
      dev.__overview = undefined;
    }
  };
}

/** 가 본 칸을 묶은 글자(맵 틀을 연 판의 visited) — 부르는 쪽이 자리를 적을 때 쓴다 */
export function walkedOf(world: World): string {
  return packBits(world.visited);
}

/** 그 자리의 서는 칸으로 걸어간다(표시가 없는 자리 — 깃발을 누른 것이 아니라 그 칸을 누른 것과 같다. 닫힌 문 너머면 문 앞에서 까닭이 뜬다) */
export function walkToSpot(world: World, stand: readonly [number, number]): void {
  tapWorld(world, stand[0] * TILE + 8, stand[1] * TILE + 8);
}

/** 목록의 줄을 누른 것이 무엇이 되었나: 'guide' = 화살표만 그 자리로, 'walk' = 그 자리로 걸어간다 */
export type RowPress = 'guide' | 'walk';

/**
 * 목록의 줄(할 일 쪽지의 줄 — ㉣의 거점 시설 목록도 같은 길)을 누른다(13.2의 22번, 4-1 ㉢ Review 권고 ㄱ).
 * 화살표가 아직 그 자리를 가리키지 않으면 'guide'(부르는 쪽이 화살표를 그 자리로 건다 — 걷지 않는다).
 * 이미 가리키고 있으면 'walk': 그 자리에 선 표시로 걸어가 다다르면 깃발을 누른 것과 같이 그 일이 열린다(walkToMark — 'mark' 일이 난다).
 * 그 자리에 표시가 없거나 걸어서 닿지 않으면 앞과 같이 서는 칸 쪽으로 걷는다(walkToSpot). 창이 떠 있으면(world가 없거나 paused) 걷지 않는다.
 */
export function pressRow(world: World | null, guide: string | null, spot: Pick<Spot, 'id' | 'stand'>): RowPress {
  if (guide !== spot.id) return 'guide';
  if (!world || world.paused) return 'walk';
  const mark = world.marks.find((m) => m.spot.id === spot.id);
  if (mark) {
    // 깃발을 누른 것과 같다(tapWorld의 표시 갈래): 문 앞의 까닭과 누른 자리의 표시를 지우고 그 표시로 간다
    world.shownGate = null;
    walkToMark(world, mark);
    if (world.arrive?.kind === 'mark' && world.arrive.mark === mark) {
      world.target = null;
      return 'walk';
    }
  }
  walkToSpot(world, spot.stand);
  return 'walk';
}
