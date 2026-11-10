// 문제 창의 셈(화면이 없는 순수한 함수 — tests/quizView.test.ts가 부른다). 겨루기의 문제 창과 ㉣의 서당이 함께 쓴다.
// 화면·브라우저·시계를 모른다. 섞는 것은 씨앗으로만 한다(같은 씨앗이면 같은 차례).
//
// ── 쓰는 법 ──────────────────────────────────────────────
//   windowReady(q)            → 이 창이 낼 수 있는 문제인가(고르기·OX·순서·짝이고 자료가 갖추어졌나)
//   displayOrder(q, seed)     → 화면에 놓는 차례(원래 자리 번호의 배열): 고르기는 고를 것, 순서는 낱장, 짝은 오른쪽. OX는 [0, 1]
//   isRight(q, response)      → 아이의 답이 맞는가
//                               고르기 = 원래 자리 번호, OX = 0(O)|1(X), 순서 = 칸 1·2·3에 놓은 낱장의 원래 자리 번호 배열,
//                               짝 = 왼쪽 i마다 이은 오른쪽의 원래 자리 번호 배열
//   rightSequence(q)          → 맞는 차례(순서: 칸마다 놓일 낱장의 원래 자리 번호) — 틀렸을 때 "맞는 차례"를 보인다
//   rightPartners(q)          → 맞는 짝(짝: 왼쪽 i마다 이어질 오른쪽의 원래 자리 번호)
//   순서의 누름: emptySlots(n) · orderTap(칸, 낱장) · orderClear(칸, k) · slotOf(칸, 낱장) · slotsFull(칸)
//   짝의 누름:   emptyMatch(n) · matchTap(상태, 쪽, i) · leftOf(상태, 오른쪽) · matchFull(상태)

import { mulberry32, shuffle, subSeed } from '../engine/rng';
import type { Question } from '../engine/types4';

/** 이 창이 내는 꼴(지도에서 찍기는 ㉣) */
export const WINDOW_FORMS = ['pick', 'ox', 'order', 'match'] as const;
export type WindowForm = (typeof WINDOW_FORMS)[number];

/** 고를 것·칸·짝의 번호 딱지 */
export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'] as const;

type QuestionLike = Pick<Question, 'id' | 'form' | 'choices' | 'answer' | 'items' | 'pairs'>;

/** 0부터 n-1까지를 한 번씩 담은 배열인가 */
function isPermutation(list: unknown, n: number): list is number[] {
  if (!Array.isArray(list) || list.length !== n) return false;
  const seen = new Set<number>();
  for (const v of list) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/** 이 창이 낼 수 있는 문제인가: 꼴 넷 가운데 하나이고 그 꼴의 자료가 갖추어졌다(아니면 창은 "준비 중"을 보인다) */
export function windowReady(q: QuestionLike): boolean {
  switch (q.form) {
    case 'pick':
      return (
        Array.isArray(q.choices) &&
        q.choices.length >= 2 &&
        q.choices.length <= 4 &&
        typeof q.answer === 'number' &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < q.choices.length
      );
    case 'ox':
      return q.answer === 0 || q.answer === 1;
    case 'order':
      // 겨루기는 셋, 서당은 다섯까지(9.2)
      return Array.isArray(q.items) && q.items.length >= 2 && q.items.length <= 5 && isPermutation(q.answer, q.items.length);
    case 'match':
      // 겨루기는 두 쌍, 서당은 넷까지
      return Array.isArray(q.pairs) && q.pairs.length >= 2 && q.pairs.length <= 4 && isPermutation(q.answer, q.pairs.length);
    default:
      return false;
  }
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const sameList = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** 맞는 차례(순서): 칸 k에 놓일 낱장의 원래 자리 번호. items를 맞는 차례로 적으므로 보통 [0, 1, 2] */
export function rightSequence(q: QuestionLike): number[] {
  const n = q.items?.length ?? 0;
  return isPermutation(q.answer, n) ? q.answer.slice() : range(n);
}

/** 맞는 짝(짝): 왼쪽 i와 이어질 오른쪽의 원래 자리 번호. pairs를 맞는 짝으로 적으므로 보통 [0, 1] */
export function rightPartners(q: QuestionLike): number[] {
  const n = q.pairs?.length ?? 0;
  return isPermutation(q.answer, n) ? q.answer.slice() : range(n);
}

/**
 * 화면에 놓는 차례(원래 자리 번호의 배열). 같은 문제·같은 씨앗이면 언제나 같은 차례다(문제 id를 씨앗에 섞어 문제마다 따로 섞인다).
 * - 고르기: 고를 것을 고루 섞는다 — 답이 늘 같은 자리에 오지 않는다(답의 자리는 씨앗마다 고르게 퍼진다).
 *   틀린 문제를 다시 낼 때는 다른 씨앗을 주면 차례가 바뀐다.
 * - OX: [0, 1](O가 먼저 — 섞지 않는다)
 * - 순서: 낱장을 섞는다. 섞은 것이 맞는 차례와 같으면 다시 섞는다(다 맞게 놓인 채 시작하지 않게). 여러 번 섞어도 같으면 한 칸 돌린다.
 * - 짝: 오른쪽을 섞는다(왼쪽은 원래 차례)
 * 창이 낼 수 없는 문제면 빈 배열.
 */
export function displayOrder(q: QuestionLike, seed: number): number[] {
  if (!windowReady(q)) return [];
  const rng = mulberry32(subSeed(seed, `quiz-window:${q.form}:${q.id}`));
  switch (q.form) {
    case 'pick':
      return shuffle(rng, range(q.choices?.length ?? 0));
    case 'ox':
      return [0, 1];
    case 'order': {
      const right = rightSequence(q);
      let out = shuffle(rng, range(right.length));
      for (let tries = 0; tries < 8 && sameList(out, right); tries++) out = shuffle(rng, range(right.length));
      if (sameList(out, right)) out = [...out.slice(1), out[0]];
      return out;
    }
    case 'match':
      return shuffle(rng, range(q.pairs?.length ?? 0));
    default:
      return [];
  }
}

/** 아이의 답이 맞는가(꼴에 맞지 않는 답은 틀림) */
export function isRight(q: QuestionLike, response: number | readonly (number | null)[] | null | undefined): boolean {
  if (!windowReady(q) || response === null || response === undefined) return false;
  switch (q.form) {
    case 'pick':
    case 'ox':
      return typeof response === 'number' && response === q.answer;
    case 'order':
      return Array.isArray(response) && sameList(response as number[], rightSequence(q));
    case 'match':
      return Array.isArray(response) && sameList(response as number[], rightPartners(q));
    default:
      return false;
  }
}

// ── 순서 맞추기의 누름 ─────────────────────────────────────────
// 칸(slots)은 칸 1·2·3…마다 놓인 낱장의 원래 자리 번호(빈 칸은 null). 낱장을 누르면 첫 빈 칸에 놓이고,
// 놓인 낱장(이나 그 칸)을 다시 누르면 되돌아간다(뒤의 칸은 당겨지지 않고 빈 칸으로 남는다 — 다음 낱장이 그 칸에 놓인다).

export type Slots = readonly (number | null)[];

export function emptySlots(n: number): (number | null)[] {
  return Array.from({ length: Math.max(0, n) }, () => null);
}

/** 그 낱장이 놓인 칸(0부터). 놓이지 않았으면 -1 */
export function slotOf(slots: Slots, card: number): number {
  return slots.indexOf(card);
}

/** 낱장을 누름: 놓여 있으면 되돌리고, 아니면 첫 빈 칸에 놓는다(빈 칸이 없으면 그대로) */
export function orderTap(slots: Slots, card: number): (number | null)[] {
  const out = slots.slice();
  const at = out.indexOf(card);
  if (at >= 0) {
    out[at] = null;
    return out;
  }
  const empty = out.indexOf(null);
  if (empty >= 0) out[empty] = card;
  return out;
}

/** 칸을 누름: 그 칸의 낱장을 되돌린다 */
export function orderClear(slots: Slots, slot: number): (number | null)[] {
  const out = slots.slice();
  if (slot >= 0 && slot < out.length) out[slot] = null;
  return out;
}

/** 칸이 모두 찼나 */
export function slotsFull(slots: Slots): slots is readonly number[] {
  return slots.length > 0 && slots.every((v) => v !== null);
}

// ── 짝 맞추기의 누름 ──────────────────────────────────────────
// links[i]는 왼쪽 i와 이어진 오른쪽의 원래 자리 번호(없으면 null). pick은 먼저 누른 하나(아직 잇지 않은 것).
// - 고른 것을 다시 누르면 고름을 거둔다.
// - 한쪽을 고른 채 맞은쪽을 누르면 둘을 잇는다(둘 가운데 하나가 이미 다른 것과 이어져 있었으면 그 줄은 끊긴다).
// - 고른 것이 없을 때(또는 같은 쪽의 다른 것을 고른 채) 누르면 그것을 고른다. 이어져 있던 것이면 그 줄을 끊고 고른다
//   (다시 누르면 끊긴다 — 끊은 채 맞은쪽을 누르면 바로 새로 잇는다).
// 오른쪽을 먼저 눌러도 된다.

export type Side = 'left' | 'right';

export interface MatchState {
  links: readonly (number | null)[];
  pick: { side: Side; i: number } | null;
}

export function emptyMatch(n: number): MatchState {
  return { links: Array.from({ length: Math.max(0, n) }, () => null), pick: null };
}

/** 그 오른쪽과 이어진 왼쪽(0부터). 없으면 -1 */
export function leftOf(state: MatchState, right: number): number {
  return state.links.indexOf(right);
}

function linkedHere(state: MatchState, side: Side, i: number): boolean {
  return side === 'left' ? state.links[i] !== null && state.links[i] !== undefined : state.links.includes(i);
}

/** 쪽(side)의 i를 누름 */
export function matchTap(state: MatchState, side: Side, i: number): MatchState {
  const n = state.links.length;
  if (i < 0 || i >= n) return state;
  const { pick } = state;
  if (pick && pick.side === side && pick.i === i) return { links: state.links, pick: null };
  if (pick && pick.side !== side) {
    const left = side === 'left' ? i : pick.i;
    const right = side === 'right' ? i : pick.i;
    const links = state.links.map((v, k) => (k === left || v === right ? null : v));
    links[left] = right;
    return { links, pick: null };
  }
  if (linkedHere(state, side, i)) {
    const links = side === 'left' ? state.links.map((v, k) => (k === i ? null : v)) : state.links.map((v) => (v === i ? null : v));
    return { links, pick: { side, i } };
  }
  return { links: state.links, pick: { side, i } };
}

/** 모두 이었나 */
export function matchFull(state: MatchState): boolean {
  return state.links.length > 0 && state.links.every((v) => v !== null);
}
