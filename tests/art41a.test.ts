// 4-1 ㉠ "남은 권고"(docs/reviews/그림2.md 16.4 권고 A·B): 시험이 못 잡던 망가뜨림(R1a·R1b·R2a·R8·R3·R11)과 화면 둘레 띠.
// (라) 처음 화면만 지은 벌로 연 판에서 먼 곳을 그린 장 = 다 지은 벌로 그린 장(그 자리에서 지어도, 쉬는 틈에 다 지은 뒤에도)
// (마) 실제 길(prepareMap → stepPrepare → prepReady → openSession)로 연 첫 장에서 그 자리에서 지은 그림 0, 그 자리에서 칠한 땅 칸 0
// (바) 연 직후 걷는 쪽의 띠부터 칠하고, 띠를 칠한 뒤에는 그 안에서 걸어도 그리기가 땅을 그 자리에서 칠하지 않는다
// R3 쉬는 틈의 기구: 가짜 MessageChannel로 ms = 0이면 port2.postMessage, setTimeout은 부르지 않는다
// R11 칸 이음매(Y3)를 울타리·돌담에도

import { afterEach, describe, expect, it, vi } from 'vitest';
import { neutigol } from '../src/content/maps/neutigol';
import type { Season } from '../src/engine/types';
import { buildScene, render } from '../src/map/draw';
import { BAND_LEAD, BAND_PAD, NEAR_PAD, bandOf, idleLoop, openSession, paintIdle, prepReady, prepareMap, splitNeeds, stepPrepare, turnBandOf } from '../src/map/session';
import { THINGS } from '../src/map/things';
import { TILE, type MapData, type Weather } from '../src/map/types';
import { createWorld, snapCamera } from '../src/map/world';
import { BAND_CELL, buildAtlas, needsOf, undoneBox, type Atlas } from '../src/pixel/atlas';
import { thingDef } from '../src/pixel/catalog';
import { snapperOf } from '../src/pixel/ground';
import { paletteOf } from '../src/pixel/palette';
import { ART, type Px } from '../src/pixel/px';
import { REGION, luma, softPixels, withSoftCanvas } from './artRules';

vi.setConfig({ testTimeout: 300_000 });

/** 맵 한 판을 그려 본다(그리기 그대로 — map/draw.ts의 render). 배율은 그림 점 하나 = 화소 하나 */
function frame(map: MapData, atlas: Atlas, cam: { x: number; y: number }, view: { w: number; h: number }, then?: (scene: ReturnType<typeof buildScene>) => void): { px: Px; late: number } {
  const hero = { x: cam.x + view.w / 2, y: cam.y + view.h / 2 };
  const world = createWorld(map, { role: 'farmer', look: 'boy' }, 'farmer-boy', [Math.floor(hero.x / TILE), Math.floor(hero.y / TILE)]);
  world.player.x = hero.x;
  world.player.y = hero.y;
  world.view = { ...view };
  world.cam = { ...cam };
  world.glow = { morning: 0, dusk: 0 };
  world.time = 0;
  const scene = buildScene(map, atlas, world);
  scene.clouds = [];
  then?.(scene);
  const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
  canvas.width = view.w * ART;
  canvas.height = view.h * ART;
  render({ ctx: canvas.getContext('2d') as CanvasRenderingContext2D, w: canvas.width, h: canvas.height, scale: ART }, world, scene);
  return { px: softPixels(canvas), late: scene.late };
}

const diffCount = (a: Px, b: Px): number => {
  let n = 0;
  for (let i = 0; i < a.d.length; i++) if (a.d[i] !== b.d[i]) n++;
  return n;
};

const SKY: [Season, Weather][] = [
  ['spring', 'clear'],
  ['autumn', 'clear'],
];

describe('(라) 처음 화면만 지은 벌로 연 판의 먼 곳 — R1a·R1b', () => {
  const view = { w: 300, h: 200 };
  // 먼 곳: 뒷산 절 마당, 뒷산, 냇가 논둑(처음 화면 — 대문 앞 — 에서 멀어 처음에는 짓지 않는다)
  const far = (map: MapData): { id: string; cam: { x: number; y: number } }[] =>
    ['temple', 'woods', 'streamBank'].map((id) => {
      const spot = map.spots.find((s) => s.id === id)!;
      return { id, cam: { x: spot.at[0] * TILE + 8 - view.w / 2, y: spot.at[1] * TILE - view.h / 2 } };
    });

  it('R1a 보일 때 아직 없는 세운 것은 그 자리에서 지어 그린다: 처음 화면만 지은 벌로 그린 먼 곳 = 다 지은 벌로 그린 먼 곳', () => {
    for (const [season, weather] of SKY) {
      withSoftCanvas(() => {
        const map = neutigol(season, weather);
        const full = buildAtlas(season, weather, needsOf(map, ['farmer-boy']));
        const { cam, view: v } = REGION;
        const near = [cam.x - NEAR_PAD, cam.y - NEAR_PAD, cam.x + v.w + NEAR_PAD, cam.y + v.h + NEAR_PAD];
        const part = buildAtlas(season, weather, { things: [], people: [], critters: [] });
        const split = splitNeeds(map, part, ['farmer-boy'], near, { x: cam.x + v.w / 2, y: cam.y + v.h / 2 });
        for (const step of split.now) while (step() === true);
        expect(split.later.length, season).toBeGreaterThan(5);
        let late = 0;
        for (const place of far(map)) {
          const want = frame(map, full, place.cam, view);
          const got = frame(map, part, place.cam, view);
          late += got.late;
          expect(diffCount(want.px, got.px), `${season} ${place.id}`).toBe(0);
        }
        // 그 자리에서 지은 것이 있었다(시험이 헛돌지 않게)
        expect(late, season).toBeGreaterThan(0);
      });
    }
  });

  it('R1b 맵을 연 뒤 쉬는 틈에 뒤로 미룬 그림을 다 지은 뒤에도 먼 곳 = 다 지은 벌(지은 그림이 판에 걸린다 — 그 자리에서 다시 짓지 않는다)', () => {
    for (const [season, weather] of SKY) {
      withSoftCanvas(() => {
        const map = neutigol(season, weather);
        const full = buildAtlas(season, weather, needsOf(map, ['farmer-boy']));
        const { cam, view: v } = REGION;
        const near = [cam.x - NEAR_PAD, cam.y - NEAR_PAD, cam.x + v.w + NEAR_PAD, cam.y + v.h + NEAR_PAD];
        const part = buildAtlas(season, weather, { things: [], people: [], critters: [] });
        const split = splitNeeds(map, part, ['farmer-boy'], near, { x: cam.x + v.w / 2, y: cam.y + v.h / 2 });
        for (const step of split.now) while (step() === true);
        const built = part.things.size;
        for (const place of far(map)) {
          const want = frame(map, full, place.cam, view);
          // 판을 먼저 세우고(그림이 아직 없을 때 — 맵을 연 때처럼), 그다음 뒤로 미룬 일감을 쉬는 틈처럼 다 한다
          const got = frame(map, part, place.cam, view, () => {
            for (const job of split.later) for (const step of job.steps) while (step() === true);
          });
          expect(got.late, `${season} ${place.id}`).toBe(0);
          expect(diffCount(want.px, got.px), `${season} ${place.id}`).toBe(0);
        }
        expect(part.things.size, season).toBeGreaterThan(built);
      });
    }
  });
});

/** 실제 길로 맵을 연다: 맵 화면처럼 처음 보이는 화면의 크기로 미리 짓고, 준비되면 판을 열고 화면 크기를 건다(resize와 같은 셈) */
function openReal(map: MapData, key: string, device: { w: number; h: number; scale: number }): { s: ReturnType<typeof openSession>; view: { w: number; h: number } } {
  const start = map.start.farmer;
  const view = { w: device.w / device.scale, h: device.h / device.scale };
  prepareMap(map, ['farmer-girl'], start, { w: view.w + 2, h: view.h + 2 });
  let calls = 0;
  while (!prepReady(map) && calls++ < 200_000) stepPrepare(4);
  expect(prepReady(map)).toBe(true);
  const s = openSession({ key, map, who: { role: 'farmer', look: 'girl' }, hero: 'farmer-girl' });
  s.world.view = { ...view };
  snapCamera(s.world);
  return { s, view };
}

const paintedTiles = (s: ReturnType<typeof openSession>): number => s.scene.ground.painted.reduce((n, v) => n + v, 0);

function draw(s: ReturnType<typeof openSession>, device: { w: number; h: number; scale: number }): void {
  const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
  canvas.width = device.w;
  canvas.height = device.h;
  render({ ctx: canvas.getContext('2d') as CanvasRenderingContext2D, w: device.w, h: device.h, scale: device.scale }, s.world, s.scene);
}

// 화면: 1180×820·화소 비율 2의 무대(배율 6)를 그림 점 하나 = 화소 하나(배율 ART)로 줄여 그린다 — 보이는 맵 점의 넓이는 같다
const DEVICE = { w: Math.round((2360 / 6) * ART), h: Math.round((1600 / 6) * ART), scale: ART };

describe('(마) 실제 길로 연 첫 장 — R2a·R8', () => {
  it('prepareMap → stepPrepare → prepReady → openSession으로 연 첫 장에서 그 자리에서 지은 그림 0, 그 자리에서 칠한 땅 칸 0', () => {
    for (const [season, weather] of [...SKY, ['winter', 'clear'] as [Season, Weather]]) {
      withSoftCanvas(() => {
        const map = neutigol(season, weather);
        const { s } = openReal(map, `art41a-ma-${season}`, DEVICE);
        // 처음 화면 둘레만 지었다(시험이 헛돌지 않게)
        expect(s.later.length, season).toBeGreaterThan(0);
        expect(s.scene.ground.left, season).toBeGreaterThan(0);
        const before = paintedTiles(s);
        draw(s, DEVICE);
        expect(s.scene.late, season).toBe(0);
        expect(paintedTiles(s) - before, `${season} 그 자리에서 칠한 땅 칸`).toBe(0);
      });
    }
  });
});

describe('(바) 연 직후 곧장 걸을 때 — 화면 둘레 띠(권고 A)', () => {
  it('띠는 보이는 화면 + 사방 두 칸이고, 걷는 쪽으로 세 칸 더 넓다. 화면을 돌릴 때 보일 땅은 긴 변의 네모다', () => {
    withSoftCanvas(() => {
      const map = neutigol('spring');
      const { s, view } = openReal(map, 'art41a-band-shape', DEVICE);
      const T = TILE;
      const { cam, player } = s.world;
      const [still] = bandOf(s, player);
      expect(BAND_PAD).toBe(2 * T);
      expect(BAND_LEAD).toBe(3 * T);
      expect(still[0]).toBe(Math.max(0, Math.floor((cam.x - BAND_PAD) / T)));
      expect(still[2]).toBe(Math.min(map.w - 1, Math.floor((cam.x + view.w + BAND_PAD) / T)));
      const east = bandOf(s, { x: player.x + 200, y: player.y });
      expect(east).toHaveLength(2);
      expect(east[1][2] - east[0][2]).toBeGreaterThanOrEqual(2);
      expect(east[1][0]).toBe(east[0][0]);
      const turn = turnBandOf(s);
      expect(turn[3] - turn[1]).toBeGreaterThan(still[3] - still[1]);
    });
  });

  it('연 직후 걷는 쪽(동쪽)으로 가면 띠를 동쪽부터 칠하고, 띠를 다 칠한 뒤 걷는 쪽으로 네 칸까지는 그리기가 땅을 그 자리에서 칠하지 않는다', () => {
    withSoftCanvas(() => {
      const map = neutigol('autumn');
      const { s } = openReal(map, 'art41a-band-walk', DEVICE);
      const g = s.scene.ground;
      const ahead = { x: s.world.player.x + 200, y: s.world.player.y };
      const band = bandOf(s, ahead);
      expect(band.some((b) => undoneBox(g, b)), '연 직후에는 띠가 다 칠해져 있지 않다').toBe(true);
      // 처음 칠한 작은 네모가 주인공의 동쪽에 있다
      const before = g.painted.slice();
      paintIdle(s, 0, ahead);
      let guard = 0;
      while (g.painted.every((v, i) => v === before[i]) && guard++ < 10_000) paintIdle(s, 0, ahead);
      let first = -1;
      for (let i = 0; i < g.painted.length; i++) if (g.painted[i] && !before[i]) first = i;
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first % g.tw, '처음 칠한 칸').toBeGreaterThan(Math.floor(s.world.player.x / TILE));
      // 띠를 다 칠한다(쉬는 틈만으로 — 한 번에 한 걸음씩)
      let calls = 0;
      while (bandOf(s, ahead).some((b) => undoneBox(g, b)) && calls++ < 100_000) paintIdle(s, 0, ahead);
      expect(bandOf(s, ahead).some((b) => undoneBox(g, b))).toBe(false);
      // 동쪽으로 네 칸(띠의 사방 두 칸 + 걷는 쪽 세 칸 안)을 걸어간 화면
      const drawn = paintedTiles(s);
      for (let step = 1; step <= 4; step++) {
        s.world.player.x += TILE;
        s.world.cam = { x: s.world.cam.x + TILE, y: s.world.cam.y };
        draw(s, DEVICE);
      }
      expect(paintedTiles(s) - drawn, '그 자리에서 칠한 땅 칸').toBe(0);
      expect(s.scene.late).toBe(0);
    });
  });

  it('띠는 작은 네모(맵 칸 4×4, 맵 전체의 격자)로 나눠 칠한다 — 조각(8×8)을 칠하던 일감이 있어도 그대로 둔다', () => {
    withSoftCanvas(() => {
      const map = neutigol('spring');
      const { s } = openReal(map, 'art41a-band-cell', DEVICE);
      const g = s.scene.ground;
      expect(BAND_CELL).toBe(4);
      paintIdle(s, 0, s.world.player);
      expect(g.band).not.toBeNull();
      const box = g.band!.box;
      expect(Math.floor(box[0] / BAND_CELL)).toBe(Math.floor(box[2] / BAND_CELL));
      expect(Math.floor(box[1] / BAND_CELL)).toBe(Math.floor(box[3] / BAND_CELL));
    });
  });
});

describe('R3 쉬는 틈의 기구 — 가짜 MessageChannel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ms = 0이면 MessageChannel의 port2.postMessage로 잇고 setTimeout은 부르지 않는다. ms가 있으면 setTimeout. 멈추면 문을 닫는다', async () => {
    const posts: unknown[] = [];
    const closed: string[] = [];
    let made = 0;
    class FakeChannel {
      port1: { onmessage: ((ev: unknown) => void) | null; close(): void };
      port2: { postMessage(v: unknown): void; close(): void };
      constructor() {
        made++;
        const port1 = { onmessage: null as ((ev: unknown) => void) | null, close: () => closed.push('port1') };
        this.port1 = port1;
        this.port2 = {
          postMessage: (v: unknown) => {
            posts.push(v);
            queueMicrotask(() => port1.onmessage?.({ data: v }));
          },
          close: () => closed.push('port2'),
        };
      }
    }
    vi.stubGlobal('MessageChannel', FakeChannel);
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const loop = idleLoop();
    expect(made).toBe(1);
    let ran = 0;
    await new Promise<void>((done) => loop.next(() => (ran++, done())));
    await new Promise<void>((done) => loop.next(() => (ran++, done()), 0));
    expect(ran).toBe(2);
    expect(posts).toHaveLength(2);
    expect(timeout).not.toHaveBeenCalled();
    // 시간을 두고 부르면 setTimeout
    await new Promise<void>((done) => loop.next(() => (ran++, done()), 5));
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(posts).toHaveLength(2);
    // 멈추면 문을 닫고, 그 뒤의 부름은 돌지 않는다
    loop.stop();
    expect(closed.sort()).toEqual(['port1', 'port2']);
    let after = false;
    loop.next(() => (after = true));
    await new Promise((r) => setTimeout(r, 5));
    expect(after).toBe(false);
    expect(posts).toHaveLength(2);
  });
});

describe('R11 칸 이음매(Y3) — 울타리·돌담도', () => {
  // 생김새 둘을 이어 붙였을 때 이음매에서 튀는 것 ÷ 칸 안쪽 이웃 열끼리의 밝기 차의 평균(이음매 비율). 튀는 것은 이음매 두 열의 차와,
  // 이음매 두 열이 그 둘레 두 열보다 짙거나 밝은 것 가운데 큰 쪽이다(칸 끝 두 줄을 함께 짙게 하면 두 열의 차는 그대로라 — 망가뜨림 R11).
  // 기와 담(wallH)은 art2fix.test.ts의 Y3가 1.5로 본다. 울타리·돌담은 칸 끝이 말뚝·줄눈이라 비율이 원래 높다 —
  // 문턱은 갈래마다 지금 값(다섯 벌에서 가장 큰 값 — 울타리 5.37(여름), 돌담 2.81(큰비). 울타리·돌담 그림은 eca5628과 같다)의 1.2배다.
  const LIMIT: Record<string, number> = { fenceH: 5.37 * 1.2, stonewallH: 2.81 * 1.2 };
  const SKIES: [string, Season, Weather][] = [
    ['spring', 'spring', 'clear'],
    ['summer', 'summer', 'clear'],
    ['rain', 'summer', 'rain'],
    ['autumn', 'autumn', 'clear'],
    ['winter', 'winter', 'clear'],
  ];
  const cols = (f: Px): number[] =>
    [...Array(f.w).keys()].map((x) => {
      let t = 0;
      let k = 0;
      for (let y = 0; y < f.h; y++) {
        const c = f.get(x, y);
        if (c >>> 24) {
          t += luma(c);
          k++;
        }
      }
      return k ? t / k : 0;
    });
  const seamRatio = (kind: string, season: Season, weather: Weather): number => {
    const pal = paletteOf(season, weather);
    const snap = snapperOf(pal);
    const n = THINGS[kind].variants;
    const all = [...Array(n).keys()].map((v) => cols(snap.apply(thingDef(pal, kind, v).frames[0].clone())));
    let worst = 0;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const ca = all[a];
        const cb = all[b];
        const inner: number[] = [];
        for (const cs of [ca, cb]) for (let x = 2; x < cs.length - 3; x++) inner.push(Math.abs(cs[x + 1] - cs[x]));
        const avg = inner.reduce((p, q) => p + q, 0) / inner.length;
        // 이음매에서 튀는 것(왼쪽 칸의 끝 열과 오른쪽 칸의 첫 열의 차)과, 이음매의 두 열이 둘레 두 열보다 짙거나 밝은 것(골·등성이) 가운데 큰 쪽
        const L = ca.length - 1;
        const jump = Math.abs(ca[L] - cb[0]);
        const valley = Math.abs((ca[L] + cb[0]) / 2 - (ca[L - 1] + cb[1]) / 2);
        worst = Math.max(worst, Math.max(jump, valley) / avg);
      }
    }
    return worst;
  };

  for (const kind of ['fenceH', 'stonewallH']) {
    it(`${kind}: 다섯 벌 모두 이음매 비율이 지금 값의 1.2배(${LIMIT[kind].toFixed(2)}) 이하`, () => {
      const got: string[] = [];
      for (const [tone, season, weather] of SKIES) {
        const r = seamRatio(kind, season, weather);
        got.push(`${tone} ${r.toFixed(2)}`);
        expect(r, `${kind} ${tone}`).toBeLessThanOrEqual(LIMIT[kind]);
      }
      expect(got.length).toBe(5);
    });
  }
});
