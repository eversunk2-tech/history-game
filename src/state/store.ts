// 화면 상태(signals)와 기기 저장. 규칙은 모두 engine에 있고, 여기서는 차례만 잇는다.
//
// 엔진은 약속이 깨지면 던진다(잠긴 것을 고름, 아직 할 수 없는 집, 한 해 돌아보기를 만들 수 없음 …).
// 던진 것이 화면까지 올라가면 빈 화면이 되므로, 여기서 모두 받아 '이어 갈 수 없어요' 화면(trouble)으로 보낸다.
// 한 해 돌아보기는 상태를 바꾸기 전에 먼저 만들어 본다.

import { computed, signal } from '@preact/signals';
import { getPack } from '../content';
import { advance, choose, lastTurn, newGame, playableRoles } from '../engine/game';
import { reviewYear, type YearReview } from '../engine/review';
import type { GameState, RoleId, Season, SituationPack } from '../engine/types';
import { SEASONS } from '../engine/types';
import type { Look } from '../map/types';
import { loadSaved, withCards, withPlay, writeSaved, type Saved } from './storage';

export type Screen =
  | 'title'
  | 'pick'
  | 'roleDraw'
  | 'intro'
  | 'play'
  | 'review'
  | 'trouble'
  // 바퀴 1-나: 맵 걸어 보기
  | 'walkPick'
  | 'walk'
  | 'sheet';

export const screen = signal<Screen>('title');
export const situationId = signal<string | null>(null);
export const game = signal<GameState | null>(null);
/** 이번 판의 씨앗. 집 뽑기와 날씨 뽑기가 여기서 나온다. */
export const seed = signal<number>(0);
export const saved = signal<Saved>(loadSaved());
/** "처음으로 돌아갈까요?"를 묻는 중인가 */
export const askingHome = signal(false);

export const pack = computed<SituationPack | null>(() =>
  situationId.value ? (getPack(situationId.value) ?? null) : null,
);

/** 한 해 돌아보기. 만들 수 없으면 null(화면은 '이어 갈 수 없어요'를 보여 준다). */
export const review = computed<YearReview | null>(() => {
  const p = pack.value;
  const g = game.value;
  if (!p || !g || g.phase !== 'done') return null;
  try {
    return reviewYear(p, g);
  } catch (error) {
    report(error);
    return null;
  }
});

// ── 씨앗 ────────────────────────────────────────────────────

/** 주소에 ?seed=숫자 를 붙이면 그 씨앗으로 판을 만든다(같은 판을 다시 보려고 둔 것). */
function seedFromUrl(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('seed');
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value >>> 0 : null;
  } catch {
    return null;
  }
}

function freshSeed(): number {
  return seedFromUrl() ?? (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

// ── 연달아 누르기 막기 ─────────────────────────────────────────
// 화면이 바뀐 바로 뒤 0.3초 동안은 누름을 받지 않는다.
// "다음"을 두 번 두드려 다음 장면의 선택지가 잘못 눌리는 일을 막는다.

const TAP_GAP_MS = 300;
let lastMove = 0;

function tooSoon(): boolean {
  const now = Date.now();
  if (now - lastMove < TAP_GAP_MS) return true;
  lastMove = now;
  return false;
}

function remember(next: Saved): void {
  if (next === saved.value) return;
  saved.value = next;
  writeSaved(next); // 못 써도 게임은 그대로 간다
}

// ── 이어 갈 수 없을 때 ─────────────────────────────────────────

function report(error: unknown): void {
  // 만드는 사람이 까닭을 볼 수 있게 콘솔에 남긴다. 학생에게는 화면의 쉬운 말만 보인다.
  console.error('[조선에서 한 해 살기] 이야기를 이어 갈 수 없다:', error);
}

/** 엔진이 던졌을 때: 빈 화면 대신 '이어 갈 수 없어요' 화면으로 간다. 거기서 처음으로 갈 수 있다. */
function fail(error: unknown): void {
  report(error);
  askingHome.value = false;
  screen.value = 'trouble';
}

// ── 움직임 ───────────────────────────────────────────────────

export function goPick(): void {
  if (tooSoon()) return;
  screen.value = 'pick';
}

export function pickSituation(id: string): void {
  const target = getPack(id);
  if (!target || playableRoles(target).length === 0) return; // 준비 중
  if (tooSoon()) return;
  situationId.value = id;
  game.value = null;
  seed.value = freshSeed();
  screen.value = 'roleDraw';
}

export function settleRole(role: RoleId): void {
  const p = pack.value;
  if (!p || !playableRoles(p).includes(role)) return; // 준비 중인 집
  if (tooSoon()) return;
  try {
    game.value = newGame(p, role, seed.value);
    screen.value = 'intro';
  } catch (error) {
    fail(error);
  }
}

export function beginYear(): void {
  if (!game.value) return;
  if (tooSoon()) return;
  screen.value = 'play';
}

export function chooseNow(choiceId: string): void {
  const p = pack.value;
  const g = game.value;
  if (!p || !g || g.phase !== 'scene') return;
  if (tooSoon()) return;
  try {
    const next = choose(p, g, choiceId);
    game.value = next;
    const turn = lastTurn(next);
    if (turn && turn.newCards.length > 0) remember(withCards(saved.value, turn.newCards));
  } catch (error) {
    fail(error);
  }
}

export function nextNow(): void {
  const p = pack.value;
  const g = game.value;
  if (!p || !g || g.phase === 'scene' || g.phase === 'done') return;
  if (tooSoon()) return;
  try {
    const next = advance(p, g);
    if (next.phase !== 'done') {
      game.value = next;
      return;
    }
    // 한 해가 끝났다. 돌아보기를 먼저 만들어 보고, 만들어지면 그때 상태를 바꾼다.
    const result = reviewYear(p, next);
    game.value = next;
    remember(
      withPlay(withCards(saved.value, next.cards), {
        situation: next.situationId,
        role: next.role,
        yearName: result.yearName.id,
      }),
    );
    screen.value = 'review';
  } catch (error) {
    fail(error);
  }
}

/** 같은 상황을 다시 한다(두 번째 판부터는 집을 골라도 된다). */
export function playAgain(): void {
  if (!pack.value) return;
  if (tooSoon()) return;
  game.value = null;
  seed.value = freshSeed();
  screen.value = 'roleDraw';
}

// ── 맵 걸어 보기(바퀴 1-나) ─────────────────────────────────────
// 규칙 엔진과는 아직 이어지지 않는다. 누가 될지 고르고 느티골을 걸어 다닌다.

export interface Walker {
  /** 주인공 그림의 이름 */
  hero: string;
  role: RoleId;
  look: Look;
  /** 고르는 화면에 보이는 이름 */
  label: string;
  lookLabel: string;
}

export const WALKERS: Walker[] = [
  { hero: 'farmer-boy', role: 'farmer', look: 'boy', label: '농민 집 아이', lookLabel: '남자아이 모습' },
  { hero: 'farmer-girl', role: 'farmer', look: 'girl', label: '농민 집 아이', lookLabel: '여자아이 모습' },
  { hero: 'son', role: 'son', look: 'boy', label: '양반 집 아들', lookLabel: '남자아이' },
  { hero: 'daughter', role: 'daughter', look: 'girl', label: '양반 집 딸', lookLabel: '여자아이' },
  { hero: 'nobi-boy', role: 'nobi', look: 'boy', label: '노비 집 아이', lookLabel: '남자아이 모습' },
  { hero: 'nobi-girl', role: 'nobi', look: 'girl', label: '노비 집 아이', lookLabel: '여자아이 모습' },
];

export const walker = signal<Walker | null>(null);
/** 그림 견본 화면과 맵의 계절(이번 바퀴의 맵은 봄만 제대로 만들었다) */
export const artSeason = signal<Season>('spring');

export function goWalkPick(): void {
  if (tooSoon()) return;
  screen.value = 'walkPick';
}

export function startWalk(hero: string): void {
  const found = WALKERS.find((w) => w.hero === hero);
  if (!found) return;
  if (tooSoon()) return;
  walker.value = found;
  screen.value = 'walk';
}

export function goSheet(): void {
  if (tooSoon()) return;
  screen.value = 'sheet';
}

/**
 * 주소로 바로 들어가기(만드는 사람이 화면을 찍어 볼 때 쓴다. 개발 서버에서만 먹는다).
 *   ?view=walk&who=farmer-girl   맵 걸어 보기
 *   ?view=sheet&season=autumn    그림 견본
 */
export function openFromUrl(): void {
  // 빌드본에서는 먹지 않는다(문을 건너뛰어 들어갈 수 있으므로)
  if (!import.meta.env.DEV) return;
  try {
    const q = new URLSearchParams(window.location.search);
    const view = q.get('view');
    const season = q.get('season') as Season | null;
    if (season && SEASONS.includes(season)) artSeason.value = season;
    if (view === 'sheet') screen.value = 'sheet';
    else if (view === 'pick') screen.value = 'walkPick';
    else if (view === 'walk') {
      const found = WALKERS.find((w) => w.hero === q.get('who')) ?? WALKERS[0];
      walker.value = found;
      screen.value = 'walk';
    }
  } catch {
    // 주소를 읽지 못하면 제목 화면에서 시작한다
  }
}

export function askHome(): void {
  askingHome.value = true;
}

export function cancelHome(): void {
  askingHome.value = false;
}

export function goHome(): void {
  askingHome.value = false;
  game.value = null;
  situationId.value = null;
  walker.value = null;
  screen.value = 'title';
  lastMove = Date.now();
}

export function backToTitle(): void {
  if (tooSoon()) return;
  goHome();
}
