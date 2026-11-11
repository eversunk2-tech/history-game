// 씨앗을 받는 난수. 같은 씨앗이면 언제나 같은 수열이 나온다.
// Math.random이나 시계를 쓰지 않는다.

import type { DrawKind, Look, RoleDef, RoleId } from './types';

export type Rng = () => number;

/** 0 이상 1 미만의 수를 내는 난수(mulberry32) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 씨앗 하나에서 쓰임새(label)마다 다른 씨앗을 얻는다. 뽑기끼리 서로 얽히지 않게 한다. */
export function subSeed(seed: number, label: string): number {
  let h = (seed >>> 0) ^ 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 마지막에 한 번 더 섞는다
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function pickOne<T>(rng: Rng, list: readonly T[]): T {
  if (list.length === 0) throw new Error('빈 목록에서는 뽑을 수 없다');
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

export interface Weighted {
  id: string;
  weight: number;
}

export function pickWeighted<T extends Weighted>(rng: Rng, table: readonly T[]): T {
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  if (table.length === 0 || total <= 0) throw new Error('뽑기 표가 비었다');
  let roll = rng() * total;
  for (const row of table) {
    roll -= row.weight;
    if (roll < 0) return row;
  }
  return table[table.length - 1];
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 뽑기 표. 날씨는 궂은 해 3 · 평소 같은 해 5 · 비가 알맞게 온 해 2 (5.2의 4번, 가정).
 * 값의 이름은 1-가 그대로다(drought = 궂은 해, normal = 평소, bumper = 알맞음). 궂은 해가 어떤 해인지는 이야기가 정한다.
 * 전쟁 뽑기("군대가 지나가는가")는 3바퀴에서 더한다.
 */
export const DRAW_TABLES: Partial<Record<DrawKind, readonly Weighted[]>> = {
  weather: [
    { id: 'drought', weight: 3 },
    { id: 'normal', weight: 5 },
    { id: 'bumper', weight: 2 },
  ],
};

/** 그 종류의 뽑기에서 나올 수 있는 값들 */
export function drawValues(kind: DrawKind): string[] {
  return (DRAW_TABLES[kind] ?? []).map((row) => row.id);
}

/** 씨앗으로 뽑기 결과를 정한다. 표가 없는 종류는 null이다. */
export function rollDraw(kind: DrawKind, seed: number): string | null {
  const table = DRAW_TABLES[kind];
  if (!table) return null;
  return pickWeighted(mulberry32(subSeed(seed, `draw:${kind}`)), table).id;
}

/** 뽑힌 아이: 태어날 집과 모습 */
export interface Hero {
  role: RoleId;
  look: Look;
}

/** 아직 살아 보지 않은 (집, 모습)은 이만큼 더 잘 나온다(spec.md 3.1의 3번 — 사용자 결정 2026-11-11) */
export const UNLIVED_WEIGHT = 3;

/**
 * 태어날 집과 모습을 함께 뽑는다(spec.md 3.1). 화면·시계·Math.random을 모르는 순수한 셈이다.
 *   - 후보는 할 수 있는 집(playable — 봄의 꼭 할 일이 만들어진 집) × 그 집이 될 수 있는 모습.
 *   - 무게 = (1 ÷ 할 수 있는 집의 수) × (1 ÷ 그 집의 모습 수): 집이 고르게 나오고, 한 집 안에서 남녀가 고르게 나온다.
 *   - 아직 살아 보지 않은 (집, 모습)은 무게를 세 배로(lived: 이 이야기를 깬 기록의 집과 모습들). 살아 본 것도 나올 수 있다.
 *   - 난수는 subSeed(seed, 'hero') — 날씨 뽑기(draw:weather)와 얽히지 않는다. 같은 씨앗·같은 기록이면 언제나 같은 아이.
 * 집이 늘어나도(양반 집·노비 집, ② 이야기) 셈은 그대로 넓어진다.
 */
export function drawHero(roles: readonly Pick<RoleDef, 'id' | 'looks'>[], playable: readonly RoleId[], seed: number, lived: readonly Hero[]): Hero {
  const open = roles.filter((role) => playable.includes(role.id) && role.looks.length > 0);
  if (open.length === 0) throw new Error('할 수 있는 집이 없다');
  const table = open.flatMap((role) =>
    role.looks.map((look) => {
      const livedOnce = lived.some((one) => one.role === role.id && one.look === look);
      return { id: `${role.id}/${look}`, role: role.id, look, weight: (1 / open.length) * (1 / role.looks.length) * (livedOnce ? 1 : UNLIVED_WEIGHT) };
    }),
  );
  const hit = pickWeighted(mulberry32(subSeed(seed, 'hero')), table);
  return { role: hit.role, look: hit.look };
}

/**
 * 패 놓기(spec.md 3.2): 뒤집은 패(picked)에는 뽑힌 집(mine)이 오고, 나머지 패에는 다른 집들이 씨앗으로 섞인 차례로 놓인다.
 * 어느 패를 눌러도 나오는 아이는 drawHero가 정한 그 아이다 — 섞는 것은 패의 자리뿐이다.
 */
export function layCards(all: readonly RoleId[], mine: RoleId, seed: number, picked: number): RoleId[] {
  if (!all.includes(mine)) throw new Error('뽑힌 집이 패에 없다');
  if (picked < 0 || picked >= all.length) throw new Error('없는 패를 골랐다');
  const rest = shuffle(
    mulberry32(subSeed(seed, 'hero:cards')),
    all.filter((id) => id !== mine),
  );
  return all.map((_, index) => (index === picked ? mine : (rest.shift() as RoleId)));
}
