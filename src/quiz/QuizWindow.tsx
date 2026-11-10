// 문제 창 — 겨루기에서 카드를 내면 무대가 어두워지고 가운데에 뜨는 문제 종이(spec 4.5, 8.1의 3·4, 시안 docs/plan-4-1/battle-question.png).
// ㉣의 서당(20문제)도 이 창을 그대로 쓴다(explainAlways).
//
// 차례: 물음 → 답(고르기·OX는 누르면 바로, 순서·짝은 다 놓고 "정했어요") → 맞음·틀림과 풀이 → "다음 ▶" → onDone(맞혔나).
// - 꼴 넷: 고르기(세로 2~4개, ①②③④) · OX(큰 단추 둘) · 순서(낱장 셋을 누르는 차례대로 칸에) · 짝(두 쌍을 눌러 잇기). 끌기는 쓰지 않는다.
// - 맞음·틀림은 색만으로 보이지 않는다: ○ 맞았어요! / 둥근 세모 아쉬워요, "맞는 답"·"내가 고른 답" 딱지, 풀이 종이(8.1 — 부드러운 말, 붉은 X 없음).
// - 시간 제한·초읽기·재촉하는 움직임·소리 없음. 번쩍임·흔들림 없음(맞으면 ○가 부드럽게 커지는 정도 — 움직임을 줄인 기기에서는 가만히).
// - 누름 막기(ui/taps.ts의 TapGate — 누른 때로 잰다): 창이 뜬 바로 뒤(OPEN_GAP_MS)와 잇달아 누름(TAP_GAP_MS)을 받지 않고,
//   답한 뒤의 "다음"은 맞음·틀림이 화면에 뜬 때부터 읽을 틈(READ_GAP_MS) 뒤에 받는다(답을 누른 손가락이 풀이를 못 읽고 넘기지 않게).
// - 자판(ui/focus.ts의 useModalKeys): 창이 뜨면 초점은 고를 것 묶음에 있고 첫 Enter·Space는 첫 고를 것으로 옮기기만 한다(Talk.tsx와 같다).
//   ↑↓(←→도)와 Tab으로 오가고 Enter·Space로 고른다. 답한 뒤에는 초점이 "다음"에 간다. 맞음·틀림의 말은 aria-live로 읽힌다.
// - 문제가 바뀌면(id·판·씨앗) 창을 새로 띄운 것으로 친다(상태와 누름의 문을 새로 — 안의 QuizPaper에 key를 준다).

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { spirit as neuti } from '../content/hub';
import type { Question } from '../engine/types4';
import { focusInto, useModalKeys } from '../ui/focus';
import { TapGate, nowMs, tapTime } from '../ui/taps';
import {
  displayOrder,
  emptyMatch,
  emptySlots,
  isRight,
  matchFull,
  matchTap,
  orderClear,
  orderTap,
  slotsFull,
  windowReady,
  type MatchState,
  type Side,
} from './logic';
import { HintIcon, MatchBody, OrderBody, OxBody, PickBody, RightMark, SoftMark, answerWords, type Answered } from './parts';

export interface QuizWindowProps {
  q: Question;
  /** 섞는 씨앗(같은 씨앗 → 같은 차례) */
  seed: number;
  /** 창 머리에 그려 넣을 것(카드 이름·갈래 표시·"맞히면 힘이 두 배(22) · 틀려도 기본 힘 11은 나가요"). 답한 뒤에는 그 자리에 맞음·틀림이 선다 */
  head?: ComponentChildren;
  /** 귀띔이 지운 고를 것(원래 자리 번호). 지운 것은 흐리게 · 줄을 긋고 · 누를 수 없게("아니에요" 표시). 답의 자리는 지우지 않는다 */
  gone?: readonly number[];
  /** 귀띔 단추(있을 때만 띄운다 — 고르기에서만). 누르면 onUse → 부르는 쪽이 gone을 늘려 다시 그린다 */
  hint?: { label: string; onUse: () => void } | null;
  /** 정령의 한 줄(귀띔을 쓴 뒤 "이건 아니야…" 등 — 있으면 창 귀퉁이에 작은 말풍선. 묻는 동안만) */
  spirit?: string | null;
  /** 답한 뒤 맞았을 때 덧붙이는 한 줄("힘 22가 나가고 방패 한 칸이 깎여요") */
  rightNote?: string;
  /** 답한 뒤 틀렸을 때 덧붙이는 한 줄("기본 힘 11은 나가요 · 이 문제는 두 차례 뒤에 다시 나와요") */
  wrongNote?: string;
  /** 맞혀도 풀이를 보일까(겨루기는 거짓 — 틀렸을 때만 풀이. 서당은 참) */
  explainAlways?: boolean;
  /** 답했을 때 바로 한 번(맞혔나) */
  onAnswer?: (right: boolean) => void;
  /** 맞음·틀림을 보인 뒤 "다음"을 누르면(맞혔나). 한 번만 부른다 */
  onDone: (right: boolean) => void;
}

const COUNT_WORDS = ['', '하나', '둘', '셋', '넷', '다섯'];

/** ↑↓·←→로 오가는 것(창 안에서 누를 수 있는 고를 것·낱장·칸·짝과 정하기·다음 단추) */
function navItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-nav]:not([disabled])'));
}

export function QuizWindow(props: QuizWindowProps): JSX.Element {
  return <QuizPaper key={`${props.q.id}:${props.q.ver}:${props.seed}`} {...props} />;
}

function QuizPaper(props: QuizWindowProps): JSX.Element {
  const { q, seed, hint, spirit, explainAlways } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  // 누름의 문: 창이 뜬 때부터 OPEN_GAP_MS 동안 받지 않는다. 잇달아 누른 것은 한 번으로 친다(누른 때로 잰다 — ui/taps.ts)
  const gate = useRef<TapGate | null>(null);
  if (!gate.current) gate.current = new TapGate(nowMs());
  const pass = (ev?: Event | null): boolean => (gate.current as TapGate).pass(tapTime(ev));

  const ready = windowReady(q);
  const order = useMemo(() => displayOrder(q, seed), [q, seed]);
  const size = q.form === 'order' ? (q.items?.length ?? 0) : q.form === 'match' ? (q.pairs?.length ?? 0) : 0;
  const [slots, setSlots] = useState(() => emptySlots(q.form === 'order' ? size : 0));
  const [match, setMatch] = useState<MatchState>(() => emptyMatch(q.form === 'match' ? size : 0));
  const [done, setDone] = useState<Answered | null>(null);
  const answered = useRef(false);
  const finished = useRef(false);
  /** 다음 그림 뒤에 초점을 줄 것(칸에서 되돌린 낱장) */
  const focusAfter = useRef<string | null>(null);
  const askId = useId();

  // 귀띔이 지운 것(답의 자리는 지우지 않는다)
  const gone = useMemo(() => new Set((q.form === 'pick' ? (props.gone ?? []) : []).filter((i) => i !== q.answer)), [q, props.gone]);

  const answer = (mine: number | number[]): void => {
    if (answered.current) return;
    answered.current = true;
    const right = isRight(q, mine);
    // 맞음·틀림을 띄운다: 그것이 화면에 뜬 때(아래 shown) 다시 읽을 틈을 막는다 — 답을 누른 손가락이 "다음"까지 누르지 않게
    gate.current?.done(nowMs(), true);
    setDone({ right, mine });
    props.onAnswer?.(right);
  };

  const pick = (i: number, ev: Event): void => {
    if (done || gone.has(i) || !pass(ev)) return;
    answer(i);
  };
  const takeHint = (ev: Event): void => {
    if (done || !hint || !pass(ev)) return;
    hint.onUse();
  };
  const tapCard = (card: number, ev: Event): void => {
    if (done || !pass(ev)) return;
    setSlots((now) => orderTap(now, card));
  };
  const tapSlot = (slot: number, ev: Event): void => {
    if (done || !pass(ev)) return;
    const card = slots[slot];
    if (card !== null && card !== undefined) focusAfter.current = `[data-card="${card}"]`;
    setSlots((now) => orderClear(now, slot));
  };
  const tapPair = (side: Side, i: number, ev: Event): void => {
    if (done || !pass(ev)) return;
    setMatch((now) => matchTap(now, side, i));
  };
  const settle = (ev: Event): void => {
    if (done || !pass(ev)) return;
    if (q.form === 'order' && slotsFull(slots)) answer(slots.map((v) => v ?? -1));
    else if (q.form === 'match' && matchFull(match)) answer(match.links.map((v) => v ?? -1));
  };
  const next = (ev: Event): void => {
    if (!done || finished.current || !pass(ev)) return;
    finished.current = true;
    props.onDone(done.right);
  };
  /** 아직 낼 수 없는 꼴(지도에서 찍기 등): 보이기만 하고 넘긴다 */
  const skip = (ev: Event): void => {
    if (finished.current || !pass(ev)) return;
    finished.current = true;
    props.onDone(false);
  };

  useModalKeys(rootRef, (ev) => {
    const root = rootRef.current;
    if (!root) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      // 단추가 아닌 곳(고를 것 묶음, 창)에서 누른 Enter·Space: 초점을 옮기기만 한다(잇달아 누르다 저절로 골라지거나 넘어가지 않게)
      ev.preventDefault();
      const target = done || !ready ? root.querySelector<HTMLElement>('[data-autofocus]') : navItems(root)[0];
      target?.focus();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      const items = navItems(root);
      if (items.length === 0) return;
      const step = ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 1 : -1;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const to = at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
      items[to].focus();
    }
  });

  // 맞음·틀림이 화면에 뜬 때: 그때부터 읽을 틈을 막고, 초점을 "다음"으로
  useEffect(() => {
    if (!done) return;
    gate.current?.shown(nowMs());
    if (rootRef.current) focusInto(rootRef.current);
  }, [done]);

  // 누른 것이 사라져 초점을 잃었으면(칸에서 되돌림, 귀띔 단추가 사라짐) 창 안으로 데려온다
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const want = focusAfter.current;
    focusAfter.current = null;
    const target = want ? root.querySelector<HTMLElement>(want) : null;
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    const active = document.activeElement;
    if (!active || active === document.body) focusInto(root);
  });

  const form = q.form;
  const asking = !done;
  const showExplain = done !== null && (!done.right || explainAlways === true);
  const note = done ? (done.right ? props.rightNote : props.wrongNote) : undefined;

  // 화면 읽기 프로그램이 읽는 줄(늘 있는 칸에 글을 채운다 — 새로 생긴 칸은 읽히지 않을 수 있다)
  const spoken = !done
    ? ''
    : done.right
      ? ['맞았어요!', props.rightNote, explainAlways ? `풀이: ${q.explain}` : ''].filter(Boolean).join(' ')
      : ['아쉬워요.', `맞는 답은 ${answerWords(q)}.`, `풀이: ${q.explain}`, props.wrongNote].filter(Boolean).join(' ');

  const count = form === 'pick' ? order.length - gone.size : form === 'ox' ? 2 : size;
  const groupLabel =
    form === 'order'
      ? `낱장 ${COUNT_WORDS[size] ?? size}. 화살표로 오가고 Enter로 칸에 놓아요.`
      : form === 'match'
        ? `짝 ${COUNT_WORDS[size] ?? size} 쌍. 화살표로 오가고 Enter로 골라 이어요.`
        : `고를 것 ${COUNT_WORDS[count] ?? count}. 화살표로 고르고 Enter로 정해요.`;

  // 순서·짝의 안내 한 줄(무엇을 누를지 — 글로)
  let guide = '';
  if (asking && form === 'order') {
    guide = slotsFull(slots) ? '다 놓았어요. 아래 단추를 눌러 정해요.' : `누르는 차례대로 ${slots.map((_, k) => k + 1).join('·')} 칸에 놓여요. 다시 누르면 되돌아가요.`;
  } else if (asking && form === 'match') {
    const pairs = q.pairs ?? [];
    const p = match.pick;
    guide = p
      ? p.side === 'left'
        ? `이제 오른쪽에서 ‘${pairs[p.i]?.[0] ?? ''}’의 짝을 눌러요.`
        : `이제 왼쪽에서 ‘${pairs[p.i]?.[1] ?? ''}’의 짝을 눌러요.`
      : matchFull(match)
        ? '다 이었어요. 아래 단추를 눌러 정해요.'
        : '왼쪽 하나를 누르고, 이어질 오른쪽 하나를 눌러요.';
  }

  const full = form === 'order' ? slotsFull(slots) : form === 'match' ? matchFull(match) : false;

  return (
    <div class="quiz-veil">
      <div
        class={`quiz-paper quiz-form-${ready ? form : 'none'}${done ? (done.right ? ' quiz-got' : ' quiz-missed') : ' quiz-asking'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={askId}
        ref={rootRef}
      >
        <p class="visually-hidden" role="status" aria-live="polite">
          {spoken}
        </p>

        {asking && props.head !== undefined && props.head !== null && <div class="quiz-head">{props.head}</div>}
        {done && (
          <div class={`quiz-verdict ${done.right ? 'quiz-got' : 'quiz-missed'}`}>
            {done.right ? <RightMark /> : <SoftMark />}
            <strong class="quiz-verdict-word">{done.right ? '맞았어요!' : '아쉬워요'}</strong>
            {!done.right && <span class="quiz-verdict-sub">이렇게 된 거예요</span>}
          </div>
        )}

        <h2 class="quiz-ask" id={askId}>
          {q.ask}
        </h2>
        {guide && (
          <p class="quiz-guide" aria-live="polite">
            {guide}
          </p>
        )}

        {!ready ? (
          <>
            <p class="quiz-soon">이 문제는 아직 준비 중이에요</p>
            <div class="quiz-foot">
              <button type="button" class="btn primary quiz-next" data-nav data-autofocus onClick={skip}>
                넘기기 <span aria-hidden="true">▶</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              class={`quiz-body quiz-form-${form}`}
              role="group"
              tabIndex={-1}
              data-autofocus={asking ? true : undefined}
              aria-label={asking ? groupLabel : undefined}
            >
              {form === 'pick' && <PickBody q={q} order={order} gone={gone} done={done} onPick={pick} />}
              {form === 'ox' && <OxBody q={q} done={done} onPick={pick} />}
              {form === 'order' && <OrderBody q={q} order={order} slots={slots} done={done} onCard={tapCard} onSlot={tapSlot} />}
              {form === 'match' && <MatchBody q={q} order={order} state={match} done={done} onTap={tapPair} />}
            </div>

            {showExplain && (
              <div class="quiz-explain">
                <span class="quiz-chip">풀이</span>
                <p class="quiz-explain-text">{q.explain}</p>
              </div>
            )}

            {asking && (form === 'order' || form === 'match') && (
              <div class="quiz-foot">
                {full ? (
                  <button type="button" class="btn primary quiz-settle" data-nav onClick={settle}>
                    {form === 'order' ? '이 차례로 정했어요' : '이렇게 이었어요'} <span aria-hidden="true">▶</span>
                  </button>
                ) : (
                  <p class="quiz-wait">{form === 'order' ? '낱장을 모두 놓으면 정할 수 있어요' : '모두 이으면 정할 수 있어요'}</p>
                )}
                {spirit && <Spirit line={spirit} />}
              </div>
            )}
            {asking && (form === 'pick' || form === 'ox') && ((hint && form === 'pick') || spirit) && (
              <div class="quiz-foot">
                {hint && form === 'pick' && (
                  <button type="button" class="btn quiz-hint" onClick={takeHint}>
                    <HintIcon />
                    {hint.label}
                  </button>
                )}
                {spirit && <Spirit line={spirit} />}
              </div>
            )}
            {done && (
              <div class="quiz-foot">
                {note ? <p class="quiz-note">{note}</p> : <span class="quiz-note" />}
                <button type="button" class="btn primary quiz-next" data-nav data-autofocus onClick={next}>
                  다음 <span aria-hidden="true">▶</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {asking && ready && (
        // 자판으로 왔을 때만 보이는 한 줄(고를 것 묶음에 초점이 있을 때 — quiz.css). 손가락·마우스로는 보이지 않는다
        <p class="quiz-keys" aria-hidden="true">
          {form === 'order' ? '↑↓로 오가고 Enter로 칸에 놓아요' : form === 'match' ? '↑↓로 오가고 Enter로 골라 이어요' : '↑↓로 고르고 Enter로 정해요'}
        </p>
      )}
    </div>
  );
}

/** 정령의 한 줄: 창 귀퉁이(아래 오른쪽)의 작은 말풍선. 이름표는 다른 말풍선(ui/Spirit.tsx)과 같은 "느티"(hub.ts의 spirit.name) */
function Spirit({ line }: { line: string }): JSX.Element {
  return (
    <p class="quiz-spirit">
      <span class="quiz-spirit-name">{neuti.name}</span>
      <span class="quiz-spirit-line">{line}</span>
    </p>
  );
}
