// 맵을 미리 짓기(spec 4.7.5의 ㅋ): 맵 화면이 열리기 전의 화면(제목 화면의 "이어 하기" 앞, 계절 닫기, 나를 소개합니다)이
// 떠 있는 동안, 다음에 열 맵의 그림 벌과 처음 보이는 땅을 쉬는 틈마다 조금씩 지어 둔다. 맵 화면이 열리면 지어 둔 것을 이어 쓴다.

import { getMap } from '../content';
import { seasonalMap } from '../content/maps';
import { currentSeason, roleOf, seasonReady } from '../engine/game';
import type { GameState, SituationPack } from '../engine/types';
import { prewarm } from '../map/session';
import type { MapData, Weather } from '../map/types';
import { heroName } from '../state/store';

function parseAt(at: string | undefined): [number, number] | undefined {
  if (!at) return undefined;
  const [x, y] = at.split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? [x, y] : undefined;
}

/** 그 판으로 맵 화면이 열 맵(맵 화면과 같은 셈 — 큰비가 온 해의 여름은 비, 가을은 낮은 논이 성기다) */
export function mapOfGame(p: SituationPack, g: GameState): MapData | undefined {
  const role = roleOf(p, g.role);
  const season = currentSeason(g);
  const flood = g.draw === 'drought';
  const sky: Weather = season === 'summer' && flood ? 'rain' : 'clear';
  return seasonalMap(role.map, season, sky, { flags: g.flags, flood }) ?? getMap(role.map);
}

/**
 * 그 판의 맵을 미리 짓기 시작한다(맵 화면에 들어설 판일 때만). 멈추는 함수를 돌려준다. 어떤 판이 와도 화면을 멈추게 하지 않는다.
 */
export function prewarmGame(p: SituationPack | null | undefined, g: GameState | null | undefined): () => void {
  try {
    if (!p || !g || g.phase !== 'season' || !seasonReady(p, g.role, currentSeason(g))) return () => undefined;
    const map = mapOfGame(p, g);
    if (!map) return () => undefined;
    return prewarm(map, [heroName(g.role, g.look)], parseAt(g.at) ?? map.start[g.role]);
  } catch {
    return () => undefined;
  }
}
