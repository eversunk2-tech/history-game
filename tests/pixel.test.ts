// 도트 그림의 검사. 캔버스 없이 버퍼만 본다: 빠진 그림이 없는지, 발치가 그림 안에 있는지, 움직임의 장이 서로 다른지.

import { describe, expect, it } from 'vitest';
import { neutigol } from '../src/content/maps/neutigol';
import { SEASONS } from '../src/engine/types';
import { THINGS } from '../src/map/things';
import { T, TILE } from '../src/map/types';
import { MAKERS, anchorOf, shadesFor, thingDefs, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { paintGround, waterFrames, type Shade } from '../src/pixel/ground';
import { MASTER, MASTER_SIZE } from '../src/pixel/master';
import { paletteOf } from '../src/pixel/palette';
import { DIRS, HEROES, HOUSEHOLDS, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS, personFrame, personSheet } from '../src/pixel/people';
import { Px, alpha, blue, green, hash2, hex, red, rgb, vnoise } from '../src/pixel/px';
import { Snapper, countColors, distance, reduce } from '../src/pixel/quant';

const same = (a: Px, b: Px): boolean => a.w === b.w && a.h === b.h && a.d.every((v, i) => v === b.d[i]);

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
  it('계절마다 한 벌은 64색이고 겹치는 빛이 없다', () => {
    for (const season of SEASONS) {
      expect(MASTER[season].length, season).toBe(MASTER_SIZE);
      expect(new Set(MASTER[season]).size, season).toBe(MASTER_SIZE);
    }
    expect(MASTER_SIZE).toBe(64);
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

  it('화면에 나오는 그림은 모두 한 벌 안의 빛깔이다(세운 것, 인물, 짐승, 땅과 그 그림자, 물결)', () => {
    const map = neutigol();
    for (const season of ['spring', 'autumn'] as const) {
      const pal = paletteOf(season);
      const snap = new Snapper(MASTER[season]);
      const defs = thingDefs(pal);
      const shades: Shade[] = shadesFor((key) => defs.get(key)?.shades, map.objects);
      const counts = new Map<number, number>();
      for (const def of defs.values()) for (const f of def.frames) countColors(snap.apply(f), counts);
      for (const p of Object.values({ ...HEROES, ...VILLAGERS })) countColors(snap.apply(personSheet(p)), counts);
      for (const make of [critters.hen, critters.rooster, critters.chick, critters.dog, critters.ox, critters.magpie]) {
        for (const f of make().frames) countColors(snap.apply(f), counts);
      }
      for (const f of waterFrames(pal, 4)) countColors(snap.apply(f), counts);
      countColors(snap.apply(paintGround(map, pal, shades).px), counts);
      const master = new Set(MASTER[season]);
      expect(counts.size, season).toBeLessThanOrEqual(MASTER_SIZE);
      for (const c of counts.keys()) expect(master.has(c), season).toBe(true);
    }
  });

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
  it.skipIf(!import.meta.env.VITE_MAKE_MASTER)('한 벌을 다시 짠다', () => {
    const map = neutigol();
    const out: Record<string, string[]> = {};
    for (const season of SEASONS) {
      const pal = paletteOf(season);
      const defs = thingDefs(pal);
      const counts = new Map<number, number>();
      const placed = new Map<string, number>();
      for (const o of map.objects) {
        const key = thingKey(o.kind, o.variant);
        placed.set(key, (placed.get(key) ?? 0) + 1);
      }
      const shades: Shade[] = shadesFor((key) => defs.get(key)?.shades, map.objects);
      for (const [key, def] of defs) countColors(def.frames[0], counts, 1 + (placed.get(key) ?? 0));
      for (const p of Object.values({ ...HEROES, ...VILLAGERS })) countColors(personSheet(p), counts, 20);
      for (const make of [critters.hen, critters.rooster, critters.chick, critters.dog, critters.ox, critters.magpie, critters.egret]) {
        for (const f of make().frames) countColors(f, counts, 20);
      }
      for (const f of [critters.flagMark(), critters.bubbleMark(), critters.barMark(), ...critters.arrowMarks(), ...critters.driftSprites(pal), ...critters.glintFrames(pal), ...critters.gustFrames(pal), ...critters.rippleFrames(pal)]) {
        countColors(f, counts, 40);
      }
      for (const f of waterFrames(pal, 6)) countColors(f, counts, 30);
      countColors(paintGround(map, pal, shades).px, counts, 1);
      out[season] = reduce(counts, MASTER_SIZE).map((c) => `#${[red(c), green(c), blue(c)].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
    throw new Error(`MASTER ${JSON.stringify(out)}`);
  });
});
