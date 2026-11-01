// 일 놀이 「가을걷이와 나라 몫」의 셈 — 화면을 모르는 순수 함수들이다(시험이 불러 쓴다).
// 두 마디로 이루어진다: ① 누렇게 익은 벼를 벤다 ② 거둔 것에서 나라 몫을 덜어 놓는다.
// 나라 몫은 거둔 것의 열에 하나쯤이었다(F58). 그래서 거둔 곡식을 자루 열로 보이고 그 가운데 하나를 나라 몫 자리로 옮긴다
// (대본의 "열 자루에서 한 자루를 나라 몫으로 덜어 놓았다"와 같은 그림이다).
// 큰비가 온 해(뽑기 'drought')에는 논 곳곳이 물에 잠겨 벨 벼가 적고, 나라가 그해에 낼 곡식을 받지 않았다(F55) — 나라 몫 자리가 빈다.
// 그해에 얼마나 적은지는 봄의 볍씨 선택에 따라 다르다(대본: 낮은 논에 몰아 뿌렸으면 "지난해의 반도 안 된다", 나눠 뿌렸으면 "높은 논의 벼는 남았다").
// 끝난 모습을 가르는 것은 "벼를 얼마나 벴느냐"뿐이다. 맞았다·틀렸다도, 점수도 없다.
//
// "어른께 맡긴다"를 눌러도 같은 셈으로 가리고(harvestLeave), 마당의 걸음(나라 몫이 덜려 나가는 것)은 어른이 하는 것으로 보인다.
//
//   left  거의 베지 않았다(여섯 포기 아래 — 어른께 맡긴 것으로 본다)
//   all   벼의 아홉 할 넘게 벴다(다 거둠)
//   some  그 밖(이삭을 남김)
//
// 큰비가 온 해에 자루가 열 자리 가운데 여섯(또는 넷)이라는 것은 "적다"를 그림으로 보이려고 꾸민 것이다(기록의 숫자가 아니다).

import { mulberry32 } from '../engine/rng';

export type HarvestEnd = 'all' | 'some' | 'left';

/** 이만큼도 베지 않고 끝내면 어른께 맡긴 것으로 본다 */
export const HARVEST_FEW = 6;
/** 벼의 이만큼을 벴으면 다 거둔 것 */
export const HARVEST_ALL_SHARE = 0.9;
/** 여느 해에 논 한 배미에 선 벼 포기 */
export const HARVEST_CLUMPS = 90;

export interface Clump {
  /** 논 안의 자리(0~1, 0~1). 포기의 밑동이다. */
  x: number;
  y: number;
  look: number;
}

/** 큰비에 물이 고여 벼가 쓰러진 자리(둥글넓적하다) */
export interface Pool {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface HarvestField {
  clumps: Clump[];
  pools: Pool[];
}

const ASPECT = 2.4;

/** 큰비가 온 해인가 */
export function isRainYear(draw: string | null): boolean {
  return draw === 'drought';
}

/** 큰비가 온 해에 물이 고인 자리 셋(벼 포기 열에 넷쯤이 이 안에 든다 — 곡식 자루가 열 자리 가운데 여섯인 것과 맞춘 것이다) */
const POOLS: Pool[] = [
  { x: 0.2, y: 0.34, rx: 0.155, ry: 0.25 },
  { x: 0.57, y: 0.74, rx: 0.185, ry: 0.215 },
  { x: 0.86, y: 0.3, rx: 0.11, ry: 0.23 },
];

/** 봄에 볍씨를 냇가 낮은 논에만 몰아 뿌렸으면 큰비에 잠긴 자리가 더 넓다(벼 포기 열에 여섯쯤이 든다 — 자루가 열 자리 가운데 넷) */
const POOLS_LOW: Pool[] = [
  { x: 0.2, y: 0.36, rx: 0.2, ry: 0.31 },
  { x: 0.57, y: 0.72, rx: 0.24, ry: 0.27 },
  { x: 0.86, y: 0.32, rx: 0.14, ry: 0.3 },
];

export function inPool(pools: readonly Pool[], x: number, y: number): boolean {
  for (const p of pools) {
    const dx = (x - p.x) / p.rx;
    const dy = (y - p.y) / p.ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

/**
 * 가을 논 한 배미. 벼는 줄지어 서 있지 않다(봄에 볍씨를 바로 뿌린 논이다).
 * 어느 해든 벼가 난 자리는 같고, 큰비가 온 해에는 물이 고인 자리의 벼가 빠진다 — 그만큼 벨 것이 적다.
 * lowOnly는 봄에 볍씨를 냇가 낮은 논에만 몰아 뿌렸는가이다(큰비가 온 해에만 뜻이 있다 — 잠긴 자리가 더 넓다).
 * 위에서 아래로(y가 작은 것부터) 늘어놓는다.
 */
export function harvestField(draw: string | null, lowOnly = false, seed = 1395): HarvestField {
  const rnd = mulberry32(seed);
  const spots: Clump[] = [];
  let apart = 0.115;
  let tries = 0;
  while (spots.length < HARVEST_CLUMPS) {
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
    if (ok) spots.push({ x, y, look: Math.floor(rnd() * 6) });
    if (++tries % 4000 === 0) apart *= 0.94;
  }
  const pools = isRainYear(draw) ? (lowOnly ? POOLS_LOW : POOLS) : [];
  const clumps = spots.filter((s) => !inPool(pools, s.x, s.y)).sort((a, b) => a.y - b.y || a.x - b.x);
  return { clumps, pools };
}

/** (x, y) 둘레(가로 rx, 세로 ry)에 있는, 아직 베지 않은 벼 포기의 번호들 */
export function clumpsNear(clumps: readonly Clump[], cut: ArrayLike<number>, x: number, y: number, rx: number, ry: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < clumps.length; i++) {
    if (cut[i]) continue;
    const dx = (clumps[i].x - x) / rx;
    const dy = (clumps[i].y - y) / ry;
    if (dx * dx + dy * dy <= 1) out.push(i);
  }
  return out;
}

/** 놀이가 끝난 모습: cut은 내가 벤 포기, total은 논에 서 있던 포기 */
export function harvestVerdict(cut: number, total: number): HarvestEnd {
  if (cut < HARVEST_FEW || total <= 0) return 'left';
  return cut / total >= HARVEST_ALL_SHARE ? 'all' : 'some';
}

/**
 * "어른께 맡긴다"를 눌렀을 때의 끝난 모습. 남은 벼는 식구들이 마저 베고 나라 몫도 어른이 덜어 놓지만,
 * 내가 벤 만큼은 버리지 않는다(끝내기 단추와 같은 셈 — 조금 벴으면 some, 다 벴으면 all, 거의 안 벴으면 left).
 */
export function harvestLeave(cut: number, total: number): HarvestEnd {
  return harvestVerdict(cut, total);
}

export interface HarvestYield {
  /** 여느 해에 곡식 자루가 놓이는 자리(열) */
  spots: number;
  /** 올해 거둔 곡식 자루 */
  sacks: number;
  /** 그 가운데 나라 몫으로 따로 놓는 자루 */
  nation: number;
  /** 나라가 그해에 낼 곡식을 받지 않았는가(큰비가 온 해) */
  eased: boolean;
}

/**
 * 거둔 것과 나라 몫. 여느 해(평소 같은 해, 비가 알맞게 온 해)에는 자루 열 가운데 하나가 나라 몫이다(F58의 "열에 하나쯤").
 * 큰비가 온 해에는 거둔 것이 적고(나눠 뿌렸으면 열 자리에 여섯, 낮은 논에만 몰아 뿌렸으면 넷 — "지난해의 반도 안 된다"),
 * 나라가 그해에 낼 곡식을 받지 않아 나라 몫 자리가 빈다(F55).
 */
export function harvestYield(draw: string | null, lowOnly = false): HarvestYield {
  if (isRainYear(draw)) return { spots: 10, sacks: lowOnly ? 4 : 6, nation: 0, eased: true };
  return { spots: 10, sacks: 10, nation: 1, eased: false };
}
