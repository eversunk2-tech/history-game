// 곳의 이름: 무대(맵)의 이름과, 맵의 자리 이름.

import { getMap } from '../content';
import { roleOf } from '../engine/game';
import type { RoleId, SituationPack } from '../engine/types';

/** 무대(맵)의 이름. 이야기마다 무대가 다르다. */
const MAP_LABELS: Record<string, string> = { neutigol: '느티골' };

/** "1395년 느티골"처럼 해와 무대를 함께 */
export function yearAndPlace(pack: SituationPack, role: RoleId): string {
  let place = '';
  try {
    place = MAP_LABELS[roleOf(pack, role).map] ?? '';
  } catch {
    place = '';
  }
  return `${pack.situation.year}년${place ? ` ${place}` : ''}`;
}

/** 맵의 자리 이름("우리 논", "우물가" …). 모르면 null. */
export function spotLabel(pack: SituationPack, role: RoleId, spot: string | undefined): string | null {
  if (!spot) return null;
  try {
    return getMap(roleOf(pack, role).map)?.spots.find((s) => s.id === spot)?.label ?? null;
  } catch {
    return null;
  }
}
