// 한 판의 규칙: 새 판, 지금 장면, 고르기, 다음으로.
// 모든 함수는 상태를 고치지 않고 새 상태를 돌려준다.

import { applyEffects, clampStats, isLocked, resolveOutcome, sceneText } from './conditions';
import { rollDraw } from './rng';
import {
  ROLE_IDS,
  SCENES_PER_SEASON,
  SEASONS,
  type Facts,
  type GameState,
  type RoleId,
  type Scene,
  type Season,
  type SituationPack,
  type Turn,
} from './types';

// ── 장면의 차례 ──────────────────────────────────────────────

/** 이 집이 그 계절에 겪는 장면들(세상 장면 + 내 장면), order 차례 */
export function scenesOfSeason(pack: SituationPack, role: RoleId, season: Season): Scene[] {
  return pack.scenes
    .filter(
      (scene) =>
        scene.season === season &&
        (scene.kind === 'world' || (scene.kind === 'mine' && scene.role === role)),
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * 이 집으로 한 판을 끝까지(한 해 돌아보기까지) 하기에 모자란 것. 비어 있으면 할 수 있다.
 * 장면뿐 아니라 한 해 돌아보기를 만드는 데 꼭 있어야 하는 것도 본다:
 * 장면만 있고 바람을 가릴 줄이나 한 해 이름이 없으면 한 해 끝에서 멈추게 되므로, 그런 집은 "준비 중"으로 남긴다.
 */
export function roleProblems(pack: SituationPack, role: RoleId): string[] {
  const out: string[] = [];
  for (const season of SEASONS) {
    const list = scenesOfSeason(pack, role, season);
    const world = list.filter((scene) => scene.kind === 'world');
    const mine = list.filter((scene) => scene.kind === 'mine');
    if (world.length !== 1) out.push(`${season}: 세상 장면이 ${world.length}개`);
    if (mine.length !== 1) out.push(`${season}: 내 장면이 ${mine.length}개`);
    if (world.length === 1 && mine.length === 1 && world[0].order === mine[0].order) {
      out.push(`${season}: 두 장면의 차례(order)가 같다`);
    }
  }
  if ((pack.situation.roles[role]?.wishOutcomes ?? []).length === 0) {
    out.push('올해의 바람을 가릴 줄(wishOutcomes)이 없다');
  }
  if ((pack.situation.endings ?? []).length === 0) {
    out.push('한 해 이름(endings)이 하나도 없다');
  }
  return out;
}

export function isPlayable(pack: SituationPack, role: RoleId): boolean {
  return roleProblems(pack, role).length === 0;
}

/** 장면과 한 해 돌아보기에 쓸 것이 다 갖춰져 지금 할 수 있는 집들. 나머지는 "준비 중"으로 남는다. */
export function playableRoles(pack: SituationPack): RoleId[] {
  return ROLE_IDS.filter((role) => isPlayable(pack, role));
}

/** 한 판의 장면 8개, 겪는 차례대로 */
export function sequence(pack: SituationPack, role: RoleId): Scene[] {
  const problems = roleProblems(pack, role);
  if (problems.length > 0) {
    throw new Error(`${pack.situation.id}/${role}: 아직 할 수 없는 집이다 — ${problems.join(', ')}`);
  }
  return SEASONS.flatMap((season) => scenesOfSeason(pack, role, season));
}

// ── 새 판 ───────────────────────────────────────────────────

export function newGame(pack: SituationPack, role: RoleId, seed: number): GameState {
  sequence(pack, role); // 아직 할 수 없는 집이면 여기서 멈춘다
  const stats = clampStats(pack.situation.roles[role].start);
  const state: GameState = {
    situationId: pack.situation.id,
    role,
    seed: seed >>> 0,
    stats,
    flags: [],
    cards: [],
    draw: null,
    seasonIndex: 0,
    slot: 0,
    phase: 'seasonOpen',
    history: [],
    flow: [stats],
  };
  return enterSeason(pack, state);
}

/** 뽑는 계절에 들어서면 뽑기 결과를 정한다(씨앗으로 정해지므로 언제 뽑아도 같다). */
function enterSeason(pack: SituationPack, state: GameState): GameState {
  const { kind, season } = pack.situation.draw;
  if (kind === 'none' || state.draw !== null) return state;
  if (season !== SEASONS[state.seasonIndex]) return state;
  return { ...state, draw: rollDraw(kind, state.seed) };
}

// ── 지금 ────────────────────────────────────────────────────

export function factsOf(state: GameState): Facts {
  return { role: state.role, stats: state.stats, flags: state.flags, draw: state.draw };
}

export function currentSeason(state: GameState): Season {
  return SEASONS[Math.min(state.seasonIndex, SEASONS.length - 1)];
}

/** 지금 장면. 계절을 열거나 닫는 때, 판이 끝난 뒤에는 null. */
export function currentScene(pack: SituationPack, state: GameState): Scene | null {
  if (state.phase !== 'scene' && state.phase !== 'result') return null;
  return sequence(pack, state.role)[state.seasonIndex * SCENES_PER_SEASON + state.slot] ?? null;
}

/** 지금 장면의 지문(뽑기·앞선 선택에 따라 달라질 수 있다) */
export function currentText(pack: SituationPack, state: GameState): string {
  const scene = currentScene(pack, state);
  return scene ? sceneText(scene, factsOf(state)) : '';
}

export interface ChoiceView {
  id: string;
  label: string;
  locked: boolean;
  /** 잠겼을 때 보여 줄 까닭 */
  reason: string | null;
}

/** 지금 장면의 선택지. 잠긴 것도 숨기지 않고 까닭과 함께 돌려준다. */
export function choiceViews(pack: SituationPack, state: GameState): ChoiceView[] {
  const scene = currentScene(pack, state);
  if (!scene) return [];
  const facts = factsOf(state);
  return scene.choices.map((choice) => {
    const locked = isLocked(choice, facts);
    return { id: choice.id, label: choice.label, locked, reason: locked ? choice.lock!.reason : null };
  });
}

/** 방금 고른 일(결과 화면에서 쓴다) */
export function lastTurn(state: GameState): Turn | null {
  return state.history[state.history.length - 1] ?? null;
}

// ── 고르기와 다음으로 ─────────────────────────────────────────

export function choose(pack: SituationPack, state: GameState, choiceId: string): GameState {
  if (state.phase !== 'scene') throw new Error(`지금은 고를 때가 아니다(${state.phase})`);
  const scene = currentScene(pack, state);
  if (!scene) throw new Error('지금 장면이 없다');
  const choice = scene.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`${scene.id}: 없는 선택지 ${choiceId}`);
  const facts = factsOf(state);
  if (isLocked(choice, facts)) throw new Error(`${scene.id}/${choiceId}: 잠긴 선택지는 고를 수 없다`);

  const outcome = resolveOutcome(choice, facts);
  const { after, requested, delta } = applyEffects(state.stats, outcome.effects);
  const newFlags = unique(outcome.setFlags ?? []).filter((flag) => !state.flags.includes(flag));
  const newCards = unique(outcome.cards ?? []).filter((card) => !state.cards.includes(card));

  const turn: Turn = {
    sceneId: scene.id,
    season: scene.season,
    kind: scene.kind,
    theme: scene.theme,
    choiceId: choice.id,
    label: choice.label,
    result: outcome.result,
    note: scene.note,
    requested,
    delta,
    before: state.stats,
    after,
    newCards,
    newFlags,
  };

  return {
    ...state,
    stats: after,
    flags: [...state.flags, ...newFlags],
    cards: [...state.cards, ...newCards],
    history: [...state.history, turn],
    phase: 'result',
  };
}

/**
 * 다음으로 넘어간다.
 * 계절 열기 → 장면 → (고르기) → 결과 → 장면 → (고르기) → 결과 → 계절 닫기 → 다음 계절 열기 … → 끝
 * 수치가 0이어도 멈추지 않는다.
 */
export function advance(pack: SituationPack, state: GameState): GameState {
  switch (state.phase) {
    case 'seasonOpen':
      return { ...state, phase: 'scene', slot: 0 };
    case 'scene':
      throw new Error('먼저 하나를 골라야 한다');
    case 'result':
      if (state.slot < SCENES_PER_SEASON - 1) {
        return { ...state, phase: 'scene', slot: state.slot + 1 };
      }
      return { ...state, phase: 'seasonClose', flow: [...state.flow, state.stats] };
    case 'seasonClose':
      if (state.seasonIndex < SEASONS.length - 1) {
        return enterSeason(pack, {
          ...state,
          phase: 'seasonOpen',
          seasonIndex: state.seasonIndex + 1,
          slot: 0,
        });
      }
      return { ...state, phase: 'done' };
    case 'done':
      return state;
  }
}

/** 지금 고를 수 있는 선택지의 id들 */
export function openChoiceIds(pack: SituationPack, state: GameState): string[] {
  return choiceViews(pack, state)
    .filter((view) => !view.locked)
    .map((view) => view.id);
}

function unique<T>(list: readonly T[]): T[] {
  return [...new Set(list)];
}
