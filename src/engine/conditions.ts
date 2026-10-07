// 잠김과 결과 갈림 판정, 수치 바꾸기.

import {
  EFFECT_MAX,
  EFFECT_MIN,
  STATS,
  STAT_MAX,
  STAT_MIN,
  type Choice,
  type Condition,
  type Facts,
  type Outcome,
  type Scene,
  type StatDelta,
  type Stats,
} from './types';

/** 조건에 적힌 칸을 모두 채우면 참. 조건이 없으면 참. */
export function meets(cond: Condition | undefined, facts: Facts): boolean {
  if (!cond) return true;
  if (cond.roles && !cond.roles.includes(facts.role)) return false;
  for (const stat of STATS) {
    const min = cond.min?.[stat];
    if (min !== undefined && facts.stats[stat] < min) return false;
    const max = cond.max?.[stat];
    if (max !== undefined && facts.stats[stat] > max) return false;
  }
  if (cond.flags && !cond.flags.every((flag) => facts.flags.includes(flag))) return false;
  if (cond.notFlags && cond.notFlags.some((flag) => facts.flags.includes(flag))) return false;
  if (cond.draw !== undefined && cond.draw !== facts.draw) return false;
  return true;
}

export function isLocked(choice: Choice, facts: Facts): boolean {
  return choice.lock !== undefined && !meets(choice.lock.unless, facts);
}

/** 이 선택의 결과: variants 가운데 처음 맞는 것, 없으면 바탕 결과 */
export function resolveOutcome(choice: Choice, facts: Facts): Outcome {
  const variant = choice.variants?.find((v) => meets(v.when, facts));
  const from: Outcome = variant ?? choice;
  return {
    effects: from.effects,
    setFlags: from.setFlags,
    cards: from.cards,
    result: from.result,
  };
}

/** 이 장면에서 보여 줄 지문: textVariants 가운데 처음 맞는 것, 없으면 text */
export function sceneText(scene: Scene, facts: Facts): string {
  return scene.textVariants?.find((v) => meets(v.when, facts))?.text ?? scene.text;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
 * 수치를 바꾼다. 변화 하나는 -3~+3으로, 바뀐 수치는 0~10으로 묶는다.
 * requested = 다듬은 변화, delta = 실제로 바뀐 만큼.
 */
export function applyEffects(
  stats: Stats,
  effects: StatDelta | undefined,
): { after: Stats; requested: Stats; delta: Stats } {
  const after = { ...stats };
  const requested = zeroStats();
  const delta = zeroStats();
  for (const stat of STATS) {
    const raw = effects?.[stat] ?? 0;
    const change = clamp(Math.round(raw), EFFECT_MIN, EFFECT_MAX) + 0; // +0: -0을 0으로
    requested[stat] = change;
    after[stat] = clamp(stats[stat] + change, STAT_MIN, STAT_MAX);
    delta[stat] = after[stat] - stats[stat];
  }
  return { after, requested, delta };
}
