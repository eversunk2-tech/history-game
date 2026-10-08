// 콘텐츠 한 묶음. 이야기 하나가 폴더 하나다(src/content/situations/<이야기>/).
//   index.ts     — situation(이야기의 뼈대: 역할, 뽑기, 계절 첫 줄, 사람들 …)
//   missions.ts  — missions(미션들)
//   그 밖의 파일 — happenings(일들. 계절이나 역할마다 파일을 나눠도 된다)

import { neutigol } from './maps/neutigol';
import { playableRoles } from '../engine/game';
import type { CatalogEntry, Happening, Look, Mission, RoleId, Situation, SituationPack } from '../engine/types';
import { gridFor, reachFrom } from '../map/path';
import type { MapData } from '../map/types';
import { cards } from './cards';
import { groups } from './groups';
import { items } from './items';
import { places } from './labels';
import { catalog } from './situations/catalog';
import { sources } from './sources';
import { themes } from './themes';
import type { ContentBundle, MapRef } from './validate';

const situationModules = import.meta.glob<{ situation?: Situation }>('./situations/*/index.ts', { eager: true });
const partModules = import.meta.glob<{ missions?: Mission[]; happenings?: Happening[] }>('./situations/*/*.ts', { eager: true });

/** './situations/s1395/spring.ts' → 's1395' */
function folderOf(path: string): string {
  return path.split('/')[2] ?? '';
}

function buildPacks(): SituationPack[] {
  const out: SituationPack[] = [];
  for (const [path, mod] of Object.entries(situationModules)) {
    if (!mod.situation) continue;
    const folder = folderOf(path);
    const parts = Object.keys(partModules)
      .filter((p) => folderOf(p) === folder && !p.endsWith('/index.ts'))
      .sort()
      .map((p) => partModules[p]);
    out.push({
      situation: mod.situation,
      missions: parts.flatMap((m) => m.missions ?? []),
      happenings: parts.flatMap((m) => m.happenings ?? []),
    });
  }
  return out.sort((a, b) => a.situation.year - b.situation.year);
}

/** 폴더가 있는 이야기들, 연대순 */
export const packs: SituationPack[] = buildPacks();

export function getPack(id: string): SituationPack | undefined {
  return packs.find((pack) => pack.situation.id === id);
}

// ── 맵 ───────────────────────────────────────────────────────

const MAPS: Record<string, () => MapData> = { neutigol };

/** 이름으로 맵을 얻는다 */
export function getMap(id: string): MapData | undefined {
  return MAPS[id]?.();
}

/** 검사기가 보는 맵: 자리가 있는가, 이 사람이 걸어서 닿는가 */
function mapRef(id: string): MapRef {
  const reachOf = new Map<string, Uint16Array>();
  return {
    id,
    hasSpot: (spot) => Boolean(getMap(id)?.spots.some((s) => s.id === spot)),
    canReach: (spot, who: { role: RoleId; look: Look }) => {
      const map = getMap(id);
      const target = map?.spots.find((s) => s.id === spot);
      if (!map || !target) return false;
      const key = `${who.role}/${who.look}`;
      let reach = reachOf.get(key);
      if (!reach) {
        const start = map.start[who.role] ?? Object.values(map.start)[0];
        reach = reachFrom(gridFor(map, who), start[0], start[1]);
        reachOf.set(key, reach);
      }
      return reach[target.stand[1] * map.w + target.stand[0]] > 0;
    },
  };
}

export const maps: MapRef[] = Object.keys(MAPS).map(mapRef);

// ── 이야기책 ──────────────────────────────────────────────────

export interface ShelfItem extends CatalogEntry {
  /** 지금 할 수 있는가(만들어진 역할이 하나라도 있는가) */
  ready: boolean;
  /** 지금 할 수 있는 역할들 */
  playable: RoleId[];
}

/** 이야기책에 늘어놓을 일곱 이야기. 준비되지 않은 것은 ready가 false다. */
export function shelf(): ShelfItem[] {
  return catalog.map((entry) => {
    const pack = getPack(entry.id);
    const playable = pack ? playableRoles(pack) : [];
    return { ...entry, ready: playable.length > 0, playable };
  });
}

/** 검사기에 넘길 묶음 */
export const bundle: ContentBundle = { packs, catalog, groups, themes, cards, items, sources, places, maps };

export { cards, catalog, groups, items, places, sources, themes };
