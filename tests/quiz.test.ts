// 문제 고르기 엔진 시험(spec 9.1·8.5·5.6의 5번, 11.1 사의 ㉡ 칸 "서당의 안 푼 것부터"): 비트 묶음, 답 적기와 한 바퀴,
// 서당 20문제(쉬움 6·보통 10·어려움 4, 넉 판 동안 겹침 0 → 다시 볼 것 → 오래전에 맞힌 것, 새 문제 먼저, 같은 id면 기록 이음),
// 겨루기의 문제 차례(이야기 → 앞 에피소드 → 서당 주제 → 견주기, 쉬움 먼저, 겨루기 꼴만), 지혜 겨루기, 귀띔.

import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/rng';
import {
  askLevel,
  battleAsk,
  battleReady,
  bitIndex,
  emptyLog,
  finishRound,
  hasBit,
  hintChoice,
  packBits,
  pickSeodang,
  recordAnswer,
  recordAnswers,
  reviewList,
  sourceRank,
  statusOf,
  unpackBits,
  withBit,
} from '../src/engine/quiz';
import { packBits as packBits3, unpackBits as unpackBits3 } from '../src/state/storage';
import type { Question, QuizLog } from '../src/engine/types4';
import { allQuestions, bank21, bankTopic, cardById, episode41, makeQuestion, storyQuestions } from './fixtures4';

const ids = (list: readonly Question[]) => list.map((q) => q.id);
const levelCount = (list: readonly Question[]) => [1, 2, 3].map((l) => list.filter((q) => q.level === l).length);

/** 한 판을 풀어 적는다(맞힘은 씨앗 있는 난수로 rate만큼) */
function solve(log: QuizLog | undefined, round: readonly Question[], topicIds: readonly string[], rate: number, seed: number): QuizLog {
  const rng = mulberry32(seed);
  let out = log ?? emptyLog();
  for (const q of round) out = recordAnswer(out, q.id, rng() < rate, topicIds);
  return out;
}

describe('비트 묶음', () => {
  it('자리는 id의 마지막 "-" 뒤의 수', () => {
    expect(bitIndex('soc5-2-1-0042')).toBe(42);
    expect(bitIndex('ep-s1395-1-007')).toBe(7);
    expect(bitIndex('soc5-2-1-0000')).toBe(0);
    expect(bitIndex('없는꼴')).toBe(-1);
    expect(bitIndex('a-b-x7')).toBe(-1);
  });

  it('3판 storage의 꼴과 같다(두 글자가 여덟 칸, 칸 0이 낮은 비트)', () => {
    const rng = mulberry32(3);
    for (let n = 1; n <= 130; n += 7) {
      const bits = Array.from({ length: n }, () => (rng() < 0.4 ? 1 : 0));
      const text = packBits(bits);
      expect(text).toBe(packBits3(Uint8Array.from(bits)));
      expect(Array.from(unpackBits(text, n))).toEqual(bits);
      expect(Array.from(unpackBits3(text, n))).toEqual(bits);
      expect(packBits(unpackBits(text, n))).toBe(text);
    }
    expect(packBits([1, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe('0102');
  });

  it('한 칸 바꾸기는 필요한 만큼 늘리고 다른 칸을 건드리지 않는다', () => {
    let t = withBit('', 42, true);
    expect(t.length).toBe(12);
    expect(hasBit(t, 42)).toBe(true);
    t = withBit(t, 3, true);
    t = withBit(t, 42, false);
    expect(hasBit(t, 3)).toBe(true);
    expect(hasBit(t, 42)).toBe(false);
    expect(hasBit(t, 200)).toBe(false);
    expect(hasBit(undefined, 0)).toBe(false);
  });
});

describe('답 적기', () => {
  it('seen·right 비트, 다시 볼 문제(맞히면 빠짐), 맞힌 차례(다시 맞히면 뒤로)', () => {
    let log = recordAnswer(undefined, 'soc5-2-1-0001', true);
    log = recordAnswer(log, 'soc5-2-1-0002', false);
    log = recordAnswer(log, 'soc5-2-1-0003', true);
    expect(hasBit(log.seen, 1) && hasBit(log.seen, 2) && hasBit(log.seen, 3)).toBe(true);
    expect(hasBit(log.right, 1)).toBe(true);
    expect(hasBit(log.right, 2)).toBe(false);
    expect(log.wrong).toEqual(['soc5-2-1-0002']);
    expect(log.lastRight).toEqual(['soc5-2-1-0001', 'soc5-2-1-0003']);
    log = recordAnswer(log, 'soc5-2-1-0001', true);
    expect(log.lastRight).toEqual(['soc5-2-1-0003', 'soc5-2-1-0001']);
    log = recordAnswer(log, 'soc5-2-1-0002', true);
    expect(log.wrong).toEqual([]);
    log = recordAnswer(log, 'soc5-2-1-0003', false);
    expect(log.wrong).toEqual(['soc5-2-1-0003']);
    expect(log.lastRight).not.toContain('soc5-2-1-0003');
    expect(hasBit(log.right, 3)).toBe(true);
  });

  it('주제의 모든 문제가 이번 바퀴에 나오면 한 바퀴: laps + 1, seen을 비운다(바퀴 수는 남는다)', () => {
    const topic = bankTopic('t', 10, [3, 5, 2]);
    let log: QuizLog | undefined;
    for (const q of topic) log = recordAnswer(log, q.id, true, ids(topic));
    expect(log?.laps).toBe(1);
    expect(log?.seen).toBe('');
    expect(log?.lastRight).toHaveLength(10);
    log = finishRound(log, 85);
    log = finishRound(log, 60);
    expect(log.rounds).toBe(2);
    expect(log.best).toBe(85);
  });

  it('여러 답을 주제마다 적는다(겨루기의 asked)', () => {
    const quiz = recordAnswers(
      {},
      [
        { q: storyQuestions[0].id, right: true },
        { q: bank21[0].id, right: false },
        { q: '없는-문제-1', right: true },
      ],
      allQuestions,
    );
    expect(Object.keys(quiz).sort()).toEqual(['ep-s1395-1', 'soc5-2-1']);
    expect(quiz['soc5-2-1'].wrong).toEqual([bank21[0].id]);
  });
});

describe('서당 20문제 — 안 푼 것부터', () => {
  const topic = bankTopic('soc5-2-1');
  const topicIds = ids(topic);

  it('쉬움 6 · 보통 10 · 어려움 4, 쉬운 것부터, 씨앗이 같으면 같고 다르면 다르다', () => {
    const round = pickSeodang(topic, undefined, 1);
    expect(round).toHaveLength(20);
    expect(levelCount(round)).toEqual([6, 10, 4]);
    expect(round.map((q) => q.level)).toEqual([...round.map((q) => q.level)].sort());
    expect(ids(pickSeodang(topic, undefined, 1))).toEqual(ids(round));
    expect(ids(pickSeodang(topic, undefined, 2))).not.toEqual(ids(round));
  });

  it('80문제 주제를 판마다 풀면 넉 판 동안 겹침이 없고, 다섯째 판은 다시 볼 것 → 오래전에 맞힌 것', () => {
    for (const rate of [0.9, 0.7, 0.4]) {
      let log: QuizLog | undefined;
      const seen = new Set<string>();
      for (let round = 1; round <= 4; round++) {
        const picked = pickSeodang(topic, log, round * 11);
        expect(levelCount(picked)).toEqual([6, 10, 4]);
        for (const q of picked) {
          expect(seen.has(q.id), `${rate} ${round}판 ${q.id}`).toBe(false);
          seen.add(q.id);
        }
        log = solve(log, picked, topicIds, rate, round * 7 + rate * 100);
      }
      expect(seen.size).toBe(80);
      expect(log?.laps).toBe(1);
      const wrong = new Set(log?.wrong ?? []);
      const fifth = pickSeodang(topic, log, 99);
      const fromWrong = fifth.filter((q) => wrong.has(q.id));
      // 다시 볼 문제가 먼저: 다시 볼 문제가 스물 넘게 있으면 모두 다시 볼 것에서
      expect(fromWrong.length).toBe(Math.min(20, wrong.size));
      // 맞힌 것에서 온 것은 그 어려움에서 가장 오래전에 맞힌 것들이다
      const rightPicked = fifth.filter((q) => !wrong.has(q.id));
      for (const q of rightPicked) {
        const sameLevel = (log?.lastRight ?? []).filter((id) => topic.find((t) => t.id === id)?.level === q.level);
        const pickedHere = rightPicked.filter((p) => p.level === q.level).map((p) => p.id);
        expect(sameLevel.slice(0, pickedHere.length).sort()).toEqual(pickedHere.sort());
      }
    }
  });

  it('다시 볼 문제가 적으면 모두 나오고 나머지는 오래전에 맞힌 것', () => {
    let log: QuizLog | undefined;
    for (let round = 1; round <= 4; round++) {
      const picked = pickSeodang(topic, log, round);
      let i = 0;
      for (const q of picked) log = recordAnswer(log, q.id, round !== 2 || i++ >= 5, topicIds);
    }
    expect(log?.wrong).toHaveLength(5);
    const fifth = pickSeodang(topic, log, 5);
    for (const w of log?.wrong ?? []) expect(ids(fifth)).toContain(w);
    // 첫 판에 맞힌 것(가장 오래전)이 셋째·넷째 판에 맞힌 것보다 먼저 나온다
    const firstRound = new Set(ids(pickSeodang(topic, undefined, 1)));
    const old = fifth.filter((q) => firstRound.has(q.id));
    expect(old.length).toBeGreaterThanOrEqual(15 - 5);
  });

  it('새 문제(새 id)가 먼저 나온다 — 한 바퀴 뒤에도, 바퀴 도중에도', () => {
    let log: QuizLog | undefined;
    for (let round = 1; round <= 4; round++) log = solve(log, pickSeodang(topic, log, round), topicIds, 0.5, round);
    const added = [1, 2, 2, 3, 2].map((level, i) => makeQuestion(`soc5-2-1-${String(81 + i).padStart(4, '0')}`, 'soc5-2-1', level as 1 | 2 | 3));
    const grown = [...topic, ...added];
    const next = pickSeodang(grown, log, 5);
    for (const q of added) expect(ids(next)).toContain(q.id);
    // 바퀴 도중(둘째 판 뒤)에 더하면, 겹치기 전에 나온다
    let mid: QuizLog | undefined;
    const seen = new Set<string>();
    for (let round = 1; round <= 2; round++) {
      const picked = pickSeodang(topic, mid, round);
      picked.forEach((q) => seen.add(q.id));
      mid = solve(mid, picked, topicIds, 0.5, round);
    }
    const grownIds = ids(grown);
    for (let round = 3; round <= 4; round++) {
      const picked = pickSeodang(grown, mid, round);
      for (const q of picked) {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
      mid = solve(mid, picked, grownIds, 0.5, round);
    }
    // 85문제이므로 다섯째 판에 남은 다섯이 모두 나오고 나머지 열다섯은 다시 볼 것·맞힌 것
    const left = grown.filter((q) => !seen.has(q.id));
    expect(left).toHaveLength(5);
    const fifth = pickSeodang(grown, mid, 5);
    for (const q of left) expect(ids(fifth)).toContain(q.id);
    left.forEach((q) => seen.add(q.id));
    expect(seen.size).toBe(85);
    for (const q of added) expect(seen.has(q.id)).toBe(true);
  });

  it('같은 id면(고친 문제 — ver가 올라도) 기록이 이어진다', () => {
    let log: QuizLog | undefined;
    const round = pickSeodang(topic, log, 1);
    log = solve(log, round, topicIds, 1, 1);
    const fixed = topic.map((q) => (q.id === round[0].id ? { ...q, ver: 2, ask: '고친 물음' } : q));
    expect(statusOf(log, round[0].id).status).toBe('right');
    expect(ids(pickSeodang(fixed, log, 2))).not.toContain(round[0].id);
  });

  it('어려움 칸이 모자라면 이웃 어려움으로 채운다(안 푼 것이 남았는데 다시 볼 문제를 먼저 내지 않는다)', () => {
    const lopsided = bankTopic('lop', 30, [20, 8, 2]);
    const round = pickSeodang(lopsided, undefined, 1);
    expect(round).toHaveLength(20);
    expect(levelCount(round)[2]).toBe(2);
    let log = solve(undefined, round, ids(lopsided), 0, 1);
    expect(log.wrong).toHaveLength(20);
    const second = pickSeodang(lopsided, log, 2);
    const fresh = second.filter((q) => statusOf(log, q.id).status === 'new');
    expect(fresh).toHaveLength(10);
    log = solve(log, second, ids(lopsided), 1, 2);
  });

  it('문제가 모자라거나 없어도 돈다', () => {
    expect(pickSeodang([], undefined, 1)).toEqual([]);
    const small = bankTopic('small', 7, [2, 3, 2]);
    expect(pickSeodang(small, undefined, 1)).toHaveLength(7);
  });

  it('다시 볼 문제만 풀기: 틀린 차례대로', () => {
    let log = recordAnswer(undefined, topic[5].id, false);
    log = recordAnswer(log, topic[2].id, false);
    log = recordAnswer(log, topic[9].id, true);
    expect(ids(reviewList(topic, log))).toEqual([topic[5].id, topic[2].id]);
  });
});

describe('겨루기의 문제 차례', () => {
  const ask = (logs: Record<string, QuizLog> = {}, questions: Question[] = allQuestions, earlier: string[] = []) =>
    battleAsk({ questions, logs, episode: episode41, earlier, seed: 1 });
  const info = (exclude: string[] = [], right = 0) => ({ exclude, right, turn: 1 });
  const levelOf = (id: string | null) => allQuestions.find((q) => q.id === id)?.level;
  const topicOf = (id: string | null, list = allQuestions) => list.find((q) => q.id === id)?.topic;

  it('그 에피소드의 이야기 문제부터, 쉬움 먼저', () => {
    const id = ask().card(cardById['skill-reckon'], info());
    expect(topicOf(id)).toBe('ep-s1395-1');
    expect(levelOf(id)).toBe(1);
    expect(levelOf(ask().card(cardById['skill-reckon'], info([], 2)))).toBe(2);
    expect(levelOf(ask().card(cardById['skill-reckon'], info([], 4)))).toBe(3);
    expect(askLevel(0)).toBe(1);
  });

  it('이야기 문제를 다 내면 이어진 서당 주제(카드의 topic 꼬리표)로', () => {
    const story = ids(storyQuestions);
    const id = ask().card(cardById['skill-tithe'], info(story));
    expect(topicOf(id)).toBe('soc5-2-2');
    const id2 = ask().card(cardById['skill-reckon'], info(story));
    expect(topicOf(id2)).toBe('soc5-2-1');
  });

  it('같은 차례 안에서는 안 푼 것 → 다시 볼 것 → 오래전에 맞힌 것', () => {
    const easy = storyQuestions.filter((q) => q.level === 1);
    let log: QuizLog | undefined;
    for (const q of easy.slice(0, 4)) log = recordAnswer(log, q.id, true);
    log = recordAnswer(log, easy[4].id, false);
    const logs = { 'ep-s1395-1': log as QuizLog };
    expect(ask(logs).card(cardById['skill-reckon'], info())).toBe(easy[5].id);
    expect(ask(logs).card(cardById['skill-reckon'], info([easy[5].id]))).not.toBe(easy[0].id);
    // 이야기 문제가 모두 풀린 뒤라면 다시 볼 것이 맞힌 것보다 먼저
    let all: QuizLog | undefined;
    for (const q of storyQuestions) all = recordAnswer(all, q.id, q.id !== easy[3].id);
    expect(ask({ 'ep-s1395-1': all as QuizLog }).card(cardById['skill-reckon'], info())).toBe(easy[3].id);
  });

  it("문제의 'card:<id>' 표시가 그 카드에 먼저", () => {
    const marked = storyQuestions.map((q, i) => (i === 15 ? { ...q, tags: [...(q.tags ?? []), 'card:skill-soil'] } : q));
    expect(ask({}, marked).card(cardById['skill-soil'], info())).toBe(marked[15].id);
    expect(ask({}, marked).card(cardById['skill-reckon'], info())).not.toBe(marked[15].id);
  });

  it('앞 에피소드 → 견주기 차례, 아직 겪지 않은 에피소드의 이야기 문제는 내지 않는다', () => {
    const earlierQ = makeQuestion('ep-s1395-0-001', 'ep-s1395-0', 1, { tags: ['ep:s1395-0'] });
    const laterQ = makeQuestion('ep-s1395-3-001', 'ep-s1395-3', 1, { tags: ['theme:duty'] });
    const themeQ = makeQuestion('theme-1-0001', 'theme-duty', 1, { tags: ['theme:duty'] });
    const card = { ...cardById['skill-reckon'], tags: ['ep:s1395-1', 'ep:s1395-0', 'theme:duty'] };
    const qs = [...storyQuestions, earlierQ, laterQ, themeQ];
    const input = { episode: episode41, earlier: ['ep-s1395-0'] };
    expect(sourceRank(card, storyQuestions[0], input)).toBe(1);
    expect(sourceRank(card, earlierQ, input)).toBe(2);
    expect(sourceRank(card, bank21[0], input)).toBe(6);
    expect(sourceRank(card, themeQ, input)).toBe(4);
    expect(sourceRank(card, laterQ, input)).toBe(0);
    const ex = ids(storyQuestions);
    expect(ask({}, qs, ['ep-s1395-0']).card(card, info(ex))).toBe(earlierQ.id);
    expect(ask({}, qs, ['ep-s1395-0']).card(card, info([...ex, earlierQ.id]))).toBe(themeQ.id);
  });

  it('겨루기에는 고르기·OX·순서 셋까지·짝 두 쌍까지·지도에서 찍기만', () => {
    expect(battleReady({ form: 'pick' })).toBe(true);
    expect(battleReady({ form: 'ox' })).toBe(true);
    expect(battleReady({ form: 'map' })).toBe(true);
    expect(battleReady({ form: 'order', items: ['a', 'b', 'c'] })).toBe(true);
    expect(battleReady({ form: 'order', items: ['a', 'b', 'c', 'd'] })).toBe(false);
    expect(battleReady({ form: 'match', pairs: [['a', 'b'], ['c', 'd']] })).toBe(true);
    expect(battleReady({ form: 'match', pairs: [['a', 'b'], ['c', 'd'], ['e', 'f']] })).toBe(false);
    for (const form of ['blank', 'number', 'picture', 'listen', 'passage'] as const) expect(battleReady({ form })).toBe(false);
    const onlyLong = storyQuestions.map((q) => ({ ...q, form: 'passage' as const }));
    expect(ask({}, onlyLong).card(cardById['skill-reckon'], info())).toBeNull();
  });

  it('은행이 비어 있어도 돈다(null)', () => {
    expect(ask({}, []).card(cardById['skill-reckon'], info())).toBeNull();
    expect(ask({}, []).wisdom(3, { exclude: [] })).toEqual([]);
  });

  it('지혜 겨루기: 핵심 물음에서 안 푼 것·다시 볼 것 먼저(핵심이 비었으면 이야기 문제의 core 꼬리표)', () => {
    let log: QuizLog | undefined;
    for (const q of storyQuestions.slice(0, 4)) log = recordAnswer(log, q.id, true);
    log = recordAnswer(log, storyQuestions[4].id, false);
    const three = ask({ 'ep-s1395-1': log as QuizLog }).wisdom(3, { exclude: [] });
    expect(three).toHaveLength(3);
    expect(three.slice(0, 2).sort()).toEqual([storyQuestions[5].id, storyQuestions[6].id].sort());
    expect(three[2]).toBe(storyQuestions[4].id);
    const noCore = battleAsk({ questions: allQuestions, logs: {}, episode: { ...episode41, core: [] }, seed: 1 }).wisdom(3, { exclude: [] });
    for (const id of noCore) expect(storyQuestions.slice(0, 7).map((q) => q.id)).toContain(id);
  });
});

describe('귀띔', () => {
  it('틀린 고를 것 하나를 지운다 — 답은 지우지 않고, 둘은 남기고, 씨앗이 같으면 같다', () => {
    const q = makeQuestion('x-1', 'x', 1, { choices: ['가', '나', '다', '라'], answer: 2 });
    for (let seed = 1; seed <= 30; seed++) {
      const a = hintChoice(q, seed);
      expect(a).not.toBeNull();
      expect(a).not.toBe(2);
      expect(hintChoice(q, seed)).toBe(a);
      const b = hintChoice(q, seed, [a as number]);
      expect(b).not.toBe(2);
      expect(b).not.toBe(a);
      expect(hintChoice(q, seed, [a as number, b as number])).toBeNull();
    }
    expect(hintChoice({ ...q, form: 'ox', choices: undefined, answer: 0 }, 1)).toBeNull();
    expect(hintChoice({ ...q, choices: ['가', '나'], answer: 0 }, 1)).toBeNull();
  });
});
