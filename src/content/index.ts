// 콘텐츠 한 묶음. 이야기 하나가 폴더 하나다(src/content/situations/<이야기>/).
//   index.ts     — situation(이야기의 뼈대: 역할, 뽑기, 계절 첫 줄, 사람들 …)
//   missions.ts  — missions(미션들)
//   그 밖의 파일 — happenings(일들. 계절이나 역할마다 파일을 나눠도 된다)
//
// 4판 자료(4-1 ㉢에서 content/four.ts를 이 파일로 합쳤다 — spec 11.1 나, 9.6: 문제 은행도 게임 묶음에 든다)
//   four      4판 자료: 에피소드 표·고비·솜씨 카드·장비·꾸미기·유물·거점·문제(서당 은행 + 이야기 문제)
//   sources4  근거 목록 = 이야기의 근거(sources.ts) + 은행의 근거(bank/sources.ts — F86부터)
//   maps4     검사기가 보는 맵: 봄의 맵뿐 아니라 계절마다 맵의 모습(이야기의 때·날씨·큰물)을 모두 걸어 자리에 닿는지 본다(1-라 Review 43번)
//   mapRef4   maps4를 짓는 셈(맵 하나 + 모습을 짓는 셈 — 시험이 계절마다 다른 꾸민 모습을 넣어 본다)
//   bundle4   앱의 묶음 = 3판 묶음(bundle) + 위의 셋. 개발 판의 검사기(main.tsx)와 4판 시험이 본다

import { neutigol, type Stage } from './maps/neutigol';
import { bankQuestions, bankReadIssues, bankTopics } from './bank';
import { bankSources } from './bank/sources';
import { plan as s1395Plan } from './episodes/s1395';
import { s1395_1Lines } from './episodes/s1395-lines';
import { foes } from './foes';
import { gear } from './gear';
import { board, facilities, keepers, notices, seodangTalk, shopTalk, spirit } from './hub';
import { outfits } from './outfits';
import { relics } from './relics';
import { storyQuestions, storyTopics } from './situations/s1395/questions';
import { skills } from './skills';
import type { Content4 } from './validate4';
import type { Season } from '../engine/types';
import type { Weather } from '../map/types';
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

// ── 4판 자료(content/four.ts였던 것) ─────────────────────────────────

export const four: Content4 = {
  plans: [s1395Plan],
  foes,
  skills,
  gear,
  outfits,
  relics,
  topics: [...bankTopics, ...storyTopics],
  questions: [...bankQuestions, ...storyQuestions],
  facilities,
  keepers,
  board,
  texts: { spirit, notices, seodangTalk, shopTalk, s1395_1: s1395_1Lines },
  bankIssues: bankReadIssues,
};

/** 근거 목록(이야기 + 은행). 문제의 facts는 이 목록에서 찾는다 */
export const sources4 = [...sources, ...bankSources];

/** 그 계절에 맵이 지어질 수 있는 모습 모두(이야기의 때·날씨·큰물 — 맵 화면의 mapLook이 고르는 것) */
export function seasonLooks(id: string, season: Season): { name: string; map: MapData }[] {
  if (id !== 'neutigol') {
    const map = getMap(id);
    return map ? [{ name: `${id}/${season}`, map }] : [];
  }
  const out: { name: string; map: MapData }[] = [];
  const add = (weather: Weather, stage: Stage, flood: boolean) => out.push({ name: `${season}/${weather}/${stage}${flood ? '/큰물' : ''}`, map: neutigol(season, weather, stage, flood) });
  if (season === 'summer') {
    add('clear', 'late', false);
    add('rain', 'early', false);
    add('rain', 'late', false);
  } else if (season === 'autumn') {
    for (const flood of [false, true]) for (const stage of ['early', 'gone', 'late', 'done'] as const) add('clear', stage, flood);
  } else add('clear', 'late', false);
  return out;
}

/** 맵 id와 계절 → 그 계절에 맵이 지어질 수 있는 모습들(이름과 맵) */
export type LooksOf = (id: string, season: Season) => { name: string; map: MapData }[];

/**
 * 검사기가 보는 맵(3판의 것 + 계절의 모습마다 걷기). 계절의 모습마다 그 모습에 서는 막는 사람이 모두 칸을 막은 채로 걷는다
 * (판의 표시로 숨는 사람까지 막은 셈 — 실제 판보다 길이 좁거나 같다. 여기서 닿으면 실제 판에서도 닿는다).
 * looks는 모습을 짓는 셈이다(묶음은 seasonLooks). 시험이 계절마다 다른 꾸민 모습을 넣어, 그 계절의 모습을 걷는지 본다.
 */
export function mapRef4(base: MapRef, looks: LooksOf = seasonLooks): MapRef {
  const reach = new Map<string, Uint16Array>();
  return {
    ...base,
    canReachIn(spot: string, who: { role: RoleId; look: Look }, season: Season): string[] {
      const out: string[] = [];
      for (const { name, map } of looks(base.id, season)) {
        const target = map.spots.find((s) => s.id === spot);
        if (!target) {
          out.push(name);
          continue;
        }
        const key = `${name}|${who.role}/${who.look}`;
        let r = reach.get(key);
        if (!r) {
          const start = map.start[who.role] ?? Object.values(map.start)[0];
          r = reachFrom(gridFor(map, who), start[0], start[1]);
          reach.set(key, r);
        }
        if (r[target.stand[1] * map.w + target.stand[0]] === 0) out.push(name);
      }
      return out;
    },
  };
}

export const maps4: MapRef[] = bundle.maps.map((base) => mapRef4(base));

/**
 * 4판 묶음 = 3판 묶음 + 근거(이야기 + 은행) + 계절마다 걷는 맵 + 4판 자료. 앱이 쓰는 묶음이다(개발 판의 검사기가 이것을 본다 — main.tsx).
 * 3판 묶음(bundle)은 3판의 자료 시험이 그대로 본다.
 */
export const bundle4: ContentBundle = { ...bundle, sources: sources4, maps: maps4, four };
