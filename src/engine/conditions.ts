// 조건과 잠김 판정, 결과 갈림, 수치 묶기. 화면·브라우저·시간을 모른다.

import {
  EFFECT_MAX,
  EFFECT_MIN,
  STATS,
  STAT_MAX,
  STAT_MIN,
  type Choice,
  type Condition,
  type Facts,
  type Happening,
  type Line,
  type Outcome,
  type StatDelta,
  type Stats,
} from './types';

/**
 * 조건이 맞는가. 적힌 칸을 모두 채워야 참이고, 아무것도 적지 않으면 언제나 참이다.
 * anyOf는 그 가운데 하나라도 참이면 된다("또는").
 */
export function meets(cond: Condition | undefined, facts: Facts): boolean {
  if (!cond) return true;
  if (cond.roles && !cond.roles.includes(facts.role)) return false;
  if (cond.look && cond.look !== facts.look) return false;
  if (cond.draw !== undefined && cond.draw !== facts.draw) return false;
  if (cond.min) for (const stat of STATS) if (cond.min[stat] !== undefined && facts.stats[stat] < (cond.min[stat] as number)) return false;
  if (cond.max) for (const stat of STATS) if (cond.max[stat] !== undefined && facts.stats[stat] > (cond.max[stat] as number)) return false;
  if (cond.flags && !cond.flags.every((flag) => facts.flags.includes(flag))) return false;
  if (cond.notFlags && cond.notFlags.some((flag) => facts.flags.includes(flag))) return false;
  if (cond.items && !cond.items.every((item) => facts.items.includes(item))) return false;
  if (cond.anyOf && cond.anyOf.length > 0 && !cond.anyOf.some((one) => meets(one, facts))) return false;
  return true;
}

/** 이 선택지가 이 사람에게 보이는가(그 사람의 삶에 아예 없는 일은 숨긴다) */
export function isShown(choice: Choice, facts: Facts): boolean {
  return !choice.only || choice.only.includes(facts.role);
}

/** 잠겼는가: lock.unless가 거짓이면 잠긴다 */
export function isLocked(choice: Choice, facts: Facts): boolean {
  return choice.lock ? !meets(choice.lock.unless, facts) : false;
}

/** 결과의 갈림: 위에서부터 when이 처음 맞는 것 하나가 바탕 결과를 통째로 갈음한다 */
export function resolveOutcome(base: Outcome & { variants?: (Outcome & { when: Condition })[] }, facts: Facts): Outcome {
  return base.variants?.find((variant) => meets(variant.when, facts)) ?? base;
}

/** 여는 대화: 갈림 가운데 처음 맞는 것, 없으면 바탕 */
export function linesOf(happening: Happening, facts: Facts): Line[] {
  return happening.lineVariants?.find((variant) => meets(variant.when, facts))?.lines ?? happening.lines;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clampStats(stats: Stats): Stats {
  return {
    living: clamp(Math.round(stats.living), STAT_MIN, STAT_MAX),
    body: clamp(Math.round(stats.body), STAT_MIN, STAT_MAX),
    trust: clamp(Math.round(stats.trust), STAT_MIN, STAT_MAX),
  };
}

export function zeroStats(): Stats {
  return { living: 0, body: 0, trust: 0 };
}

/**
 * 수치를 바꾼다. 변화 하나는 -limit~+limit으로(미션의 일은 3, 덤으로 하는 일은 1), 바뀐 수치는 0~10으로 묶는다.
 * requested = 다듬은 변화, delta = 실제로 바뀐 만큼.
 */
export function applyEffects(
  stats: Stats,
  effects: StatDelta | undefined,
  limit: number = EFFECT_MAX,
): { after: Stats; requested: Stats; delta: Stats } {
  const after = { ...stats };
  const requested = zeroStats();
  const delta = zeroStats();
  const lo = Math.max(EFFECT_MIN, -limit);
  const hi = Math.min(EFFECT_MAX, limit);
  for (const stat of STATS) {
    const raw = effects?.[stat] ?? 0;
    const change = clamp(Math.round(raw), lo, hi) + 0; // +0: -0을 0으로
    requested[stat] = change;
    after[stat] = clamp(stats[stat] + change, STAT_MIN, STAT_MAX);
    delta[stat] = after[stat] - stats[stat];
  }
  return { after, requested, delta };
}
