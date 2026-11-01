// 일 놀이 「김매기」의 셈 — 화면을 모르는 순수 함수들이다(시험이 불러 쓴다).
// 볍씨를 논에 바로 뿌린 논이다(F04). 벼가 줄지어 서 있지 않고 흩어져 났고, 그 사이사이에 풀이 섞여 자랐다.
// 그래서 벼와 풀을 하나하나 가려 풀만 뽑아야 한다 — 손이 많이 간다는 것이 이 놀이의 내용이다.
// 풀은 누를 때만 뽑힌다(손가락으로 쓸고 지나가기만 해서는 뽑히지 않는다 — 하나하나 가려 뽑는 것이 내용이다).
// 끝난 모습을 가르는 것은 "풀을 얼마나 뽑았느냐"뿐이다. 벼를 건드려도 달라지는 것이 없다. 맞았다·틀렸다도, 점수도 없다.
// "어른께 맡긴다"를 눌러도 같은 셈으로 가린다 — 한 만큼은 버리지 않는다(weedLeave).
//
//   left   거의 뽑지 않았다(다섯 포기 아래 — 어른께 맡긴 것으로 본다)
//   clean  풀의 아홉 할 넘게 뽑았다(말끔히 맴)
//   rough  그 밖(풀이 남음)

export type WeedEnd = 'clean' | 'rough' | 'left';

/** 이만큼도 뽑지 않고 끝내면 어른께 맡긴 것으로 본다 */
export const WEED_FEW = 5;
/** 풀의 이만큼을 뽑았으면 말끔히 맨 것 */
export const WEED_CLEAN_SHARE = 0.9;

import { mulberry32 } from '../engine/rng';

export interface WeedRules {
  /** 벼 포기의 수 */
  rice: number;
  /** 풀의 수 */
  weeds: number;
}

/**
 * 규칙의 이름표마다의 논. 지금은 '1395'(논에 바로 뿌린 논 — 벼 백 포기 사이에 풀 마흔 포기가 섞여 있다) 하나다.
 * 풀의 수는 손가락으로 하나하나 눌러 뽑아 40~70초에 말끔해지도록 잡았다(서른여섯 포기를 누르면 "말끔히").
 * 뒤 이야기의 "줄 맞춰 옮겨 심은 논"(풀이 적고 줄 사이로 다닌다)은 그 이야기를 만들 때 더한다.
 */
export const WEED_RULES: Record<string, WeedRules> = {
  '1395': { rice: 100, weeds: 40 },
};

export function weedRulesOf(label: string): WeedRules {
  return WEED_RULES[label] ?? WEED_RULES['1395'];
}

export interface WeedPlant {
  /** 논 안의 자리(0~1, 0~1). 포기의 밑동이다. */
  x: number;
  y: number;
  /** 풀인가(아니면 벼) */
  weed: boolean;
  /** 생김새의 갈래(그림이 고른다) */
  look: number;
}

/** 논의 가로세로 비(자리 사이의 거리를 잴 때 쓴다. 화면마다 조금씩 다르지만 이쯤이다) */
const ASPECT = 2.4;

/**
 * 논 한 배미에 난 것들. 벼는 줄지어 서 있지 않다 — 아무 데나 흩어져 났고(서로 너무 붙지만 않는다) 풀이 그 사이에 섞여 있다.
 * 같은 이름표와 씨앗이면 언제나 같은 논이 나온다. 위에서 아래로(y가 작은 것부터) 늘어놓는다 — 그리는 차례다.
 */
export function weedPatch(label: string, seed = 1395): WeedPlant[] {
  const rules = weedRulesOf(label);
  const want = rules.rice + rules.weeds;
  const rnd = mulberry32(seed);
  const spots: { x: number; y: number }[] = [];
  // 서로 이만큼은 떨어진다(세로 길이를 1로 본 거리). 자리가 모자라면 조금씩 좁힌다.
  let apart = 0.088;
  let tries = 0;
  while (spots.length < want) {
    const x = 0.03 + rnd() * 0.94;
    const y = 0.1 + rnd() * 0.87;
    let ok = true;
    for (const s of spots) {
      const dx = (s.x - x) * ASPECT;
      const dy = s.y - y;
      if (dx * dx + dy * dy < apart * apart) {
        ok = false;
        break;
      }
    }
    if (ok) spots.push({ x, y });
    if (++tries % 4000 === 0) apart *= 0.94;
  }
  // 놓인 차례가 곧 아무렇게나 섞인 차례다: 앞에서부터 풀의 수만큼이 풀이다(풀이 논 전체에 고루 섞인다)
  const plants: WeedPlant[] = spots.map((s, i) => ({ x: s.x, y: s.y, weed: i < rules.weeds, look: Math.floor(rnd() * 6) }));
  return plants.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** 풀의 수 */
export function weedCount(plants: readonly WeedPlant[]): number {
  let n = 0;
  for (const p of plants) if (p.weed) n++;
  return n;
}

/**
 * (x, y) 둘레(가로 rx, 세로 ry의 둥글넓적한 손 닿는 곳)에서 가장 가까운, 아직 뽑지 않은 풀의 번호. 없으면 -1.
 * 벼는 세지 않는다 — 굵은 손가락으로 눌러도 가까운 풀이 뽑힌다.
 */
export function weedNear(plants: readonly WeedPlant[], gone: ArrayLike<number>, x: number, y: number, rx: number, ry: number): number {
  let best = -1;
  let bestD = 1;
  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    if (!p.weed || gone[i]) continue;
    const dx = (p.x - x) / rx;
    const dy = (p.y - y) / ry;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** (x, y)에서 가장 가까운, 아직 뽑지 않은 풀의 번호(멀어도 된다. 자판으로 다음 풀을 찾을 때 쓴다). 없으면 -1. */
export function weedNearest(plants: readonly WeedPlant[], gone: ArrayLike<number>, x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    if (!p.weed || gone[i]) continue;
    const dx = (p.x - x) * ASPECT;
    const dy = p.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** (x, y) 둘레에 있는 벼의 번호들(건드리면 잠깐 눕는다) */
export function riceNear(plants: readonly WeedPlant[], x: number, y: number, rx: number, ry: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    if (p.weed) continue;
    const dx = (p.x - x) / rx;
    const dy = (p.y - y) / ry;
    if (dx * dx + dy * dy <= 1) out.push(i);
  }
  return out;
}

/** 놀이가 끝난 모습: pulled는 뽑은 풀, total은 처음에 있던 풀 */
export function weedVerdict(pulled: number, total: number): WeedEnd {
  if (pulled < WEED_FEW || total <= 0) return 'left';
  return pulled / total >= WEED_CLEAN_SHARE ? 'clean' : 'rough';
}

/**
 * "어른께 맡긴다"를 눌렀을 때의 끝난 모습. 남은 것은 어른이 하지만, 내가 한 만큼은 버리지 않는다:
 * 거의 하지 않았으면 left, 조금이라도 했으면 rough, 다 해 놓고 눌렀으면 clean — 끝내기 단추와 같은 셈이다.
 */
export function weedLeave(pulled: number, total: number): WeedEnd {
  return weedVerdict(pulled, total);
}

export type Facing = 'up' | 'down' | 'left' | 'right';

/**
 * 자판으로 뽑을 때 손이 가는 자리: 내가 선 자리에서 바라보는 쪽으로 한 걸음(점 dx, dy만큼) 앞.
 * 논 안의 자리(0~1)로 돌려준다. fw, fh는 논의 너비·높이(점)다.
 */
export function aheadOf(x: number, y: number, facing: Facing, fw: number, fh: number, step = 9): [number, number] {
  const sx = step / Math.max(1, fw);
  const sy = step / Math.max(1, fh);
  if (facing === 'left') return [x - sx, y];
  if (facing === 'right') return [x + sx, y];
  if (facing === 'up') return [x, y - sy * 0.8];
  return [x, y + sy];
}
