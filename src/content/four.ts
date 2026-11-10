// 4판의 자료 묶음(4-1 ㉡). 3판의 묶음(content/index.ts의 bundle — 지금 앱이 쓰는 것)은 그대로 두고, 4판 자료를 더한 묶음을 따로 만든다.
// ㉢(출전 고리)이 앱을 꼴 5와 에피소드로 바꿀 때 이 묶음을 content/index.ts로 합친다.
//
// 내보내는 것
//   four      4판 자료: 에피소드 표·고비·솜씨 카드·장비·꾸미기·유물·거점·문제(서당 은행 + 이야기 문제)
//   sources4  근거 목록 = 이야기의 근거(sources.ts) + 은행의 근거(bank/sources.ts — F86부터)
//   maps4     검사기가 보는 맵: 봄의 맵뿐 아니라 계절마다 맵의 모습(이야기의 때·날씨·큰물)을 모두 걸어 자리에 닿는지 본다(1-라 Review 43번)
//   bundle4   검사기(validateContent)에 넘길 묶음 = 3판 묶음 + 위의 셋

import { bundle, getMap } from './index';
import { bankQuestions, bankReadIssues, bankTopics } from './bank';
import { bankSources } from './bank/sources';
import { plan as s1395Plan } from './episodes/s1395';
import { s1395_1Lines } from './episodes/s1395-lines';
import { foes } from './foes';
import { gear } from './gear';
import { board, facilities, keepers, notices, seodangTalk, shopTalk, spirit } from './hub';
import { neutigol, type Stage } from './maps/neutigol';
import { outfits } from './outfits';
import { relics } from './relics';
import { storyQuestions, storyTopics } from './situations/s1395/questions';
import { skills } from './skills';
import { sources } from './sources';
import type { ContentBundle, MapRef } from './validate';
import type { Content4 } from './validate4';
import type { Look, RoleId, Season } from '../engine/types';
import { gridFor, reachFrom } from '../map/path';
import type { MapData, Weather } from '../map/types';

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

/**
 * 검사기가 보는 맵(3판의 것 + 계절의 모습마다 걷기). 계절의 모습마다 그 모습에 서는 막는 사람이 모두 칸을 막은 채로 걷는다
 * (판의 표시로 숨는 사람까지 막은 셈 — 실제 판보다 길이 좁거나 같다. 여기서 닿으면 실제 판에서도 닿는다).
 */
function mapRef4(base: MapRef): MapRef {
  const reach = new Map<string, Uint16Array>();
  return {
    ...base,
    canReachIn(spot: string, who: { role: RoleId; look: Look }, season: Season): string[] {
      const out: string[] = [];
      for (const { name, map } of seasonLooks(base.id, season)) {
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

export const maps4: MapRef[] = bundle.maps.map(mapRef4);

/** 검사기에 넘길 4판 묶음 */
export const bundle4: ContentBundle = { ...bundle, sources: sources4, maps: maps4, four };
