// 문제 창의 몸 — 꼴 넷(고르기·OX·순서·짝)이 저마다 그리는 것. 누름의 문(TapGate)과 자판·초점은 QuizWindow.tsx가 맡고,
// 여기는 받은 상태를 그리고 누름을 위로 올리기만 한다.
//
// 지킬 것(spec 4.4·4.5): 본문 20px 이상, 누르는 것 56px 이상, 색만으로 뜻을 전하지 않음(맞는 답·고른 답·지운 것·이은 짝은 글과 번호로도 보인다).
// 누르는 것에는 data-nav를 붙인다(↑↓·←→로 오가는 차례 — QuizWindow.tsx).

import type { JSX } from 'preact';
import type { Question } from '../engine/types4';
import { CIRCLED, leftOf, rightPartners, rightSequence, slotOf, type MatchState, type Side, type Slots } from './logic';

type Tap = Event;

/** 답한 뒤의 모습(없으면 아직 묻는 중) */
export interface Answered {
  right: boolean;
  /** 아이의 답(고르기·OX는 원래 자리 번호, 순서·짝은 배열) */
  mine: number | number[];
}

// ── 표시 ──────────────────────────────────────────────

/** 맞았어요: 동그라미(부드럽게 커진다 — quiz.css) */
export function RightMark(): JSX.Element {
  return (
    <svg class="quiz-mark" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="4.5" />
    </svg>
  );
}

/** 아쉬워요: 모서리가 둥근 세모(붉은 X를 쓰지 않는다 — 8.1) */
export function SoftMark(): JSX.Element {
  return (
    <svg class="quiz-mark" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 8 Q22 8 23.2 10.2 L33 28 Q34.2 31 31 31 L9 31 Q5.8 31 7 28 L16.8 10.2 Q18 8 20 8 Z" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" />
    </svg>
  );
}

/** 정령의 귀띔 단추의 작은 등불 */
export function HintIcon(): JSX.Element {
  return (
    <svg class="icon quiz-hint-icon" viewBox="0 0 32 32" aria-hidden="true">
      <g stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M16 4 Q24.5 4 24.5 12.5 Q24.5 17 20.5 20 L20.5 23 L11.5 23 L11.5 20 Q7.5 17 7.5 12.5 Q7.5 4 16 4 Z" fill="#f2cf6b" />
        <path d="M12 27 H20" fill="none" />
      </g>
    </svg>
  );
}

function Tag({ kind, children }: { kind: 'answer' | 'mine' | 'gone' | 'good'; children: string }): JSX.Element {
  return <span class={`quiz-tag quiz-tag-${kind}`}>{children}</span>;
}

// ── 고르기 ────────────────────────────────────────────

export function PickBody({
  q,
  order,
  gone,
  done,
  onPick,
}: {
  q: Question;
  order: readonly number[];
  gone: ReadonlySet<number>;
  done: Answered | null;
  onPick: (i: number, ev: Tap) => void;
}): JSX.Element {
  const choices = q.choices ?? [];
  const firstOpen = order.find((i) => !gone.has(i));
  return (
    <>
      {order.map((i, k) => {
        const num = (
          <span class="quiz-num" aria-hidden="true">
            {CIRCLED[k]}
          </span>
        );
        const text = <span class="quiz-text">{choices[i]}</span>;
        if (!done && !gone.has(i)) {
          return (
            <button key={i} type="button" class="quiz-choice" data-nav data-first-tab={i === firstOpen ? true : undefined} onClick={(ev) => onPick(i, ev)}>
              {num}
              {text}
            </button>
          );
        }
        // 지운 것(귀띔)과 답한 뒤: 누를 수 없다
        const isAnswer = done !== null && i === q.answer;
        const isMine = done !== null && i === done.mine;
        const cls = ['quiz-choice', 'quiz-still', gone.has(i) && !isMine ? 'quiz-gone' : '', isAnswer ? 'quiz-answer' : '', isMine ? 'quiz-mine' : '', done && !isAnswer && !isMine ? 'quiz-other' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <div key={i} class={cls} aria-disabled="true">
            {num}
            {text}
            {isAnswer && isMine && <Tag kind="good">○ 내가 고른 답</Tag>}
            {isAnswer && !isMine && <Tag kind="answer">○ 맞는 답</Tag>}
            {isMine && !isAnswer && <Tag kind="mine">내가 고른 답</Tag>}
            {!isAnswer && !isMine && gone.has(i) && <Tag kind="gone">아니에요</Tag>}
          </div>
        );
      })}
    </>
  );
}

// ── OX ────────────────────────────────────────────────

const OX = [
  { mark: 'O', word: '맞아요' },
  { mark: 'X', word: '아니에요' },
] as const;

export function OxBody({ q, done, onPick }: { q: Question; done: Answered | null; onPick: (i: number, ev: Tap) => void }): JSX.Element {
  return (
    <div class="quiz-ox-row">
      {OX.map((one, i) => {
        const inner = (
          <>
            <span class="quiz-ox-mark" aria-hidden="true">
              {one.mark}
            </span>
            <span class="quiz-ox-word">{one.word}</span>
          </>
        );
        if (!done) {
          return (
            <button
              key={one.mark}
              type="button"
              class="quiz-choice quiz-ox"
              data-nav
              data-first-tab={i === 0 ? true : undefined}
              aria-label={`${one.mark}, ${one.word}`}
              onClick={(ev) => onPick(i, ev)}
            >
              {inner}
            </button>
          );
        }
        const isAnswer = i === q.answer;
        const isMine = i === done.mine;
        const cls = ['quiz-choice', 'quiz-ox', 'quiz-still', isAnswer ? 'quiz-answer' : '', isMine ? 'quiz-mine' : '', !isAnswer && !isMine ? 'quiz-other' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <div key={one.mark} class={cls} aria-disabled="true">
            {inner}
            {isAnswer && isMine && <Tag kind="good">○ 내가 고른 답</Tag>}
            {isAnswer && !isMine && <Tag kind="answer">○ 맞는 답</Tag>}
            {isMine && !isAnswer && <Tag kind="mine">내가 고른 답</Tag>}
          </div>
        );
      })}
    </div>
  );
}

// ── 순서 맞추기 ────────────────────────────────────────
// 왼쪽: 섞인 낱장(누르면 첫 빈 칸에 놓인다. 놓인 낱장은 흐린 점선과 "n번 칸" 딱지 — 다시 누르면 되돌아간다).
// 오른쪽: 칸 1·2·3(먼저 → 나중). 찬 칸을 눌러도 되돌아간다. 끌기(드래그)는 쓰지 않는다.
// 답한 뒤: 오른쪽은 내가 놓은 차례(자리가 맞은 칸에 ○), 틀렸으면 왼쪽이 "맞는 차례"가 된다.

export function OrderBody({
  q,
  order,
  slots,
  done,
  onCard,
  onSlot,
}: {
  q: Question;
  order: readonly number[];
  slots: Slots;
  done: Answered | null;
  onCard: (card: number, ev: Tap) => void;
  onSlot: (slot: number, ev: Tap) => void;
}): JSX.Element {
  const items = q.items ?? [];
  const right = rightSequence(q);
  const last = slots.length - 1;
  const when = (k: number): string => (k === 0 ? '먼저' : k === last ? '나중' : '');
  const mine = done && Array.isArray(done.mine) ? done.mine : null;
  const shown: readonly (number | null)[] = mine ?? slots;

  const pool = !done ? (
    <div class="quiz-col">
      <p class="quiz-col-head">낱장</p>
      {order.map((card, k) => {
        const at = slotOf(slots, card);
        return (
          <button
            key={card}
            type="button"
            class={`quiz-card${at >= 0 ? ' quiz-placed' : ''}`}
            data-nav
            data-card={card}
            data-first-tab={k === 0 ? true : undefined}
            aria-label={at >= 0 ? `${items[card]} — ${at + 1}번 칸에 놓았어요. 누르면 되돌아가요.` : items[card]}
            onClick={(ev) => onCard(card, ev)}
          >
            <span class="quiz-text">{items[card]}</span>
            {at >= 0 && (
              <span class="quiz-tag quiz-tag-mine" aria-hidden="true">
                {at + 1}번 칸
              </span>
            )}
          </button>
        );
      })}
    </div>
  ) : !done.right ? (
    <div class="quiz-col">
      <p class="quiz-col-head">맞는 차례</p>
      {right.map((card, k) => (
        <div key={card} class="quiz-slot quiz-still quiz-answer">
          <span class="quiz-slot-num" aria-hidden="true">
            {k + 1}
          </span>
          <span class="quiz-text">{items[card]}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div class={`quiz-two${pool ? '' : ' quiz-one'}`}>
      {pool}
      <div class="quiz-col">
        <p class="quiz-col-head">{done ? '내가 놓은 차례' : '놓은 차례'}</p>
        {shown.map((card, k) => {
          const num = (
            <span class="quiz-slot-num" aria-hidden="true">
              {k + 1}
            </span>
          );
          if (card === null) {
            return (
              <div key={`empty-${k}`} class="quiz-slot quiz-empty" aria-label={`${k + 1}번 칸: 비었어요`}>
                {num}
                <span class="quiz-slot-when">{when(k)}</span>
              </div>
            );
          }
          if (!done) {
            return (
              <button key={`slot-${k}`} type="button" class="quiz-slot quiz-filled" data-nav aria-label={`${k + 1}번 칸: ${items[card]}. 누르면 되돌아가요.`} onClick={(ev) => onSlot(k, ev)}>
                {num}
                <span class="quiz-text">{items[card]}</span>
                <span class="quiz-undo" aria-hidden="true">
                  ↩
                </span>
              </button>
            );
          }
          const good = card === right[k];
          return (
            <div key={`mine-${k}`} class={`quiz-slot quiz-still${good ? ' quiz-good' : ' quiz-off'}`}>
              {num}
              <span class="quiz-text">{items[card]}</span>
              {good && <Tag kind="good">○</Tag>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 짝 맞추기 ─────────────────────────────────────────
// 왼쪽은 원래 차례, 오른쪽은 섞인 차례. 왼쪽 하나와 오른쪽 하나를 누르면 이어진다 — 이어진 둘은 같은 번호 딱지(①·②, 왼쪽의 번호).
// 먼저 누른 것은 굵은 겹테와 "고름" 딱지. 이어진 것을 다시 누르면 끊는다.
// 답한 뒤에는 맞는 짝을 줄마다 나란히 보인다(맞게 이은 줄에 ○ — 두 쌍이면 틀렸을 때 둘 다 바뀐 것이다).

function Badge({ n, picked }: { n: number; picked: boolean }): JSX.Element {
  // 이어진 것: 먹빛 동그라미 안의 번호(①·②의 꼴 — 동그라미 글자를 찬 바탕에 넣으면 겹동그라미가 되어 숫자를 쓴다)
  if (n >= 0)
    return (
      <span class="quiz-badge quiz-on" aria-hidden="true">
        {n + 1}
      </span>
    );
  return (
    <span class={`quiz-badge${picked ? ' quiz-picked' : ''}`} aria-hidden="true">
      {picked ? '고름' : ''}
    </span>
  );
}

export function MatchBody({
  q,
  order,
  state,
  done,
  onTap,
}: {
  q: Question;
  order: readonly number[];
  state: MatchState;
  done: Answered | null;
  onTap: (side: Side, i: number, ev: Tap) => void;
}): JSX.Element {
  const pairs = q.pairs ?? [];
  const links: readonly (number | null)[] = done && Array.isArray(done.mine) ? done.mine : state.links;
  const view: MatchState = { links, pick: done ? null : state.pick };
  const partners = rightPartners(q);

  // 답한 뒤: 맞는 짝을 줄마다 나란히(왼쪽 i ↔ 맞는 오른쪽, 같은 번호). 맞게 이은 줄에는 ○. 틀렸으면 머리에 "맞는 짝"
  if (done) {
    return (
      <>
        <p class="quiz-col-head">{done.right ? '내가 이은 짝' : '맞는 짝은 이렇게 이어져요'}</p>
        <div class="quiz-two">
          <div class="quiz-col">
            {pairs.map((pair, i) => {
              const good = links[i] === partners[i];
              return (
                <div key={`left-${i}`} class={`quiz-pair quiz-side-left quiz-still${good ? ' quiz-good' : ' quiz-answer'}`}>
                  <span class="quiz-text">{pair[0]}</span>
                  {good && <Tag kind="good">○</Tag>}
                  <Badge n={i} picked={false} />
                </div>
              );
            })}
          </div>
          <div class="quiz-col">
            {partners.map((r, i) => (
              <div key={`right-${r}`} class={`quiz-pair quiz-side-right quiz-still${links[i] === r ? ' quiz-good' : ' quiz-answer'}`}>
                <Badge n={i} picked={false} />
                <span class="quiz-text">{pairs[r]?.[1] ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  const item = (side: Side, i: number, text: string, n: number, first: boolean): JSX.Element => {
    const picked = view.pick?.side === side && view.pick.i === i;
    const badge = <Badge n={n} picked={picked} />;
    const body = <span class="quiz-text">{text}</span>;
    const parts = side === 'left' ? [body, badge] : [badge, body];
    const label =
      n >= 0 ? `${text} — ${n + 1}번 짝으로 이었어요. 누르면 끊어요.` : picked ? `${text} — 골랐어요. 맞은쪽에서 짝을 눌러요.` : text;
    return (
      <button
        key={`${side}-${i}`}
        type="button"
        class={`quiz-pair quiz-side-${side}${picked ? ' quiz-picked' : ''}${n >= 0 ? ' quiz-linked' : ''}`}
        data-nav
        data-first-tab={first ? true : undefined}
        aria-pressed={picked}
        aria-label={label}
        onClick={(ev) => onTap(side, i, ev)}
      >
        {parts}
      </button>
    );
  };

  return (
    <div class="quiz-two">
      <div class="quiz-col">{pairs.map((pair, i) => item('left', i, pair[0], links[i] === null || links[i] === undefined ? -1 : i, i === 0))}</div>
      <div class="quiz-col">{order.map((r) => item('right', r, pairs[r]?.[1] ?? '', leftOf(view, r), false))}</div>
    </div>
  );
}

/** 맞는 답을 글로(화면 읽기 프로그램이 읽는 줄) */
export function answerWords(q: Question): string {
  switch (q.form) {
    case 'pick':
      return typeof q.answer === 'number' ? (q.choices?.[q.answer] ?? '') : '';
    case 'ox':
      return q.answer === 0 ? 'O, 맞아요' : 'X, 아니에요';
    case 'order':
      return rightSequence(q)
        .map((card, k) => `${k + 1}번 ${q.items?.[card] ?? ''}`)
        .join(', ');
    case 'match': {
      const partners = rightPartners(q);
      return (q.pairs ?? []).map((pair, i) => `${pair[0]} — ${q.pairs?.[partners[i]]?.[1] ?? ''}`).join(', ');
    }
    default:
      return '';
  }
}
