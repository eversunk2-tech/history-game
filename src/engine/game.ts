// 한 해의 흐름: 맵을 돌아다니며 일(Happening)을 하고, 미션(Mission)을 풀고, 계절을 넘긴다.
// 모두 순수 함수다. 상태를 고치지 않고 새 상태를 돌려준다. 화면·브라우저·시간·맵의 좌표를 모른다.
//
// 한 계절: phase 'season'(맵) → 일을 하나씩 한다(doHappening) → 꼭 푸는 미션을 다 풀면 closeSeason
//          → phase 'seasonClose'(나중에 나타나는 결과가 붙는다) → nextSeason → 다음 계절(겨울 뒤에는 'done').
// 일 하나는 한 번에 끝난다(대화·선택·놀이를 화면이 모아서 넘긴다). 도중의 상태는 엔진에 없다.

import { applyEffects, isLocked, isShown, linesOf, meets, resolveOutcome, zeroStats } from './conditions';
import { rollDraw } from './rng';
import {
  EFFECT_MAX,
  EXTRA_EFFECT_MAX,
  SEASONS,
  STATS,
  TIRED_AT,
  type Choice,
  type Closing,
  type Deed,
  type Facts,
  type GameState,
  type Happening,
  type Line,
  type Look,
  type Mission,
  type RoleDef,
  type RoleId,
  type Season,
  type SituationPack,
  type Stats,
} from './types';

// ── 이야기의 것 찾기 ──────────────────────────────────────────

export function roleOf(pack: SituationPack, role: RoleId): RoleDef {
  const def = pack.situation.roles.find((r) => r.id === role);
  if (!def) throw new Error(`${pack.situation.id}: 없는 역할 "${role}"`);
  return def;
}

export function happeningOf(pack: SituationPack, id: string): Happening {
  const found = pack.happenings.find((h) => h.id === id);
  if (!found) throw new Error(`${pack.situation.id}: 없는 일 "${id}"`);
  return found;
}

/** 이 역할이 푸는 미션들(season을 주면 그 계절의 것과 한 해 내내의 것) */
export function missionsOf(pack: SituationPack, role: RoleId, season?: Season): Mission[] {
  return pack.missions.filter(
    (m) => (!m.roles || m.roles.includes(role)) && (season === undefined || m.season === season || m.season === 'year'),
  );
}

/**
 * 아직 풀리지 않은 미션을 어디까지 했는가: 푸는 조건이 표시(flags) 여럿이면 그 가운데 몇을 남겼는지 돌려준다.
 * (예: 이야기 셋을 모으는 덤 미션에서 하나를 들었으면 { have: 1, need: 3 }) 셀 수 없는 조건이면 null.
 */
export function missionProgress(mission: Mission, state: GameState): { have: number; need: number } | null {
  const flags = mission.done.flags;
  if (!flags || flags.length < 2) return null;
  return { have: flags.filter((flag) => state.flags.includes(flag)).length, need: flags.length };
}

/** 이 일이 속한 미션(이 역할의 것 가운데 처음) */
export function missionOfHappening(pack: SituationPack, role: RoleId, happeningId: string): Mission | undefined {
  return missionsOf(pack, role).find((m) => m.parts.includes(happeningId) || m.rescue === happeningId);
}

/** 그 계절에 이 역할이 꼭 푸는 미션이 만들어져 있는가(없으면 "다음에 만들어요") */
export function seasonReady(pack: SituationPack, role: RoleId, season: Season): boolean {
  return pack.missions.some((m) => m.must && m.season === season && (!m.roles || m.roles.includes(role)));
}

/** 지금 할 수 있는 역할들: 봄의 꼭 푸는 미션이 만들어진 역할 */
export function playableRoles(pack: SituationPack): RoleId[] {
  return pack.situation.roles.filter((r) => seasonReady(pack, r.id, 'spring')).map((r) => r.id);
}

// ── 판 ───────────────────────────────────────────────────────

export function factsOf(state: GameState): Facts {
  return { role: state.role, look: state.look, stats: state.stats, flags: state.flags, draw: state.draw, items: state.items };
}

export function currentSeason(state: GameState): Season {
  return SEASONS[Math.min(state.seasonIndex, SEASONS.length - 1)];
}

/** 이 계절의 해 ☀: 역할의 해에서, 기력이 2 이하이면 하나 준다(하나는 남는다) */
export function sunsFor(pack: SituationPack, role: RoleId, stats: Stats): number {
  const base = roleOf(pack, role).suns;
  return Math.max(1, stats.body <= TIRED_AT ? base - 1 : base);
}

export function newGame(pack: SituationPack, role: RoleId, look: Look, seed: number): GameState {
  const def = roleOf(pack, role);
  if (!playableRoles(pack).includes(role)) throw new Error(`"${def.label}"은(는) 아직 할 수 없다`);
  if (!def.looks.includes(look)) throw new Error(`"${def.label}"은(는) 그 모습이 될 수 없다`);
  const stats = { ...def.start };
  const { draw } = pack.situation;
  return {
    situationId: pack.situation.id,
    role,
    look,
    seed: seed >>> 0,
    stats,
    flags: [],
    cards: [],
    items: [],
    draw: draw.season === 'spring' ? rollDraw(draw.kind, seed) : null,
    seasonIndex: 0,
    phase: 'season',
    sunsLeft: sunsFor(pack, role, stats),
    done: [],
    solved: [],
    history: [],
    flow: [stats],
    closings: [],
    seen: [],
  };
}

// ── 지금 할 수 있는 일 ─────────────────────────────────────────

export interface ChoiceView {
  id: string;
  label: string;
  locked: boolean;
  /** 잠겼을 때 보여 줄 까닭 */
  reason?: string;
}

/** 이 일에서 이 사람에게 보이는 선택지들(숨긴 것은 빠지고, 잠긴 것은 까닭과 함께 남는다) */
export function choiceViews(pack: SituationPack, state: GameState, happeningId: string): ChoiceView[] {
  const facts = factsOf(state);
  return (happeningOf(pack, happeningId).choices ?? [])
    .filter((c) => isShown(c, facts))
    .map((c) => {
      const locked = isLocked(c, facts);
      return { id: c.id, label: c.label, locked, reason: locked ? c.lock?.reason : undefined };
    });
}

/** 선택지가 있는 일인데 열린 것이 하나도 없는가 */
function allLocked(pack: SituationPack, state: GameState, h: Happening): boolean {
  if (!h.choices || h.choices.length === 0) return false;
  const views = choiceViews(pack, state, h.id);
  return views.length === 0 || views.every((v) => v.locked);
}

function belongs(h: Happening, state: GameState): boolean {
  return h.situation === state.situationId && h.season === currentSeason(state) && (!h.roles || h.roles.includes(state.role));
}

export interface HappeningView {
  happening: Happening;
  /** 이 일이 속한 미션(덤으로 하는 일은 없다) */
  mission?: Mission;
  /** 꼭 푸는 미션의 일인가(맵에서 깃발) */
  must: boolean;
  /** 해 ☀가 모자라 지금은 할 수 없는가 */
  noSun: boolean;
}

/**
 * 지금 맵에 나타나는 일들: 이 계절·이 역할의 일 가운데 조건(shows)이 맞고 아직 하지 않은 것.
 * 미션이 막혔으면(남은 일의 선택지가 모두 잠겼거나 남은 일이 없으면) 도움의 일이 나타난다.
 */
export function openHappenings(pack: SituationPack, state: GameState): HappeningView[] {
  if (state.phase !== 'season') return [];
  const facts = factsOf(state);
  const rescues = new Set(pack.missions.map((m) => m.rescue).filter((id): id is string => Boolean(id)));
  const visible = (h: Happening): boolean => belongs(h, state) && !state.done.includes(h.id) && meets(h.shows, facts);
  const list = pack.happenings.filter((h) => !rescues.has(h.id) && visible(h));
  // 도움의 길
  for (const m of missionsOf(pack, state.role, currentSeason(state))) {
    if (!m.rescue || state.solved.includes(m.id) || state.done.includes(m.rescue)) continue;
    const parts = list.filter((h) => m.parts.includes(h.id));
    const stuck = parts.length === 0 || parts.every((h) => allLocked(pack, state, h));
    if (stuck) {
      const rescue = pack.happenings.find((h) => h.id === m.rescue);
      if (rescue && belongs(rescue, state)) list.push(rescue);
    }
  }
  return list.map((happening) => {
    const mission = missionOfHappening(pack, state.role, happening.id);
    return { happening, mission, must: Boolean(mission?.must), noSun: happening.cost > state.sunsLeft };
  });
}

export interface MissionView {
  mission: Mission;
  solved: boolean;
  /** 이 미션의 다음 일이 있는 맵의 자리(화살표가 가리킬 곳) */
  spot?: string;
}

/** 할 일 쪽지: 이 계절의 미션(꼭 푸는 것 먼저)과 푼 것 표시 */
export function missionViews(pack: SituationPack, state: GameState): MissionView[] {
  const open = openHappenings(pack, state);
  return missionsOf(pack, state.role, currentSeason(state))
    .slice()
    .sort((a, b) => Number(b.must) - Number(a.must))
    .map((mission) => {
      const next = open.find((v) => v.mission?.id === mission.id);
      return { mission, solved: state.solved.includes(mission.id), spot: next?.happening.spot };
    });
}

/** 이 계절의 꼭 푸는 미션 가운데 아직 풀지 못한 것 */
export function missingMusts(pack: SituationPack, state: GameState): Mission[] {
  return missionsOf(pack, state.role, currentSeason(state)).filter((m) => m.must && m.season !== 'year' && !state.solved.includes(m.id));
}

/** 꼭 푸는 미션을 다 풀었으면 언제든 계절을 보낼 수 있다 */
export function canCloseSeason(pack: SituationPack, state: GameState): boolean {
  return state.phase === 'season' && missingMusts(pack, state).length === 0;
}

// ── 일 하기 ──────────────────────────────────────────────────

export interface DoInput {
  id: string;
  /** 선택지가 있는 일이면 고른 것 */
  choiceId?: string;
  /** 일 놀이가 있는 일이면 끝난 모습(play.flags의 열쇠) */
  play?: string;
}

const unique = (list: readonly string[]): string[] => [...new Set(list)];

/**
 * 일 하나를 한다. 고른 선택지와 놀이의 끝난 모습을 받아 결과를 붙이고, 풀린 미션을 적는다.
 * 약속이 깨지면 던진다(지금 할 수 없는 일, 잠기거나 숨긴 선택지, 해가 없음).
 */
export function doHappening(pack: SituationPack, state: GameState, input: DoInput): GameState {
  if (state.phase !== 'season') throw new Error('지금은 일을 할 수 없다');
  const view = openHappenings(pack, state).find((v) => v.happening.id === input.id);
  if (!view) throw new Error(`지금은 할 수 없는 일이다: ${input.id}`);
  if (view.noSun) throw new Error(`해가 남아 있지 않다: ${input.id}`);
  const h = view.happening;
  const before = state.stats;
  let flags = state.flags.slice();

  // 1. 고르기
  let choice: Choice | undefined;
  if (h.choices && h.choices.length > 0) {
    choice = h.choices.find((c) => c.id === input.choiceId);
    if (!choice) throw new Error(`${h.id}: 없는 선택지 "${input.choiceId}"`);
    if (!isShown(choice, factsOf(state))) throw new Error(`${h.id}: 이 사람에게 보이지 않는 선택지 "${choice.id}"`);
    if (isLocked(choice, factsOf(state))) throw new Error(`${h.id}: 잠긴 선택지 "${choice.id}"`);
  }

  // 2. 일 놀이가 남기는 표시(결과의 갈림이 이것을 볼 수 있다)
  let played: string | undefined;
  if (h.play) {
    // 자료에 적힌 끝난 모습만 받는다('in'은 constructor 같은 물려받은 이름까지 참으로 보므로 쓰지 않는다)
    const ends = Object.keys(h.play.flags);
    const end = input.play !== undefined && ends.includes(input.play) ? input.play : ends[0];
    played = end;
    const flag = h.play.flags[end];
    if (flag) flags = unique([...flags, flag]);
  }

  // 3. 결과
  const facts: Facts = { ...factsOf(state), flags };
  const base = choice ?? h.after ?? { lines: [] as Line[] };
  const outcome = resolveOutcome(base, facts);
  const limit = h.cost === 0 ? EFFECT_MAX : EXTRA_EFFECT_MAX;
  const { after, requested, delta } = applyEffects(before, outcome.effects, limit);
  const newFlags = unique(outcome.setFlags ?? []).filter((f) => !flags.includes(f));
  flags = [...flags, ...newFlags];
  const newCards = unique(outcome.cards ?? []).filter((c) => !state.cards.includes(c));
  const newItems = unique(outcome.items ?? []).filter((i) => !state.items.includes(i));
  const done = [...state.done, h.id];

  // 4. 풀린 미션
  const next: GameState = {
    ...state,
    stats: after,
    flags,
    cards: [...state.cards, ...newCards],
    items: [...state.items, ...newItems],
    sunsLeft: state.sunsLeft - h.cost,
    done,
    goTo: outcome.goTo,
  };
  const nowFacts = factsOf(next);
  const solvedNow = missionsOf(pack, state.role)
    .filter((m) => !state.solved.includes(m.id) && meets(m.done, nowFacts))
    .map((m) => m.id);

  const deed: Deed = {
    happeningId: h.id,
    season: currentSeason(state),
    missionId: view.mission?.id,
    theme: h.theme,
    choiceId: choice?.id,
    label: choice?.label,
    play: played,
    lines: outcome.lines,
    note: outcome.note ?? h.note,
    requested,
    delta,
    before,
    after,
    newCards,
    newItems,
    newFlags: flags.filter((f) => !state.flags.includes(f)),
    solved: solvedNow,
    sun: h.cost,
    goTo: outcome.goTo,
  };
  return { ...next, solved: [...state.solved, ...solvedNow], history: [...state.history, deed] };
}

export function lastDeed(state: GameState): Deed | null {
  return state.history.length > 0 ? state.history[state.history.length - 1] : null;
}

/** 이 일에서 지금 고를 수 있는(열린) 선택지의 id. 선택지가 없는 일이면 빈 목록. */
export function openChoiceIds(pack: SituationPack, state: GameState, happeningId: string): string[] {
  return choiceViews(pack, state, happeningId)
    .filter((v) => !v.locked)
    .map((v) => v.id);
}

/** 이 일의 여는 대화(뽑기·앞선 선택에 따라 갈린다) */
export function openingLines(pack: SituationPack, state: GameState, happeningId: string): Line[] {
  return linesOf(happeningOf(pack, happeningId), factsOf(state));
}

/** 계절 첫 줄(뽑기·앞선 선택에 따라 갈린다) */
export function seasonLine(pack: SituationPack, state: GameState): string {
  const row = pack.situation.seasons[currentSeason(state)];
  return row.lineVariants?.find((v) => meets(v.when, factsOf(state)))?.line ?? row.line;
}

// ── 계절 넘기기 ───────────────────────────────────────────────

/**
 * 계절을 보낸다. 꼭 푸는 미션을 다 풀어야 한다.
 * 이때 "나중에 나타나는 결과"(앞선 선택과 뽑기가 만나는 것)가 붙는다.
 */
export function closeSeason(pack: SituationPack, state: GameState): GameState {
  if (state.phase !== 'season') throw new Error('지금은 계절을 보낼 수 없다');
  const missing = missingMusts(pack, state);
  if (missing.length > 0) throw new Error(`꼭 푸는 미션이 남았다: ${missing.map((m) => m.title).join(', ')}`);
  const season = currentSeason(state);
  const start = state.flow[state.seasonIndex] ?? state.stats;
  let stats = state.stats;
  let cards = state.cards;
  const lines: string[] = [];
  const newCards: string[] = [];
  const facts = factsOf(state);
  for (const later of pack.situation.later ?? []) {
    if (later.at !== season || !meets(later.when, facts)) continue;
    stats = applyEffects(stats, later.effects).after;
    lines.push(later.line);
    for (const card of later.cards ?? []) {
      if (!cards.includes(card)) {
        cards = [...cards, card];
        newCards.push(card);
      }
    }
  }
  const delta = zeroStats();
  for (const stat of STATS) delta[stat] = stats[stat] - start[stat];
  const closing: Closing = { season, delta, before: start, after: stats, lines, newCards };
  return {
    ...state,
    stats,
    cards,
    phase: 'seasonClose',
    flow: [...state.flow.slice(0, state.seasonIndex + 1), stats],
    closings: [...state.closings, closing],
    goTo: undefined,
  };
}

/** 다음 계절로 간다(뽑는 계절이면 뽑는다). 겨울을 보낸 뒤면 한 해가 끝난다. */
export function nextSeason(pack: SituationPack, state: GameState): GameState {
  if (state.phase !== 'seasonClose') throw new Error('계절을 먼저 보내야 한다');
  if (state.seasonIndex >= SEASONS.length - 1) return { ...state, phase: 'done' };
  const seasonIndex = state.seasonIndex + 1;
  const { draw } = pack.situation;
  return {
    ...state,
    seasonIndex,
    phase: 'season',
    draw: state.draw ?? (draw.season === SEASONS[seasonIndex] ? rollDraw(draw.kind, state.seed) : null),
    sunsLeft: sunsFor(pack, state.role, state.stats),
    at: undefined,
  };
}

/** 계절을 닫은 기록 가운데 마지막 */
export function lastClosing(state: GameState): Closing | null {
  return state.closings.length > 0 ? state.closings[state.closings.length - 1] : null;
}

/** 이 계절에 한 일들 */
export function deedsOfSeason(state: GameState, season: Season): Deed[] {
  return state.history.filter((d) => d.season === season);
}
