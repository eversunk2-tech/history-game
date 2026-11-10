// 계절의 맵. 같은 맵이 계절(과 날씨, 이야기의 때)에 따라 다른 모습으로 지어진다.
// 자리의 이름과 칸, 처음 서는 칸, 맵의 크기는 계절이 바뀌어도 같다(저장이 칸을 적는다).

import type { Season } from '../../engine/types';
import type { MapData, Weather } from '../../map/types';
import { marks } from '../episodes/s1395';
import { neutigol, stageOf } from './neutigol';

/** 맵을 고르는 판의 형편: 판의 표시와, 큰비가 온 해인가 */
export interface MapCase {
  flags?: readonly string[];
  /** 큰비가 온 해인가(뽑힌 날씨가 'drought'). 여름에는 비가 오고, 가을에는 냇가 쪽 낮은 논의 벼가 성기다. */
  flood?: boolean;
}

const SEASONAL: Record<string, (season: Season, weather: Weather, flags: readonly string[], flood: boolean) => MapData> = {
  neutigol: (season, weather, flags, flood) => neutigol(season, weather, stageOf(season, flags, weather), flood),
};

/**
 * 이름으로 그 계절·날씨의 맵을 얻는다. 모르는 이름이면 undefined.
 * 판의 표시(flags)에 따라 가을과 큰비가 온 해의 여름은 때가 갈린다(없으면 장정들이 돌아온 뒤의 가을).
 * 표시의 이름은 ①의 에피소드 표의 이름표(marks)에서 읽는다(1-라 Review 43번).
 */
export function seasonalMap(id: string, season: Season, weather: Weather = 'clear', at: MapCase = {}): MapData | undefined {
  return SEASONAL[id]?.(season, weather, at.flags ?? [marks.leaveTend, marks.leaveBack], Boolean(at.flood));
}

/** 맵의 모습을 가르는 열쇠(같은 열쇠면 같은 맵이다). 맵 화면이 판을 새로 지을지 정할 때 쓴다. */
export function mapLook(id: string, season: Season, weather: Weather, at: MapCase = {}): string {
  const stage = id === 'neutigol' ? stageOf(season, at.flags ?? [], weather) : 'late';
  const flood = season === 'autumn' && Boolean(at.flood);
  return `${id}/${season}/${weather}/${stage}/${flood ? 'flood' : 'dry'}`;
}
