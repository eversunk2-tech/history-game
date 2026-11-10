// 보류한 3판 한 해 길(4-3에서 carries로 옮기며 지운다): 4-1 ㉢부터 앱(src/app·screens·state·ui)은 이 파일을 부르지 않는다. 엔진·자료 시험만 쓴다.
//   (한 해 돌아보기 화면 YearReview는 지웠다 — 4-3의 이야기 돌아보기 한 장이 이 셈을 이어받는다. spec 11.1 가)
// 한 해 돌아보기: 푼 미션, 수치의 흐름, 올해의 바람, 한 해 이름. 화면·브라우저·시간을 모른다.
// 3판에서는 겨울을 보낸 뒤 한 해 돌아보기 화면과 이야기책의 도장이 읽었다.

import { meets } from './conditions';
import { deedsOfSeason, factsOf, roleOf } from './game';
import { SEASONS, type Closing, type Deed, type Ending, type Facts, type GameState, type RoleDef, type RoleId, type Season, type Situation, type SituationPack, type Stats } from './types';

export interface SeasonSummary {
  season: Season;
  deeds: Deed[];
  closing?: Closing;
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
  solved: string[];
  wish: WishResult;
  yearName: { id: string; title: string; line: string };
  epilogue: string;
  cards: string[];
  draw: string | null;
}

/** 계절 하나를 간추린다 */
export function summarizeSeason(state: GameState, seasonIndex: number): SeasonSummary {
  const season = SEASONS[seasonIndex];
  return { season, deeds: deedsOfSeason(state, season), closing: state.closings.find((c) => c.season === season) };
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
    solved: state.solved,
    wish: judgeWish(roleOf(pack, state.role), facts),
    yearName: { id: ending.id, title: ending.title, line: ending.line },
    epilogue: pack.situation.epilogue,
    cards: state.cards,
    draw: state.draw,
  };
}
