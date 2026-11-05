// 그림 올리기 ②(spec 4.7.5)의 그림 규칙: 집·나무·소품·짐승·날림·표시·구름 그림자·일 놀이 안의 작은 것을 그림 점으로 다시 그렸는지,
// 꼴·크기·발치가 1-라 그대로인지, 먹빛 테두리·때·잡티가 없는지, 발밑 그림자, 큰비 날의 웅덩이와 사람, 실제 화면의 어두운 점.
// 캔버스 없이 버퍼만 본다(실제 화면은 tests/artRules.ts의 캔버스 흉내로 게임의 그리기를 그대로 돌린다).

import { describe, expect, it, vi } from 'vitest';
import { SEASONS, type Season } from '../src/engine/types';
import { THINGS } from '../src/map/things';
import { T, type Weather } from '../src/map/types';
import { thingDefs, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { paintGround } from '../src/pixel/ground';
import { MASTER, type Tone } from '../src/pixel/master';
import { paletteOf, type Palette } from '../src/pixel/palette';
import { footShadow } from '../src/pixel/people';
import { ART, Px, blue, hex, red } from '../src/pixel/px';
import { Snapper } from '../src/pixel/quant';
import type { SpriteDef } from '../src/pixel/shapes';
import { footBox } from '../src/pixel/atlas';
import * as playArt from '../src/plays/art';
import { edgeContrast, gameGateScene, gateScene, harshOrphans, luma, puddleBlobs, upscaledCopy, upscaledShare, warmth } from './artRules';

vi.setConfig({ testTimeout: 60_000 });

/** 그림 벌 다섯: 네 계절과 큰비가 온 해의 여름 */
const SKIES: [Tone, Season, Weather][] = [
  ['spring', 'spring', 'clear'],
  ['summer', 'summer', 'clear'],
  ['rain', 'summer', 'rain'],
  ['autumn', 'autumn', 'clear'],
  ['winter', 'winter', 'clear'],
];

const same = (a: Px, b: Px): boolean => a.w === b.w && a.h === b.h && a.d.every((v, i) => v === b.d[i]);

/**
 * 계절마다 세운 것의 그림(한 번만 짓는다 — 2배 그림은 짓는 데 시간이 걸린다). 이 파일의 시험은 그림을 읽기만 하고
 * 고칠 때는 snapped처럼 복사본을 만든다(같은 벌을 여러 시험이 함께 쓴다).
 */
const defsMemo = new Map<Palette, Map<string, SpriteDef>>();
const defsOf = (pal: Palette): Map<string, SpriteDef> => {
  let d = defsMemo.get(pal);
  if (!d) {
    d = thingDefs(pal);
    defsMemo.set(pal, d);
  }
  return d;
};


/** 1-라(커밋 9f41cdc)의 1배 그림의 크기·발치·장 수(·굴뚝 끝). 2배 그림은 이것의 ART배여야 한다(꼴·크기·발치는 1-라 그대로) */
const SIZES_1E = 'choga:0=108,94,54,91,1,102,71 choga:1=108,94,54,91,1,6,71 choga:2=108,94,54,91,1,102,71 choga:3=108,94,54,91,1,102,71 choga:4=108,94,54,91,1,6,71 choga:5=108,94,54,91,1,102,71 hut:0=76,76,38,73,1,71,54 hut:1=76,76,38,73,1,5,54 hut:2=76,76,38,73,1,71,54 hut:3=76,76,38,73,1,5,54 shed:0=58,52,29,49,1 manor:0=160,106,80,103,1 wing:0=94,86,47,83,1 temple:0=146,112,73,109,1 wallH:0=16,30,8,26,1 wallH:1=16,30,8,26,1 wallH:2=16,30,8,26,1 wallV:0=14,38,7,34,1 wallV:1=14,38,7,34,1 gate:0=64,62,8,56,1 gate:1=64,62,8,56,1 hall:0=76,76,38,73,1,5,54 well:0=38,34,17,30,1 jars:0=34,30,17,26,1 jars:1=34,30,17,26,1 woodpile:0=34,24,17,21,1 strawstack:0=38,44,19,40,1 strawstack:1=38,44,19,40,1 fenceH:0=16,22,8,19,1 fenceH:1=16,22,8,19,1 fenceH:2=16,22,8,19,1 fenceV:0=8,30,4,27,1 fenceV:1=8,30,4,27,1 stonewallH:0=16,18,8,15,1 stonewallH:1=16,18,8,15,1 stonewallH:2=16,18,8,15,1 stonewallV:0=12,30,6,27,1 stonewallV:1=12,30,6,27,1 pagoda:0=26,50,13,47,1 lantern:0=16,28,8,25,1 rockS:0=12,9,6,7,1 rockS:1=12,9,6,7,1 rockS:2=12,9,6,7,1 rockS:3=12,9,6,7,1 rockM:0=22,18,11,16,1 rockM:1=22,18,11,16,1 rockM:2=22,18,11,16,1 rockL:0=40,28,20,26,1 rockL:1=40,28,20,26,1 flatstone:0=22,14,11,11,1 flatstone:1=22,14,11,11,1 stump:0=18,16,9,13,1 stump:1=18,16,9,13,1 log:0=36,14,18,11,1 fallen:0=40,18,20,15,1 cairn:0=24,26,12,23,1 zelkova:0=196,186,98,178,3 oak:0=56,66,28,63,3 oak:1=56,66,28,63,3 oak:2=56,66,28,63,3 oak:3=56,66,28,63,3 oak:4=56,66,28,63,3 oak:5=56,66,28,63,3 oldpine:0=72,92,34,87,3 oldpine:1=72,92,38,87,3 young:0=34,44,17,41,3 young:1=34,44,17,41,3 young:2=34,44,17,41,3 pine:0=48,70,24,67,3 pine:1=48,70,24,67,3 pine:2=48,70,24,67,3 pineS:0=34,48,17,45,3 pineS:1=34,48,17,45,3 blossom:0=46,52,23,49,3 blossom:1=46,52,23,49,3 blossom:2=46,52,23,49,3 willow:0=52,62,26,58,3 willow:1=52,62,26,58,3 bigtree:0=92,98,46,94,3 bush:0=24,20,12,18,3 bush:1=24,20,12,18,3 bush:2=24,20,12,18,3 azalea:0=24,20,12,18,3 azalea:1=24,20,12,18,3 forsythia:0=24,20,12,18,3 forsythia:1=24,20,12,18,3 reed:0=14,20,7,18,3 reed:1=14,20,7,18,3 reed:2=14,20,7,18,3 tuft:0=12,10,6,9,3 tuft:1=12,10,6,9,3 tuft:2=12,10,6,9,3 tuft:3=12,10,6,9,3 flower:0=10,11,5,10,3 flower:1=10,11,5,10,3 flower:2=10,11,5,10,3 flower:3=10,11,5,10,3 flower:4=10,11,5,10,3 swing:0=46,50,23,46,1 swing:1=46,50,23,46,5 sandring:0=72,42,36,21,1 wrestlers:0=40,36,20,33,4 basin:0=24,16,12,13,1 sheaf:0=26,26,13,23,1 sheaf:1=26,26,13,23,1 sheaf:2=26,26,13,23,1 sheafpile:0=38,28,19,24,1 gaesang:0=40,22,20,18,1 grainmat:0=46,28,23,14,1 bundle:0=18,14,9,12,1 bundle:1=18,14,9,12,1 snowpile:0=20,11,10,9,1 snowpile:1=28,14,14,12,1 @hen=14,12,6,11,3 @rooster=14,12,6,11,3 @chick=7,7,3,6,2 @dog=22,13,10,12,4 @ox=39,22,20,21,2 @egret=12,16,6,13,2 @magpie=11,9,5,8,4 @sparrow=9,7,4,6,4';

const INK = hex('#2a2422');
const INK_SOFT = hex('#4b3f38');

/** 그 계절의 벌에 맞춘 그림(게임이 그리는 빛깔) */
const snapped = (tone: Tone, f: Px): Px => new Snapper(MASTER[tone]).apply(f.clone());

/** 그림 벌의 바탕(날림·물빛·표시·구름 그림자)과 짐승의 그림 — 계절마다 */
function baseSprites(pal: ReturnType<typeof paletteOf>): { name: string; f: Px }[] {
  const out: { name: string; f: Px }[] = [];
  const add = (name: string, list: readonly Px[]): void => list.forEach((f, i) => out.push({ name: `${name}#${i}`, f }));
  for (const [name, make] of Object.entries({ hen: critters.hen, rooster: critters.rooster, chick: critters.chick, dog: critters.dog, ox: critters.ox, plowTeam: critters.plowTeam, egret: critters.egret, magpie: critters.magpie, sparrow: critters.sparrow }))
    add(`@${name}`, make().frames);
  add('날림', critters.driftSprites(pal));
  add('날씨', critters.weatherSprites(pal));
  add('연기', critters.smokePuffs());
  add('반짝임', critters.glintFrames(pal));
  add('바람결', critters.gustFrames(pal));
  add('잔물결', critters.rippleFrames(pal));
  add('새', critters.birdFrames());
  add('표시', [critters.flagMark(), critters.bubbleMark(), critters.barMark(), ...critters.targetRings(), ...critters.arrowMarks()]);
  add('나비', [...critters.butterfly('white').frames, ...critters.butterfly('yellow').frames]);
  add('구름 그림자', [critters.cloudShadow(pal)]);
  return out;
}

describe('그림 올리기 ②: 집·나무·소품·짐승·계절의 것(ㄱ·ㄴ·ㄹ·ㅁ·ㅂ·ㅊ·ㅎ)', () => {
  it('세운 것과 짐승의 크기·발치·장 수·굴뚝은 1-라 그림의 ART배다(꼴이 같다). 그림자와 가림 줄은 맵 점 그대로', () => {
    const want = new Map(SIZES_1E.split(' ').map((t) => [t.split('=')[0], t.split('=')[1].split(',').map(Number)] as const));
    for (const season of SEASONS) {
      const defs = defsOf(paletteOf(season));
      for (const [key, def] of defs) {
        const w = want.get(key);
        expect(w, key).toBeDefined();
        if (!w) continue;
        const f = def.frames[0];
        expect([f.w, f.h, def.ax, def.ay], `${season} ${key}`).toEqual(w.slice(0, 4).map((v) => v * ART));
        expect(def.frames.length, `${season} ${key}`).toBe(w[4]);
        if (w.length > 5) expect([def.smoke?.x, def.smoke?.y], key).toEqual([w[5] * ART, w[6] * ART]);
      }
    }
    for (const [name, make] of Object.entries({ hen: critters.hen, rooster: critters.rooster, chick: critters.chick, dog: critters.dog, ox: critters.ox, egret: critters.egret, magpie: critters.magpie, sparrow: critters.sparrow })) {
      const c = make();
      const w = want.get(`@${name}`)!;
      expect([c.frames[0].w, c.frames[0].h, c.ax, c.ay, c.frames.length], name).toEqual([...w.slice(0, 4).map((v) => v * ART), w[4]]);
    }
    // 논 가는 소와 사람은 ①부터 그림 점 틀이다(156×68, 발치 76·64)
    const plow = critters.plowTeam();
    expect([plow.frames[0].w, plow.frames[0].h, plow.ax, plow.ay]).toEqual([156, 68, 76, 64]);
  });

  it('1배 그림을 키워 쓴 것이 없다: 모든 낱그림에서 빛이 바뀌는 곳의 짝수 자리 2×2 칸이 한 빛인 몫이 0.8 아래(1배를 키운 그림은 1)', () => {
    let seen = 0;
    for (const [tone, season, weather] of SKIES) {
      const pal = paletteOf(season, weather);
      const all: { name: string; f: Px }[] = [];
      for (const [key, def] of defsOf(pal)) def.frames.forEach((f, i) => all.push({ name: `${key}#${i}`, f }));
      all.push(...baseSprites(pal));
      for (const { name, f } of all) {
        const g = snapped(tone, f);
        const share = upscaledShare(g);
        if (share === null) continue;
        seen++;
        expect(share, `${tone} ${name}`).toBeLessThan(0.8);
        // 같은 그림을 1배로 줄였다 키운 것은 잡는다(이 셈이 1배를 키운 그림을 가려낸다)
        if (name.endsWith('#0')) expect(upscaledShare(upscaledCopy(g)) ?? 1, `${tone} ${name} 키운 것`).toBeGreaterThan(0.99);
      }
    }
    expect(seen).toBeGreaterThan(900);
    // 일 놀이 안의 작은 것(볍씨·벼·풀·볏단·자루·되·베 조각·북)
    const pal = paletteOf('summer');
    const plays: Px[] = [
      playArt.riceTuft(pal, 0).px,
      ...[0, 1, 2].map((k) => playArt.weedArt(pal, k).px),
      playArt.goldClump(0).px,
      playArt.stubbleArt(0, true).px,
      playArt.swathArt(0).px,
      playArt.sheafArt(paletteOf('autumn')).px,
      playArt.sackArt(paletteOf('autumn'), 'rice').px,
      playArt.measureArt(paletteOf('autumn'), true).px,
      playArt.riceHeapArt(paletteOf('autumn')).px,
      playArt.clothPiece(paletteOf('autumn'), 30, 9, 2, 10),
      playArt.matArt(paletteOf('autumn'), 60, 30),
    ];
    for (const [i, f] of plays.entries()) {
      const share = upscaledShare(f);
      if (share !== null) expect(share, `놀이 ${i}`).toBeLessThan(0.8);
    }
  }, 120000);

  it('ㄴ 먹빛 테두리를 쓰지 않는다: 세운 것에 먹빛 점이 없고, 짐승의 둘레는 (나) 제 빛깔을 짙게 한 따뜻한 테두리다', () => {
    for (const [, season, weather] of SKIES) {
      for (const [key, def] of defsOf(paletteOf(season, weather))) {
        // 그네·씨름의 사람(people.ts)은 눈동자에 먹빛을 쓴다 — 사람 그림은 사람의 시험이 본다
        if (key.startsWith('swing') || key.startsWith('wrestlers')) continue;
        let ink = 0;
        for (const f of def.frames) for (const c of f.d) if (c === INK || c === INK_SOFT) ink++;
        expect(ink, `${season}/${weather} ${key}`).toBe(0);
      }
    }
    for (const [name, make] of Object.entries({ hen: critters.hen, rooster: critters.rooster, chick: critters.chick, dog: critters.dog, ox: critters.ox, egret: critters.egret, magpie: critters.magpie, sparrow: critters.sparrow })) {
      for (const f of make().frames) {
        let edge = 0;
        let warm = 0;
        let dark = 0;
        let ink = 0;
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const c = f.get(x, y);
            if (c === 0) continue;
            if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
            edge++;
            if (c === INK) ink++;
            if (red(c) >= blue(c)) warm++;
            if (luma(c) <= 0.12) dark++;
          }
        }
        expect(ink, `${name} 먹빛 테두리`).toBe(0);
        // 까치는 검은 몸에 푸른 윤이라(1-라·시안 그대로) 따뜻함은 보지 않는다
        if (name !== 'magpie') expect(warm / edge, name).toBeGreaterThan(0.9);
        expect(dark / edge, `${name} 거의 먹빛`).toBeLessThan(name === 'magpie' ? 0.6 : 0.2);
      }
    }
  });

  it('ㄴ 땅·집·나무·소품에 먹선이 없다: 가장자리 점(빈 점과 닿은 점) 가운데 밝기 0.2 이하의 몫 — 계절마다 평균 0.35 이하, 한 장 0.75 이하', () => {
    // 지금 그림: 평균 0.10~0.27(큰비가 가장 높다), 한 장 가장 높은 것 0.64(어두운 잎빛의 덤불). 1-라(먹빛 테두리): 평균 0.32~0.53.
    // 지금 그림에 먹빛 테두리를 한 점 두르면 평균 0.87~0.89가 된다 — 이 시험이 그것을 잡는다.
    const edgeDark = (f: Px): number => {
      let edge = 0;
      let dark = 0;
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const c = f.get(x, y);
          if (c === 0) continue;
          if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
          edge++;
          if (luma(c) <= 0.2) dark++;
        }
      }
      return edge ? dark / edge : 0;
    };
    for (const [tone, season, weather] of SKIES) {
      let sum = 0;
      let n = 0;
      for (const [key, def] of defsOf(paletteOf(season, weather))) {
        // 그네·씨름의 사람은 사람의 시험이 본다
        if (key.startsWith('swing') || key.startsWith('wrestlers')) continue;
        const v = edgeDark(snapped(tone, def.frames[0]));
        expect(v, `${tone} ${key}`).toBeLessThanOrEqual(0.75);
        sum += v;
        n++;
      }
      expect(sum / n, tone).toBeLessThanOrEqual(0.35);
    }
  });

  it('ㄹ 대비 큰 외톨이 점: 세운 것 한 장 천 개당 25 이하(계절마다, 벌에 맞춘 그림)', () => {
    for (const [tone, season, weather] of SKIES) {
      for (const [key, def] of defsOf(paletteOf(season, weather))) expect(harshOrphans(snapped(tone, def.frames[0])), `${tone} ${key}`).toBeLessThanOrEqual(25);
      for (const { name, f } of baseSprites(paletteOf(season, weather))) if (name.startsWith('@')) expect(harshOrphans(snapped(tone, f)), `${tone} ${name}`).toBeLessThanOrEqual(25);
    }
  }, 120000);

  it('ㅎ 때 없음: 수채화 같은 결이 어둡게 만든 점의 몫 — 대문·담 5% 이하, 초가 8% 이하(계절마다)', () => {
    for (const [tone, season, weather] of SKIES) {
      for (const [key, def] of defsOf(paletteOf(season, weather))) {
        const kind = key.split(':')[0];
        const limit = ['gate', 'wallH', 'wallV'].includes(kind) ? 5 : ['choga', 'hut', 'hall', 'shed'].includes(kind) ? 8 : null;
        if (limit === null) continue;
        expect(def.wash, `${tone} ${key}`).toBeTypeOf('number');
        expect(def.wash!, `${tone} ${key}`).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('ㅊ 흔들림은 1~2 그림 점이다(나무·덤불·풀의 석 장)', () => {
    const defs = defsOf(paletteOf('summer'));
    for (const [kind, def] of Object.entries(THINGS)) {
      if (!def.sways) continue;
      const sprite = defs.get(thingKey(kind, 0))!;
      const b = sprite.frames.map((f) => f.bounds()!);
      for (const q of b.slice(1)) {
        expect(Math.max(Math.abs(q.x0 - b[0].x0), Math.abs(q.x1 - b[0].x1)), kind).toBeLessThanOrEqual(2);
        expect(same(sprite.frames[0], sprite.frames[1]), kind).toBe(false);
      }
    }
  });

  it('ㅂ 발밑 그림자: 사람·짐승 모두 가운데가 발치의 오른쪽 아래(3.1차 시안의 자리)이고, 바닥 밑으로 내려와 보인다', () => {
    const foot = footShadow(paletteOf('spring'));
    for (const [who, b] of [
      ['사람', footBox(foot)],
      ['닭', footBox(foot, critters.hen().frames[0].w)],
      ['개', footBox(foot, critters.dog().frames[0].w)],
      ['소', footBox(foot, critters.ox().frames[0].w)],
    ] as const) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      expect(cx, `${who} 오른쪽`).toBeGreaterThanOrEqual(2);
      expect(cy, `${who} 아래`).toBeGreaterThanOrEqual(-1);
      expect(b.y + b.h, `${who} 발치 밑으로`).toBeGreaterThanOrEqual(4);
    }
  });

  it('ㅂ 발밑 그림자의 짙기는 3.1차 시안과 같다: 바닥의 밝기를 가운데 0.5~0.65배, 그림자 전체 평균 0.52~0.7배로(시안 0.57)', () => {
    for (const season of SEASONS) {
      const g = gateScene(season);
      for (const f of g.feet) {
        let sum = 0;
        let n = 0;
        let core = 0;
        let coreN = 0;
        for (let y = f.y; y < f.y + f.h; y++) {
          for (let x = f.x; x < f.x + f.w; x++) {
            const a = g.bare.get(x, y);
            const b = g.floor.get(x, y);
            if (a === 0 || a === b) continue;
            const k = luma(b) / Math.max(1e-6, luma(a));
            sum += k;
            n++;
            const dx = (x + 0.5 - (f.x + f.w / 2)) / (f.w / 2);
            const dy = (y + 0.5 - (f.y + f.h / 2)) / (f.h / 2);
            if (dx * dx + dy * dy < 0.3) {
              core += k;
              coreN++;
            }
          }
        }
        expect(n, `${season} ${f.id}`).toBeGreaterThan(40);
        expect(core / coreN, `${season} ${f.id} 가운데`).toBeGreaterThanOrEqual(0.5);
        expect(core / coreN, `${season} ${f.id} 가운데`).toBeLessThanOrEqual(0.65);
        expect(sum / n, `${season} ${f.id} 평균`).toBeGreaterThanOrEqual(0.52);
        expect(sum / n, `${season} ${f.id} 평균`).toBeLessThanOrEqual(0.7);
      }
    }
  });

  it('큰비 날 땅의 웅덩이는 1-라처럼 맵 점 크기의 덩이다(그림 점 크기로 잘게 흩어지지 않는다 — ①의 Review 권고 8)', () => {
    const plot = { w: 24, h: 16, terrain: new Uint8Array(24 * 16) };
    plot.terrain.fill(T.path);
    for (let i = 0; i < 24 * 4; i++) plot.terrain[i] = T.yard;
    const b = puddleBlobs(paintGround(plot, paletteOf('summer', 'rain')).px);
    expect(b.count).toBeGreaterThan(100);
    // 덩이의 평균 넓이(그림 점): 지금 95쯤. 웅덩이의 꼴을 그림 점으로 셈하면(반 크기) 33쯤이 된다
    expect(b.mean).toBeGreaterThan(60);
  });

  it('큰비 날에도 사람이 바닥에 묻히지 않는다: 사람의 가장 바깥 점과 바로 밖 바닥의 밝기 차가 1-라(0.22~0.24) 아래로 내려가지 않는다', () => {
    const g = gateScene('summer', 'rain');
    const e = g.people.map((p) => edgeContrast(p.sprite, p.x, p.y, g.floor, g.bare));
    for (const [i, v] of e.entries()) expect(v, g.people[i].id).toBeGreaterThanOrEqual(0.22);
    expect(e.reduce((a, b) => a + b, 0) / e.length).toBeGreaterThanOrEqual(0.26);
  });

  it('실제 화면(게임의 그리기 그대로)의 어두운 점의 몫: 봄 대문 앞 7% 이하, 다른 계절은 ①보다 늘지 않는다(①: 여름 9.8 · 큰비 11.8 · 가을 7.4 · 겨울 6.5%)', () => {
    const limit: Record<Tone, number> = { spring: 7, summer: 9.8, rain: 11.8, autumn: 7.4, winter: 6.5 };
    for (const [tone, season, weather] of SKIES) {
      const w = warmth(gameGateScene(season, weather));
      expect(w.darkShare, tone).toBeLessThanOrEqual(limit[tone]);
      expect(w.darkWarmth, tone).toBeGreaterThanOrEqual(0);
    }
    // 봄은 따뜻함의 다른 수치도(ㅍ): 실제 화면에서
    const spring = warmth(gameGateScene('spring'));
    expect(spring.greenHue).toBeGreaterThanOrEqual(95);
    expect(spring.greenHue).toBeLessThanOrEqual(105);
    expect(spring.warmth).toBeGreaterThanOrEqual(49);
  }, 120000);
});
