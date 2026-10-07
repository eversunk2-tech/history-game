// 한 해 돌아보기: 계절마다 고른 일, 수치의 흐름, 올해의 바람, 한 해 이름, 뒷이야기.
// 견주어 보기와 일기 글감은 뒤 바퀴에서 이 파일에 더한다.

import { meets } from './conditions';
import { factsOf } from './game';
import {
  SCENES_PER_SEASON,
  SEASONS,
  STATS,
  type Ending,
  type Facts,
  type GameState,
  type RoleDef,
  type RoleId,
  type Season,
  type Situation,
  type SituationPack,
  type Stats,
  type Turn,
} from './types';

export interface SeasonSummary {
  season: Season;
  /** 그 계절에 고른 일(아직 다 고르지 않았으면 고른 것까지만) */
  turns: Turn[];
  start: Stats;
  end: Stats;
  delta: Stats;
}

export interface WishResult {
  text: string;
  fulfilled: boolean;
  reason: string;
}

export interface YearReview {
  situationId: string;
  role: RoleId;
  seasons: SeasonSummary[];
  /** 수치의 흐름: 처음 + 계절 넷 = 다섯 점 */
  flow: Stats[];
  final: Stats;
  wish: WishResult;
  yearName: { id: string; title: string; line: string };
  epilogue: string;
  cards: string[];
  draw: string | null;
}

/** 계절 하나를 간추린다. 계절 닫기 화면에서도 쓴다. */
export function summarizeSeason(state: GameState, seasonIndex: number): SeasonSummary {
  const season = SEASONS[seasonIndex];
  const turns = state.history.slice(
    seasonIndex * SCENES_PER_SEASON,
    (seasonIndex + 1) * SCENES_PER_SEASON,
  );
  const start = turns[0]?.before ?? state.flow[seasonIndex] ?? state.stats;
  const end = turns[turns.length - 1]?.after ?? start;
  const delta: Stats = { living: 0, body: 0, trust: 0 };
  for (const stat of STATS) delta[stat] = end[stat] - start[stat];
  return { season, turns, start, end, delta };
}

/** 한 해 이름: 위에서부터 처음 맞는 것. 맞는 것이 없으면 마지막 줄. */
export function pickEnding(situation: Situation, facts: Facts): Ending {
  const endings = situation.endings;
  if (endings.length === 0) throw new Error(`${situation.id}: 한 해 이름 목록이 비었다`);
  return endings.find((ending) => meets(ending.when, facts)) ?? endings[endings.length - 1];
}

/** 올해의 바람이 이루어졌는지와 그 까닭: 위에서부터 처음 맞는 것. */
export function judgeWish(roleDef: RoleDef, facts: Facts): WishResult {
  const rows = roleDef.wishOutcomes;
  if (rows.length === 0) throw new Error(`"${roleDef.label}": 바람을 가릴 줄이 없다`);
  const row = rows.find((r) => meets(r.when, facts)) ?? rows[rows.length - 1];
  return { text: roleDef.wish, fulfilled: row.fulfilled, reason: row.reason };
}

/** 판이 끝난 뒤 한 해를 돌아본다. */
export function reviewYear(pack: SituationPack, state: GameState): YearReview {
  if (state.phase !== 'done') throw new Error('한 해가 아직 끝나지 않았다');
  const facts = factsOf(state);
  const ending = pickEnding(pack.situation, facts);
  return {
    situationId: state.situationId,
    role: state.role,
    seasons: SEASONS.map((_, index) => summarizeSeason(state, index)),
    flow: state.flow,
    final: state.stats,
    wish: judgeWish(pack.situation.roles[state.role], facts),
    yearName: { id: ending.id, title: ending.title, line: ending.line },
    epilogue: pack.situation.epilogue,
    cards: state.cards,
    draw: state.draw,
  };
}
