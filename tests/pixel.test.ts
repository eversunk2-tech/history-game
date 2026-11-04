// 도트 그림의 검사. 캔버스 없이 버퍼만 본다: 빠진 그림이 없는지, 발치가 그림 안에 있는지, 움직임의 장이 서로 다른지.
// 그림 올리기 ①(spec 4.7.5): 사람과 땅은 그림 점(ART — 맵 점의 반)으로 그린다. 사람 한 장은 48×64, 땅 한 칸은 32×32 그림 점이다.
// 집·나무·소품·짐승은 ② 전까지 1배 그림이다(그림 벌이 ART배로 키워 쓴다).

import { describe, expect, it, vi } from 'vitest';
import { neutigol, type Stage } from '../src/content/maps/neutigol';
import type { MapData } from '../src/map/types';
import { SEASONS, type Season } from '../src/engine/types';
import { THINGS } from '../src/map/things';
import { T, TILE, type Weather } from '../src/map/types';
import { MAKERS, anchorOf, shadesFor, thingDefs, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { GROUND_TILE, groundJob, paintGround, snapperOf, waterFrames, type Shade } from '../src/pixel/ground';
import { MASTER, MASTER_BASE, MASTER_MAX, MASTER_WARMER, TONES, toneOf, type Tone } from '../src/pixel/master';
import { paletteOf } from '../src/pixel/palette';
import { DIRS, GUISES, HEROES, HOUSEHOLDS, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS, personFrame, personOf, personSheet } from '../src/pixel/people';
import { SKIN } from '../src/pixel/palette';
import { ART, Px, alpha, blue, green, hash2, hex, red, rgb, vnoise } from '../src/pixel/px';
import { Snapper, countColors, distance, reduce } from '../src/pixel/quant';
import { buildAtlas, ensureAll, groundCanvas, needsOf, paintChunk, prepareSteps, shadesOf, workGround } from '../src/pixel/atlas';
import { atlasFor } from '../src/map/session';
import { CLOTH } from '../src/pixel/palette';
import { footShadow } from '../src/pixel/people';
import { artScale, scaleFor } from '../src/map/camera';
import { blotch, edgeContrast, gateScene, harshChecker, harshOrphans, luma, monotony, seasonGround, warmth } from './artRules';

const same = (a: Px, b: Px): boolean => a.w === b.w && a.h === b.h && a.d.every((v, i) => v === b.d[i]);
/** 버퍼의 네모 한 조각 */
const cut = (px: Px, x0: number, y0: number, w: number, h: number): Px => {
  const out = new Px(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.d[y * w + x] = px.d[(y0 + y) * px.w + x0 + x];
  return out;
};

/** 봄의 느티나무 그림의 지문(public/icons의 아이콘이 이 그림에서 떴다. 봄의 느티나무는 고치지 않는다) */
const ZELKOVA_SPRING = '57c3b9d8';

/** 그림 벌 다섯: 네 계절과 큰비가 온 해의 여름 */
const SKIES: [Tone, Season, Weather][] = [
  ['spring', 'spring', 'clear'],
  ['summer', 'summer', 'clear'],
  ['rain', 'summer', 'rain'],
  ['autumn', 'autumn', 'clear'],
  ['winter', 'winter', 'clear'],
];

// 계절마다 맵을 짓고 그림을 찍는 시험은 무겁다. 다른 시험과 함께 돌 때도 시간에 걸리지 않게 넉넉히 준다.
vi.setConfig({ testTimeout: 60_000 });

describe('화소 버퍼', () => {
  it('빛깔을 묶고 푼다', () => {
    expect(hex('#ff8000')).toBe(rgb(255, 128, 0));
    expect(alpha(hex('#000000', 90))).toBe(90);
  });

  it('무늬는 같은 자리에서 언제나 같은 값이다(Math.random을 쓰지 않는다)', () => {
    expect(hash2(12, 34, 5)).toBe(hash2(12, 34, 5));
    expect(hash2(12, 34, 5)).not.toBe(hash2(12, 35, 5));
    const v = vnoise(3.3, 7.7, 9);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('테두리를 두른다', () => {
    const px = new Px(5, 5);
    px.set(2, 2, hex('#ffffff'));
    px.outline(hex('#000000'));
    expect(px.count()).toBe(5);
    expect(px.get(2, 1)).toBe(hex('#000000'));
    expect(px.get(1, 1)).toBe(0);
  });
});

describe('세운 것의 그림', () => {
  it('맵에 놓는 모든 갈래에 그림이 있다', () => {
    for (const kind of Object.keys(THINGS)) expect(MAKERS[kind], kind).toBeTypeOf('function');
    for (const o of neutigol().objects) {
      expect(THINGS[o.kind], o.kind).toBeDefined();
      expect(o.variant, o.kind).toBeLessThan(THINGS[o.kind].variants);
    }
  });

  it('네 계절 모두 그려지고, 발치가 그림 안에 있다', () => {
    for (const season of SEASONS) {
      const defs = thingDefs(paletteOf(season));
      for (const [key, def] of defs) {
        expect(def.frames.length, key).toBeGreaterThan(0);
        const first = def.frames[0];
        expect(first.count(), key).toBeGreaterThan(8);
        expect(def.ax >= 0 && def.ax < first.w && def.ay >= 0 && def.ay <= first.h, key).toBe(true);
        for (const f of def.frames) expect(f.w === first.w && f.h === first.h, key).toBe(true);
      }
    }
  });

  it('넓은 잎 나무는 꼴이 여섯 가지이고 잎 빛이 세 벌이다', () => {
    const defs = thingDefs(paletteOf('spring'));
    const oaks = [0, 1, 2, 3, 4, 5].map((v) => defs.get(thingKey('oak', v))!.frames[0]);
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(same(oaks[i], oaks[j]), `${i}=${j}`).toBe(false);
    // 나무갓 안에 어두운 속이 보인다(한 덩어리의 밝은 구름이 아니다): 가장 어두운 잎빛 둘이 갓의 한 푼을 넘는다
    const pal = paletteOf('spring');
    for (const [v, ramp] of [
      [0, pal.leaf],
      [1, pal.leafWarm],
      [2, pal.leafDeep],
    ] as const) {
      let dark = 0;
      let all = 0;
      for (const c of oaks[v].d) {
        if (c === 0) continue;
        all++;
        if (c === ramp[0] || c === ramp[1]) dark++;
      }
      expect(dark / all, `oak ${v}`).toBeGreaterThan(0.1);
    }
  });

  it('흔들리는 것은 장이 서로 다르다(나무, 덤불, 풀)', () => {
    const defs = thingDefs(paletteOf('spring'));
    for (const [kind, def] of Object.entries(THINGS)) {
      if (!def.sways) continue;
      const sprite = defs.get(thingKey(kind, 0))!;
      expect(sprite.frames.length, kind).toBeGreaterThanOrEqual(3);
      expect(same(sprite.frames[0], sprite.frames[1]), kind).toBe(false);
    }
  });

  it('큰 느티나무는 여러 칸 크기다(집보다 크다)', () => {
    const defs = thingDefs(paletteOf('spring'));
    const tree = defs.get(thingKey('zelkova', 0))!.frames[0];
    const house = defs.get(thingKey('choga', 0))!.frames[0];
    expect(tree.w).toBeGreaterThanOrEqual(TILE * 10);
    expect(tree.h).toBeGreaterThanOrEqual(TILE * 10);
    expect(tree.w).toBeGreaterThan(house.w);
  });

  it('계절이 바뀌면 잎의 빛깔이 바뀐다', () => {
    const spring = thingDefs(paletteOf('spring')).get(thingKey('oak', 0))!.frames[0];
    const autumn = thingDefs(paletteOf('autumn')).get(thingKey('oak', 0))!.frames[0];
    expect(same(spring, autumn)).toBe(false);
  });

  it('세운 것이 놓이는 발치: 여러 칸짜리는 차지한 칸들의 아래 가운데', () => {
    expect(anchorOf('choga', 10, 20)).toEqual({ x: 10 * 16 + 48, y: 21 * 16 - 2 });
    expect(anchorOf('oak', 3, 4, 2, -1)).toEqual({ x: 3 * 16 + 10, y: 4 * 16 + 11 });
  });
});

describe('인물의 그림', () => {
  const everyone = { ...HEROES, ...VILLAGERS };

  it('주인공은 여섯 모습이고 마을 사람은 열 사람이 넘는다', () => {
    expect(Object.keys(HEROES).sort()).toEqual(['daughter', 'farmer-boy', 'farmer-girl', 'nobi-boy', 'nobi-girl', 'son']);
    expect(Object.keys(VILLAGERS).length).toBeGreaterThanOrEqual(10);
    // 맵에 나오는 사람의 그림이 모두 있다
    for (const d of neutigol().dwellers) {
      if (d.animal) continue;
      expect(everyone[d.sprite], d.sprite).toBeDefined();
    }
  });

  it('한 장은 48×64 그림 점(맵 점 24×32 — 화면 크기는 1-라와 같다)이고, 한 인물의 모든 장이 한 장에 들어 있다', () => {
    expect([PERSON_W, PERSON_H, PERSON_AX, PERSON_AY]).toEqual([48, 64, 24, 60]);
    expect([PERSON_W / ART, PERSON_H / ART]).toEqual([24, 32]);
    const frame = personFrame(HEROES['farmer-girl'], 'down', 'idle', 0);
    expect([frame.w, frame.h]).toEqual([PERSON_W, PERSON_H]);
    const sheet = personSheet(HEROES['farmer-girl']);
    expect([sheet.w, sheet.h]).toEqual([PERSON_W * SHEET_COLS, PERSON_H * 4]);
  });

  it('네 방향의 그림이 서로 다르고, 걷기 넉 장은 모두 다른 자세다', () => {
    for (const [name, p] of Object.entries(everyone)) {
      const stand = DIRS.map((dir) => personFrame(p, dir, 'idle', 0));
      expect(same(stand[0], stand[1]), name).toBe(false);
      expect(same(stand[0], stand[2]), name).toBe(false);
      expect(same(stand[2], stand[3]), name).toBe(false);
      for (const dir of DIRS) {
        const walk = [0, 1, 2, 3].map((f) => personFrame(p, dir, 'walk', f));
        // 넉 장 가운데 같은 장이 없다(발 벌림 → 섬 → 발 벌림 → 섬이 아니다)
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(same(walk[i], walk[j]), `${name} ${dir} ${i}=${j}`).toBe(false);
        // 서 있는 모습과도 다르다
        for (let i = 0; i < 4; i++) expect(same(walk[i], personFrame(p, dir, 'idle', 0)), `${name} ${dir} ${i}`).toBe(false);
        expect(same(personFrame(p, dir, 'idle', 0), personFrame(p, dir, 'idle', 1)), `${name} ${dir}`).toBe(false);
      }
    }
  });

  it('걸을 때 몸이 오르내린다: 발을 디딜 때 머리가 맵 점 하나(그림 점 둘) 내려온다', () => {
    const p = HEROES['farmer-boy'];
    for (const dir of DIRS) {
      const top = (f: number): number => personFrame(p, dir, 'walk', f).bounds()!.y0;
      expect(top(0), dir).toBe(top(1) + ART);
      expect(top(2), dir).toBe(top(3) + ART);
    }
  });

  it('옆모습의 몸통은 열네 그림 점(맵 점 일곱) 너비다(종이 인형처럼 얇지 않다)', () => {
    for (const name of ['farmer-boy', 'daughter', 'father', 'mother']) {
      const f = personFrame(everyone[name], 'left', 'idle', 0);
      // 어깨 아래 줄들에서 찍힌 점의 너비(테두리 빼고)
      const b = f.bounds()!;
      let widest = 0;
      for (let y = b.y0 + 26; y <= b.y0 + 34; y++) {
        let x0 = -1;
        let x1 = -1;
        for (let x = 0; x < f.w; x++) {
          if (f.get(x, y) !== 0) {
            if (x0 < 0) x0 = x;
            x1 = x;
          }
        }
        widest = Math.max(widest, x1 - x0 + 1 - 2);
      }
      expect(widest, name).toBeGreaterThanOrEqual(14);
    }
  });

  it('일하는 몸짓은 넉 장이고 석 장이 서로 다르다(들고, 가운데, 내리고)', () => {
    for (const name of ['father', 'brother', 'wellWoman', 'nobiMother']) {
      const w = [0, 1, 2, 3].map((f) => personFrame(everyone[name], 'left', 'work', f));
      expect(same(w[0], w[1]), name).toBe(false);
      expect(same(w[1], w[2]), name).toBe(false);
      expect(same(w[0], w[2]), name).toBe(false);
    }
    const wash = [0, 1, 2].map((f) => personFrame(everyone.washWoman, 'down', 'work', f));
    expect(same(wash[0], wash[1])).toBe(false);
    expect(same(wash[1], wash[2])).toBe(false);
  });

  it('남자아이와 여자아이는 아랫도리만이 아니라 얼굴 둘레에서도 다르다', () => {
    for (const [boy, girl] of [
      ['farmer-boy', 'farmer-girl'],
      ['nobi-boy', 'nobi-girl'],
      ['son', 'daughter'],
    ]) {
      expect(HEROES[boy].bottom).toBe('pants');
      expect(HEROES[girl].bottom).toBe('skirt');
      expect(HEROES[boy].sex).toBe('m');
      expect(HEROES[girl].sex).toBe('f');
      for (const dir of DIRS) {
        const a = personFrame(HEROES[boy], dir, 'idle', 0);
        const b = personFrame(HEROES[girl], dir, 'idle', 0);
        // 머리의 줄(위에서 스물두 줄)에서 다른 점이 여럿 있다
        const top = Math.min(a.bounds()!.y0, b.bounds()!.y0);
        let diff = 0;
        for (let y = top; y < top + 22; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) diff++;
        expect(diff, `${boy}/${girl} ${dir}`).toBeGreaterThanOrEqual(12);
        // 아랫도리도 다르다(바지와 치마)
        let low = 0;
        for (let y = 44; y < 62; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) low++;
        expect(low, `${boy}/${girl} ${dir}`).toBeGreaterThan(20);
      }
    }
  });

  it('살빛은 집안으로 갈리지 않는다: 여섯 주인공은 같은 살빛이고, 집안마다 살빛이 섞여 있다', () => {
    const skins = Object.values(HEROES).map((p) => p.skin);
    for (const sk of skins) expect(sk).toBe(skins[0]);
    const tonesOf = (names: string[]): Set<unknown> => new Set(names.map((n) => everyone[n].skin));
    for (const [house, names] of Object.entries(HOUSEHOLDS)) {
      for (const n of names) expect(everyone[n], n).toBeDefined();
      expect(tonesOf(names).size, house).toBeGreaterThanOrEqual(2);
    }
    // 어느 살빛도 한 집안에만 나오지 않는다
    const all = new Set(Object.values(everyone).map((p) => p.skin));
    for (const tone of all) {
      const houses = Object.entries(HOUSEHOLDS).filter(([, names]) => names.some((n) => everyone[n].skin === tone));
      expect(houses.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('같은 틀을 쓰던 어른 남자 셋(아버지, 이웃 어른, 소 모는 이웃)이 옷과 머리에서 갈린다', () => {
    const trio = ['father', 'neighborMan', 'plowman'].map((n) => everyone[n]);
    expect(new Set(trio.map((p) => p.hair)).size).toBe(3);
    expect(new Set(trio.map((p) => p.top)).size).toBeGreaterThanOrEqual(2);
    for (const dir of DIRS) {
      const f = trio.map((p) => personFrame(p, dir, 'idle', 0));
      expect(same(f[0], f[1]) || same(f[0], f[2]) || same(f[1], f[2]), dir).toBe(false);
    }
  });

  it('사람마다 생김새가 다르다', () => {
    const names = Object.keys(everyone);
    const fronts = names.map((name) => personFrame(everyone[name], 'down', 'idle', 0));
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        expect(same(fronts[i], fronts[j]), `${names[i]} = ${names[j]}`).toBe(false);
      }
    }
  });

  it('그림이 칸을 벗어나지 않는다(위쪽에 머리 장식이 잘리지 않는다)', () => {
    for (const [name, p] of Object.entries(everyone)) {
      for (const dir of DIRS) {
        for (const act of ['walk', 'idle', 'work', 'sit'] as const) {
          const b = personFrame(p, dir, act, 0).bounds()!;
          expect(b.y0, `${name} ${dir} ${act}`).toBeGreaterThanOrEqual(1);
          expect(b.y1, `${name} ${dir} ${act}`).toBeLessThanOrEqual(PERSON_H - 1);
        }
      }
    }
  });
});

describe('짐승과 표시', () => {
  it('닭, 병아리, 개, 소, 논 가는 소, 까치의 그림이 있고 장이 움직인다', () => {
    for (const make of [critters.hen, critters.rooster, critters.chick, critters.dog, critters.ox, critters.plowTeam, critters.magpie, critters.egret]) {
      const c = make();
      expect(c.frames.length).toBeGreaterThanOrEqual(2);
      expect(same(c.frames[0], c.frames[1])).toBe(false);
    }
  });

  it('화살표는 여덟 방향이다', () => {
    const arrows = critters.arrowMarks();
    expect(arrows.length).toBe(8);
    expect(same(arrows[0], arrows[2])).toBe(false);
  });

  it('봄에는 꽃잎이, 가을에는 잎이, 겨울에는 눈이 날린다', () => {
    expect(critters.driftSprites(paletteOf('spring')).length).toBeGreaterThan(0);
    expect(critters.driftSprites(paletteOf('summer')).length).toBe(0);
    expect(critters.driftSprites(paletteOf('autumn')).length).toBeGreaterThan(0);
    expect(critters.driftSprites(paletteOf('winter')).length).toBeGreaterThan(0);
  });
});

describe('땅 그림', () => {
  const small = { w: 12, h: 8, terrain: new Uint8Array(12 * 8) };
  small.terrain.fill(T.grass);
  for (let y = 0; y < 8; y++) {
    small.terrain[y * 12 + 5] = T.shallow;
    small.terrain[y * 12 + 6] = T.deep;
    small.terrain[y * 12 + 7] = T.shallow;
  }
  for (let x = 0; x < 4; x++) small.terrain[3 * 12 + x] = T.path;
  small.terrain[6 * 12 + 1] = T.paddy;
  small.terrain[6 * 12 + 2] = T.paddy;

  it('언제 칠해도 같은 그림이 나온다. 땅 한 칸은 32×32 그림 점이다', () => {
    const a = paintGround(small, paletteOf('spring'));
    const b = paintGround(small, paletteOf('spring'));
    expect(same(a.px, b.px)).toBe(true);
    expect(GROUND_TILE).toBe(TILE * ART);
    expect(GROUND_TILE).toBe(32);
    expect(a.px.w).toBe(12 * GROUND_TILE);
    expect(a.px.h).toBe(8 * GROUND_TILE);
  });

  it('조각으로 나눠 칠해도 한 번에 칠한 것과 점 하나까지 같다(어느 차례로 칠해도 — spec 4.7.5의 ㅋ)', () => {
    const map = neutigol('autumn');
    const pal = paletteOf('autumn');
    const defs = thingDefs(pal);
    const shades = shadesFor((key) => defs.get(key)?.shades, map.objects);
    const job = groundJob(map, pal, shades);
    // 냇물·논·마을이 만나는 자리의 큰 네모 하나와, 그것을 네 조각으로 나눈 것(조각마다 다른 차례로)
    const x0 = 40 * GROUND_TILE;
    const y0 = 56 * GROUND_TILE;
    const S = 4 * GROUND_TILE;
    const whole = job.paint(x0, y0, 2 * S, 2 * S);
    const parts = new Px(2 * S, 2 * S);
    for (const [i, j] of [
      [1, 1],
      [0, 1],
      [1, 0],
      [0, 0],
    ]) {
      parts.blitRaw(job.paint(x0 + i * S, y0 + j * S, S, S), i * S, j * S);
    }
    expect(same(whole, parts)).toBe(true);
  });

  it('홀수 자리에서 시작한 네모를 칠해도 큰 네모에서 잘라 낸 것과 같다(2×2 휨을 맵의 짝수 격자에 맞춘다)', () => {
    const map = neutigol('spring');
    const pal = paletteOf('spring');
    const defs = thingDefs(pal);
    const job = groundJob(map, pal, shadesFor((key) => defs.get(key)?.shades, map.objects));
    const x0 = 40 * GROUND_TILE;
    const y0 = 34 * GROUND_TILE;
    const S = 3 * GROUND_TILE;
    const whole = job.paint(x0, y0, 2 * S, 2 * S);
    for (const [dx, dy, w, h] of [
      [3, 5, S, S + 1],
      [1, 0, S - 1, S],
      [0, 7, S + 3, S - 5],
      [S + 1, S + 1, S - 3, S - 1],
    ]) {
      expect(same(job.paint(x0 + dx, y0 + dy, w, h), cut(whole, dx, dy, w, h)), `${dx},${dy} ${w}×${h}`).toBe(true);
    }
  });

  it('잘게 나눠 칠하기(steps)를 도중에 쉬고 다른 네모를 칠한 뒤 이어도 한 번에 칠한 것과 같다', () => {
    const map = neutigol('summer', 'rain');
    const pal = paletteOf('summer', 'rain');
    const defs = thingDefs(pal);
    const job = groundJob(map, pal, shadesFor((key) => defs.get(key)?.shades, map.objects));
    const S = 4 * GROUND_TILE;
    const a: [number, number, number, number] = [40 * GROUND_TILE, 56 * GROUND_TILE, S, S];
    const b: [number, number, number, number] = [44 * GROUND_TILE, 56 * GROUND_TILE, S, S];
    const ga = job.steps(...a);
    const gb = job.steps(...b);
    let ra = ga.next();
    let rb = gb.next();
    let turns = 0;
    while (!ra.done || !rb.done) {
      // 한 걸음씩 번갈아(가운데에 한 번에 칠하는 다른 네모를 끼워 넣는다)
      if (!ra.done) ra = ga.next();
      if (turns === 5) job.paint(42 * GROUND_TILE, 58 * GROUND_TILE, S, S);
      if (!rb.done) rb = gb.next();
      turns++;
    }
    expect(turns).toBeGreaterThan(20);
    expect(same(ra.value as Px, job.paint(...a))).toBe(true);
    expect(same(rb.value as Px, job.paint(...b))).toBe(true);
  });

  it('냇물 자리만 비워 두고(그 아래에 물결을 깐다) 나머지는 빈틈없이 칠한다', () => {
    const g = paintGround(small, paletteOf('spring'));
    // 풀밭 한가운데는 꽉 차 있다
    const T2 = GROUND_TILE;
    for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) expect(alpha(g.px.get(x + T2, y + T2))).toBe(255);
    // 깊은 물 한가운데는 비쳐 보인다
    expect(alpha(g.px.get(6 * T2 + T2 / 2, 4 * T2 + T2 / 2))).toBeLessThan(255);
    expect(g.wet[4 * 12 + 6]).toBe(1);
    expect(g.wet[1 * 12 + 1]).toBe(0);
    expect(g.glint[6 * 12 + 1]).toBe(1);
  });

  it('칸의 경계가 곧은 줄로 남지 않는다(길과 풀이 구불구불 만난다)', () => {
    const g = paintGround(small, paletteOf('spring'));
    // 길 칸의 아래 가장자리 줄(y = 4칸째의 맨 위)을 따라가면 빛깔이 한 가지가 아니다
    const seen = new Set<number>();
    for (let x = 0; x < 3 * GROUND_TILE; x++) seen.add(g.px.get(x, 4 * GROUND_TILE + ART));
    expect(seen.size).toBeGreaterThan(2);
  });

  it('계절마다 논의 모습이 다르다: 물 댄 논 → 푸른 벼 → 누런 벼 → 빈 논', () => {
    const states = SEASONS.map((s) => paletteOf(s).paddyState);
    expect(states).toEqual(['water', 'green', 'gold', 'bare']);
    const spring = paintGround(small, paletteOf('spring'));
    const summer = paintGround(small, paletteOf('summer'));
    expect(spring.px.get(24 * ART, (6 * 16 + 8) * ART)).not.toBe(summer.px.get(24 * ART, (6 * 16 + 8) * ART));
    expect(summer.glint[6 * 12 + 1]).toBe(0);
  });

  it('물결은 이어 붙여도 되는 맵 점 64(그림 점 128)짜리 무늬가 여러 장이다', () => {
    const frames = waterFrames(paletteOf('spring'), 8);
    expect(frames.length).toBe(8);
    expect(frames[0].w).toBe(64 * ART);
    expect(same(frames[0], frames[3])).toBe(false);
    for (const f of frames) expect(f.count()).toBe(64 * ART * 64 * ART);
    // 오른쪽 끝과 왼쪽 끝, 아래 끝과 위 끝이 이어진다(끝줄의 빛이 첫 줄과 많이 같다)
    const f = frames[0];
    const S = f.w;
    let joinX = 0;
    let joinY = 0;
    for (let k = 0; k < S; k++) {
      if (f.get(S - 1, k) === f.get(0, k)) joinX++;
      if (f.get(k, S - 1) === f.get(k, 0)) joinY++;
    }
    expect(joinX / S).toBeGreaterThan(0.6);
    expect(joinY / S).toBeGreaterThan(0.6);
  });

  it('그림자는 바탕 빛을 어둡게 해서 진다', () => {
    const plain = paintGround(small, paletteOf('spring'));
    // 그림자는 맵 점으로 준다(칠할 때 그림 점으로 옮긴다)
    const shaded = paintGround(small, paletteOf('spring'), [{ cx: 24, cy: 24, rx: 6, ry: 4, strength: 0.3 }]);
    const a = plain.px.get(24 * ART, 24 * ART);
    const b = shaded.px.get(24 * ART, 24 * ART);
    expect(red(b) + green(b) + blue(b)).toBeLessThan(red(a) + green(a) + blue(a));
    // 그늘은 푸르스름해지지 않는다(빨강이 파랑보다 작지 않다 — ㅂ·ㅍ. 장면 전체의 따뜻함은 아래 규칙 시험이 잰다)
    expect(red(b) - blue(b)).toBeGreaterThanOrEqual(0);
    expect(shaded.px.get(60 * ART, 100 * ART)).toBe(plain.px.get(60 * ART, 100 * ART));
  });
});

describe('빛깔 한 벌(계절마다 손으로 다듬은 96색 이하 — spec 4.7.5의 ㅇ)', () => {
  it('계절마다 한 벌은 96색 이하이고 겹치는 빛이 없다(네 계절과 큰비가 온 여름)', () => {
    expect(MASTER_MAX).toBe(96);
    expect([...TONES].sort()).toEqual(['autumn', 'rain', 'spring', 'summer', 'winter']);
    for (const tone of TONES) {
      expect(MASTER[tone].length, tone).toBeLessThanOrEqual(MASTER_MAX);
      expect(MASTER[tone].length, tone).toBeGreaterThan(64);
      expect(new Set(MASTER[tone]).size, tone).toBe(MASTER[tone].length);
    }
    // 날씨는 여름에만 한 벌을 가른다
    expect(toneOf('summer', 'rain')).toBe('rain');
    expect(toneOf('summer')).toBe('summer');
    for (const season of ['spring', 'autumn', 'winter'] as const) expect(toneOf(season, 'rain')).toBe(season);
  });

  it('한 벌은 1-라의 64색 벌에서 출발해 손으로 다듬었다: 1-라 벌의 빛이 거의 다 그대로 있고, 옮긴 빛은 따뜻한 쪽으로만 옮겼다', () => {
    const rb = (c: number): number => red(c) - blue(c);
    for (const tone of TONES) {
      expect(MASTER_BASE[tone].length, tone).toBe(64);
      const now = new Set(MASTER[tone]);
      const kept = MASTER_BASE[tone].filter((c) => now.has(c)).length;
      const moved = Object.entries(MASTER_WARMER[tone]);
      expect(kept + moved.length, tone).toBe(64);
      expect(moved.length, tone).toBeLessThanOrEqual(5);
      for (const [from, to] of moved) {
        expect(MASTER_BASE[tone].includes(hex(from)), `${tone} ${from}`).toBe(true);
        expect(now.has(hex(to)), `${tone} ${to}`).toBe(true);
        // 따뜻한 쪽으로(빨강 − 파랑이 커진다), 밝기는 거의 그대로
        expect(rb(hex(to)), `${tone} ${from}`).toBeGreaterThan(rb(hex(from)));
        const lum = (c: number): number => red(c) * 0.3 + green(c) * 0.59 + blue(c) * 0.11;
        expect(Math.abs(lum(hex(to)) - lum(hex(from))), `${tone} ${from}`).toBeLessThan(10);
      }
    }
  });

  it('한 벌이 그 계절의 그림에 맞는다: 계절의 맵에 쓰인 빛깔이 한 벌로 옮겨질 때 크게 달라지지 않는다', () => {
    for (const [tone, season, weather] of SKIES) {
      const map = neutigol(season, weather);
      const pal = paletteOf(season, weather);
      const snap = new Snapper(MASTER[tone]);
      const defs = thingDefs(pal);
      const counts = new Map<number, number>();
      const shades: Shade[] = shadesFor((key) => defs.get(key)?.shades, map.objects);
      for (const px of sampleGround(map, pal, shades)) countColors(px, counts);
      const used = new Set(map.objects.map((o) => thingKey(o.kind, o.variant)));
      for (const [key, def] of defs) if (used.has(key)) countColors(def.frames[0], counts, 4);
      const onMap = new Set(map.dwellers.map((d) => d.sprite));
      for (const [name, p] of Object.entries({ ...HEROES, ...VILLAGERS, ...GUISES })) if (name in HEROES || onMap.has(name)) countColors(personSheet(p), counts, 2);
      // 점의 수로 달아 본 평균 어긋남(빛깔 한 칸의 값으로)과, 많이 쓰인 빛깔의 가장 큰 어긋남
      let total = 0;
      let off = 0;
      let worst = 0;
      for (const [c, n] of counts) {
        const d = Math.sqrt(distance(c, snap.nearest(c)) / 15);
        total += n;
        off += d * n;
        if (n > 4000) worst = Math.max(worst, d);
      }
      expect(off / total, tone).toBeLessThan(3.2);
      expect(worst, tone).toBeLessThan(17);
    }
  }, 60000);

  it('계절마다 한 벌에 맞춰도 빛깔 단계가 뭉개지지 않는다(풀·잎·짚·물·돌·논·눈·길·나무·마당·밭, 살빛)', () => {
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const snap = new Snapper(MASTER[tone]);
      const kept = (ramp: readonly number[]): number => new Set(ramp.map((c) => snap.nearest(c))).size;
      expect(kept(pal.grass), `${tone} grass`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.leaf), `${tone} leaf`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.thatch), `${tone} thatch`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.water), `${tone} water`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.stone), `${tone} stone`).toBeGreaterThanOrEqual(4);
      // 흙길·나무·마당 흙·갈아엎은 흙(1-라의 "짚·잎·돌·흙·길·나무 단계가 넷 넘게 남는다"를 계절마다로 — 그림 올리기 ① review 권고 11)
      expect(kept(pal.path), `${tone} path`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.wood), `${tone} wood`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.yard), `${tone} yard`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.soil), `${tone} soil`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.crop), `${tone} crop`).toBeGreaterThanOrEqual(season === 'spring' ? 3 : 4);
      if (season === 'winter') expect(kept(pal.snow), 'snow').toBe(5);
      if (pal.rain) {
        // 불어난 냇물과 잠긴 논의 물빛이 한 벌 안에서 갈린다
        expect(kept(pal.water), 'rain water').toBeGreaterThanOrEqual(6);
        expect(kept(pal.paddy), 'rain paddy').toBeGreaterThanOrEqual(4);
      }
      // 사람의 살빛 세 단계가 뭉개지지 않는다(얼굴의 볕·그늘)
      for (const skin of [SKIN.fair, SKIN.tan, SKIN.pale]) expect(kept(skin), `${tone} skin`).toBeGreaterThanOrEqual(4);
    }
  });

  it('가까운 빛깔부터 합쳐 줄인다(quant의 reduce — 그림 견본의 빛깔을 살필 때 쓴다. 한 벌은 이것으로 새로 줄이지 않는다)', () => {
    const counts = new Map<number, number>([
      [hex('#ff0000'), 100],
      [hex('#fe0000'), 1],
      [hex('#00ff00'), 50],
      [hex('#0000ff'), 50],
    ]);
    const three = reduce(counts, 3);
    expect(three.length).toBe(3);
    // 붉은빛 둘이 하나가 된다
    expect(three.filter((c) => red(c) > 200).length).toBe(1);
    expect(distance(hex('#101010'), hex('#101010'))).toBe(0);
  });

  it('화면에 나오는 그림은 모두 한 벌 안의 빛깔이다(계절마다 — 세운 것, 인물, 짐승, 날리는 것, 땅과 그 그림자, 물결)', () => {
    for (const [tone, season, weather] of SKIES) {
      const map = neutigol(season, weather);
      const pal = paletteOf(season, weather);
      const snap = new Snapper(MASTER[tone]);
      const defs = thingDefs(pal);
      const shades: Shade[] = shadesFor((key) => defs.get(key)?.shades, map.objects);
      const counts = new Map<number, number>();
      for (const def of defs.values()) for (const f of def.frames) countColors(snap.apply(f), counts);
      for (const p of Object.values({ ...HEROES, ...VILLAGERS, ...GUISES })) countColors(snap.apply(personSheet(p)), counts);
      for (const make of [critters.hen, critters.rooster, critters.chick, critters.dog, critters.ox, critters.magpie, critters.egret, critters.sparrow]) {
        for (const f of make().frames) countColors(snap.apply(f), counts);
      }
      for (const f of [...critters.driftSprites(pal), ...critters.weatherSprites(pal)]) countColors(snap.apply(f), counts);
      for (const f of waterFrames(pal, 4)) countColors(snap.apply(f), counts);
      // 땅은 칠할 때 이미 한 벌에 맞춘다(따로 맞추지 않는다)
      for (const px of sampleGround(map, pal, shades)) countColors(px, counts);
      const master = new Set(MASTER[tone]);
      expect(counts.size, tone).toBeLessThanOrEqual(MASTER[tone].length);
      for (const c of counts.keys()) expect(master.has(c), tone).toBe(true);
      // 한 벌의 빛깔이 남아돌지 않는다(그 계절의 그림에 쓰이지 않는 빛깔이 열둘을 넘지 않는다)
      expect(counts.size, tone).toBeGreaterThanOrEqual(MASTER[tone].length - 12);
    }
  }, 120000);
});

/** 맵의 몇 자리(마을, 들판, 냇가, 뒷산, 숲, 고갯길)의 땅을 칠한다(맵 전체를 칠하면 시험이 무겁다). 땅은 이미 한 벌에 맞춘 것이다. */
function sampleGround(map: MapData, pal: ReturnType<typeof paletteOf>, shades: readonly Shade[]): Px[] {
  const job = groundJob(map, pal, shades);
  const S = 10 * GROUND_TILE;
  return [
    [44, 22],
    [36, 50],
    [44, 60],
    [30, 4],
    [6, 8],
    [82, 22],
    [60, 44],
  ].map(([tx, ty]) => job.paint(Math.min(tx, map.w - 10) * GROUND_TILE, Math.min(ty, map.h - 10) * GROUND_TILE, S, S));
}

// ── 계절의 그림(바퀴 1-라) ───────────────────────────────────────

describe('계절의 그림', () => {
  const countOf = (px: Px, ramp: readonly number[]): number => {
    const set = new Set(ramp);
    let n = 0;
    for (const c of px.d) if (c !== 0 && set.has(c)) n++;
    return n;
  };

  it('새 도트 넷이 있다: 향교의 선생, 향교에 다니는 동무, 관아에서 온 사람, 고개 너머 사람', () => {
    for (const name of ['teacher', 'student', 'official', 'passMan']) expect(VILLAGERS[name], name).toBeDefined();
    expect(VILLAGERS.teacher).toMatchObject({ sex: 'm', build: 'adult', bottom: 'robe' });
    expect(VILLAGERS.student).toMatchObject({ sex: 'm', build: 'teen' });
    expect(VILLAGERS.official).toMatchObject({ sex: 'm', build: 'adult' });
    expect(VILLAGERS.passMan).toMatchObject({ sex: 'm', build: 'adult' });
    expect(VILLAGERS.passMan.pack).toBeDefined(); // 짐을 졌다
    // 넷이 서로, 그리고 다른 어른 남자들과 앞모습·옆모습에서 갈린다
    const names = ['teacher', 'student', 'official', 'passMan', 'father', 'neighborMan', 'plowman', 'monk', 'elderMan', 'brother'];
    for (const dir of ['down', 'left'] as const) {
      const f = names.map((n) => personFrame(VILLAGERS[n], dir, 'idle', 0));
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) expect(same(f[i], f[j]), `${names[i]} = ${names[j]} ${dir}`).toBe(false);
    }
    // 갓(검은 머리쓰개)은 그리지 않는다: 머리 장식은 상투·머리띠·머릿수건·땋은 머리뿐이다
    for (const name of ['teacher', 'student', 'official', 'passMan']) expect(['topknot', 'band', 'scarf', 'braid'], name).toContain(VILLAGERS[name].hair);
  });

  it('맵에 나오는 사람의 그림이 계절마다 모두 있다(같은 사람의 다른 차림도)', () => {
    const everyone = { ...HEROES, ...VILLAGERS, ...GUISES };
    const withFrames = ['hen', 'rooster', 'chick', 'dog', 'ox', 'plowTeam', 'magpie', 'egret', 'sparrow'];
    for (const [, season, weather] of SKIES) {
      for (const stage of ['early', 'late'] as const) {
        for (const d of neutigol(season, weather, stage).dwellers) {
          if (d.animal) expect(withFrames, d.sprite).toContain(d.sprite);
          else expect(everyone[d.sprite], `${season} ${d.sprite}`).toBeDefined();
        }
      }
    }
    // 다른 차림은 얼굴과 옷이 그 사람 그대로다(연장과 짐만 다르다)
    expect(GUISES.motherHoe).toMatchObject({ top: VILLAGERS.mother.top, lower: VILLAGERS.mother.lower, hair: VILLAGERS.mother.hair, tool: 'hoe' });
    expect(GUISES.fatherPack.pack).toBeDefined();
    expect(same(personFrame(GUISES.fatherPack, 'up', 'idle', 0), personFrame(VILLAGERS.father, 'up', 'idle', 0))).toBe(false);
    // 일하는 몸짓이 움직인다: 김매기(호미), 벼 베기(낫), 타작(볏단)
    for (const name of ['motherHoe', 'brotherSickle', 'fatherSheaf', 'monkBroom', 'wellWomanHoe']) {
      const w = [0, 1, 2].map((f) => personFrame(GUISES[name], 'left', 'work', f));
      expect(same(w[0], w[1]) || same(w[1], w[2]) || same(w[0], w[2]), name).toBe(false);
    }
    expect(critters.sparrow().frames.length).toBe(4);
  });

  it('계절의 것: 그네는 움직이고(다섯 장), 씨름하는 두 사람도 움직인다', () => {
    const defs = thingDefs(paletteOf('summer'));
    const swing = defs.get(thingKey('swing', 1))!;
    expect(swing.frames.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < swing.frames.length; i++) for (let j = i + 1; j < swing.frames.length; j++) expect(same(swing.frames[i], swing.frames[j]), `${i}=${j}`).toBe(false);
    expect(defs.get(thingKey('swing', 0))!.frames.length).toBe(1); // 빈 그네
    const wrestle = defs.get(thingKey('wrestlers', 0))!;
    expect(wrestle.frames.length).toBeGreaterThanOrEqual(3);
    expect(same(wrestle.frames[0], wrestle.frames[1])).toBe(false);
    for (const kind of ['swing', 'wrestlers']) expect(THINGS[kind].moves, kind).toBe(true);
    for (const kind of ['sandring', 'grainmat']) expect(THINGS[kind].flat, kind).toBe(true);
    // 볏단은 생김새가 셋이다
    const sheaves = [0, 1, 2].map((v) => thingDefs(paletteOf('autumn')).get(thingKey('sheaf', v))!.frames[0]);
    expect(same(sheaves[0], sheaves[1]) || same(sheaves[1], sheaves[2])).toBe(false);
  });

  it('겨울의 나무는 잎이 지고 가지에 눈이 얹힌다. 소나무는 푸르고 눈을 이고 있다', () => {
    const summer = paletteOf('summer');
    const winter = paletteOf('winter');
    const s = thingDefs(summer);
    const w = thingDefs(winter);
    for (const kind of ['oak', 'young', 'blossom', 'willow', 'zelkova', 'bigtree']) {
      const full = s.get(thingKey(kind, 0))!.frames[0];
      const bare = w.get(thingKey(kind, 0))!.frames[0];
      // 앙상하다: 찍힌 점이 여름의 반에도 못 미친다
      expect(bare.count(), kind).toBeLessThan(full.count() * 0.55);
      expect(bare.count(), kind).toBeGreaterThan(full.count() * 0.08);
      // 눈이 얹혔다
      expect(countOf(bare, winter.snow), kind).toBeGreaterThan(12);
      // 그림의 크기와 발치는 같다(맵의 같은 자리에 선다)
      expect([bare.w, bare.h], kind).toEqual([full.w, full.h]);
      expect(w.get(thingKey(kind, 0))!.ay, kind).toBe(s.get(thingKey(kind, 0))!.ay);
    }
    for (const kind of ['pine', 'pineS', 'oldpine']) {
      const tree = w.get(thingKey(kind, 0))!.frames[0];
      expect(countOf(tree, winter.snow), kind).toBeGreaterThan(40);
      expect(countOf(tree, winter.pine.slice(0, 4)), kind).toBeGreaterThan(60); // 솔잎은 푸르다
      expect(countOf(s.get(thingKey(kind, 0))!.frames[0], summer.snow), kind).toBe(0);
    }
    // 덤불도 잎이 지고 눈을 이고 있다
    expect(countOf(w.get(thingKey('bush', 0))!.frames[0], winter.snow)).toBeGreaterThan(20);
  });

  it('봄의 느티나무 그림은 그대로다(아이콘이 이 그림에서 떴다): 잎 뭉치가 가득하고 눈이 없다', () => {
    const spring = paletteOf('spring');
    const tree = thingDefs(spring).get(thingKey('zelkova', 0))!.frames[0];
    expect([tree.w, tree.h]).toEqual([196, 186]);
    expect(tree.count()).toBeGreaterThan(14000);
    expect(countOf(tree, [...spring.leaf, ...spring.leafDeep])).toBeGreaterThan(9000);
    // 점마다의 값으로 지문을 뜬다(봄의 느티나무가 한 점이라도 달라지면 값이 달라진다)
    let h = 2166136261;
    for (const c of tree.d) {
      h ^= c & 0xffffff;
      h = Math.imul(h, 16777619) >>> 0;
    }
    expect(h.toString(16)).toBe(ZELKOVA_SPRING);
  });

  it('꽃나무와 진달래·개나리는 봄에만 꽃이 핀다', () => {
    const spring = paletteOf('spring');
    const pink = (season: Season): number => {
      const defs = thingDefs(paletteOf(season));
      return countOf(defs.get(thingKey('blossom', 0))!.frames[0], spring.blossom) + countOf(defs.get(thingKey('azalea', 0))!.frames[0], spring.azalea);
    };
    const yellow = (season: Season): number => countOf(thingDefs(paletteOf(season)).get(thingKey('forsythia', 0))!.frames[0], spring.yellow);
    expect(pink('spring')).toBeGreaterThan(400);
    expect(yellow('spring')).toBeGreaterThan(40);
    for (const season of ['summer', 'autumn', 'winter'] as const) {
      expect(pink(season), season).toBe(0);
      expect(yellow(season), season).toBe(0);
      expect(paletteOf(season).flowers, season).toBe(false);
    }
  });

  it('겨울에는 지붕과 담, 마당의 것에 눈이 덮인다', () => {
    const winter = paletteOf('winter');
    const w = thingDefs(winter);
    const s = thingDefs(paletteOf('summer'));
    for (const kind of ['choga', 'hut', 'shed', 'manor', 'wing', 'temple', 'gate']) {
      const roof = w.get(thingKey(kind, 0))!.frames[0];
      expect(countOf(roof, winter.snow) / roof.count(), kind).toBeGreaterThan(0.12);
      expect(countOf(s.get(thingKey(kind, 0))!.frames[0], winter.snow), kind).toBe(0);
    }
    for (const kind of ['wallH', 'wallV', 'well', 'jars', 'woodpile', 'strawstack', 'fenceH', 'stonewallH', 'pagoda', 'lantern', 'rockM', 'rockL', 'stump', 'cairn']) {
      expect(countOf(w.get(thingKey(kind, 0))!.frames[0], winter.snow), kind).toBeGreaterThan(5);
    }
    // 눈을 얹어도 그림의 크기는 같다
    for (const [key, def] of w) expect([def.frames[0].w, def.frames[0].h], key).toEqual([s.get(key)!.frames[0].w, s.get(key)!.frames[0].h]);
  });

  it('논은 계절마다 다르게 칠해진다: 물 댄 논 → 푸른 벼 → 누런 벼와 벤 논 → 눈 덮인 빈 논', () => {
    const plot = { w: 12, h: 9, terrain: new Uint8Array(12 * 9) };
    plot.terrain.fill(T.grass);
    for (let y = 1; y < 8; y++) for (let x = 1; x < 6; x++) plot.terrain[y * 12 + x] = T.paddy;
    for (let y = 1; y < 8; y++) for (let x = 7; x < 11; x++) plot.terrain[y * 12 + x] = T.soil;
    const paint = (season: Season, weather: Weather = 'clear') => paintGround(plot, paletteOf(season, weather));
    const T2 = GROUND_TILE;
    const region = (g: ReturnType<typeof paint>, x0: number, x1: number): Px => {
      const out = new Px((x1 - x0) * T2, 5 * T2);
      for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.set(x, y, g.px.get(x0 * T2 + x, 2 * T2 + y));
      return out;
    };
    const cells = (n: number): number => n * 5 * T2 * T2;
    // 땅은 칠할 때 한 벌에 맞추므로, 단계의 빛도 한 벌에 맞춘 빛으로 센다
    const on = (ramp: readonly number[], season: Season, weather: Weather = 'clear'): number[] => ramp.map((c) => snapperOf(paletteOf(season, weather)).nearest(c));
    const summer = paint('summer');
    const autumn = paint('autumn');
    const winter = paint('winter');
    const rain = paint('summer', 'rain');
    // 벼가 선 논: 여름은 푸른 벼, 가을은 누런 벼(벼의 빛이 논을 가득 채운다)
    expect(countOf(region(summer, 2, 5), on(paletteOf('summer').crop, 'summer')) / cells(3)).toBeGreaterThan(0.8);
    expect(countOf(region(autumn, 2, 5), on(paletteOf('autumn').crop, 'autumn')) / cells(3)).toBeGreaterThan(0.8);
    expect(summer.crop[4 * 12 + 3]).toBe(1);
    expect(autumn.crop[4 * 12 + 3]).toBe(1);
    expect(summer.glint[4 * 12 + 3]).toBe(0);
    // 벤 논(가을): 벼의 빛이 거의 없고 마른 흙과 그루터기다
    expect(countOf(region(autumn, 8, 10), on(paletteOf('autumn').crop, 'autumn')) / cells(2)).toBeLessThan(0.05);
    expect(countOf(region(autumn, 8, 10), on(paletteOf('autumn').thatch, 'autumn'))).toBeGreaterThan(40); // 그루터기
    expect(autumn.crop[4 * 12 + 8]).toBe(0);
    // 겨울: 눈이 논의 반을 넘게 덮는다
    const snowy = on([...paletteOf('winter').grass.slice(3), ...paletteOf('winter').snow], 'winter');
    expect(countOf(region(winter, 2, 5), snowy) / cells(3)).toBeGreaterThan(0.5);
    expect(winter.crop[4 * 12 + 3]).toBe(0);
    // 큰비가 온 해: 잠긴 논은 물빛이고(반짝임을 놓는 칸), 벼가 선 논은 그대로 푸르다
    expect(rain.glint[4 * 12 + 8]).toBe(1);
    expect(rain.crop[4 * 12 + 8]).toBe(0);
    expect(countOf(region(rain, 8, 10), on(paletteOf('summer', 'rain').paddy, 'summer', 'rain')) / cells(2)).toBeGreaterThan(0.6);
    expect(rain.crop[4 * 12 + 3]).toBe(1);
    // 네 계절의 논이 서로 다르다
    const looks = [paint('spring'), summer, autumn, winter].map((g) => region(g, 2, 5));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(same(looks[i], looks[j]), `${i}=${j}`).toBe(false);
  });

  it('여름의 벼는 줄지어 서 있지 않다(볍씨를 바로 흩어 뿌린 논이다 — 줄 맞춘 모가 아니다)', () => {
    const plot = { w: 10, h: 8, terrain: new Uint8Array(10 * 8) };
    plot.terrain.fill(T.paddy);
    const pal = paletteOf('summer');
    const g = paintGround(plot, pal);
    const tip = snapperOf(pal).nearest(pal.crop[3]);
    // 가장 밝은 벼의 빛(포기의 끝)이 가로줄·세로줄마다 고르게 흩어져 있다: 줄 맞춘 모라면 빈 줄과 꽉 찬 줄이 번갈아 나온다
    const W = 6 * GROUND_TILE;
    const H = 4 * GROUND_TILE;
    const cols = new Array<number>(W).fill(0);
    const rows = new Array<number>(H).fill(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g.px.get(2 * GROUND_TILE + x, 2 * GROUND_TILE + y) !== tip) continue;
        cols[x]++;
        rows[y]++;
      }
    }
    const spread = (list: number[]): number => {
      const mean = list.reduce((a, b) => a + b, 0) / list.length;
      return Math.sqrt(list.reduce((a, b) => a + (b - mean) * (b - mean), 0) / list.length) / mean;
    };
    expect(Math.min(...cols)).toBeGreaterThan(0);
    expect(Math.min(...rows)).toBeGreaterThan(0);
    // 줄 맞춘 모(맵 점 넷 — 그림 점 여덟 — 마다 한 줄)라면 이 값이 2.6쯤이다. 흩어 뿌린 논은 그 반에 못 미친다.
    const lined = spread(Array.from({ length: W }, (_, x) => (x % (4 * ART) === 0 ? 12 : 0)));
    expect(lined).toBeGreaterThan(1.5);
    expect(spread(cols)).toBeLessThan(lined * 0.45);
    expect(spread(rows)).toBeLessThan(lined * 0.45);
  });

  it('계절의 날림: 봄 꽃잎 · 여름 잠자리 · 가을 가랑잎 · 겨울 눈, 큰비가 온 여름에는 비', () => {
    expect(paletteOf('spring').drift).toBe('petal');
    expect(paletteOf('summer').drift).toBe('none');
    expect(paletteOf('autumn').drift).toBe('leaf');
    expect(paletteOf('winter').drift).toBe('snow');
    for (const tone of ['blue', 'amber'] as const) {
      const fly = critters.dragonfly(tone);
      expect(fly.frames.length).toBe(2);
      expect(same(fly.frames[0], fly.frames[1])).toBe(false);
    }
    expect(paletteOf('summer', 'rain').rain).toBe(true);
    for (const season of SEASONS) expect(paletteOf(season).rain, season).toBe(false);
    expect(paletteOf('autumn', 'rain')).toBe(paletteOf('autumn')); // 날씨는 여름에만 갈린다
    const rain = critters.rainSprites(paletteOf('summer', 'rain'));
    expect(rain.streaks.length).toBe(3);
    expect(rain.splash.length).toBe(3);
    for (const f of [...rain.streaks, ...rain.splash]) expect(f.count()).toBeGreaterThan(2);
    // 불어난 냇물은 맑은 여름의 냇물과 빛이 다르다
    expect(same(waterFrames(paletteOf('summer'), 2)[0], waterFrames(paletteOf('summer', 'rain'), 2)[0])).toBe(false);
    expect(critters.cropGustFrames(paletteOf('summer')).length).toBe(3);
  });
});

// ── 나무와 지붕에 가려지는 사람(1-라 review 8번) ─────────────────────
// 주인공이 아닌 사람은 나무 뒤에서 비쳐 보이지 않는다. 그 사람의 머리와 가슴(그림의 윗부분)이 그보다 나중에 그려지는
// 세운 것(나무, 지붕, 담 …)의 찍힌 점에 얼마나 덮이는지를 그림의 점으로 센다(그리기의 차례와 자리는 draw.ts와 같다).
// 사람은 그림 점(48×64), 세운 것은 1배 그림이다(그림 올리기 ②까지) — 자리는 맵 점으로 맞춰 본다.

const SHEET_LOOKS: { name: string; season: Season; weather: Weather; stage: Stage; flood?: boolean }[] = [
  { name: '봄', season: 'spring', weather: 'clear', stage: 'late' },
  { name: '여름', season: 'summer', weather: 'clear', stage: 'late' },
  { name: '큰비 여름(단오 전)', season: 'summer', weather: 'rain', stage: 'early' },
  { name: '큰비 여름(단오 뒤)', season: 'summer', weather: 'rain', stage: 'late' },
  { name: '가을(떠나기 전)', season: 'autumn', weather: 'clear', stage: 'early' },
  { name: '가을(떠난 뒤)', season: 'autumn', weather: 'clear', stage: 'gone' },
  { name: '가을(돌아온 뒤)', season: 'autumn', weather: 'clear', stage: 'late' },
  { name: '가을(가을걷이 뒤)', season: 'autumn', weather: 'clear', stage: 'done' },
  { name: '큰비 해 가을', season: 'autumn', weather: 'clear', stage: 'done', flood: true },
  { name: '겨울', season: 'winter', weather: 'clear', stage: 'late' },
];

/** 맵의 사람마다 머리와 가슴이 덮인 몫(0~1)과 덮은 것 */
function hiddenPeople(map: MapData): { id: string; share: number; by: string }[] {
  const defs = thingDefs(paletteOf(map.season, map.weather));
  const out: { id: string; share: number; by: string }[] = [];
  const things = map.objects
    .filter((o) => !THINGS[o.kind].flat)
    .map((o) => {
      const def = defs.get(thingKey(o.kind, o.gate ? 0 : o.variant))!;
      const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
      return { o, f: def.frames[0], x0: at.x - def.ax, y0: at.y - def.ay, sortY: at.y + (def.sort ?? 0) };
    });
  for (const d of map.dwellers) {
    if (d.animal) continue;
    const person = personOf(d.sprite);
    if (!person) continue;
    const sit = d.act === 'sit';
    const frame = personFrame(person, d.facing, d.act === 'work' ? 'work' : sit ? 'sit' : 'idle', 0);
    const fx = d.at[0] * TILE + 8;
    const fy = d.at[1] * TILE + 10;
    const key = fy + (sit ? 8 : 0);
    const ox = fx - PERSON_AX / ART;
    const oy = fy - (sit ? 5 : 0) - PERSON_AY / ART;
    let all = 0;
    let hid = 0;
    const by = new Map<string, number>();
    for (let y = 0; y <= PERSON_AY - 23; y++) {
      for (let x = 0; x < frame.w; x++) {
        if (frame.get(x, y) === 0) continue;
        all++;
        const wx = ox + (x + 0.5) / ART;
        const wy = oy + (y + 0.5) / ART;
        for (const t of things) {
          if (t.sortY <= key) continue;
          if (wx < t.x0 || wy < t.y0 || wx >= t.x0 + t.f.w || wy >= t.y0 + t.f.h) continue;
          if (t.f.get(Math.floor(wx - t.x0), Math.floor(wy - t.y0)) === 0) continue;
          hid++;
          const name = `${t.o.kind}@${t.o.tx},${t.o.ty}`;
          by.set(name, (by.get(name) ?? 0) + 1);
          break;
        }
      }
    }
    const worst = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ id: `${d.id}@${d.at[0]},${d.at[1]}`, share: all ? hid / all : 0, by: worst ? worst[0] : '' });
  }
  return out;
}

describe('나무와 지붕에 가려지는 사람이 없다(1-라 review 8번)', () => {
  it('모든 계절의 맵에서 사람의 머리와 가슴이 앞에 그려지는 나무·지붕에 가려지지 않는다', () => {
    const bad: string[] = [];
    for (const look of SHEET_LOOKS) {
      const map = neutigol(look.season, look.weather, look.stage, look.flood);
      for (const h of hiddenPeople(map)) {
        // 훑은 값을 보려면: VITE_OCCLUDE_LOG=0.01 npx vitest run tests/pixel.test.ts -t "가려지지 않는다" --silent=false (1%가 넘는 사람을 찍는다)
        if (import.meta.env.VITE_OCCLUDE_LOG && h.share > Number(import.meta.env.VITE_OCCLUDE_LOG)) console.log(`OCC ${look.name} ${h.id} ${(h.share * 100).toFixed(0)}% ${h.by}`);
        if (h.share > 0.1) bad.push(`${look.name} ${h.id} ${(h.share * 100).toFixed(0)}% ← ${h.by}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('가림을 셈하는 틀이 가림을 잡는다: 나무 바로 뒤(북쪽)에 세운 사람은 가려지고, 나무 앞(남쪽)에 세운 사람은 가려지지 않는다', () => {
    const map = neutigol('summer');
    const oak = map.objects.find((o) => o.kind === 'oak' && o.tx === 49 && o.ty === 31)!;
    expect(oak).toBeDefined();
    const stand = (at: [number, number]): number => {
      const probe: MapData = { ...map, dwellers: [{ id: 'probe', sprite: 'official', label: '', about: '', at, facing: 'down', act: 'stand' }] };
      return hiddenPeople(probe)[0].share;
    };
    expect(stand([49, 29])).toBeGreaterThan(0.5);
    expect(stand([49, 32])).toBe(0);
  });
});


// ── 그림 올리기 ①의 규칙(spec 4.7.5) ─────────────────────────────
// 수치는 docs/mockup-art/lib.mjs와 같은 셈(tests/artRules.ts)으로, 시안의 자리(대문 앞 — region.json)를 게임의 그림 코드로 그려 잰다.
// 괄호 안은 기획서의 기준(지금 → 3.1차 시안)이다.

describe('그림 올리기 ①: 촘촘함과 배율(ㄱ)', () => {
  it('그림 점은 맵 점의 반이다: 땅 한 칸 32, 사람 48×64(발끝 24·60), 물결 128. 맵의 칸은 16 그대로다', () => {
    expect(ART).toBe(2);
    expect(TILE).toBe(16);
    expect(GROUND_TILE).toBe(32);
    expect([PERSON_W, PERSON_H, PERSON_AX, PERSON_AY]).toEqual([48, 64, 24, 60]);
    expect(waterFrames(paletteOf('spring'), 1)[0].w).toBe(128);
    // 세운 것의 발치와 그림자는 맵 점 그대로다
    expect(anchorOf('choga', 10, 20)).toEqual({ x: 10 * 16 + 48, y: 21 * 16 - 2 });
  });

  it('배율이 그림 점의 정수배가 아니면 가장 가까운 짝수로: 사람의 CSS 키가 96에 가까운 쪽, 같으면 큰 쪽(13.1의 53번)', () => {
    expect(artScale(6, 2)).toBe(6);
    expect(artScale(4, 1.5)).toBe(4);
    expect(artScale(4, 1)).toBe(4);
    expect(artScale(8, 2)).toBe(8);
    expect(artScale(3, 1)).toBe(4); // 크롬북·작은 PC 3 → 4
    expect(artScale(5, 1.75)).toBe(6);
    expect(artScale(7, 2.25)).toBe(6);
    expect(artScale(2, 1)).toBe(2);
    // 기기마다 사람의 CSS 키(맵 점 32 × 배율 ÷ 화소 비율). 무대는 위 띠(CSS 120)를 뺀 높이다.
    const cssTall = (cssW: number, cssH: number, dpr: number): number => {
      const s = artScale(scaleFor(cssW * dpr, (cssH - 120) * dpr, dpr), dpr, ART);
      expect(s % ART, `${cssW}×${cssH}@${dpr}`).toBe(0);
      return Math.round((32 * s) / dpr);
    };
    expect(cssTall(1180, 820, 2)).toBe(96); // 아이패드 에어
    expect(cssTall(1080, 810, 2)).toBe(96); // 아이패드 9·10세대
    expect(cssTall(1280, 800, 1.5)).toBe(85); // 갤럭시탭(1.5)
    expect(cssTall(1280, 800, 2)).toBe(96); // 갤럭시탭(2)
    expect(cssTall(1920, 1080, 1)).toBe(128); // 교사 TV·PC
    expect(cssTall(1366, 768, 1)).toBe(128); // 크롬북·작은 PC: 3 → 4(96 → 128)
  });
});

describe('그림 올리기 ①: 사람(ㄴ·ㅁ·ㅊ)', () => {
  const everyone = { ...HEROES, ...VILLAGERS, ...GUISES };
  it('서른일곱 모습 모두 네 방향 × 걷기 넉 장·숨쉬기 두 장·일 넉 장·앉기 두 장이 시트에 있다', () => {
    expect(Object.keys(everyone).length).toBe(37);
    for (const [name, p] of Object.entries(everyone)) {
      const sheet = personSheet(p);
      expect([sheet.w, sheet.h], name).toEqual([PERSON_W * SHEET_COLS, PERSON_H * 4]);
      // 빈 칸이 없다
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < SHEET_COLS; col++) {
          let on = 0;
          for (let y = 0; y < PERSON_H; y++) for (let x = 0; x < PERSON_W; x++) if (sheet.get(col * PERSON_W + x, row * PERSON_H + y) !== 0) on++;
          expect(on, `${name} ${row},${col}`).toBeGreaterThan(400);
        }
      }
    }
  });

  it('테두리는 (나) 제 빛깔을 짙게 한 부드러운 테두리다: 먹빛 검은 선이 아니고, 따뜻하다(빨강이 파랑보다 크거나 같다)', () => {
    const INK = hex('#2a2422');
    for (const [name, p] of Object.entries(everyone)) {
      for (const dir of DIRS) {
        const f = personFrame(p, dir, 'idle', 0);
        let edge = 0;
        let warm = 0;
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const c = f.get(x, y);
            if (c === 0) continue;
            if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
            edge++;
            expect(c, `${name} ${dir}`).not.toBe(INK);
            if (red(c) >= blue(c)) warm++;
          }
        }
        expect(warm / edge, `${name} ${dir}`).toBeGreaterThan(0.97);
      }
    }
  });

  it('테두리는 거의 먹빛도 아니다: 테두리 점 가운데 밝기 0.2 이하의 몫에 위 한도(모두 0.4, 한 모습 0.9, 흰옷의 주인공 0.45·어른 0.1·아주머니 0.25)', () => {
    // 머리·짙은 옷의 테두리는 본디 어둡다(검은 갓의 관원·남빛 치마의 아씨가 0.8 남짓). 테두리에 먹빛을 반만 섞어도 모두 0.45를 넘는다
    let edges = 0;
    let darks = 0;
    const share: Record<string, number> = {};
    for (const [name, p] of Object.entries(everyone)) {
      let edge = 0;
      let dark = 0;
      for (const dir of DIRS) {
        const f = personFrame(p, dir, 'idle', 0);
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const c = f.get(x, y);
            if (c === 0) continue;
            if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
            edge++;
            if (luma(c) <= 0.2) dark++;
          }
        }
      }
      share[name] = dark / edge;
      edges += edge;
      darks += dark;
      expect(share[name], name).toBeLessThanOrEqual(0.9);
    }
    expect(darks / edges).toBeLessThanOrEqual(0.4);
    expect(share['farmer-boy']).toBeLessThanOrEqual(0.45);
    expect(share.elderMan).toBeLessThanOrEqual(0.1);
    expect(share.wellWoman).toBeLessThanOrEqual(0.25);
  });

  it('얼굴과 발(3.1차 시안): 앞모습의 입은 계절의 벌에 맞춰도 붉고, 바지 입은 사람의 두 짝 신은 갈라져 있다(37모습 모두)', () => {
    for (const [name, p] of Object.entries(everyone)) {
      const f = personFrame(p, 'down', 'idle', 0);
      for (const tone of TONES) {
        const snap = new Snapper(MASTER[tone]);
        const g = snap.apply(f.clone());
        // 입: 얼굴 가운데에 붉은 점이 둘 넘는 줄이 있고 그 밑은 턱(살빛)이다(빨강이 초록보다 0.3 넘게 크다 — 볼의 분홍과 살빛은 그만큼 붉지 않다)
        const skin = new Set<number>(p.skin.map((c) => snap.nearest(c)));
        let lip = 0;
        for (let y = 4; y < PERSON_AY - 8; y++) {
          let n = 0;
          for (let x = PERSON_AX - 2; x <= PERSON_AX + 1; x++) {
            const c = g.get(x, y);
            if (c !== 0 && red(c) - green(c) > 0.3 * 255 && red(c) < 200) n++;
          }
          if (n >= 2 && skin.has(g.get(PERSON_AX - 1, y + 1))) lip = Math.max(lip, n);
        }
        if (!p.beard) expect(lip, `${name} ${tone} 입`).toBeGreaterThanOrEqual(2);
      }
      if (p.bottom !== 'pants') continue;
      // 신의 줄(발바닥 바로 위)에서 가운데 두 점은 신이 아니고(테두리가 메운 틈), 그 양옆은 신이다
      const y = PERSON_AY - 2;
      const shoe = new Set<number>(p.shoes);
      expect(shoe.has(f.get(PERSON_AX - 1, y)) || shoe.has(f.get(PERSON_AX, y)), `${name} 신 사이`).toBe(false);
      expect(f.get(PERSON_AX - 1, y), `${name} 신 사이`).not.toBe(0);
      expect(shoe.has(f.get(PERSON_AX - 3, y)), `${name} 왼짝`).toBe(true);
      expect(shoe.has(f.get(PERSON_AX + 2, y)), `${name} 오른짝`).toBe(true);
    }
  });

  it('얼굴: 앞모습에 2×3의 눈 둘(젊은이와 아이는 왼쪽 위에 반짝임)과 입이 있다', () => {
    const f = personFrame(HEROES['farmer-boy'], 'down', 'idle', 0);
    const INK = hex('#2a2422');
    let ink = 0;
    let shine = 0;
    for (const c of f.d) {
      if (c === INK) ink++;
      if (c === hex('#faf6ec')) shine++;
    }
    expect(ink).toBeGreaterThanOrEqual(8); // 눈 두 쪽(반짝임 빼고 다섯 점씩 남짓)
    expect(shine).toBe(2);
  });

  it('흰 무명옷은 그대로다(고증) — 바닥과는 테두리와 발밑 그림자로 가른다: 사람의 가장 바깥 점과 바로 밖 바닥의 밝기 차 0.3 이상', () => {
    expect(HEROES['farmer-boy'].top).toBe(CLOTH.cotton);
    const g = gateScene('spring');
    expect(g.people.length).toBe(3);
    for (const p of g.people) expect(edgeContrast(p.sprite, p.x, p.y, g.floor), p.id).toBeGreaterThanOrEqual(0.3);
  });

  it('발밑의 그림자는 따뜻하다(곱해 얹는 빛이 바닥을 붉은 밤빛 쪽으로 어둡게 한다. 겨울에는 붉은 보랏빛)', () => {
    for (const season of SEASONS) {
      const f = footShadow(paletteOf(season));
      const core = f.get(f.w >> 1, f.h >> 1);
      expect(red(core) > blue(core) || season === 'winter', season).toBe(true);
      expect(red(core) + green(core) + blue(core), season).toBeLessThan(255 * 3 * 0.85);
      if (season === 'winter') expect(red(core)).toBeGreaterThanOrEqual(green(core)); // 푸르스름하지 않다
    }
  });
});

describe('그림 올리기 ①: 땅(ㄷ·ㄹ·ㅌ·ㅎ)과 따뜻함(ㅍ) — 대문 앞', () => {
  const g = gateScene('spring');

  it('대비 큰 체크무늬 천 개당 0.5 이하, 대비 큰 외톨이 점 천 개당 1 이하(1.92 → 0.08, 7.65 → 0.10)', () => {
    expect(harshChecker(g.ground.px)).toBeLessThanOrEqual(0.5);
    expect(harshOrphans(g.ground.px)).toBeLessThanOrEqual(1);
  });

  it('수채화 같은 큰 결: 풀 밝기 5.6·색조 3.7·갈래 7 이상·평탄 18.5% 이하, 흙 밝기 5.4·색조 3.3·갈래 8 이상·평탄 36% 이하', () => {
    const m = monotony(g.ground);
    expect(m.grass.lumaStd).toBeGreaterThanOrEqual(5.6);
    expect(m.grass.warmStd).toBeGreaterThanOrEqual(3.7);
    expect(m.grass.tones).toBeGreaterThanOrEqual(7);
    expect(m.grass.flatPct).toBeLessThanOrEqual(18.5);
    expect(m.dirt.lumaStd).toBeGreaterThanOrEqual(5.4);
    expect(m.dirt.warmStd).toBeGreaterThanOrEqual(3.3);
    expect(m.dirt.tones).toBeGreaterThanOrEqual(8);
    expect(m.dirt.flatPct).toBeLessThanOrEqual(36);
  });

  it('얼룩덜룩함의 위 한도: 흙 3.8·풀 4.0 이하(이웃 조각끼리 부드럽게 이어진다)', () => {
    const b = blotch(g.ground);
    expect(b.dirt).toBeLessThanOrEqual(3.8);
    expect(b.grass).toBeLessThanOrEqual(4.0);
  });

  it('따뜻함: 풀빛 색상각 95~105°, 화면의 R−B 49 이상, 어두운 점의 R−B 0 이상·몫 7% 이하', () => {
    const w = warmth(g.scene);
    expect(w.greenHue).toBeGreaterThanOrEqual(95);
    expect(w.greenHue).toBeLessThanOrEqual(105);
    expect(w.warmth).toBeGreaterThanOrEqual(49);
    expect(w.darkWarmth).toBeGreaterThanOrEqual(0);
    expect(w.darkShare).toBeLessThanOrEqual(7);
  });

  it('땅은 네 계절과 큰비 모두 대비 큰 잡티가 없다(들판·냇가·뒷산·마당)', () => {
    const spots: [number, number][] = [
      [600, 780],
      [620, 980],
      [480, 40],
      [470, 420],
    ];
    for (const [, season, weather] of SKIES) {
      for (const [x, y] of spots) {
        const v = seasonGround(season, weather, x, y, 240, 180);
        expect(harshOrphans(v.px), `${season}/${weather} ${x},${y}`).toBeLessThanOrEqual(1);
        expect(harshChecker(v.px), `${season}/${weather} ${x},${y}`).toBeLessThanOrEqual(0.5);
      }
    }
  }, 60000);

  it('계절마다 대문 앞의 그늘이 푸르스름해지지 않는다(어두운 점의 R−B 0 이상)', () => {
    for (const [, season, weather] of SKIES) expect(warmth(gateScene(season, weather).scene).darkWarmth, `${season}/${weather}`).toBeGreaterThanOrEqual(0);
  }, 60000);
});

describe('그림 올리기 ①: 무게(ㅋ)', () => {
  it('캔버스 넓이의 합 80MB 이하, 한 장 1,600만 점 이하(계절마다 그 맵에 놓인 것과 나오는 사람만 지은 한 벌 + 땅 한 장)', () => {
    const made: { width: number; height: number }[] = [];
    vi.stubGlobal(
      'ImageData',
      class {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data;
          this.width = width;
          this.height = height;
        }
      },
    );
    vi.stubGlobal('document', {
      createElement: () => {
        const c = { width: 0, height: 0, getContext: () => ({ putImageData: () => undefined }) };
        made.push(c);
        return c;
      },
    });
    try {
      for (const look of SHEET_LOOKS) {
        made.length = 0;
        const map = neutigol(look.season, look.weather, look.stage, look.flood);
        const atlas = buildAtlas(look.season, look.weather, needsOf(map, ['farmer-boy', 'farmer-girl']));
        groundCanvas(atlas, map, shadesOf(atlas, map.objects));
        const area = made.reduce((n, c) => n + c.width * c.height, 0);
        const biggest = Math.max(...made.map((c) => c.width * c.height));
        expect((area * 4) / 2 ** 20, look.name).toBeLessThanOrEqual(80);
        expect(biggest, look.name).toBeLessThanOrEqual(16_000_000);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 120000);

  /** 캔버스를 흉내 낸다: 만든 캔버스를 모으고, 캔버스에 놓은 점(putImageData)을 자리와 함께 적어 둔다 */
  interface FakeCanvas {
    width: number;
    height: number;
    puts: { x: number; y: number; w: number; h: number; d: Uint32Array }[];
    getContext(): { putImageData(img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number): void };
  }
  const fakeCanvas = (): FakeCanvas[] => {
    const made: FakeCanvas[] = [];
    vi.stubGlobal(
      'ImageData',
      class {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data;
          this.width = width;
          this.height = height;
        }
      },
    );
    vi.stubGlobal('document', {
      createElement: () => {
        const c: FakeCanvas = {
          width: 0,
          height: 0,
          puts: [],
          getContext: () => ({
            putImageData: (img, x, y) => void c.puts.push({ x, y, w: img.width, h: img.height, d: new Uint32Array(img.data.slice().buffer) }),
          }),
        };
        made.push(c);
        return c;
      },
    });
    return made;
  };

  it('한 벌만 든다: 다른 계절(이나 큰비)을 부르면 들고 있던 벌을 놓는다', () => {
    fakeCanvas();
    try {
      const spring = atlasFor('spring');
      expect(atlasFor('spring')).toBe(spring);
      const summer = atlasFor('summer');
      expect(summer).not.toBe(spring);
      const rain = atlasFor('summer', 'rain');
      expect(rain).not.toBe(summer);
      // 봄으로 돌아오면 새로 짓는다(앞의 봄 벌을 들고 있지 않았다)
      const again = atlasFor('spring');
      expect(again).not.toBe(spring);
      expect(again.season).toBe('spring');
      // 봄·가을·겨울은 비가 와도 같은 벌
      expect(atlasFor('spring', 'rain')).toBe(again);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('그림 벌에는 그 맵에 놓인 것과 나오는 사람·짐승만 짓는다(땅을 칠해도 더 짓지 않는다)', () => {
    fakeCanvas();
    try {
      for (const look of SHEET_LOOKS) {
        const map = neutigol(look.season, look.weather, look.stage, look.flood);
        const needs = needsOf(map, ['farmer-boy', 'farmer-girl']);
        const atlas = buildAtlas(look.season, look.weather, needs);
        const g = groundCanvas(atlas, map, shadesOf(atlas, map.objects));
        paintChunk(g, 0, 0);
        expect([...atlas.things.keys()].sort(), look.name).toEqual([...needs.things].sort());
        expect([...atlas.people.keys()].sort(), look.name).toEqual([...needs.people].sort());
        expect([...atlas.critters.keys()].sort(), look.name).toEqual([...needs.critters].sort());
        // 맵에 없는 사람은 짓지 않았다
        expect(atlas.people.has('official') === needs.people.includes('official'), look.name).toBe(true);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 120000);

  it('벌의 사람 시트는 personSheet(한 장 48×64)를 벌에 맞춘 것과 점 하나까지 같다(한 번에 지어도, 방향 한 줄씩 나눠 지어도)', () => {
    const made = fakeCanvas();
    try {
      const map = neutigol('spring');
      const needs = needsOf(map, ['farmer-boy', 'farmer-girl']);
      const whole = buildAtlas('spring', 'clear', { things: [], people: [], critters: [] });
      ensureAll(whole, { things: [], people: needs.people, critters: [] });
      const parts = buildAtlas('spring', 'clear', { things: [], people: [], critters: [] });
      const steps = prepareSteps(parts, { things: [], people: needs.people, critters: [] });
      expect(steps.length).toBe(needs.people.length * 4);
      for (const step of steps) step();
      for (const name of needs.people) {
        const p = personOf(name);
        if (!p) continue;
        const want = whole.snap.apply(personSheet(p));
        expect([want.w, want.h]).toEqual([PERSON_W * SHEET_COLS, PERSON_H * 4]);
        expect([PERSON_W, PERSON_H]).toEqual([48, 64]);
        for (const atlas of [whole, parts]) {
          const c = atlas.people.get(name) as unknown as FakeCanvas;
          expect(made.includes(c), name).toBe(true);
          expect([c.width, c.height], name).toEqual([want.w, want.h]);
          expect(c.puts.length, name).toBe(1);
          expect(c.puts[0].d.every((v, i) => v === want.d[i]), name).toBe(true);
        }
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 60000);

  it('땅 조각을 한 장의 시간 안에 잘게 나눠 칠해도(차례를 바꾸고 도중에 다른 조각을 끼워도) 한 번에 칠한 것과 점 하나까지 같다', () => {
    fakeCanvas();
    try {
      const map = neutigol('spring');
      const atlas = buildAtlas('spring', 'clear', needsOf(map));
      const shades = shadesOf(atlas, map.objects);
      const a = groundCanvas(atlas, map, shades);
      const b = groundCanvas(atlas, map, shades);
      // 대문 둘레의 조각 여섯
      const ids: number[] = [];
      for (let cy = 1; cy <= 2; cy++) for (let cx = 1; cx <= 3; cx++) ids.push(cy * a.cw + cx);
      for (const i of ids) paintChunk(a, i % a.cw, Math.floor(i / a.cw));
      const order = [...ids].reverse();
      let calls = 0;
      while (ids.some((i) => !b.done[i])) {
        // 0밀리초: 한 번에 한 걸음만
        workGround(b, 0, () => order.find((i) => !b.done[i]) ?? -1);
        calls++;
        // 나눠 칠하던 조각이 있는 동안 다른 조각을 먼저 다 칠한다(걸어가 화면에 들어온 조각)
        if (calls === 7) paintChunk(b, ids[0] % b.cw, Math.floor(ids[0] / b.cw));
      }
      expect(calls).toBeGreaterThan(ids.length * 10);
      expect(b.cur).toBe(null);
      const put = (g: typeof a): Map<string, Uint32Array> => new Map((g.canvas as unknown as FakeCanvas).puts.map((q) => [`${q.x},${q.y},${q.w},${q.h}`, q.d]));
      const pa = put(a);
      const pb = put(b);
      expect([...pb.keys()].sort()).toEqual([...pa.keys()].sort());
      for (const [k, d] of pa) expect(d.every((v, i) => v === pb.get(k)?.[i]), k).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  }, 60000);
});
