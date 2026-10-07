// 콘텐츠를 모으는 곳.
//
// 자료만 더하면 풀린다:
//  - situations/ 아래에 상황 폴더(예: s1446)를 더하고 index.ts에서 `situation`을 내보내면
//    고르기 화면의 "준비 중"이 풀린다.
//  - 상황 폴더 안에 장면 파일을 더하고 `scenes` 배열을 내보내면 그 장면이 판에 들어간다.
//    한 집의 내 장면이 네 계절 다 갖춰지면 그 집을 할 수 있게 된다.
// 엔진과 화면은 고치지 않는다.

import { playableRoles } from '../engine/game';
import type { CatalogEntry, RoleId, Scene, Situation, SituationPack } from '../engine/types';
import { cards } from './cards';
import { groups } from './groups';
import { places } from './labels';
import { catalog } from './situations/catalog';
import { sources } from './sources';
import { themes } from './themes';
import type { ContentBundle } from './validate';

const situationModules = import.meta.glob<{ situation?: Situation }>('./situations/*/index.ts', {
  eager: true,
});
const sceneModules = import.meta.glob<{ scenes?: Scene[] }>('./situations/*/*.ts', { eager: true });

/** './situations/s1395/world.ts' → 's1395' */
function folderOf(path: string): string {
  return path.split('/')[2] ?? '';
}

function buildPacks(): SituationPack[] {
  const out: SituationPack[] = [];
  for (const [path, mod] of Object.entries(situationModules)) {
    if (!mod.situation) continue;
    const folder = folderOf(path);
    const scenes = Object.keys(sceneModules)
      .filter((scenePath) => folderOf(scenePath) === folder && !scenePath.endsWith('/index.ts'))
      .sort()
      .flatMap((scenePath) => sceneModules[scenePath].scenes ?? []);
    out.push({ situation: mod.situation, scenes });
  }
  return out.sort((a, b) => a.situation.year - b.situation.year);
}

/** 장면 폴더가 있는 상황들, 연대순 */
export const packs: SituationPack[] = buildPacks();

export function getPack(id: string): SituationPack | undefined {
  return packs.find((pack) => pack.situation.id === id);
}

export interface ShelfItem extends CatalogEntry {
  /** 지금 고를 수 있는가(장면이 갖춰진 집이 하나라도 있는가) */
  ready: boolean;
  /** 지금 할 수 있는 집들 */
  playable: RoleId[];
}

/** 고르기 화면에 늘어놓을 일곱 상황. 준비되지 않은 것은 ready가 false다. */
export function shelf(): ShelfItem[] {
  return catalog.map((entry) => {
    const pack = getPack(entry.id);
    const playable = pack ? playableRoles(pack) : [];
    return { ...entry, ready: playable.length > 0, playable };
  });
}

/** 검사기에 넘길 묶음 */
export const bundle: ContentBundle = { packs, catalog, groups, themes, cards, sources, places };

export { cards, catalog, groups, places, sources, themes };
