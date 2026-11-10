// 4-1 ㉢의 새 도트: 정령 「느티」, 도깨비, 굳은 논흙, 작은 그림(카드·장비·유물·갈래·할 일·도깨비불), 맵의 동료.
// 수치는 그림 규칙(spec 4.7.5 — tests/artRules.ts의 셈)으로 잰다: ㄱ 크기·발치, ㄴ 테두리, ㄹ 대비 큰 외톨이 점, ㅁ 바닥과의 밝기 차, ㅇ 봄 벌, ㅊ 장마다 다름, ㅋ 무게.
// 고증(spec 8.4·F71, 4.5, 6.2): 도깨비에 뿔·범 무늬·쇠못이 없다 · 굳은 논흙에 눈·입이 없다 · 정령에 성별을 가르는 부품이 없다.

import { describe, expect, it, vi } from 'vitest';
import { neutigol } from '../src/content/maps/neutigol';
import { foes } from '../src/content/foes';
import { skills } from '../src/content/skills';
import type { Season } from '../src/engine/types';
import { buildScene, render } from '../src/map/draw';
import { openSession, prepReady, prepareMap, stepPrepare } from '../src/map/session';
import { TILE, type MapData, type Weather } from '../src/map/types';
import { COMPANION_SPOT, createWorld, setCompanion, setKeys, stepWorld, tapWorld, type World } from '../src/map/world';
import { iconNames as iconNamesView, iconScale } from '../src/art/PixelArt';
import { buildAtlas, ensureBase, groundCanvas, needsOf, personCanvas, shadesOf } from '../src/pixel/atlas';
import {
  CLUB_WOOD,
  DOKKAEBI_AX,
  DOKKAEBI_AY,
  DOKKAEBI_H,
  DOKKAEBI_PARTS,
  DOKKAEBI_W,
  SOIL_AX,
  SOIL_AY,
  SOIL_BREAK_FRAMES,
  SOIL_H,
  SOIL_PARTS,
  SOIL_STAGES,
  SOIL_W,
  dokkaebiClub,
  dokkaebiFrame,
  soilBreak,
  soilFrame,
  soilStage,
} from '../src/pixel/foes41';
import { snapperOf } from '../src/pixel/ground';
import { iconGroup, iconNames, iconPx } from '../src/pixel/icons';
import { MASTER, toneOf } from '../src/pixel/master';
import { paletteOf } from '../src/pixel/palette';
import { PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, VILLAGERS, personFrame } from '../src/pixel/people';
import { ART, Px, blue, green, hex, red, type Color } from '../src/pixel/px';
import { BOB, LEAF_HAIR, LIFT, SPIRIT, SPIRIT_DIRS, SPIRIT_FRAMES, SPIRIT_GLOW, SPIRIT_PERSON, spiritFrame, spiritSheet } from '../src/pixel/spirit';
import { REGION, edgeContrast, gateScene, harshOrphans, luma, seasonGround, softPixels, withSoftCanvas } from './artRules';

vi.setConfig({ testTimeout: 300_000 });

const SPRING = snapperOf(paletteOf('spring'));
const INK = hex('#2a2422');
const INK_SOFT = hex('#4b3f38');

/** 테두리 점: 찍힌 점 가운데 위·아래·옆 넷 중 하나라도 빈 점 */
function edgePixels(f: Px, skip?: (c: Color) => boolean): Color[] {
  const out: Color[] = [];
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const c = f.get(x, y);
      if (c === 0 || skip?.(c)) continue;
      if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
      out.push(c);
    }
  }
  return out;
}

const colorsOf = (f: Px): Set<Color> => {
  const out = new Set<Color>();
  for (const c of f.d) if (c !== 0) out.add(c);
  return out;
};

const same = (a: Px, b: Px): boolean => a.w === b.w && a.h === b.h && a.d.every((c, i) => c === b.d[i]);

/** 맵에서 칸 n×n이 모두 그 갈래인 자리들(맵 칸) */
function blocksOf(map: MapData, terrain: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let ty = 2; ty + n < map.h - 2; ty++) {
    for (let tx = 2; tx + n < map.w - 2; tx++) {
      let ok = true;
      for (let j = 0; j < n && ok; j++) for (let i = 0; i < n && ok; i++) if (map.terrain[(ty + j) * map.w + tx + i] !== terrain) ok = false;
      if (ok) out.push([tx, ty]);
    }
  }
  return out;
}

/** 봄 풀밭의 여섯 자리(칸 5×5가 모두 풀밭 — 맵 위에서 고루 떨어진 곳) */
const GRASS_SPOTS = blocksOf(neutigol('spring'), 0, 5).filter((_, i) => i % 40 === 0).slice(0, 6);

/**
 * ㅁ: 그림을 봄 풀밭 한가운데(여섯 자리)에 놓고 가장 바깥 점과 바로 밖 바닥의 밝기 차 — 자리마다의 값.
 * 비교로 같은 자리에 선 마을 어른(1-라부터 있는 사람)의 값도 돌려준다.
 */
function onGrass(sprite: Px): { each: number[]; elder: number[] } {
  const each: number[] = [];
  const elder: number[] = [];
  const old = SPRING.apply(personFrame(VILLAGERS.elderMan, 'down', 'idle', 0));
  for (const [tx, ty] of GRASS_SPOTS) {
    const g = seasonGround('spring', 'clear', tx * TILE, ty * TILE, 5 * TILE, 5 * TILE);
    each.push(edgeContrast(sprite, Math.floor((g.px.w - sprite.w) / 2), Math.floor((g.px.h - sprite.h) / 2), g.px));
    elder.push(edgeContrast(old, Math.floor((g.px.w - old.w) / 2), Math.floor((g.px.h - old.h) / 2), g.px));
  }
  return { each, elder };
}

const GATE = gateScene('spring');
/** ㅁ: 대문 앞 흙길(주인공이 선 자리 — 시안의 자리)에 발치를 맞춰 놓고, 발밑 그림자를 얹기 전의 바닥으로 잰다 */
function onPath(sprite: Px, ax: number, ay: number): number {
  const hero = REGION.people.find((p) => p.id === 'hero')!;
  const x = Math.round((hero.x - REGION.cam.x) * ART);
  const y = Math.round((hero.y - REGION.cam.y) * ART);
  return edgeContrast(sprite, x - ax, y - ay, GATE.floor, GATE.bare);
}

const mean = (a: readonly number[]): number => a.reduce((p, q) => p + q, 0) / a.length;

/** 수치를 모아 둔다(마지막 시험이 한꺼번에 적는다 — Build의 보고에 옮긴다) */
const METRICS: Record<string, number> = {};
const note = (k: string, v: number): number => {
  METRICS[k] = Math.round(v * 1000) / 1000;
  return v;
};

const inMaster = (f: Px, tone = 'spring' as keyof typeof MASTER): boolean => {
  const set = new Set(MASTER[tone]);
  for (const c of f.d) if (c !== 0 && !set.has(c)) return false;
  return true;
};

// ══ 정령 ══════════════════════════════════════════════════════════

describe('정령 「느티」의 도트(spec 6.2, 11.1 마)', () => {
  const frames = SPIRIT_DIRS.flatMap((dir) => Array.from({ length: SPIRIT_FRAMES }, (_, f) => ({ dir, f, px: spiritFrame(dir, f, SPRING) })));
  const glow = new Set(SPRIT_GLOW_SNAPPED());

  it('ㄱ 사람과 같은 틀: 한 장 48×64 그림 점, 발치 (24, 60) — 네 방향 × 떠 있기 두 장, 시트는 줄이 방향·칸이 떠 있기', () => {
    expect([PERSON_W, PERSON_H, PERSON_AX, PERSON_AY]).toEqual([48, 64, 24, 60]);
    for (const { dir, f, px } of frames) {
      expect([px.w, px.h], `${dir} ${f}`).toEqual([PERSON_W, PERSON_H]);
      expect(px.count(), `${dir} ${f}`).toBeGreaterThan(400);
    }
    const sheet = spiritSheet(SPRING);
    expect([sheet.w, sheet.h]).toEqual([PERSON_W * SPIRIT_FRAMES, PERSON_H * 4]);
    expect(PERSON_W % ART + PERSON_H % ART + PERSON_AX % ART + PERSON_AY % ART).toBe(0);
  });

  it('떠 있다: 발이 땅(발치 줄)에 닿지 않고, 두 장이 위아래로 1~2 그림 점 오르내린다(ㅊ)', () => {
    expect(LIFT).toBeGreaterThanOrEqual(4);
    expect(BOB).toBeGreaterThanOrEqual(1);
    expect(BOB).toBeLessThanOrEqual(2);
    for (const dir of SPIRIT_DIRS) {
      const a = spiritFrame(dir, 0);
      const b = spiritFrame(dir, 1);
      // 빛 점을 뺀 몸의 맨 아랫줄
      const bottom = (px: Px): number => {
        let y1 = -1;
        for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.get(x, y) !== 0 && !SPIRIT_GLOW.includes(px.get(x, y))) y1 = y;
        return y1;
      };
      // 사람 한 장의 맨 아랫줄은 발치 줄(발바닥 밑의 테두리)이다 — 정령은 그보다 LIFT 그림 점 위에서 끝난다
      expect(bottom(a), dir).toBeLessThanOrEqual(PERSON_AY - LIFT);
      expect(personFrame(SPIRIT_PERSON, dir, 'idle', 0).bounds()!.y1 - bottom(a), dir).toBe(LIFT);
      expect(bottom(a) - bottom(b), dir).toBe(BOB);
      expect(same(a, b), dir).toBe(false);
    }
  });

  it('둘레의 빛: 장마다 자리가 다른 반딧불 같은 빛(두 점 이상의 무리)이 셋', () => {
    for (const dir of SPIRIT_DIRS) {
      const where: string[] = [];
      for (let f = 0; f < SPIRIT_FRAMES; f++) {
        const px = spiritFrame(dir, f);
        const lit: [number, number][] = [];
        for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (SPIRIT_GLOW.includes(px.get(x, y))) lit.push([x, y]);
        // 빛 점은 모두 다른 빛 점과 붙어 있다(외톨이 한 점이 아니다)
        for (const [x, y] of lit) expect(lit.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1), `${dir} ${f} ${x},${y}`).toBe(true);
        expect(lit.length, `${dir} ${f}`).toBeGreaterThanOrEqual(8);
        where.push(lit.map((p) => p.join(',')).join(' '));
      }
      expect(where[0]).not.toBe(where[1]);
    }
  });

  it('성별을 드러내지 않는다: 댕기·수염·콧수염이 없고 치마도 바지도 아닌 긴 옷, 땋은 머리가 아니다, 속눈썹 점을 지웠다, 댕기 빛이 없다', () => {
    expect(SPIRIT_PERSON.ribbon).toBeUndefined();
    expect(SPIRIT_PERSON.beard).toBeUndefined();
    expect(SPIRIT_PERSON.mustache).toBeUndefined();
    expect(SPIRIT_PERSON.bottom).toBe('robe');
    expect(SPIRIT_PERSON.hair).not.toBe('braid');
    expect(SPIRIT_PERSON.build).toBe('child');
    // 사람 틀이 여자 얼굴에만 찍는 속눈썹 두 점(앞모습, 눈의 바깥 곁)이 얼굴 살빛이다
    const raw = personFrame(SPIRIT_PERSON, 'down', 'idle', 0);
    const fixed = spiritFrame('down', 0);
    for (const x of [19, 28]) {
      expect(raw.get(x, 32)).toBe(SPIRIT_PERSON.skin[0]);
      expect(fixed.get(x, 32 - LIFT)).toBe(SPIRIT_PERSON.skin[2]);
    }
    // 댕기·고름 같은 붉은 천의 빛이 없다: 또렷한 붉은 점(색상각 15° 아래나 340° 위, 채도 0.45 이상, 명도 0.35 이상)은 입(석 점 안)뿐이다
    const vivid = (c: Color): boolean => {
      const r = redOf(c);
      const g = greenOf(c);
      const b = blueOf(c);
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      if (mx !== r || mx === mn) return false;
      const hue = ((((g - b) / (mx - mn)) % 6) * 60 + 360) % 360;
      return (hue <= 15 || hue >= 340) && (mx - mn) / mx >= 0.45 && mx / 255 >= 0.35;
    };
    for (const { dir, f, px } of frames) expect([...px.d].filter((c) => c !== 0 && vivid(c)).length, `${dir} ${f}`).toBeLessThanOrEqual(3);
  });

  it('잎빛 머리와 한지 빛 옷: 앞모습의 머리 점이 잎빛(초록이 가장 큰 빛), 몸통이 흰 듯한 한지 빛', () => {
    const f = spiritFrame('down', 0, SPRING);
    let green = 0;
    let hair = 0;
    // 머리(정수리 아래 다섯 줄, 아이 머리 너비)
    for (let y = 24 - LIFT; y < 29 - LIFT; y++) {
      for (let x = 18; x < 30; x++) {
        const c = f.get(x, y);
        if (c === 0) continue;
        hair++;
        if (greenOf(c) > redOf(c) && greenOf(c) > blueOf(c)) green++;
      }
    }
    expect(green / hair).toBeGreaterThan(0.9);
    let pale = 0;
    let body = 0;
    for (let y = 50 - LIFT; y < 56 - LIFT; y++) {
      for (let x = 21; x < 28; x++) {
        const c = f.get(x, y);
        if (c === 0) continue;
        body++;
        if (luma(c) > 0.6 && redOf(c) >= blueOf(c)) pale++;
      }
    }
    expect(pale / body).toBeGreaterThan(0.5);
    // 잎빛 머리의 단계가 봄 벌에 그대로 있다(벌에 맞춰도 뭉개지지 않는다)
    for (const c of LEAF_HAIR) expect(MASTER.spring).toContain(c);
  });

  it('ㄴ 테두리는 사람과 같은 (나): 먹빛이 아니고 따뜻하며(빨강 ≥ 파랑), 밝기 0.2 이하의 몫이 사람의 위 한도(한 모습 0.9) 안', () => {
    for (const { dir, f, px } of frames) {
      const edge = edgePixels(px, (c) => glow.has(c));
      expect(edge.length).toBeGreaterThan(60);
      for (const c of edge) {
        expect(c, `${dir} ${f}`).not.toBe(INK);
        expect(c, `${dir} ${f}`).not.toBe(INK_SOFT);
      }
      expect(edge.filter((c) => redOf(c) >= blueOf(c)).length / edge.length, `${dir} ${f}`).toBeGreaterThan(0.97);
      expect(edge.filter((c) => luma(c) <= 0.2).length / edge.length, `${dir} ${f}`).toBeLessThanOrEqual(0.9);
    }
  });

  it('ㄹ 대비 큰 외톨이 점: 한 장 천 개당 25 이하(벌에 맞춘 장 모두)', () => {
    let worst = 0;
    for (const { dir, f, px } of frames) {
      const v = harshOrphans(px);
      worst = Math.max(worst, v);
      expect(v, `${dir} ${f}`).toBeLessThanOrEqual(25);
    }
    note('정령 ㄹ(가장 큰 장)', worst);
  });

  it('ㅁ 바닥에 묻히지 않는다: 대문 앞 흙길에서 0.3 이상, 봄 풀밭 여섯 자리의 평균 0.3 이상(자리마다 마을 어른보다 낮지 않다) — 장마다', () => {
    let path = 1;
    let grass = 1;
    let low = 1;
    for (const { dir, f, px } of frames) {
      const p = onPath(px, PERSON_AX, PERSON_AY);
      path = Math.min(path, p);
      expect(p, `${dir} ${f} 흙길`).toBeGreaterThanOrEqual(0.3);
      const g = onGrass(px);
      grass = Math.min(grass, mean(g.each));
      expect(mean(g.each), `${dir} ${f} 풀밭`).toBeGreaterThanOrEqual(0.3);
      g.each.forEach((v, i) => {
        low = Math.min(low, v);
        expect(v, `${dir} ${f} 풀밭 ${GRASS_SPOTS[i]}`).toBeGreaterThanOrEqual(g.elder[i] - 0.005);
      });
    }
    note('정령 ㅁ 흙길(가장 작은 장)', path);
    note('정령 ㅁ 풀밭 여섯 자리 평균(가장 작은 장)', grass);
    note('정령 ㅁ 풀밭 한 자리(가장 작은 값)', low);
    note('마을 어른 ㅁ 풀밭 한 자리(같은 자리들의 가장 작은 값 — 견줌)', Math.min(...onGrass(frames[0].px).elder));
  });

  it('ㅇ 봄 벌 안(대화 장면의 대역), 그림 벌에서는 그 계절의 벌 안(여름·겨울도)', () => {
    for (const { px } of frames) expect(inMaster(px)).toBe(true);
    withSoftCanvas(() => {
      for (const [season, weather] of [
        ['summer', 'clear'],
        ['summer', 'rain'],
        ['winter', 'clear'],
      ] as [Season, Weather][]) {
        const atlas = buildAtlas(season, weather, { things: [], people: [SPIRIT], critters: [] });
        const sheet = softPixels(atlas.people.get(SPIRIT));
        expect([sheet.w, sheet.h]).toEqual([PERSON_W * SPIRIT_FRAMES, PERSON_H * 4]);
        expect(inMaster(sheet, toneOf(season, weather)), `${season}/${weather}`).toBe(true);
      }
    });
  });
});

// ══ 도깨비 ════════════════════════════════════════════════════════

describe('도깨비의 도트(spec 8.4·F71 — 어수룩하고 친근하게)', () => {
  const frames = (['plain', 'glad'] as const).flatMap((pose) => [0, 1].map((f) => ({ pose, f, px: dokkaebiFrame(pose, f, SPRING) })));

  it('ㄱ 크기와 발치가 그림 점 단위: 72×104(사람 한 장보다 키가 크다), 발치 (36, 100), 발바닥이 발치 줄 바로 위', () => {
    expect([DOKKAEBI_W, DOKKAEBI_H, DOKKAEBI_AX, DOKKAEBI_AY]).toEqual([72, 104, 36, 100]);
    expect(DOKKAEBI_W % ART + DOKKAEBI_H % ART + DOKKAEBI_AX % ART + DOKKAEBI_AY % ART).toBe(0);
    expect(DOKKAEBI_H).toBeGreaterThan(PERSON_H);
    for (const { pose, f, px } of frames) {
      expect([px.w, px.h]).toEqual([DOKKAEBI_W, DOKKAEBI_H]);
      const b = px.bounds()!;
      expect(b.y1, `${pose} ${f}`).toBe(DOKKAEBI_AY); // 맨 아랫줄은 발바닥(발치 줄 바로 위) 밑의 (나) 테두리 — 방망이 끝도 땅에 닿는다
      // 몸의 키(머리 꼭대기 → 발바닥)가 사람 어른(48 그림 점)의 1.6배 넘게
      let top = DOKKAEBI_H;
      for (let y = 0; y < px.h && top === DOKKAEBI_H; y++) for (let x = 0; x < 56; x++) if (px.get(x, y) !== 0) top = y;
      expect(DOKKAEBI_AY - top, `${pose} ${f}`).toBeGreaterThan(48 * 1.6);
    }
  });

  it('ㅊ 숨쉬기 두 장이 다르고, 웃는 모습(glad)이 쉬는 모습과 다르다', () => {
    expect(same(frames[0].px, frames[1].px)).toBe(false);
    expect(same(frames[2].px, frames[3].px)).toBe(false);
    expect(same(frames[0].px, frames[2].px)).toBe(false);
  });

  it('뿔이 없다: 부품에 없고, 머리 위 둘레에 뾰족이 솟은 점이 없다(정수리는 둥근 머리털 — 뿔을 붙이면 잡히는지도 본다)', () => {
    for (const part of DOKKAEBI_PARTS) expect(part).not.toMatch(/horn|뿔|tiger|범|호랑|spike|못|iron|쇠|nail/i);
    const spikes = (px: Px): number => {
      // 머리털이 있는 줄(가운데 ±19)의 맨 윗점
      const x0 = DOKKAEBI_AX - 19;
      const x1 = DOKKAEBI_AX + 18;
      const top: number[] = [];
      for (let x = x0; x <= x1; x++) {
        let t = px.h;
        for (let y = 0; y < 40; y++) {
          if (px.get(x, y) !== 0) {
            t = y;
            break;
          }
        }
        top.push(t);
      }
      let worst = 0;
      for (let w = 1; w <= 6; w++) {
        for (let i = 1; i + w < top.length; i++) {
          const win = top.slice(i, i + w);
          const rise = Math.min(top[i - 1], top[i + w]) - Math.max(...win);
          worst = Math.max(worst, rise);
        }
      }
      return worst;
    };
    for (const { pose, f, px } of frames) expect(spikes(px), `${pose} ${f}`).toBeLessThan(3);
    // 시험이 헛돌지 않게: 정수리에 너비 3·높이 5 그림 점의 뿔을 붙이면 잡힌다
    const horned = frames[0].px.clone();
    const b = horned.bounds()!;
    for (let y = b.y0 - 5; y < b.y0; y++) for (let x = DOKKAEBI_AX - 9; x < DOKKAEBI_AX - 6; x++) horned.set(x, y, CLUB_WOOD[1]);
    expect(spikes(horned)).toBeGreaterThanOrEqual(3);
  });

  it('범(호랑이) 가죽 옷이 없다: 주황빛(색상각 15~35°, 채도 0.6 이상, 명도 0.55 이상) 점이 하나도 없다 — 주황·검정이 엇갈리는 줄무늬가 될 빛이 없다(짚 허리띠의 누런 금빛은 39°)', () => {
    for (const { pose, f, px } of frames) {
      let orange = 0;
      for (const c of px.d) {
        if (c === 0) continue;
        const r = redOf(c);
        const g = greenOf(c);
        const b = blueOf(c);
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        if (mx === mn || mx !== r) continue;
        const hue = (((g - b) / (mx - mn)) % 6) * 60;
        if (hue >= 15 && hue <= 35 && (mx - mn) / mx >= 0.6 && mx / 255 >= 0.55) orange++;
      }
      expect(orange, `${pose} ${f}`).toBe(0);
    }
  });

  it('쇠못 박힌 방망이가 아니다: 방망이는 나무 빛 단계(봄 벌의 wood)뿐이고 쇠 빛(돌·잿빛)이 없다', () => {
    const wood = new Set(CLUB_WOOD);
    for (const pose of ['plain', 'glad'] as const) {
      const club = dokkaebiClub(pose);
      expect(club.count(), pose).toBeGreaterThan(60);
      for (const c of colorsOf(club)) expect(wood.has(c), pose).toBe(true);
      // 다 그린 장에서도 방망이 자리는 나무 빛(벌에 맞춘 나무 단계)이거나 다른 부품(손)이다
      const full = dokkaebiFrame(pose, 0, SPRING);
      const woodSnapped = new Set([...CLUB_WOOD].map((c) => SPRING.nearest(c)));
      const iron = new Set([...paletteOf('spring').stone].map((c) => SPRING.nearest(c)));
      let woodN = 0;
      let ironN = 0;
      for (let i = 0; i < club.d.length; i++) {
        if (club.d[i] === 0) continue;
        if (woodSnapped.has(full.d[i])) woodN++;
        if (iron.has(full.d[i]) && !woodSnapped.has(full.d[i])) ironN++;
      }
      expect(woodN / club.count(), pose).toBeGreaterThan(0.75);
      expect(ironN, pose).toBe(0);
    }
  });

  it('ㄴ 테두리는 (나): 먹빛이 아니고 따뜻하다', () => {
    for (const { pose, f, px } of frames) {
      const edge = edgePixels(px);
      for (const c of edge) expect([INK, INK_SOFT], `${pose} ${f}`).not.toContain(c);
      expect(edge.filter((c) => redOf(c) >= blueOf(c)).length / edge.length, `${pose} ${f}`).toBeGreaterThan(0.97);
      expect(edge.filter((c) => luma(c) <= 0.2).length / edge.length, `${pose} ${f}`).toBeLessThanOrEqual(0.9);
    }
  });

  it('ㄹ·ㅁ·ㅇ: 외톨이 점 천 개당 25 이하, 대문 앞 흙길 0.3 이상·봄 풀밭 여섯 자리 평균 0.3 이상, 봄 벌 안', () => {
    let orphan = 0;
    let grass = 1;
    let path = 1;
    for (const { pose, f, px } of frames) {
      orphan = Math.max(orphan, harshOrphans(px));
      expect(harshOrphans(px), `${pose} ${f}`).toBeLessThanOrEqual(25);
      const g = onGrass(px);
      const p = onPath(px, DOKKAEBI_AX, DOKKAEBI_AY);
      grass = Math.min(grass, mean(g.each));
      path = Math.min(path, p);
      expect(mean(g.each), `${pose} ${f} 풀밭`).toBeGreaterThanOrEqual(0.3);
      for (const [i, v] of g.each.entries()) expect(v, `${pose} ${f} 풀밭 ${GRASS_SPOTS[i]}`).toBeGreaterThanOrEqual(g.elder[i] - 0.005);
      expect(p, `${pose} ${f} 흙길`).toBeGreaterThanOrEqual(0.3);
      expect(inMaster(px)).toBe(true);
    }
    note('도깨비 ㄹ(가장 큰 장)', orphan);
    note('도깨비 ㅁ 풀밭 여섯 자리 평균(가장 작은 장)', grass);
    note('도깨비 ㅁ 흙길(가장 작은 장)', path);
  });

  it('겨루기 자료와 이름이 맞는다: 도깨비 고비의 sprite가 dokkaebi, 굳은 논흙이 hardsoil', () => {
    const dok = foes.find((f) => f.id === 's1395-dokkaebi-bet');
    const soil = foes.find((f) => f.id === 's1395-hardsoil');
    expect(dok?.sprite).toBe('dokkaebi');
    expect(soil?.sprite).toBe('hardsoil');
  });
});

// ══ 굳은 논흙 ═════════════════════════════════════════════════════

describe('굳은 논흙(spec 4.5 — 사람 꼴이 아닌 상징)', () => {
  const stages = Array.from({ length: SOIL_STAGES + 1 }, (_, s) => soilFrame(s, SPRING));
  const breaks = Array.from({ length: SOIL_STAGES + 1 }, (_, s) => Array.from({ length: SOIL_BREAK_FRAMES }, (_, f) => soilBreak(s, f, SPRING)));

  it('ㄱ 96×64 그림 점, 발치 (48, 60) — 모든 장이 같은 크기', () => {
    expect([SOIL_W, SOIL_H, SOIL_AX, SOIL_AY]).toEqual([96, 64, 48, 60]);
    for (const px of [...stages, ...breaks.flat()]) expect([px.w, px.h]).toEqual([SOIL_W, SOIL_H]);
  });

  it('기운이 깎일수록 금이 는다: 단계(1 → 0)가 차례로 오르고, 짙은 금의 점이 단계마다 늘며, 0이면 다 풀린 흙(낮게 흩어진다)', () => {
    expect(soilStage(1)).toBe(0);
    expect(soilStage(0.99)).toBe(0);
    expect(soilStage(0.5)).toBe(2);
    expect(soilStage(0.01)).toBe(SOIL_STAGES - 1);
    expect(soilStage(0)).toBe(SOIL_STAGES);
    expect(soilStage(-1)).toBe(SOIL_STAGES);
    const dark = (px: Px): number => [...px.d].filter((c) => c !== 0 && luma(c) < 0.2).length;
    for (let s = 1; s < SOIL_STAGES; s++) expect(dark(stages[s]), `${s}`).toBeGreaterThan(dark(stages[s - 1]));
    // 다 풀린 흙은 흙덩이보다 낮다
    expect(stages[SOIL_STAGES].bounds()!.y0).toBeGreaterThan(stages[0].bounds()!.y0 + 15);
  });

  it('ㅊ 맞을 때 흙이 부서지는 석 장: 서로 다르고 쉬는 장과도 다르다 — 흙덩이 자체는 움직이지 않는다(흔들지 않는다)', () => {
    for (let s = 0; s <= SOIL_STAGES; s++) {
      const [a, b, c] = breaks[s];
      expect(same(a, b) || same(b, c) || same(a, c), `${s}`).toBe(false);
      for (const f of breaks[s]) expect(same(f, stages[s]), `${s}`).toBe(false);
      // 흙덩이의 아랫부분(튀는 조각이 지나가지 않는 줄)은 쉬는 장과 점 하나까지 같다
      for (const f of breaks[s]) {
        let diff = 0;
        for (let y = 32; y < SOIL_H; y++) for (let x = 0; x < SOIL_W; x++) if (f.get(x, y) !== stages[s].get(x, y)) diff++;
        expect(diff, `${s}`).toBe(0);
      }
    }
  });

  it('번쩍이지 않는다: 부서지는 장의 평균 밝기가 쉬는 장과 0.05 안', () => {
    const mean = (px: Px): number => {
      let sum = 0;
      let n = 0;
      for (const c of px.d) if (c !== 0) (sum += luma(c)), n++;
      return sum / n;
    };
    for (let s = 0; s <= SOIL_STAGES; s++) for (const f of breaks[s]) expect(Math.abs(mean(f) - mean(stages[s])), `${s}`).toBeLessThan(0.05);
  });

  it('눈·입이 없다: 부품에 없고, 얼굴 빛(먹빛 눈동자·흰자·입술)이 없고, 짙은 점의 무리는 금이다(눈처럼 둥근 짙은 덩이가 없다)', () => {
    for (const part of SOIL_PARTS) expect(part).not.toMatch(/eye|mouth|face|눈|입|얼굴/i);
    const face = new Set([hex('#2a2422'), hex('#f6f0df'), hex('#faf6ec'), hex('#b5564d')].map((c) => SPRING.nearest(c)));
    for (const px of [...stages, ...breaks.flat()]) {
      for (const c of colorsOf(px)) expect(face.has(c) && luma(c) < 0.2).toBe(false);
      // 짙은 점(밝기 0.2 아래)을 이은 무리마다: 넷 이상이면 길쭉하다(긴 변이 짧은 변의 2배 넘게)
      const { w, h } = px;
      const seen = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        if (seen[i] || px.d[i] === 0 || luma(px.d[i]) >= 0.2) continue;
        const stack = [i];
        seen[i] = 1;
        let n = 0;
        let x0 = w;
        let y0 = h;
        let x1 = -1;
        let y1 = -1;
        while (stack.length) {
          const k = stack.pop()!;
          n++;
          const x = k % w;
          const y = (k - x) / w;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
          for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1]) {
            if (q >= 0 && !seen[q] && px.d[q] !== 0 && luma(px.d[q]) < 0.2) {
              seen[q] = 1;
              stack.push(q);
            }
          }
        }
        // 눈처럼 둥글고 속이 찬 덩이(넷 이상, 긴 변이 짧은 변의 1.5배 안, 둘레 네모의 3/4 넘게 찼다)가 없다 — 금은 가늘고 길다
        const long = Math.max(x1 - x0, y1 - y0) + 1;
        const short = Math.min(x1 - x0, y1 - y0) + 1;
        const eyeLike = n >= 4 && long <= short * 1.5 && n >= 0.75 * (x1 - x0 + 1) * (y1 - y0 + 1);
        expect(eyeLike, `무리 ${x0},${y0} 넓이 ${n}`).toBe(false);
      }
    }
  });

  it('ㄴ 제 빛깔: 먹빛이 없고 가장자리가 거의 먹빛이 아니다(세운 것의 한도 — 한 장 0.75, 평균 0.35), ㄹ 25 이하, ㅇ 봄 벌 안', () => {
    let sum = 0;
    let worst = 0;
    const all = [...stages, ...breaks.flat()];
    for (const px of all) {
      for (const c of colorsOf(px)) expect([INK, INK_SOFT]).not.toContain(c);
      const edge = edgePixels(px);
      const v = edge.filter((c) => luma(c) <= 0.2).length / edge.length;
      sum += v;
      expect(v).toBeLessThanOrEqual(0.75);
      worst = Math.max(worst, harshOrphans(px));
      expect(harshOrphans(px)).toBeLessThanOrEqual(25);
      expect(inMaster(px)).toBe(true);
    }
    expect(sum / all.length).toBeLessThanOrEqual(0.35);
    note('굳은 논흙 ㄹ(가장 큰 장)', worst);
    note('굳은 논흙 ㄴ 가장자리 먹빛 몫(평균)', sum / all.length);
  });
});

// ══ 작은 그림 ═════════════════════════════════════════════════════

const CARDS = ['skill-bund', 'skill-carry', 'skill-reckon', 'skill-tithe', 'skill-soil', 'skill-call', 'skill-help', 'skill-provision', 'skill-sow', 'skill-wood'];
const OTHERS = ['relic-seed-sack', 'gear-hoe', 'gear-sickle', 'gear-flail', 'bare-hand'];
const KINDS = ['kind-power', 'kind-wisdom', 'kind-craft', 'kind-heart'];
const MOVES = ['crust', 'clod', 'riddle', 'ssireum', 'work'];
const WISPS = ['wisp-on', 'wisp-off'];

describe('작은 그림(카드 열·장비·유물·갈래·할 일·도깨비불 — 글자 없음)', () => {
  it('iconNames()가 이름을 모두 담는다(화면의 PixelArt와 같은 목록), 카드 열은 솜씨 카드 자료와 같고, 할 일은 고비 자료의 icon과 같다', () => {
    const names = iconNames();
    for (const n of [...CARDS, ...OTHERS, ...KINDS, ...MOVES, ...WISPS]) expect(names, n).toContain(n);
    expect(iconNamesView()).toEqual(names);
    expect([...skills.map((s) => s.id)].sort()).toEqual([...CARDS].sort());
    const icons = new Set(foes.flatMap((f) => f.moves.map((m) => m.icon)));
    expect([...icons].sort()).toEqual([...MOVES].sort());
    expect(iconPx('no-such-icon')).toBeNull();
  });

  it('크기: 카드·장비·유물은 32×32, 갈래·할 일·도깨비불은 24×24 안(갈래·도깨비불 16×16, 할 일 24×24) — 모두 정사각형, 빈 그림이 없다', () => {
    for (const n of iconNames()) {
      const px = iconPx(n)!;
      expect(px.w, n).toBe(px.h);
      expect(px.count(), n).toBeGreaterThan(px.w * px.h * 0.12);
      if ([...CARDS, ...OTHERS].includes(n)) expect(px.w, n).toBe(32);
      else expect(px.w, n).toBeLessThanOrEqual(24);
    }
    for (const n of [...KINDS, ...WISPS]) expect(iconPx(n)!.w, n).toBe(16);
    for (const n of MOVES) expect(iconPx(n)!.w, n).toBe(24);
    expect(iconGroup('kind-power')).toBe('kind');
  });

  it('갈래 넷은 꼴로도 갈린다: 빛깔을 지운 밝기만으로 서로 다르고(평균 차 0.08 넘게), 바깥 꼴(윤곽)이 서로 많이 다르다(겹침 0.75 아래)', () => {
    const lum = (px: Px): Float32Array => Float32Array.from(px.d, (c) => (c === 0 ? 0.92 : luma(c)));
    for (let i = 0; i < KINDS.length; i++) {
      for (let j = i + 1; j < KINDS.length; j++) {
        const a = iconPx(KINDS[i])!;
        const b = iconPx(KINDS[j])!;
        const la = lum(a);
        const lb = lum(b);
        let d = 0;
        let inter = 0;
        let union = 0;
        for (let k = 0; k < la.length; k++) {
          d += Math.abs(la[k] - lb[k]);
          const on = [a.d[k] !== 0, b.d[k] !== 0];
          if (on[0] && on[1]) inter++;
          if (on[0] || on[1]) union++;
        }
        const pair = `${KINDS[i]} · ${KINDS[j]}`;
        expect(d / la.length, pair).toBeGreaterThan(0.08);
        expect(inter / union, pair).toBeLessThan(0.75);
      }
    }
  });

  it('도깨비불의 켜진 불과 꺼진 자리는 꼴이 다르다: 켜진 불은 속이 찬 불꽃, 꺼진 자리는 가운데가 빈 고리', () => {
    const on = iconPx('wisp-on')!;
    const off = iconPx('wisp-off')!;
    expect(on.get(7, 11)).not.toBe(0);
    expect(off.get(7, 10)).toBe(0);
    expect(off.count()).toBeLessThan(on.count() * 0.7);
  });

  it('ㄴ 먹빛 테두리가 없다(가장자리의 밝기 0.2 이하 몫 — 한 장 0.75, 평균 0.35 이하), ㄹ 외톨이 점 천 개당 25 이하, ㅇ 봄 벌 안', () => {
    let sum = 0;
    let worst = 0;
    let worstName = '';
    for (const n of iconNames()) {
      const px = iconPx(n)!;
      for (const c of colorsOf(px)) expect([INK, INK_SOFT], n).not.toContain(c);
      const edge = edgePixels(px);
      const v = edge.filter((c) => luma(c) <= 0.2).length / edge.length;
      sum += v;
      expect(v, n).toBeLessThanOrEqual(0.75);
      const o = harshOrphans(px);
      if (o > worst) {
        worst = o;
        worstName = n;
      }
      expect(o, n).toBeLessThanOrEqual(25);
      expect(inMaster(px), n).toBe(true);
    }
    expect(sum / iconNames().length).toBeLessThanOrEqual(0.35);
    note(`작은 그림 ㄹ(가장 큰 것 — ${worstName})`, worst);
    note('작은 그림 ㄴ 가장자리 먹빛 몫(평균)', sum / iconNames().length);
  });

  it('PixelIcon의 배율: 그림 점 하나 = 기기 화소의 정수배(적어도 1), CSS size에 가장 가깝게', () => {
    expect(iconScale(32, 48, 2)).toBe(3);
    expect(iconScale(32, 32, 1)).toBe(1);
    expect(iconScale(16, 24, 1.5)).toBe(2);
    expect(iconScale(32, 8, 1)).toBe(1);
    expect(iconScale(24, 40, 3)).toBe(5);
  });
});

// ══ 맵의 동료 ═════════════════════════════════════════════════════

describe('맵의 동료(정령이 주인공 곁에 떠 다닌다 — 맵의 셈에 끼지 않는다)', () => {
  const who = { role: 'farmer', look: 'girl' } as const;

  /** 같은 판을 동료와 함께·없이 걸려 본다: 자판으로 걷기 + 누른 곳으로 걷기 */
  function walk(world: World): string[] {
    const log: string[] = [];
    const plan: [number, () => void][] = [
      [40, () => setKeys(world, 1, 0)],
      [40, () => setKeys(world, 0, 1)],
      [30, () => setKeys(world, -1, -1)],
      [1, () => setKeys(world, 0, 0)],
      [90, () => tapWorld(world, world.player.x + 120, world.player.y + 40)],
      [90, () => tapWorld(world, world.player.x - 80, world.player.y - 100)],
    ];
    for (const [n, act] of plan) {
      act();
      for (let i = 0; i < n; i++) {
        const ev = stepWorld(world, 1 / 30);
        log.push(`${world.player.x.toFixed(3)},${world.player.y.toFixed(3)},${world.player.dir},${world.player.act},${ev.map((e) => e.type).join('+')}`);
      }
    }
    return log;
  }

  it('동료를 세워도 주인공의 길·부딪힘·사건이 그대로이고 막힌 칸도 같다; 동료는 주인공을 따라 보는 쪽의 뒤·옆에 선다', () => {
    for (const season of ['spring', 'autumn'] as Season[]) {
      const map = neutigol(season);
      const a = createWorld(map, who, 'farmer-girl');
      const b = createWorld(map, who, 'farmer-girl');
      setCompanion(b, SPIRIT);
      const blockedBefore = b.grid.blocked.slice();
      expect(walk(b)).toEqual(walk(a));
      expect([...b.grid.blocked]).toEqual([...blockedBefore]);
      expect(b.actors.length).toBe(a.actors.length);
      // 오래 서 있으면 동료가 보는 쪽의 자리에 닿는다(사람 몸과 겹치지 않을 만큼 옆)
      setKeys(b, 0, 0);
      for (let i = 0; i < 120; i++) stepWorld(b, 1 / 30);
      const c = b.companion!;
      const spot = COMPANION_SPOT[b.player.dir];
      expect(Math.abs(c.x - (b.player.x + spot.x))).toBeLessThan(0.5);
      expect(Math.abs(c.y - (b.player.y + spot.y))).toBeLessThan(0.5);
      expect(c.dir).toBe(b.player.dir);
      expect(Math.abs(spot.x)).toBeGreaterThanOrEqual(12);
      setCompanion(b, null);
      expect(b.companion).toBeNull();
    }
  });

  it("companion: 'neuti'로 연 판에서 정령이 그려진다(그 자리의 점이 동료 없는 판과 다르고 잎빛 머리가 화면에 있다) — 동료를 주지 않은 판은 그대로", () => {
    withSoftCanvas(() => {
      const map = neutigol('spring');
      const draw = (companion?: string): { px: Px; world: World } => {
        const s = openSession({ key: `art41c-${companion ?? 'none'}`, map, who, hero: 'farmer-girl', companion });
        const world = s.world;
        world.view = { w: 300, h: 200 };
        world.glow = { morning: 0, dusk: 0 };
        world.cam = { x: world.player.x - 150, y: world.player.y - 110 };
        const scene = buildScene(map, s.atlas, world);
        scene.clouds = [];
        const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
        canvas.width = world.view.w * ART;
        canvas.height = world.view.h * ART;
        render({ ctx: canvas.getContext('2d') as CanvasRenderingContext2D, w: canvas.width, h: canvas.height, scale: ART }, world, scene);
        return { px: softPixels(canvas), world };
      };
      const plain = draw();
      expect(plain.world.companion ?? null).toBeNull();
      const withMate = draw(SPIRIT);
      const c = withMate.world.companion!;
      expect(c.sprite).toBe(SPIRIT);
      // 동료 자리(그림 점)의 네모 안에서 달라진 점과 잎빛 머리 점
      const cx = (c.x - withMate.world.cam.x) * ART;
      const cy = (c.y - withMate.world.cam.y) * ART;
      const hair = new Set(LEAF_HAIR.map((h) => SPRING.nearest(h)));
      let diff = 0;
      let leafy = 0;
      let outside = 0;
      for (let y = 0; y < plain.px.h; y++) {
        for (let x = 0; x < plain.px.w; x++) {
          const i = y * plain.px.w + x;
          if (plain.px.d[i] === withMate.px.d[i]) continue;
          const inside = x >= cx - PERSON_AX && x < cx + PERSON_W - PERSON_AX && y >= cy - PERSON_AY && y < cy + PERSON_H - PERSON_AY + 12;
          if (!inside) outside++;
          else {
            diff++;
            if (hair.has(withMate.px.d[i])) leafy++;
          }
        }
      }
      expect(diff).toBeGreaterThan(300);
      expect(leafy).toBeGreaterThan(40);
      // 동료 밖의 화면은 점 하나까지 같다
      expect(outside).toBe(0);
    });
  });

  it('미리 짓기에 정령을 넣으면(prepareMap의 사람 목록) 판을 열 때 이미 지어 있고, 넣지 않으면 판을 연 뒤 쉬는 틈의 맨 앞 일감이다', () => {
    withSoftCanvas(() => {
      const map = neutigol('summer');
      prepareMap(map, ['farmer-girl', SPIRIT], map.start.farmer);
      let calls = 0;
      while (!prepReady(map) && calls++ < 200_000) stepPrepare(4);
      expect(prepReady(map)).toBe(true);
      const s = openSession({ key: 'art41c-prep', map, who, hero: 'farmer-girl', companion: SPIRIT });
      expect(s.atlas.people.has(SPIRIT)).toBe(true);
      const map2 = neutigol('winter');
      prepareMap(map2, ['farmer-girl'], map2.start.farmer);
      calls = 0;
      while (!prepReady(map2) && calls++ < 200_000) stepPrepare(4);
      const s2 = openSession({ key: 'art41c-prep2', map: map2, who, hero: 'farmer-girl', companion: SPIRIT });
      expect(s2.atlas.people.has(SPIRIT)).toBe(false);
      for (const step of s2.later[0].steps) while (step() === true);
      expect(s2.atlas.people.has(SPIRIT)).toBe(true);
      // 사람 이름이 아니면 정령 시트를 짓지 않는다
      expect(personCanvas(s2.atlas, 'no-such-person')).toBeUndefined();
    });
  });

  it('ㅋ 무게: 정령 시트를 더해도 캔버스 넓이 합 80MB 이하, 한 장 1,600만 점 이하(계절마다 한 벌 + 땅 한 장)', () => {
    const made: { width: number; height: number }[] = [];
    vi.stubGlobal(
      'ImageData',
      class {
        constructor(
          readonly data: Uint8ClampedArray,
          readonly width: number,
          readonly height: number,
        ) {}
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
      let most = 0;
      for (const [season, weather] of [
        ['spring', 'clear'],
        ['summer', 'clear'],
        ['summer', 'rain'],
        ['autumn', 'clear'],
        ['winter', 'clear'],
      ] as [Season, Weather][]) {
        made.length = 0;
        const map = neutigol(season, weather);
        const atlas = buildAtlas(season, weather, needsOf(map, ['farmer-boy', 'farmer-girl', SPIRIT]));
        ensureBase(atlas);
        groundCanvas(atlas, map, shadesOf(atlas, map.objects));
        expect(atlas.people.has(SPIRIT)).toBe(true);
        const area = made.reduce((n, c) => n + c.width * c.height, 0);
        const biggest = Math.max(...made.map((c) => c.width * c.height));
        const mb = (area * 4) / 2 ** 20;
        most = Math.max(most, mb);
        expect(mb, `${season}/${weather}`).toBeLessThanOrEqual(80);
        expect(biggest, `${season}/${weather}`).toBeLessThanOrEqual(16_000_000);
      }
      note('ㅋ 캔버스 합(정령 시트 포함, 가장 큰 계절 MB)', most);
      note('ㅋ 정령 시트(MB)', (PERSON_W * SPIRIT_FRAMES * PERSON_H * 4 * 4) / 2 ** 20);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('(수치 기록) 그림 규칙의 값', () => {
    // eslint-disable-next-line no-console
    console.log('[art41c 수치]', JSON.stringify(METRICS, null, 1));
    expect(Object.keys(METRICS).length).toBeGreaterThan(0);
  });
});

// ── 도움 셈 ──────────────────────────────────────────────────────
function redOf(c: Color): number {
  return red(c);
}
function greenOf(c: Color): number {
  return green(c);
}
function blueOf(c: Color): number {
  return blue(c);
}
/** 반딧불 빛을 봄 벌에 맞춘 것 */
function SPRIT_GLOW_SNAPPED(): Color[] {
  return SPIRIT_GLOW.map((c) => SPRING.nearest(c));
}
