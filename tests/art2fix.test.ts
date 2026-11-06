// 그림 올리기 ②의 고침 바퀴(docs/reviews/그림2.md 3절 권고 1~11, spec 13.1의 59번).
// ① 양반 댁 담은 흙빛 토석담 ② 미리 짓기는 처음 화면 둘레부터(나눠 지어도·처음 화면만 지어도 그림이 같다) ③ 큰 나무의 굵은 곁가지
// ④ 엷던 것(돌탑·돌등, 가을 새 짚, 흰 꽃나무, 소의 털) ⑤ 빗줄기 두 점 ⑦ 시험이 못 잡던 망가뜨림(Y3·Y4·Y7·Y8·Y9·Y10·Y12·Y13).

import { describe, expect, it, vi } from 'vitest';
import { neutigol } from '../src/content/maps/neutigol';
import { buildScene, render } from '../src/map/draw';
import { NEAR_PAD, idleLoop, openSession, paintIdle, prepReady, prepareMap, splitNeeds, stepPrepare } from '../src/map/session';
import { THINGS } from '../src/map/things';
import type { Weather } from '../src/map/types';
import { createWorld } from '../src/map/world';
import {
  buildAtlas,
  ensureAll,
  ensureBase,
  footBox,
  GROUND_CHUNK,
  groundCanvas,
  needsOf,
  paintAround,
  paintChunk,
  prepareSteps,
  shadesOf,
  thingImg,
  thingMetaOf,
  workView,
  type Atlas,
  type Img,
} from '../src/pixel/atlas';
import { thingDef, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { snapperOf, waterFrames } from '../src/pixel/ground';
import { paletteOf } from '../src/pixel/palette';
import { personOf, personSheet } from '../src/pixel/people';
import { ART, Px } from '../src/pixel/px';
import type { Season } from '../src/engine/types';
import { REGION, gameView, luma, softPixels, withSoftCanvas } from './artRules';
import mask1e from './fixtures/art/mask-1e.json';

vi.setConfig({ testTimeout: 120_000 });

const R = (c: number): number => c & 255;
const G = (c: number): number => (c >> 8) & 255;
const B = (c: number): number => (c >> 16) & 255;
/** 색상각(도) */
const hue = (c: number): number => {
  const r = R(c);
  const g = G(c);
  const b = B(c);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};

/** 그림 벌 다섯: 네 계절과 큰비가 온 해의 여름 */
const SKIES: [string, Season, Weather][] = [
  ['spring', 'spring', 'clear'],
  ['summer', 'summer', 'clear'],
  ['rain', 'summer', 'rain'],
  ['autumn', 'autumn', 'clear'],
  ['winter', 'winter', 'clear'],
];

/** 벌에 맞춘 첫 장 */
const snapped = (season: Season, weather: Weather, kind: string, v: number): Px => {
  const pal = paletteOf(season, weather);
  return snapperOf(pal).apply(thingDef(pal, kind, v).frames[0].clone());
};

describe('그림 올리기 ②의 고침: 담·곁가지·엷은 것·빗줄기', () => {
  it('양반 댁 담의 몸은 흙빛 토석담이다(spec 13.1의 59번): 몸에 회벽 빛이 없고 흙벽 빛이 넓다 — 계절마다, 가로·세로 담 모두', () => {
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const plaster = new Set(pal.plaster);
      const clay = new Set(pal.clay);
      // 가로 담의 몸(줄 16~47)과 세로 담 남쪽 끝 마구리면(줄 48~63, 열 4~23) — 그림 점
      const bodies: [string, number, [number, number, number, number]][] = [
        ...[0, 1, 2].map((v) => ['wallH', v, [0, 16, 32, 48]] as [string, number, [number, number, number, number]]),
        ...[0, 1].map((v) => ['wallV', v, [4, 48, 24, 64]] as [string, number, [number, number, number, number]]),
      ];
      for (const [kind, v, [x0, y0, x1, y1]] of bodies) {
        const f = thingDef(pal, kind, v).frames[0];
        let n = 0;
        let pl = 0;
        let cl = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const c = f.get(x, y);
            if (!(c >>> 24)) continue;
            n++;
            if (plaster.has(c)) pl++;
            if (clay.has(c)) cl++;
          }
        }
        expect(pl, `${tone} ${kind}:${v} 회벽 빛`).toBe(0);
        expect(cl / n, `${tone} ${kind}:${v} 흙벽 빛의 몫`).toBeGreaterThan(0.4);
      }
    }
  });

  /**
   * 담 그림의 돌 덩이: 흙벽 단계의 빛이 아닌 불투명한 점이 이웃 넷으로 이어진 것(벌에 맞추기 전의 그림 — 흙벽은 결이 오르내려도 흙벽 단계 안).
   * 네모 [x0, y0, x1, y1](그 안만 본다)에서 찾고, 네모의 왼쪽·오른쪽 끝에 닿은 덩이(칸 경계에 걸친 돌의 반쪽)와 점 12개 아래의 부스러기는 뺀다.
   */
  const wallBlobs = (f: Px, clay: ReadonlySet<number>, [x0, y0, x1, y1]: readonly number[]) => {
    const stone = (x: number, y: number): boolean => x >= x0 && x <= x1 && y >= y0 && y <= y1 && f.get(x, y) >>> 24 === 255 && !clay.has(f.get(x, y));
    const seen = new Uint8Array(f.w * f.h);
    const out: { x0: number; x1: number; y0: number; y1: number; px: number[] }[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (seen[y * f.w + x] || !stone(x, y)) continue;
        const b = { x0: x, x1: x, y0: y, y1: y, px: [] as number[] };
        const stack = [[x, y]];
        seen[y * f.w + x] = 1;
        while (stack.length) {
          const [px, py] = stack.pop() as number[];
          b.px.push(f.get(px, py));
          b.x0 = Math.min(b.x0, px);
          b.x1 = Math.max(b.x1, px);
          b.y0 = Math.min(b.y0, py);
          b.y1 = Math.max(b.y1, py);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const qx = px + dx;
            const qy = py + dy;
            if (!stone(qx, qy) || seen[qy * f.w + qx]) continue;
            seen[qy * f.w + qx] = 1;
            stack.push([qx, qy]);
          }
        }
        if (b.x0 > x0 && b.x1 < x1 && b.px.length >= 12) out.push(b);
      }
    }
    return out;
  };
  /** 가로 담의 몸(줄 16~47, 칸 너비 전부)과 세로 담 남쪽 끝 마구리면(줄 48~63, 열 4~23 — 마구리면의 양옆 끝도 돌이 닿는 끝이라 하나 밖으로) */
  const WALL_BODY: Record<'wallH' | 'wallV', readonly number[]> = { wallH: [0, 16, 31, 47], wallV: [3, 48, 24, 63] };

  it('담 돌은 들쭉날쭉하다(ㅌ, review 권고 5): 높이가 5~7 그림 점에서 셋 넘게 갈리고, 둥근 돌이 섞인다 — 두 켜에 걸친 큰 돌(높이 11 넘음)은 따로 센다', () => {
    const pal = paletteOf('spring');
    const clay = new Set(pal.clay);
    const heights = new Set<number>();
    const fills: number[] = [];
    let round = 0;
    let all = 0;
    for (const v of [0, 1, 2]) {
      for (const b of wallBlobs(thingDef(pal, 'wallH', v).frames[0], clay, WALL_BODY.wallH)) {
        const h = b.y1 - b.y0 + 1;
        if (h >= 11) continue; // 큰 돌(아래 시험)
        const fill = b.px.length / ((b.x1 - b.x0 + 1) * h);
        all++;
        heights.add(h);
        fills.push(+fill.toFixed(2));
        if (fill < 0.86) round++;
      }
    }
    expect([...heights].filter((h) => h >= 5 && h <= 7).length, [...heights].join(',')).toBeGreaterThanOrEqual(3);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...heights)).toBeLessThanOrEqual(8);
    // 둥근 돌(네모를 0.86 아래로 채운 돌)과 모난 돌(0.9 넘게)이 함께 있다
    expect(round, `둥근 돌 ${round}/${all} ${fills.join(',')}`).toBeGreaterThanOrEqual(1);
    expect(fills.filter((q) => q > 0.9).length, fills.join(',')).toBeGreaterThanOrEqual(3);
  });

  it('4-1 ㉠ 담 돌 다듬기(review 권고 C, spec 13.1의 61번): 칸마다 두 켜에 걸친 큰 돌이 하나(높이 11 그림 점 넘음, 칸 안쪽) — 생김새마다 자리가 다르다', async () => {
    const { WALL_STONES_41A, wallHOf, wallVOf } = await import('../src/pixel/buildings');
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const clay = new Set(pal.clay);
      for (const [kind, make, n] of [['wallH', wallHOf, 3], ['wallV', wallVOf, 2]] as const) {
        const spots = new Set<string>();
        for (let v = 0; v < n; v++) {
          const f = make(pal, v, WALL_STONES_41A).frames[0];
          const big = wallBlobs(f, clay, WALL_BODY[kind]).filter((b) => b.y1 - b.y0 + 1 >= 11);
          expect(big.length, `${tone} ${kind}:${v} 큰 돌`).toBe(1);
          const [b] = big;
          // 칸 안쪽: 가로 담은 칸의 옆 끝에서 셋 넘게(칸 경계에 걸친 돌과 떨어진 덩이), 세로 담은 마구리면 안
          const [lo, hi] = kind === 'wallH' ? [3, f.w - 4] : [4, 23];
          expect(b.x0, `${tone} ${kind}:${v}`).toBeGreaterThanOrEqual(lo);
          expect(b.x1, `${tone} ${kind}:${v}`).toBeLessThanOrEqual(hi);
          // 너비도 켜의 돌보다 크다(가로로 아홉 넘음)
          expect(b.x1 - b.x0 + 1, `${tone} ${kind}:${v}`).toBeGreaterThanOrEqual(9);
          spots.add(`${b.x0},${b.y0}`);
        }
        expect(spots.size, `${tone} ${kind} 큰 돌의 자리`).toBe(n);
      }
    }
  });

  it('4-1 ㉠ 담 돌 다듬기: 따뜻한 돌이 칸마다 모아 25~35%이고, 벌에 맞춘 뒤에도 잿빛 돌과 다른 따뜻한 빛이다(봄·여름 벌에서 잿빛으로 맞춰지지 않게)', async () => {
    const { WALL_STONES_41A, wallHOf, wallStoneRamps, wallVOf } = await import('../src/pixel/buildings');
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const clay = new Set(pal.clay);
      const ramps = wallStoneRamps(pal, WALL_STONES_41A);
      const warm = new Set(ramps.warm);
      const share: Record<string, [number, number]> = { wallH: [0, 0], all: [0, 0] };
      for (const [kind, make, n] of [['wallH', wallHOf, 3], ['wallV', wallVOf, 2]] as const) {
        for (let v = 0; v < n; v++) {
          for (const b of wallBlobs(make(pal, v, WALL_STONES_41A).frames[0], clay, WALL_BODY[kind])) {
            // 따뜻한 돌: 점의 반 넘게가 따뜻한 돌 단계의 빛
            const isWarm = b.px.filter((c) => warm.has(c)).length * 2 > b.px.length ? 1 : 0;
            for (const key of kind === 'wallH' ? ['wallH', 'all'] : ['all']) {
              share[key][0] += isWarm;
              share[key][1]++;
            }
          }
        }
      }
      for (const [key, [w, all]] of Object.entries(share)) {
        expect(w / all, `${tone} ${key} 따뜻한 돌 ${w}/${all}`).toBeGreaterThanOrEqual(0.25);
        expect(w / all, `${tone} ${key} 따뜻한 돌 ${w}/${all}`).toBeLessThanOrEqual(0.35);
      }
      // 벌에 맞춘 빛: 따뜻한 돌의 몸빛은 잿빛·짙은 잿빛 돌의 어느 빛과도 다르고, R−B가 잿빛 돌의 몸빛보다 15 넘게 크다
      const snap = snapperOf(pal);
      const grays = new Set([...ramps.gray, ...ramps.dim].map((c) => snap.nearest(c)));
      const body = snap.nearest(ramps.warm[1]);
      expect(grays.has(body), `${tone} 따뜻한 돌의 몸빛`).toBe(false);
      expect(R(body) - B(body), tone).toBeGreaterThan(R(snap.nearest(ramps.gray[1])) - B(snap.nearest(ramps.gray[1])) + 15);
    }
  });

  it('4-1 ㉠ 담 돌 다듬기: 되돌린 값(WALL_STONES_ECA5628)으로 지은 담은 그림 올리기 ②의 고침 판(eca5628)과 점 하나까지 같고, 게임은 WALL_LOOK으로 짓는다', async () => {
    const { WALL_LOOK, WALL_STONES_ECA5628, wallHOf, wallVOf } = await import('../src/pixel/buildings');
    const want = (await import('./fixtures/art/wall-eca5628.json')).default.walls as Record<string, string>;
    // 지문: 장 수·크기·발치·결의 몫·그림자와, 모든 장의 점(RGBA 바이트를 이어 붙인 것)의 SHA-256
    const print = async (def: ReturnType<typeof wallHOf>): Promise<string> => {
      const bytes = new Uint8Array(def.frames.reduce((n, f) => n + f.d.byteLength, 0));
      let at = 0;
      for (const f of def.frames) {
        bytes.set(new Uint8Array(f.d.buffer, f.d.byteOffset, f.d.byteLength), at);
        at += f.d.byteLength;
      }
      const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((q) => q.toString(16).padStart(2, '0')).join('');
      const f0 = def.frames[0];
      return `${def.frames.length}x${f0.w}x${f0.h} ax${def.ax} ay${def.ay} wash${def.wash?.toFixed(4)} shades${JSON.stringify(def.shades)} ${hex}`;
    };
    let n = 0;
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      for (const [kind, make, count] of [['wallH', wallHOf, 3], ['wallV', wallVOf, 2]] as const) {
        for (let v = 0; v < count; v++) {
          expect(await print(make(pal, v, WALL_STONES_ECA5628)), `${tone} ${kind}:${v}`).toBe(want[`${tone} ${kind}:${v}`]);
          expect(await print(thingDef(pal, kind, v)), `${tone} ${kind}:${v} 게임의 담`).toBe(await print(make(pal, v, WALL_LOOK)));
          n++;
        }
      }
    }
    expect(n).toBe(Object.keys(want).length);
  });

  it('Y3 담 칸의 이음매가 보이지 않는다: 생김새 둘을 이어 붙였을 때 이음매 열과 옆 열의 평균 밝기 차가 칸 안쪽 이웃 열끼리의 차의 1.5배 이하', () => {
    for (const [tone, season, weather] of SKIES) {
      const n = THINGS.wallH.variants;
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
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          const ca = cols(snapped(season, weather, 'wallH', a));
          const cb = cols(snapped(season, weather, 'wallH', b));
          const inner: number[] = [];
          for (const cs of [ca, cb]) for (let x = 2; x < cs.length - 3; x++) inner.push(Math.abs(cs[x + 1] - cs[x]));
          const avg = inner.reduce((p, q) => p + q, 0) / inner.length;
          expect(Math.abs(ca[ca.length - 1] - cb[0]), `${tone} wallH ${a}|${b}`).toBeLessThanOrEqual(avg * 1.5);
        }
      }
    }
  });

  it('냇가 큰 나무의 그네를 맬 곁가지가 굵다(review 권고 2): 곁가지 자리(1-라 좌표 ×ART)에서 껍질빛 점이 세로로 4 그림 점 넘게 이어진다 — 계절마다', () => {
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const f = thingDef(pal, 'bigtree', 0).frames[0];
      const bark = new Set(pal.bark);
      // 1-라의 곁가지: (cx+4, 64) → (cx+34, 59), cx = 46. 줄기와 가지 끝을 빼고 가운데 열들
      const runs: number[] = [];
      for (let X = (46 + 10) * ART; X <= (46 + 28) * ART; X++) {
        let best = 0;
        let cur = 0;
        for (let Y = 52 * ART; Y <= 70 * ART; Y++) {
          if (bark.has(f.get(X, Y))) best = Math.max(best, ++cur);
          else cur = 0;
        }
        runs.push(best);
      }
      runs.sort((a, b) => a - b);
      expect(runs[runs.length >> 1], tone).toBeGreaterThanOrEqual(4);
      expect(runs[0], tone).toBeGreaterThanOrEqual(3);
    }
  });

  it('돌탑·돌등의 층이 선다(review 권고 3): 그늘 쪽(오른쪽·처마 밑)의 짙은 돌빛이 넓고, 꼭대기의 보주가 보인다', () => {
    const pal = paletteOf('spring');
    const dark = new Set(pal.stone.slice(0, 3));
    const share = (kind: string): number => {
      const f = thingDef(pal, kind, 0).frames[0];
      let n = 0;
      let d = 0;
      for (const c of f.d) {
        if (!(c >>> 24)) continue;
        n++;
        if (dark.has(c)) d++;
      }
      return d / n;
    };
    expect(share('pagoda')).toBeGreaterThan(0.3);
    expect(share('lantern')).toBeGreaterThan(0.2);
    // 보주: 돌탑 맨 위(꼭대기 기둥 위 — 그림 점 줄 0~7)에 찍힌 점
    const top = thingDef(pal, 'pagoda', 0).frames[0];
    let bead = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < top.w; x++) if (top.get(x, y) >>> 24) bead++;
    expect(bead).toBeGreaterThanOrEqual(18);
  });

  it('가을의 새 짚 지붕은 금빛이다(review 권고 4): 벌에 맞춘 지붕의 점이 마른 풀의 올리브(색상각 50° 넘음)로 가지 않는다', () => {
    for (const [kind, v, rows] of [
      ['choga', 0, 56],
      ['choga', 1, 56],
      ['choga', 2, 56],
      ['hut', 0, 42],
      ['hut', 1, 42],
    ] as const) {
      const f = snapped('autumn', 'clear', kind, v);
      let n = 0;
      let olive = 0;
      for (let y = 0; y < rows * ART; y++) {
        for (let x = 0; x < f.w; x++) {
          const c = f.get(x, y);
          if (!(c >>> 24)) continue;
          n++;
          if (hue(c) >= 50 && hue(c) < 90) olive++;
        }
      }
      expect(olive / n, `${kind}:${v}`).toBeLessThan(0.05);
    }
  });

  it('흰 꽃나무는 그늘 단계가 보인다(review 권고 10): 흰빛 단계 가운데 그늘 쪽 둘의 몫이 다섯에 하나 가까이', () => {
    const pal = paletteOf('spring');
    const f = thingDef(pal, 'blossom', 1).frames[0];
    const white = pal.blossomWhite;
    let n = 0;
    let shade = 0;
    for (const c of f.d) {
      const i = white.indexOf(c);
      if (i < 0) continue;
      n++;
      if (i <= 1) shade++;
    }
    expect(shade / n).toBeGreaterThan(0.18);
  });

  it('소의 털은 잔잔하다(review 권고 11): 몸 안에서 이웃과 빛이 다른 점의 몫이 셋에 하나 아래', () => {
    for (const f of critters.ox().frames) {
      let n = 0;
      let diff = 0;
      for (let y = 8; y < 26; y++) {
        for (let x = 14; x < 66; x++) {
          const c = f.get(x, y);
          if (!(c >>> 24)) continue;
          n++;
          if (f.get(x + 1, y) !== c || f.get(x, y + 1) !== c) diff++;
        }
      }
      expect(diff / n).toBeLessThan(0.34);
    }
  });

  it('빗줄기는 두 그림 점 굵기이고(review 권고 9), 찍힌 네모와 장 수는 그대로다', () => {
    const rain = critters.rainSprites(paletteOf('summer', 'rain'));
    expect(rain.streaks.length).toBe(3);
    const want = [
      [0, 0, 5, 17],
      [0, 0, 4, 13],
      [0, 0, 3, 9],
    ];
    rain.streaks.forEach((f, i) => {
      let rows = 0;
      let two = 0;
      for (let y = 0; y < f.h; y++) {
        let k = 0;
        for (let x = 0; x < f.w; x++) if (f.get(x, y) >>> 24) k++;
        if (k) rows++;
        if (k >= 2) two++;
      }
      expect(two / rows, `빗줄기 ${i}`).toBeGreaterThan(0.6);
      const b = f.bounds();
      expect(b && [b.x0, b.y0, b.x1, b.y1], `빗줄기 ${i}`).toEqual(want[i]);
    });
  });
});

// ── 미리 짓기(review 권고 1) ─────────────────────────────────────

/** 흉내 낸 캔버스의 점 */
const pixelsOf = (c: unknown): Uint32Array => softPixels(c).d;

const sameImg = (a: Img, b: Img, label: string): void => {
  expect([b.w, b.h, b.n, b.ax, b.ay, b.sort, b.mw, b.mh], label).toEqual([a.w, a.h, a.n, a.ax, a.ay, a.sort, a.mw, a.mh]);
  expect(b.shades, label).toEqual(a.shades);
  expect(b.smoke, label).toEqual(a.smoke);
  expect([...b.mask], label).toEqual([...a.mask]);
  expect(pixelsOf(b.canvas), label).toEqual(pixelsOf(a.canvas));
  if (a.flipped || b.flipped) expect(pixelsOf(b.flipped), label).toEqual(pixelsOf(a.flipped));
};

describe('미리 짓기: 나눠 지어도, 처음 화면만 지어도 그림이 같다(review 권고 1의 (가)·(나)·(다))', () => {
  it('꼴의 표(catalog의 THING_META)는 그림 함수가 지은 것과 같다: 모든 갈래·생김새·계절의 크기·발치·장 수·가림 줄·굴뚝·그림자', () => {
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const atlas = { pal } as Atlas;
      for (const [kind, def] of Object.entries(THINGS)) {
        for (let v = 0; v < def.variants; v++) {
          const key = thingKey(kind, v);
          const d = thingDef(pal, kind, v);
          const meta = thingMetaOf(atlas, key);
          expect(meta, `${tone} ${key}`).toBeDefined();
          expect([meta?.w, meta?.h, meta?.ax, meta?.ay, meta?.n, meta?.sort], `${tone} ${key}`).toEqual([d.frames[0].w, d.frames[0].h, d.ax, d.ay, d.frames.length, d.sort ?? 0]);
          expect(meta?.smoke, `${tone} ${key}`).toEqual(d.smoke);
          expect(meta?.shades, `${tone} ${key}`).toEqual(d.shades ?? []);
        }
      }
    }
  }, 180_000);

  it('(가) Y8·Y9 나눠 지은 벌 = 한꺼번에 지은 벌: 세운 것·사람·짐승·물결·바탕의 점, 발치, 가림 마스크(도중에 다른 열쇠의 그림과 바탕을 끼워 불러도)', () => {
    for (const [tone, season, weather] of [SKIES[0], SKIES[2], SKIES[4]]) {
      withSoftCanvas(() => {
        const map = neutigol(season, weather);
        const needs = needsOf(map, ['farmer-boy', 'farmer-girl']);
        const whole = buildAtlas(season, weather, needs);
        ensureBase(whole);
        const parts = buildAtlas(season, weather, { things: [], people: [], critters: [] });
        const steps = prepareSteps(parts, needs);
        let k = 0;
        for (const step of steps) {
          while (step() === true) {
            // 나눠 짓던 큰 나무·집 사이에 다른 열쇠의 그림을 그 자리에서 짓고(그리기가 보이는 것을 먼저 짓듯이), 바탕을 꺼내 본다
            if (++k % 5 === 0) thingImg(parts, needs.things[(k * 7) % needs.things.length]);
            if (k % 9 === 0) void parts.arrows;
          }
        }
        for (const key of needs.things) sameImg(whole.things.get(key) as Img, parts.things.get(key) as Img, `${tone} ${key}`);
        for (const name of needs.people) expect(pixelsOf(parts.people.get(name)), `${tone} ${name}`).toEqual(pixelsOf(whole.people.get(name)));
        for (const name of needs.critters) sameImg(whole.critters.get(name) as Img, parts.critters.get(name) as Img, `${tone} ${name}`);
        for (const key of ['flag', 'bubble', 'lock', 'rings', 'glint', 'gust', 'ripple', 'foot', 'cropFront', 'splash'] as const) sameImg(whole[key], parts[key], `${tone} ${key}`);
        for (const key of ['arrows', 'drift', 'smoke', 'rain', 'butterflies', 'dragonflies'] as const) whole[key].forEach((img, i) => sameImg(img, parts[key][i], `${tone} ${key}${i}`));
        // 물결: 한 장씩 지은 캔버스 = 물결 스물넉 장을 벌에 맞춰 이은 것(한 장씩 밀리지 않는다 — Y8)
        const frames = waterFrames(parts.pal, parts.waterN).map((f) => parts.snap.apply(f));
        const water = softPixels(parts.water);
        const W = frames[0].w;
        frames.forEach((f, i) => {
          let same = true;
          for (let y = 0; y < f.h && same; y++) for (let x = 0; x < W; x++) if (water.get(i * W + x, y) !== f.d[y * W + x]) same = false;
          expect(same, `${tone} 물결 ${i}`).toBe(true);
        });
        expect(pixelsOf(parts.water), tone).toEqual(pixelsOf(whole.water));
        // 사람 시트는 personSheet를 벌에 맞춘 것 그대로
        const p = personOf('farmer-boy');
        if (p) expect(pixelsOf(parts.people.get('farmer-boy'))).toEqual(parts.snap.apply(personSheet(p)).d);
      });
    }
  }, 300_000);

  it('(나) 처음 보이는 화면(+조각 하나)에 걸치는 그림만 지은 채 연 판의 첫 장이, 다 지은 판의 첫 장과 점 하나까지 같다(그 자리에서 지은 그림 0)', () => {
    const hero = REGION.people.find((p) => p.id === 'hero');
    const at = hero ? { x: hero.x, y: hero.y } : undefined;
    for (const [tone, season, weather] of [SKIES[0], SKIES[2], SKIES[3], SKIES[4]]) {
      let deferred = 0;
      let built = 0;
      let all = 0;
      const nearOnly = (map: ReturnType<typeof neutigol>): Atlas => {
        const atlas = buildAtlas(season, weather, { things: [], people: [], critters: [] });
        const { cam, view } = REGION;
        const near = [cam.x - NEAR_PAD, cam.y - NEAR_PAD, cam.x + view.w + NEAR_PAD, cam.y + view.h + NEAR_PAD];
        const focus = at ?? { x: cam.x + view.w / 2, y: cam.y + view.h / 2 };
        const split = splitNeeds(map, atlas, ['farmer-boy'], near, focus);
        for (const step of split.now) while (step() === true);
        deferred = split.later.length;
        built = atlas.things.size;
        all = needsOf(map, ['farmer-boy']).things.length;
        return atlas;
      };
      const late = { n: -1, people: -1, critters: -1 };
      const full = gameView(season, weather, REGION.cam, REGION.view, at);
      const near = gameView(season, weather, REGION.cam, REGION.view, at, 0, nearOnly, late);
      // 뒤로 미룬 것이 있었다(시험이 헛돌지 않게)
      expect(deferred, tone).toBeGreaterThan(0);
      expect(built, tone).toBeLessThan(all);
      expect(late, tone).toEqual({ n: 0, people: 0, critters: 0 });
      expect([near.w, near.h]).toEqual([full.w, full.h]);
      let diff = 0;
      for (let i = 0; i < full.d.length; i++) if (full.d[i] !== near.d[i]) diff++;
      expect(diff, tone).toBe(0);
    }
  }, 300_000);

  it('(다) 맵을 연 뒤 쉬는 틈(paintIdle)만으로 남은 그림이 다 지어진다: 한 번에 한 걸음씩 불러도 끝이 있다', () => {
    withSoftCanvas(() => {
      const map = neutigol('autumn');
      const start = map.start.farmer;
      prepareMap(map, ['farmer-girl'], start, { w: 395, h: 232 });
      let calls = 0;
      while (!prepReady(map) && calls++ < 200_000) stepPrepare(4);
      expect(prepReady(map)).toBe(true);
      const s = openSession({ key: 'art2fix', map, who: { role: 'farmer', look: 'girl' }, hero: 'farmer-girl' });
      // 처음 화면 둘레만 지었다
      const needs = needsOf(map, ['farmer-girl']);
      expect(s.later.length).toBeGreaterThan(0);
      expect(s.atlas.things.size).toBeLessThan(needs.things.length);
      const steps = s.later.reduce((n, l) => n + l.steps.length, 0);
      let idle = 0;
      // 0밀리초: 한 번에 한 걸음만(낮은 사양에서 한 장에 한 걸음씩 하는 셈)
      while (s.later.length > 0 && idle < 20_000) {
        paintIdle(s, 0, s.world.player);
        idle++;
      }
      expect(s.later.length).toBe(0);
      expect(idle).toBeGreaterThanOrEqual(steps);
      expect(idle).toBeLessThan(5_000);
      for (const k of needs.things) expect(s.atlas.things.has(k), k).toBe(true);
      for (const n of needs.people) expect(s.atlas.people.has(n), n).toBe(true);
      for (const n of needs.critters) expect(s.atlas.critters.has(n), n).toBe(true);
    });
  }, 300_000);

  it('처음 보이는 화면의 땅을 네모 하나로 칠해도(나눠 칠하고, 그리기가 화면에 걸친 몫만 칠하고, 나머지를 조각마다 칠해도) 조각마다 칠한 땅과 점 하나까지 같다', () => {
    for (const [tone, season, weather] of [SKIES[0], SKIES[2]]) {
      withSoftCanvas(() => {
        const map = neutigol(season, weather);
        const atlas = buildAtlas(season, weather, { things: [], people: [], critters: [] });
        const shades = shadesOf(atlas, map.objects);
        // 처음 보이는 화면(맵 점) — 조각의 금에 맞지 않게
        const view: [number, number, number, number] = [REGION.cam.x - 21, REGION.cam.y - 13, REGION.cam.x + REGION.view.w + 9, REGION.cam.y + REGION.view.h + 5];
        // 견줄 조각: 그 화면에 걸친 조각들과 둘레 한 조각
        const C = GROUND_CHUNK / ART;
        const cx0 = Math.floor(view[0] / C) - 1;
        const cy0 = Math.floor(view[1] / C) - 1;
        const cx1 = Math.floor(view[2] / C) + 1;
        const cy1 = Math.floor(view[3] / C) + 1;
        const chunks = (g: ReturnType<typeof groundCanvas>): void => {
          for (let cy = Math.max(0, cy0); cy <= Math.min(g.ch - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(g.cw - 1, cx1); cx++) paintChunk(g, cx, cy);
        };
        const whole = groundCanvas(atlas, map, shades);
        chunks(whole);
        const parts = groundCanvas(atlas, map, shades);
        let calls = 0;
        while (!workView(parts, 0, view) && calls < 100_000) calls++;
        expect(calls, tone).toBeGreaterThan(50);
        // 그리기가 화면에 걸친 몫만 그 자리에서 칠한다(조각의 반쯤)
        paintAround(parts, REGION.cam.x + 200, REGION.cam.y + 100, REGION.cam.x + 520, REGION.cam.y + 380);
        chunks(parts);
        expect(parts.left, tone).toBe(whole.left);
        const a = softPixels(whole.canvas);
        const b = softPixels(parts.canvas);
        let diff = 0;
        let seen = 0;
        for (let i = 0; i < a.d.length; i++) {
          if (a.d[i] !== 0) seen++;
          if (a.d[i] !== b.d[i]) diff++;
        }
        expect(seen, tone).toBeGreaterThan(100_000);
        expect(diff, tone).toBe(0);
        let wet = 0;
        for (let i = 0; i < whole.wet.length; i++) if (whole.wet[i] !== parts.wet[i]) wet++;
        expect(wet, tone).toBe(0);
      });
    }
  }, 300_000);

  it('쉬는 틈은 MessageChannel로 잇고(길 1), 없는 환경이면 setTimeout으로 돌아간다', async () => {
    const seen: string[] = [];
    const a = idleLoop();
    await new Promise<void>((done) => a.next(() => (seen.push('channel'), done())));
    a.stop();
    vi.stubGlobal('MessageChannel', undefined);
    try {
      const b = idleLoop();
      await new Promise<void>((done) => b.next(() => (seen.push('timeout'), done())));
      b.stop();
      // 멈춘 뒤에는 부르지 않는다
      const c = idleLoop();
      let ran = false;
      c.next(() => (ran = true));
      c.stop();
      await new Promise((r) => setTimeout(r, 10));
      expect(ran).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(seen).toEqual(['channel', 'timeout']);
  });
});

// ── 시험이 못 잡던 망가뜨림(review 권고 7) ─────────────────────────

describe('시험이 못 잡던 것(review 권고 7)', () => {
  it('Y4 그리기가 짐승의 발밑 그림자를 그린다: 대문 앞의 닭·까치 발치 오른쪽 아래가 그림자 없는 장보다 어둡다', () => {
    const shot = (hideCritters: boolean): { px: Px; boxes: { x: number; y: number; w: number; h: number }[] } =>
      withSoftCanvas(() => {
        const map = neutigol('spring');
        const atlas = buildAtlas('spring', 'clear', needsOf(map, ['farmer-boy']));
        ensureAll(atlas, needsOf(map, ['farmer-boy']));
        // 짐승의 몸은 비운 그림으로(그림자만 남는다)
        for (const img of atlas.critters.values()) {
          const empty = document.createElement('canvas') as unknown as { width: number; height: number };
          empty.width = img.w * img.n;
          empty.height = img.h;
          img.canvas = empty as unknown as HTMLCanvasElement;
          img.flipped = empty as unknown as HTMLCanvasElement;
        }
        const { cam, view } = REGION;
        const world = createWorld(map, { role: 'farmer', look: 'boy' }, 'farmer-boy', [Math.floor((cam.x + view.w / 2) / 16), Math.floor((cam.y + view.h / 2) / 16)]);
        world.view = { w: view.w, h: view.h };
        world.cam = { x: cam.x, y: cam.y };
        world.glow = { morning: 0, dusk: 0 };
        world.time = 0;
        const boxes: { x: number; y: number; w: number; h: number }[] = [];
        for (const a of world.actors) {
          const img = atlas.critters.get(a.sprite);
          if (!img || a.act === 'fly') continue;
          if (a.x < cam.x || a.x > cam.x + view.w || a.y < cam.y || a.y > cam.y + view.h) continue;
          if (hideCritters) a.hidden = true;
          const b = footBox(atlas.foot, img.w);
          boxes.push({ x: Math.round((a.x - cam.x) * ART) + b.x, y: Math.round((a.y - cam.y) * ART) + b.y, w: b.w, h: b.h });
        }
        const scene = buildScene(map, atlas, world);
        scene.clouds = [];
        const canvas = document.createElement('canvas') as unknown as { width: number; height: number; getContext(): unknown };
        canvas.width = view.w * ART;
        canvas.height = view.h * ART;
        render({ ctx: canvas.getContext() as CanvasRenderingContext2D, w: canvas.width, h: canvas.height, scale: ART }, world, scene);
        return { px: softPixels(canvas), boxes };
      });
    const on = shot(false);
    const off = shot(true);
    expect(on.boxes.length).toBeGreaterThanOrEqual(2);
    const ratios: number[] = [];
    for (const b of on.boxes) {
      let a = 0;
      let z = 0;
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) {
          a += luma(on.px.get(x, y));
          z += luma(off.px.get(x, y));
        }
      }
      ratios.push(a / z);
    }
    // 그림자 네모 안의 밝기가 그림자 없는 장보다 어둡다(앞에 선 풀포기가 조금 가리는 자리도 있어 하나하나는 0.95, 고루는 0.85 아래)
    for (const r of ratios) expect(r, ratios.map((q) => q.toFixed(3)).join(',')).toBeLessThan(0.95);
    expect(ratios.reduce((p, q) => p + q, 0) / ratios.length, ratios.map((q) => q.toFixed(3)).join(',')).toBeLessThan(0.85);
  }, 120_000);

  it('Y7 집·나무 뒤로 돌아가면 가려지는 자리가 1-라와 같다: 큰 것(tall)마다 새 가림 마스크가 1-라 마스크의 켜진 칸을 덮는다(모두 99.5% 넘게, 갈래마다 92% 넘게 — 4-1 ㉠, 권고 E)', () => {
    const want = mask1e as Record<string, string>;
    const keys = Object.keys(want)
      .filter((k) => k.endsWith('@spring'))
      .map((k) => k.slice(0, -'@spring'.length));
    expect(keys.length).toBeGreaterThan(40);
    for (const [tone, season, weather] of SKIES) {
      withSoftCanvas(() => {
        const atlas = buildAtlas(season, weather, { things: [], people: [], critters: [] });
        let on = 0;
        let hit = 0;
        for (const key of keys) {
          const [dims, hex] = (want[`${key}@${tone}`] ?? want[`${key}@spring`]).split(':');
          const [mw, mh] = dims.split('x').map(Number);
          const bits: number[] = [];
          for (const ch of hex) {
            const q = parseInt(ch, 16);
            bits.push((q >> 3) & 1, (q >> 2) & 1, (q >> 1) & 1, q & 1);
          }
          const img = thingImg(atlas, key) as Img;
          expect([img.mw, img.mh], `${tone} ${key}`).toEqual([mw, mh]);
          let o = 0;
          let h = 0;
          for (let i = 0; i < mw * mh; i++) {
            if (!bits[i]) continue;
            o++;
            if (img.mask[i]) h++;
          }
          on += o;
          hit += h;
          // 지금 값: 갈래마다 가장 낮은 것이 young:2 93.0%, pineS:1 93.8% — 앞으로 1~2칸 더 빠지는 것을 잡는다(review 16.4 권고 E)
          if (o > 0) expect(h / o, `${tone} ${key}`).toBeGreaterThan(0.92);
        }
        // 지금 값: 모두 99.63~99.65%
        expect(hit / on, tone).toBeGreaterThan(0.995);
      });
    }
  }, 180_000);

  it('Y10 구름 그림자는 따뜻한 빛을 곱한다: 모든 점이 R ≥ B이고 밝기 0.7 이상(남빛·검은빛으로 어둡게 하지 않는다)', () => {
    for (const [tone, season, weather] of SKIES) {
      const f = critters.cloudShadow(paletteOf(season, weather));
      let n = 0;
      for (const c of f.d) {
        if (!(c >>> 24)) continue;
        n++;
        expect(R(c) >= B(c) && luma(c) >= 0.7, `${tone} #${c.toString(16)}`).toBe(true);
      }
      expect(n, tone).toBeGreaterThan(10_000);
    }
  });

  it('Y12 겨울에 마당의 것에 얹힌 눈은 두께가 1-라의 ART배다: 위에서부터 이어진 눈 줄의 가운뎃값이 두께 × ART의 0.9배 이상', () => {
    const DEPTH: Record<string, number> = { well: 2, jars: 2, woodpile: 2, strawstack: 4, fenceH: 2, fenceV: 1, stonewallH: 2, stonewallV: 2, pagoda: 2, lantern: 2, rockS: 1, rockM: 3, rockL: 4, flatstone: 1, stump: 2, log: 2, fallen: 2, cairn: 2 };
    const pal = paletteOf('winter');
    const snow = new Set(pal.snow);
    for (const [kind, d] of Object.entries(DEPTH)) {
      const f = thingDef(pal, kind, 0).frames[0];
      const runs: number[] = [];
      for (let x = 0; x < f.w; x++) {
        let y = 0;
        while (y < f.h && !(f.get(x, y) >>> 24)) y++;
        if (y >= f.h || !snow.has(f.get(x, y))) continue;
        let k = 0;
        while (y + k < f.h && snow.has(f.get(x, y + k))) k++;
        runs.push(k);
      }
      runs.sort((a, b) => a - b);
      expect(runs.length, kind).toBeGreaterThan(8);
      expect(runs[runs.length >> 1] / (d * ART), kind).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('Y13 표시가 화면에 찍히는 네모(맵 점, 발치 기준)가 1-라와 같다: 깃발·말풍선·막힌 길·누른 곳의 테는 그대로, 화살표 여덟은 1-라 ±0.5', () => {
    const box = (img: Img, f = 0): number[] => {
      const px = softPixels(img.canvas);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
          if (!(px.get(f * img.w + x, y) >>> 24)) continue;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
      return [(x0 - img.ax) / ART, (y0 - img.ay) / ART, (x1 + 1 - img.ax) / ART, (y1 + 1 - img.ay) / ART];
    };
    withSoftCanvas(() => {
      const atlas = buildAtlas('spring', 'clear', { things: [], people: [], critters: [] });
      // 1-라(9f41cdc)의 1배 그림과 발치로 잰 네모
      expect(box(atlas.flag)).toEqual([-3, -15, 11, 1]);
      expect(box(atlas.bubble)).toEqual([-5, -10, 8, 1]);
      expect(box(atlas.lock)).toEqual([-7, -12, 8, 1]);
      expect(box(atlas.rings)).toEqual([-8, -4, 8, 4]);
      const old = [
        [-9, -7, 9, 8],
        [-8, -8, 7, 7],
        [-7, -9, 8, 9],
        [-6, -8, 9, 7],
        [-8, -7, 9, 8],
        [-6, -6, 9, 9],
        [-7, -8, 8, 9],
        [-8, -6, 7, 9],
      ];
      // 지금 판(그림 올리기 ②): 가로·세로 넷은 1-라의 가운데 점에 맞춰 반 점씩 넉넉하고, 비스듬한 넷은 같다
      const now = [
        [-8.5, -7.5, 9.5, 8.5],
        [-8, -8, 7, 7],
        [-7.5, -8.5, 8.5, 9.5],
        [-6, -8, 9, 7],
        [-8.5, -7.5, 9.5, 8.5],
        [-6, -6, 9, 9],
        [-7.5, -8.5, 8.5, 9.5],
        [-8, -6, 7, 9],
      ];
      expect(atlas.arrows.length).toBe(8);
      atlas.arrows.forEach((a, i) => {
        const b = box(a);
        expect(b, `화살표 ${i}`).toEqual(now[i]);
        b.forEach((v, k) => expect(Math.abs(v - old[i][k]), `화살표 ${i}`).toBeLessThanOrEqual(0.5));
      });
    });
  });
});
