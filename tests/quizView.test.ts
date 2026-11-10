// 문제 창의 셈 시험(4-1 ㉢ — 겨루기의 문제 창 넷, 서당도 쓴다). 화면 없이 src/quiz/logic.ts를 부른다.
// - displayOrder: 같은 씨앗 → 같은 차례, 씨앗이 바뀌면 달라질 수 있음, 원래 자리를 한 번씩, 순서는 맞는 차례로 시작하지 않음,
//   고르기 스무 문제를 씨앗 1~200으로 섞으면 답의 자리가 한 곳에 몰리지 않음
// - isRight: 꼴 넷마다 맞는 답·틀린 답, 실제 이야기 문제 스물의 정답이 모두 맞음, 화면의 누름(놓기·잇기)으로 만든 답도 맞음
// - 순서·짝의 누름(놓기·되돌리기·잇기·끊기)
// - 소스 글자: 창이 TapGate와 tapTime(누른 때)으로 막고 Date.now()·타이머를 쓰지 않음, 클래스는 quiz-로 시작

import { describe, expect, it } from 'vitest';
import { storyQuestions } from '../src/content/situations/s1395/questions';
import type { Question } from '../src/engine/types4';
import {
  displayOrder,
  emptyMatch,
  emptySlots,
  isRight,
  leftOf,
  matchFull,
  matchTap,
  orderClear,
  orderTap,
  rightPartners,
  rightSequence,
  slotOf,
  slotsFull,
  windowReady,
  type MatchState,
} from '../src/quiz/logic';
import { stripComments } from './sourceText';

/** 시험에 쓰는 문제 한 줄 */
function make(id: string, extra: Partial<Question>): Question {
  return {
    id,
    grade: 5,
    subject: 'social',
    topic: 'ep-s1395-1',
    standard: '[6사05-01]',
    form: 'pick',
    ask: `물음 ${id}`,
    choices: ['가', '나', '다', '라'],
    answer: 0,
    explain: '풀이예요.',
    level: 1,
    facts: ['F04'],
    by: 'claude',
    ver: 1,
    ...extra,
  };
}

const byForm = (form: Question['form']) => storyQuestions.filter((q) => q.form === form);
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const sorted = (list: readonly number[]) => list.slice().sort((a, b) => a - b);

const PICK = make('t-pick', { choices: ['가', '나', '다', '라'], answer: 2 });
const OX = make('t-ox', { form: 'ox', choices: undefined, answer: 1 });
const ORDER = make('t-order', { form: 'order', choices: undefined, items: ['첫째', '둘째', '셋째'], answer: [0, 1, 2] });
const MATCH = make('t-match', {
  form: 'match',
  choices: undefined,
  pairs: [
    ['스님들', '궁궐 짓는 일'],
    ['농민들', '봄 농사'],
  ],
  answer: [0, 1],
});

describe('실제 이야기 문제', () => {
  it('스물이 모두 창이 낼 수 있는 꼴이다(고르기 13 · OX 4 · 순서 2 · 짝 1)', () => {
    expect(storyQuestions).toHaveLength(20);
    for (const q of storyQuestions) expect(windowReady(q), q.id).toBe(true);
    expect([byForm('pick').length, byForm('ox').length, byForm('order').length, byForm('match').length]).toEqual([13, 4, 2, 1]);
  });
});

describe('windowReady — 이 창이 낼 수 있나', () => {
  it('꼴 넷이 아니거나 자료가 모자라면 낼 수 없다(창은 "준비 중"을 보인다)', () => {
    expect(windowReady(make('t-map', { form: 'map', choices: undefined, answer: '경복궁' }))).toBe(false);
    expect(windowReady(make('t-num', { form: 'number', choices: undefined, answer: '3/4' }))).toBe(false);
    expect(windowReady(make('t-5', { choices: ['가', '나', '다', '라', '마'] }))).toBe(false);
    expect(windowReady(make('t-1', { choices: ['가'] }))).toBe(false);
    expect(windowReady(make('t-far', { answer: 4 }))).toBe(false);
    expect(windowReady(make('t-oxbad', { form: 'ox', choices: undefined, answer: 2 }))).toBe(false);
    expect(windowReady(make('t-ordbad', { form: 'order', items: ['가', '나', '다'], answer: [0, 0, 1] }))).toBe(false);
    expect(windowReady(make('t-ordnone', { form: 'order', items: undefined, answer: [0, 1, 2] }))).toBe(false);
    expect(windowReady(make('t-matchbad', { form: 'match', pairs: [['가', '나']], answer: [0] }))).toBe(false);
    for (const q of [PICK, OX, ORDER, MATCH]) expect(windowReady(q), q.id).toBe(true);
  });
});

describe('displayOrder — 화면에 놓는 차례', () => {
  it('같은 씨앗이면 같은 차례', () => {
    for (const q of storyQuestions) {
      for (const seed of [1, 7, 12345, 0xfffffff]) expect(displayOrder(q, seed), q.id).toEqual(displayOrder(q, seed));
    }
  });

  it('씨앗이 바뀌면 달라질 수 있다(고르기 넷은 씨앗 스물에 여러 차례, 순서도 둘 이상)', () => {
    for (const q of byForm('pick')) {
      const kinds = new Set(seeds(20).map((s) => displayOrder(q, s).join(',')));
      expect(kinds.size, q.id).toBeGreaterThan(5);
    }
    for (const q of byForm('order')) {
      const kinds = new Set(seeds(20).map((s) => displayOrder(q, s).join(',')));
      expect(kinds.size, q.id).toBeGreaterThan(1);
    }
    const right = new Set(seeds(20).map((s) => displayOrder(MATCH, s).join(',')));
    expect(right.size).toBe(2);
  });

  it('문제가 다르면 같은 씨앗이어도 따로 섞인다(문제 id를 씨앗에 섞는다)', () => {
    const picks = byForm('pick');
    const kinds = new Set(picks.map((q) => displayOrder(q, 42).join(',')));
    expect(kinds.size).toBeGreaterThan(3);
  });

  it('원래 자리를 모두 한 번씩 담는다', () => {
    for (const q of [...storyQuestions, PICK, ORDER, MATCH, make('t-two', { choices: ['맞다', '아니다'], answer: 1 })]) {
      const n = q.form === 'order' ? q.items!.length : q.form === 'match' ? q.pairs!.length : q.form === 'ox' ? 2 : q.choices!.length;
      for (const seed of seeds(50)) expect(sorted(displayOrder(q, seed)), `${q.id} ${seed}`).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it('OX는 섞지 않는다(O가 먼저)', () => {
    for (const q of byForm('ox')) for (const seed of seeds(30)) expect(displayOrder(q, seed)).toEqual([0, 1]);
  });

  it('순서는 맞는 차례로 시작하지 않는다(씨앗 1~1000)', () => {
    const odd = make('t-order-odd', { form: 'order', items: ['가', '나', '다'], answer: [2, 0, 1] });
    const two = make('t-order-two', { form: 'order', items: ['가', '나'], answer: [0, 1] });
    const five = make('t-order-five', { form: 'order', items: ['가', '나', '다', '라', '마'], answer: [0, 1, 2, 3, 4] });
    for (const q of [...byForm('order'), ORDER, odd, two, five]) {
      const right = rightSequence(q);
      for (const seed of seeds(1000)) expect(displayOrder(q, seed), `${q.id} ${seed}`).not.toEqual(right);
    }
  });

  it('고르기 스무 문제를 씨앗 1~200으로 섞으면 답의 자리가 한 곳에 몰리지 않는다', () => {
    // 실제 고르기 13 + 답의 자리를 여러 곳에 둔 넷짜리 일곱
    const extra = Array.from({ length: 7 }, (_, i) => make(`t-pick-${i}`, { answer: i % 4 }));
    const picks = [...byForm('pick'), ...extra];
    expect(picks).toHaveLength(20);
    const total = [0, 0, 0, 0];
    for (const q of picks) {
      const each = [0, 0, 0, 0];
      for (const seed of seeds(200)) {
        const at = displayOrder(q, seed).indexOf(q.answer as number);
        each[at]++;
        total[at]++;
      }
      // 문제 하나로 보아도 네 자리에 모두 오고, 한 자리에 4할 넘게 몰리지 않는다(고루 섞으면 2할 5푼쯤)
      for (const n of each) {
        expect(n, `${q.id} ${each.join('/')}`).toBeGreaterThan(0);
        expect(n, `${q.id} ${each.join('/')}`).toBeLessThan(80);
      }
    }
    // 모두 4,000번: 한 자리는 2할~3할 안
    for (const n of total) {
      expect(n, total.join('/')).toBeGreaterThan(800);
      expect(n, total.join('/')).toBeLessThan(1200);
    }
  });

  it('창이 낼 수 없는 문제는 빈 차례', () => {
    expect(displayOrder(make('t-map', { form: 'map', choices: undefined, answer: '경복궁' }), 1)).toEqual([]);
  });
});

describe('isRight — 아이의 답이 맞는가', () => {
  it('고르기: 원래 자리 번호', () => {
    expect(isRight(PICK, 2)).toBe(true);
    for (const wrong of [0, 1, 3]) expect(isRight(PICK, wrong)).toBe(false);
    expect(isRight(PICK, [2])).toBe(false);
    expect(isRight(PICK, null)).toBe(false);
    expect(isRight(PICK, undefined)).toBe(false);
  });

  it('OX: 0 = O, 1 = X', () => {
    expect(isRight(OX, 1)).toBe(true);
    expect(isRight(OX, 0)).toBe(false);
    const yes = make('t-ox-yes', { form: 'ox', choices: undefined, answer: 0 });
    expect(isRight(yes, 0)).toBe(true);
    expect(isRight(yes, 1)).toBe(false);
  });

  it('순서: 칸 1·2·3에 놓은 낱장의 원래 자리 번호', () => {
    expect(isRight(ORDER, [0, 1, 2])).toBe(true);
    for (const wrong of [
      [1, 0, 2],
      [0, 2, 1],
      [2, 1, 0],
      [1, 2, 0],
      [2, 0, 1],
    ])
      expect(isRight(ORDER, wrong), wrong.join(',')).toBe(false);
    expect(isRight(ORDER, [0, 1])).toBe(false);
    expect(isRight(ORDER, [0, 1, null])).toBe(false);
    expect(isRight(ORDER, 0)).toBe(false);
    // 맞는 차례를 [0, 1, 2]가 아니게 적어도 answer를 따른다
    const odd = make('t-order-odd', { form: 'order', items: ['가', '나', '다'], answer: [2, 0, 1] });
    expect(isRight(odd, [2, 0, 1])).toBe(true);
    expect(isRight(odd, [0, 1, 2])).toBe(false);
  });

  it('짝: 왼쪽 i마다 이은 오른쪽의 원래 자리 번호', () => {
    expect(isRight(MATCH, [0, 1])).toBe(true);
    expect(isRight(MATCH, [1, 0])).toBe(false);
    expect(isRight(MATCH, [0, null])).toBe(false);
    expect(isRight(MATCH, [0])).toBe(false);
    expect(isRight(MATCH, 0)).toBe(false);
  });

  it('낼 수 없는 꼴은 늘 틀림', () => {
    const map = make('t-map', { form: 'map', choices: undefined, answer: '경복궁' });
    expect(isRight(map, 0)).toBe(false);
  });

  it('실제 이야기 문제 스물: answer대로 놓은 것은 모두 맞고, 다르게 놓은 것은 틀림', () => {
    for (const q of storyQuestions) {
      const response = Array.isArray(q.answer) ? q.answer.slice() : (q.answer as number);
      expect(isRight(q, response), q.id).toBe(true);
      // 다르게 놓은 것
      if (typeof response === 'number') {
        const n = q.form === 'ox' ? 2 : q.choices!.length;
        for (let i = 0; i < n; i++) if (i !== response) expect(isRight(q, i), `${q.id} ${i}`).toBe(false);
      } else {
        expect(isRight(q, [...response].reverse()), q.id).toBe(false);
      }
    }
  });

  it('화면의 누름으로 만든 답: 섞인 차례에서 맞게 놓고 이으면 맞음', () => {
    for (const q of storyQuestions) {
      for (const seed of seeds(30)) {
        const order = displayOrder(q, seed);
        if (q.form === 'pick') {
          // k번째 자리에 놓인 고를 것을 누르면 그 원래 자리 번호가 답이다
          const k = order.indexOf(q.answer as number);
          expect(isRight(q, order[k]), q.id).toBe(true);
        } else if (q.form === 'order') {
          let slots = emptySlots(q.items!.length);
          for (const card of rightSequence(q)) slots = orderTap(slots, card);
          expect(slotsFull(slots)).toBe(true);
          expect(isRight(q, slots), `${q.id} ${seed}`).toBe(true);
        } else if (q.form === 'match') {
          let state: MatchState = emptyMatch(q.pairs!.length);
          const partners = rightPartners(q);
          // 오른쪽은 섞인 차례로 보이지만 누르는 것은 원래 자리 번호다
          for (let i = 0; i < q.pairs!.length; i++) {
            state = matchTap(state, 'left', i);
            state = matchTap(state, 'right', partners[i]);
          }
          expect(matchFull(state)).toBe(true);
          expect(isRight(q, state.links), `${q.id} ${seed}`).toBe(true);
        }
      }
    }
  });
});

describe('순서 맞추기의 누름', () => {
  it('누르는 차례대로 첫 빈 칸에 놓이고, 놓인 것을 다시 누르면 되돌아간다', () => {
    let s = emptySlots(3);
    expect(s).toEqual([null, null, null]);
    s = orderTap(s, 2);
    s = orderTap(s, 0);
    expect(s).toEqual([2, 0, null]);
    expect(slotOf(s, 0)).toBe(1);
    expect(slotOf(s, 1)).toBe(-1);
    expect(slotsFull(s)).toBe(false);
    // 둘째 칸의 것을 되돌리면 빈 칸이 남고, 다음 낱장이 그 칸에 놓인다(뒤의 칸이 당겨지지 않는다)
    s = orderTap(s, 0);
    expect(s).toEqual([2, null, null]);
    s = orderTap(s, 1);
    s = orderTap(s, 0);
    expect(s).toEqual([2, 1, 0]);
    expect(slotsFull(s)).toBe(true);
    // 다 찼으면 놓이지 않은 낱장이 없다 — 칸을 눌러 되돌린다
    s = orderClear(s, 0);
    expect(s).toEqual([null, 1, 0]);
    s = orderTap(s, 2);
    expect(s).toEqual([2, 1, 0]);
    // 범위 밖의 칸은 그대로
    expect(orderClear(s, 5)).toEqual([2, 1, 0]);
  });

  it('상태를 고치지 않고 새 배열을 돌려준다', () => {
    const s = emptySlots(3);
    const t = orderTap(s, 1);
    expect(s).toEqual([null, null, null]);
    expect(t).not.toBe(s);
  });
});

describe('짝 맞추기의 누름', () => {
  it('왼쪽 하나와 오른쪽 하나를 누르면 이어지고, 이어진 것을 다시 누르면 끊긴다', () => {
    let s = emptyMatch(2);
    s = matchTap(s, 'left', 0);
    expect(s.pick).toEqual({ side: 'left', i: 0 });
    s = matchTap(s, 'right', 1);
    expect(s.links).toEqual([1, null]);
    expect(s.pick).toBeNull();
    expect(leftOf(s, 1)).toBe(0);
    expect(leftOf(s, 0)).toBe(-1);
    // 이어진 오른쪽을 누르면 끊기고 그것이 골라진다(맞은쪽을 누르면 바로 새로 잇는다)
    s = matchTap(s, 'right', 1);
    expect(s.links).toEqual([null, null]);
    expect(s.pick).toEqual({ side: 'right', i: 1 });
    // 한 번 더 누르면 고름도 거둔다
    s = matchTap(s, 'right', 1);
    expect(s.pick).toBeNull();
    // 오른쪽을 먼저 눌러도 된다
    s = matchTap(s, 'right', 0);
    s = matchTap(s, 'left', 1);
    expect(s.links).toEqual([null, 0]);
    // 이어진 왼쪽을 누르면 끊긴다
    s = matchTap(s, 'left', 1);
    expect(s.links).toEqual([null, null]);
    expect(s.pick).toEqual({ side: 'left', i: 1 });
  });

  it('고른 것을 다시 누르면 고름을 거두고, 같은 쪽의 다른 것을 누르면 그것을 고른다', () => {
    let s = emptyMatch(2);
    s = matchTap(s, 'left', 0);
    s = matchTap(s, 'left', 0);
    expect(s.pick).toBeNull();
    s = matchTap(s, 'left', 0);
    s = matchTap(s, 'left', 1);
    expect(s.pick).toEqual({ side: 'left', i: 1 });
    expect(s.links).toEqual([null, null]);
  });

  it('이미 이어진 것과 새로 이으면 옛 줄은 끊긴다(한 오른쪽에 왼쪽 둘이 붙지 않는다)', () => {
    let s = emptyMatch(2);
    s = matchTap(matchTap(s, 'left', 0), 'right', 0);
    s = matchTap(matchTap(s, 'left', 1), 'right', 0);
    expect(s.links).toEqual([null, 0]);
    s = matchTap(matchTap(s, 'left', 1), 'right', 1);
    expect(s.links).toEqual([null, 1]);
    s = matchTap(matchTap(s, 'right', 0), 'left', 0);
    expect(s.links).toEqual([0, 1]);
    expect(matchFull(s)).toBe(true);
    expect(isRight(MATCH, s.links)).toBe(true);
  });

  it('범위 밖의 누름은 그대로', () => {
    const s = emptyMatch(2);
    expect(matchTap(s, 'left', 5)).toBe(s);
  });
});

// ── 소스 글자 ──────────────────────────────────────────────

const RAW = import.meta.glob<string>(['../src/quiz/**/*.ts', '../src/quiz/**/*.tsx'], { eager: true, query: '?raw', import: 'default' });
const CODE: Record<string, string> = Object.fromEntries(Object.entries(RAW).map(([path, text]) => [path, stripComments(text)]));

/** quiz.css의 글(주석을 지운 것). 시험에서는 CSS를 ?raw로 읽으면 비어 오므로 파일을 읽는다(device.test.ts의 꼴 — Node의 형 정의를 두지 않는다) */
async function quizCss(): Promise<string> {
  const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync(path: string, encoding: 'utf8'): string };
  const path = decodeURIComponent(new URL('../src/styles/quiz.css', import.meta.url).pathname);
  return fs.readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('문제 창의 소스(주석을 지운 것)', () => {
  const view = CODE['../src/quiz/QuizWindow.tsx'] ?? '';

  it('창과 셈 파일이 있다', async () => {
    expect(Object.keys(CODE)).toEqual(expect.arrayContaining(['../src/quiz/QuizWindow.tsx', '../src/quiz/logic.ts']));
    expect((await quizCss()).length).toBeGreaterThan(1000);
  });

  it('누름을 TapGate로 막고 누른 때(tapTime)로 잰다. 답한 뒤에는 읽을 틈을 둔다', () => {
    expect(view).toMatch(/new TapGate\(nowMs\(\)\)/);
    expect(view).toMatch(/\.pass\(tapTime\(ev\)\)/);
    // 답한 뒤: 맞음·틀림을 띄울 때 놀이 뒤처럼 읽을 틈을 막고(done(…, true)), 화면에 뜬 때 한 번 더(shown)
    expect(view).toMatch(/\.done\(nowMs\(\), true\)/);
    expect(view).toMatch(/\.shown\(nowMs\(\)\)/);
  });

  it('Date.now()·타이머·소리를 쓰지 않는다(시간 제한·초읽기 없음)', () => {
    for (const [path, text] of Object.entries(CODE)) {
      expect(text, path).not.toMatch(/Date\.now\(/);
      expect(text, path).not.toMatch(/\bset(Timeout|Interval)\(/);
      expect(text, path).not.toMatch(/\bnew Audio\(|AudioContext/);
    }
  });

  it('창은 얹힌 창의 자판을 쓴다(role="dialog", aria-modal, useModalKeys, aria-live)', () => {
    expect(view).toMatch(/role="dialog"/);
    expect(view).toMatch(/aria-modal="true"/);
    expect(view).toMatch(/useModalKeys\(rootRef/);
    expect(view).toMatch(/aria-live="polite"/);
  });

  it('quiz.css의 클래스는 모두 quiz-로 시작하고, 움직임은 줄인 기기에서 멈춘다', async () => {
    const CSS = await quizCss();
    const classes = new Set(CSS.match(/\.[a-zA-Z][\w-]*/g) ?? []);
    for (const name of classes) expect(name, name).toMatch(/^\.quiz-/);
    expect(CSS).toMatch(/prefers-reduced-motion: reduce/);
    expect(CSS).not.toMatch(/infinite/);
  });

  it('누르는 것은 56px(3.5rem) 아래로 줄이지 않는다', async () => {
    const CSS = await quizCss();
    for (const m of CSS.matchAll(/min-height:\s*([\d.]+)rem/g)) {
      const value = Number(m[1]);
      // 머리·맞음·틀림 줄(2rem 안팎)은 누르는 것이 아니다
      if (value >= 3) expect(value).toBeGreaterThanOrEqual(3.5);
    }
  });
});
