// 도트 그림의 검사. 캔버스 없이 버퍼만 본다: 빠진 그림이 없는지, 발치가 그림 안에 있는지, 움직임의 장이 서로 다른지.

import { describe, expect, it, vi } from 'vitest';
import { neutigol, type Stage } from '../src/content/maps/neutigol';
import type { MapData } from '../src/map/types';
import { SEASONS, type Season } from '../src/engine/types';
import { THINGS } from '../src/map/things';
import { T, TILE, type Weather } from '../src/map/types';
import { MAKERS, anchorOf, shadesFor, thingDefs, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { paintGround, waterFrames, type Shade } from '../src/pixel/ground';
import { MASTER, MASTER_SIZE, TONES, toneOf, type Tone } from '../src/pixel/master';
import { paletteOf } from '../src/pixel/palette';
import { DIRS, GUISES, HEROES, HOUSEHOLDS, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS, personFrame, personOf, personSheet } from '../src/pixel/people';
import { Px, alpha, blue, green, hash2, hex, red, rgb, vnoise } from '../src/pixel/px';
import { Snapper, countColors, distance, reduce } from '../src/pixel/quant';

const same = (a: Px, b: Px): boolean => a.w === b.w && a.h === b.h && a.d.every((v, i) => v === b.d[i]);

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

  it('한 장은 24×32이고, 한 인물의 모든 장이 한 장에 들어 있다', () => {
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

  it('걸을 때 몸이 오르내린다: 발을 디딜 때 머리가 한 점 내려온다', () => {
    const p = HEROES['farmer-boy'];
    for (const dir of DIRS) {
      const top = (f: number): number => personFrame(p, dir, 'walk', f).bounds()!.y0;
      expect(top(0), dir).toBe(top(1) + 1);
      expect(top(2), dir).toBe(top(3) + 1);
    }
  });

  it('옆모습의 몸통은 일곱 점 너비다(종이 인형처럼 얇지 않다)', () => {
    for (const name of ['farmer-boy', 'daughter', 'father', 'mother']) {
      const f = personFrame(everyone[name], 'left', 'idle', 0);
      // 어깨 아래 둘째 줄에서 찍힌 점의 너비(테두리 빼고)
      const b = f.bounds()!;
      let widest = 0;
      for (let y = b.y0 + 13; y <= b.y0 + 17; y++) {
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
      expect(widest, name).toBeGreaterThanOrEqual(7);
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
        // 머리의 줄(위에서 열 줄)에서 다른 점이 여럿 있다
        const top = Math.min(a.bounds()!.y0, b.bounds()!.y0);
        let diff = 0;
        for (let y = top; y < top + 11; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) diff++;
        expect(diff, `${boy}/${girl} ${dir}`).toBeGreaterThanOrEqual(6);
        // 아랫도리도 다르다(바지와 치마)
        let low = 0;
        for (let y = 22; y < 31; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) low++;
        expect(low, `${boy}/${girl} ${dir}`).toBeGreaterThan(10);
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

  it('언제 칠해도 같은 그림이 나온다', () => {
    const a = paintGround(small, paletteOf('spring'));
    const b = paintGround(small, paletteOf('spring'));
    expect(same(a.px, b.px)).toBe(true);
    expect(a.px.w).toBe(12 * TILE);
    expect(a.px.h).toBe(8 * TILE);
  });

  it('냇물 자리만 비워 두고(그 아래에 물결을 깐다) 나머지는 빈틈없이 칠한다', () => {
    const g = paintGround(small, paletteOf('spring'));
    // 풀밭 한가운데는 꽉 차 있다
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) expect(alpha(g.px.get(x + 16, y + 16))).toBe(255);
    // 깊은 물 한가운데는 비쳐 보인다
    expect(alpha(g.px.get(6 * 16 + 8, 4 * 16 + 8))).toBeLessThan(255);
    expect(g.wet[4 * 12 + 6]).toBe(1);
    expect(g.wet[1 * 12 + 1]).toBe(0);
    expect(g.glint[6 * 12 + 1]).toBe(1);
  });

  it('칸의 경계가 곧은 줄로 남지 않는다(길과 풀이 구불구불 만난다)', () => {
    const g = paintGround(small, paletteOf('spring'));
    // 길 칸의 아래 가장자리 줄(y = 4칸째의 맨 위)을 따라가면 빛깔이 한 가지가 아니다
    const seen = new Set<number>();
    for (let x = 0; x < 3 * 16; x++) seen.add(g.px.get(x, 4 * 16 + 1));
    expect(seen.size).toBeGreaterThan(2);
  });

  it('계절마다 논의 모습이 다르다: 물 댄 논 → 푸른 벼 → 누런 벼 → 빈 논', () => {
    const states = SEASONS.map((s) => paletteOf(s).paddyState);
    expect(states).toEqual(['water', 'green', 'gold', 'bare']);
    const spring = paintGround(small, paletteOf('spring'));
    const summer = paintGround(small, paletteOf('summer'));
    expect(spring.px.get(24, 6 * 16 + 8)).not.toBe(summer.px.get(24, 6 * 16 + 8));
    expect(summer.glint[6 * 12 + 1]).toBe(0);
  });

  it('물결은 이어 붙여도 되는 64점짜리 무늬가 여러 장이다', () => {
    const frames = waterFrames(paletteOf('spring'), 8);
    expect(frames.length).toBe(8);
    expect(frames[0].w).toBe(64);
    expect(same(frames[0], frames[3])).toBe(false);
    for (const f of frames) expect(f.count()).toBe(64 * 64);
  });

  it('그림자는 바탕 빛을 어둡게 해서 진다', () => {
    const plain = paintGround(small, paletteOf('spring'));
    const shaded = paintGround(small, paletteOf('spring'), [{ cx: 24, cy: 24, rx: 6, ry: 4, strength: 0.3 }]);
    const a = plain.px.get(24, 24);
    const b = shaded.px.get(24, 24);
    expect(red(b) + green(b) + blue(b)).toBeLessThan(red(a) + green(a) + blue(a));
    expect(shaded.px.get(60, 100)).toBe(plain.px.get(60, 100));
  });
});

describe('빛깔 한 벌(계절마다 64색)', () => {
  it('계절마다 한 벌은 64색이고 겹치는 빛이 없다(네 계절과 큰비가 온 여름)', () => {
    for (const season of SEASONS) {
      expect(MASTER[season].length, season).toBe(MASTER_SIZE);
      expect(new Set(MASTER[season]).size, season).toBe(MASTER_SIZE);
    }
    expect(MASTER_SIZE).toBe(64);
    expect([...TONES].sort()).toEqual(['autumn', 'rain', 'spring', 'summer', 'winter']);
    for (const tone of TONES) {
      expect(MASTER[tone].length, tone).toBe(MASTER_SIZE);
      expect(new Set(MASTER[tone]).size, tone).toBe(MASTER_SIZE);
    }
    // 날씨는 여름에만 한 벌을 가른다
    expect(toneOf('summer', 'rain')).toBe('rain');
    expect(toneOf('summer')).toBe('summer');
    for (const season of ['spring', 'autumn', 'winter'] as const) expect(toneOf(season, 'rain')).toBe(season);
  });

  it('한 벌이 그 계절의 그림에 맞는다: 계절의 맵에 쓰인 빛깔이 한 벌로 옮겨질 때 크게 달라지지 않는다', () => {
    for (const [tone, season, weather] of SKIES) {
      const map = neutigol(season, weather);
      const pal = paletteOf(season, weather);
      const snap = new Snapper(MASTER[tone]);
      const defs = thingDefs(pal);
      const counts = new Map<number, number>();
      const shades: Shade[] = shadesFor((key) => defs.get(key)?.shades, map.objects);
      countColors(paintGround(map, pal, shades).px, counts);
      const used = new Set(map.objects.map((o) => thingKey(o.kind, o.variant)));
      for (const [key, def] of defs) if (used.has(key)) countColors(def.frames[0], counts, 4);
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
      // 한 벌을 그 계절의 그림으로 짰을 때의 값은 3~4쯤이다(다른 계절의 한 벌을 쓰면 4.5를 넘는다)
      expect(off / total, tone).toBeLessThan(4.2);
      expect(worst, tone).toBeLessThan(17);
    }
  }, 60000);

  it('계절마다 한 벌에 맞춰도 빛깔 단계가 뭉개지지 않는다(풀·잎·논·물·눈)', () => {
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const snap = new Snapper(MASTER[tone]);
      const kept = (ramp: readonly number[]): number => new Set(ramp.map((c) => snap.nearest(c))).size;
      expect(kept(pal.grass), `${tone} grass`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.leaf), `${tone} leaf`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.thatch), `${tone} thatch`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.water), `${tone} water`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.stone), `${tone} stone`).toBeGreaterThanOrEqual(4);
      expect(kept(pal.crop), `${tone} crop`).toBeGreaterThanOrEqual(season === 'spring' ? 3 : 4);
      if (season === 'winter') expect(kept(pal.snow), 'snow').toBe(5);
      if (pal.rain) {
        // 불어난 냇물과 잠긴 논의 물빛이 한 벌 안에서 갈린다
        expect(kept(pal.water), 'rain water').toBeGreaterThanOrEqual(6);
        expect(kept(pal.paddy), 'rain paddy').toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('가까운 빛깔부터 합쳐 줄인다', () => {
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
      countColors(snap.apply(paintGround(map, pal, shades).px), counts);
      const master = new Set(MASTER[tone]);
      expect(counts.size, tone).toBeLessThanOrEqual(MASTER_SIZE);
      for (const c of counts.keys()) expect(master.has(c), tone).toBe(true);
      // 한 벌의 빛깔이 남아돌지 않는다(그 계절의 그림에 쓰이지 않는 빛깔이 열 가지를 넘지 않는다)
      expect(counts.size, tone).toBeGreaterThanOrEqual(MASTER_SIZE - 10);
    }
  }, 60000);

  it('한 벌에 맞춰도 빛깔 단계가 뭉개지지 않는다(짚·잎·돌·흙의 단계가 넷 넘게 남는다)', () => {
    const pal = paletteOf('spring');
    const snap = new Snapper(MASTER.spring);
    for (const [name, ramp] of [
      ['thatch', pal.thatch],
      ['leaf', pal.leaf],
      ['grass', pal.grass],
      ['stone', pal.stone],
      ['path', pal.path],
      ['water', pal.water],
      ['wood', pal.wood],
    ] as const) {
      expect(new Set(ramp.map((c) => snap.nearest(c))).size, name).toBeGreaterThanOrEqual(4);
    }
  });

  // 그림을 크게 고친 뒤 한 벌을 다시 짤 때: VITE_MAKE_MASTER=1 npx vitest run tests/pixel.test.ts
  // (결과는 실패 글에 찍힌다. src/pixel/master.ts에 옮겨 적는다.)
  // 그림을 고친 뒤에는 한 벌을 다시 짜서 master.ts에 옮긴다(아래 시험이 옮기지 않은 것을 잡는다).
  // 다시 짜기: VITE_MAKE_MASTER=1 npx vitest run tests/pixel.test.ts -t "한 벌을 다시 짠다" (결과가 실패 글에 찍힌다)
  it.skipIf(!import.meta.env.VITE_MAKE_MASTER)('한 벌을 다시 짠다', () => {
    const out: Record<string, string[]> = {};
    for (const [tone] of SKIES) out[tone] = remake(tone);
    throw new Error(`MASTER ${JSON.stringify(out)}`);
  }, 120_000);

  it('한 벌은 지금의 그림으로 다시 짠 것과 같다(여름·큰비·가을·겨울 — 그림을 고치고 한 벌을 옮기지 않으면 잡는다)', () => {
    // 봄의 한 벌은 1-다 그대로 둔다(봄의 그림과 아이콘이 바뀌지 않게 — 봄의 그림은 그대로이고, 봄의 시험이 한 벌 안을 따로 본다)
    for (const tone of ['summer', 'rain', 'autumn', 'winter'] as const) {
      const now = MASTER[tone].map((c) => `#${[red(c), green(c), blue(c)].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
      expect(now, tone).toEqual(remake(tone));
    }
  }, 120_000);
});

/** 한 벌을 짤 때 셀 맵들: 그 계절의 맵(때가 갈리는 계절은 때마다) */
function mapsOf(tone: Tone): MapData[] {
  switch (tone) {
    case 'spring':
      return [neutigol()];
    case 'summer':
      return [neutigol('summer')];
    case 'rain':
      return [neutigol('summer', 'rain', 'early'), neutigol('summer', 'rain', 'late')];
    case 'autumn':
      return [neutigol('autumn', 'clear', 'late'), neutigol('autumn', 'clear', 'done', true)];
    case 'winter':
      return [neutigol('winter')];
  }
}

/** 그 계절의 그림에 쓰인 빛깔을 세어 64색 한 벌을 짠다(맵에 놓인 것, 사람, 짐승, 날리는 것, 물결, 땅) */
function remake(tone: Tone): string[] {
  const [, season, weather] = SKIES.find(([t]) => t === tone)!;
  const maps = mapsOf(tone);
  const pal = paletteOf(season, weather);
  const defs = thingDefs(pal);
  const counts = new Map<number, number>();
  const placed = new Map<string, number>();
  for (const map of maps) {
    for (const o of map.objects) {
      const key = thingKey(o.kind, o.variant);
      placed.set(key, (placed.get(key) ?? 0) + 1);
    }
  }
  // 그 계절의 맵에 놓인 것만 센다(다른 계절의 것 때문에 빛깔을 쓰지 않는다). 문짝과 날씨로 갈리는 생김새는 함께 센다.
  for (const [key, def] of defs) {
    const kind = key.split(':')[0];
    const used = placed.get(key) ?? 0;
    if (used === 0 && ![...placed.keys()].some((k) => k.startsWith(`${kind}:`))) continue;
    countColors(def.frames[0], counts, 1 + used);
  }
  const onMap = new Set(maps.flatMap((map) => map.dwellers.map((d) => d.sprite)));
  for (const [name, p] of Object.entries({ ...HEROES, ...VILLAGERS, ...GUISES })) {
    if (name in HEROES || onMap.has(name)) countColors(personSheet(p), counts, 20);
  }
  for (const make of [critters.hen, critters.rooster, critters.chick, critters.dog, critters.ox, critters.magpie, critters.egret, critters.sparrow]) {
    for (const f of make().frames) countColors(f, counts, 20);
  }
  for (const f of [critters.flagMark(), critters.bubbleMark(), critters.barMark(), ...critters.arrowMarks(), ...critters.driftSprites(pal), ...critters.glintFrames(pal), ...critters.gustFrames(pal), ...critters.rippleFrames(pal), ...critters.weatherSprites(pal)]) {
    countColors(f, counts, 40);
  }
  for (const f of waterFrames(pal, 6)) countColors(f, counts, 30);
  for (const map of maps) {
    const shades: Shade[] = shadesFor((key) => defs.get(key)?.shades, map.objects);
    countColors(paintGround(map, pal, shades).px, counts, 1);
  }
  return reduce(counts, MASTER_SIZE).map((c) => `#${[red(c), green(c), blue(c)].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
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
    const region = (g: ReturnType<typeof paint>, x0: number, x1: number): Px => {
      const out = new Px((x1 - x0) * TILE, 5 * TILE);
      for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.set(x, y, g.px.get(x0 * TILE + x, 2 * TILE + y));
      return out;
    };
    const summer = paint('summer');
    const autumn = paint('autumn');
    const winter = paint('winter');
    const rain = paint('summer', 'rain');
    // 벼가 선 논: 여름은 푸른 벼, 가을은 누런 벼(벼의 빛이 논을 가득 채운다)
    expect(countOf(region(summer, 2, 5), paletteOf('summer').crop) / (3 * 5 * 256)).toBeGreaterThan(0.8);
    expect(countOf(region(autumn, 2, 5), paletteOf('autumn').crop) / (3 * 5 * 256)).toBeGreaterThan(0.8);
    expect(summer.crop[4 * 12 + 3]).toBe(1);
    expect(autumn.crop[4 * 12 + 3]).toBe(1);
    expect(summer.glint[4 * 12 + 3]).toBe(0);
    // 벤 논(가을): 벼의 빛이 거의 없고 마른 흙과 그루터기다
    expect(countOf(region(autumn, 8, 10), paletteOf('autumn').crop) / (2 * 5 * 256)).toBeLessThan(0.05);
    expect(countOf(region(autumn, 8, 10), paletteOf('autumn').thatch)).toBeGreaterThan(40); // 그루터기
    expect(autumn.crop[4 * 12 + 8]).toBe(0);
    // 겨울: 눈이 논의 반을 넘게 덮는다
    const snowy = [...paletteOf('winter').grass.slice(3), ...paletteOf('winter').snow];
    expect(countOf(region(winter, 2, 5), snowy) / (3 * 5 * 256)).toBeGreaterThan(0.5);
    expect(winter.crop[4 * 12 + 3]).toBe(0);
    // 큰비가 온 해: 잠긴 논은 물빛이고(반짝임을 놓는 칸), 벼가 선 논은 그대로 푸르다
    expect(rain.glint[4 * 12 + 8]).toBe(1);
    expect(rain.crop[4 * 12 + 8]).toBe(0);
    expect(countOf(region(rain, 8, 10), paletteOf('summer', 'rain').paddy) / (2 * 5 * 256)).toBeGreaterThan(0.6);
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
    // 가장 밝은 벼의 빛(포기의 끝)이 가로줄·세로줄마다 고르게 흩어져 있다: 줄 맞춘 모라면 빈 줄과 꽉 찬 줄이 번갈아 나온다
    const W = 6 * TILE;
    const H = 4 * TILE;
    const cols = new Array<number>(W).fill(0);
    const rows = new Array<number>(H).fill(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g.px.get(2 * TILE + x, 2 * TILE + y) !== pal.crop[3]) continue;
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
    // 줄 맞춘 모(네 점마다 한 줄)라면 이 값이 1.7쯤이다. 흩어 뿌린 논은 그 반에 못 미친다.
    const lined = spread(Array.from({ length: W }, (_, x) => (x % 4 === 0 ? 12 : 0)));
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
    const ox = fx - PERSON_AX;
    const oy = fy - (sit ? 5 : 0) - PERSON_AY;
    let all = 0;
    let hid = 0;
    const by = new Map<string, number>();
    for (let y = 0; y <= PERSON_AY - 12; y++) {
      for (let x = 0; x < frame.w; x++) {
        if (frame.get(x, y) === 0) continue;
        all++;
        const wx = ox + x;
        const wy = oy + y;
        for (const t of things) {
          if (t.sortY <= key) continue;
          if (wx < t.x0 || wy < t.y0 || wx >= t.x0 + t.f.w || wy >= t.y0 + t.f.h) continue;
          if (t.f.get(wx - t.x0, wy - t.y0) === 0) continue;
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

