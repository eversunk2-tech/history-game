// 씨앗을 받는 난수. 같은 씨앗이면 언제나 같은 수열이 나온다.
// Math.random이나 시계를 쓰지 않는다.

import type { DrawKind, RoleId } from './types';

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
 * 뽑기 표. 날씨는 가뭄 3 · 보통 5 · 풍년 2 (5절 5번, 가정).
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

/**
 * 태어날 집 뽑기. 패 넉 장에 집을 한 장씩 숨기고, 내가 뒤집은 패(pickedIndex)에는
 * 반드시 할 수 있는 집이 오게 한다. 돌려주는 것은 패 차례대로의 집이다.
 */
export function dealRoles(
  all: readonly RoleId[],
  playable: readonly RoleId[],
  seed: number,
  pickedIndex: number,
): RoleId[] {
  if (playable.length === 0) throw new Error('할 수 있는 집이 없다');
  if (pickedIndex < 0 || pickedIndex >= all.length) throw new Error('없는 패를 골랐다');
  const rng = mulberry32(subSeed(seed, 'role'));
  const dealt = shuffle(rng, all);
  if (!playable.includes(dealt[pickedIndex])) {
    const wanted = pickOne(rng, playable);
    const from = dealt.indexOf(wanted);
    [dealt[pickedIndex], dealt[from]] = [dealt[from], dealt[pickedIndex]];
  }
  return dealt;
}
