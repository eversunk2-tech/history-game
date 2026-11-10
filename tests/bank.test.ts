// 문제 검사 규칙(src/content/bankRules.ts — spec 9.7의 2번, 11.1 다 "문제 전수")과 은행의 뼈대(src/content/bank/).
// ① 실제 문제(①-1의 이야기 문제 20 + 은행 파일 — ㉮가 넣는 것)가 잘못 0 ② 규칙마다 틀린 견본을 넣어 그 규칙이 잡는다.

import { describe, expect, it } from 'vitest';
import {
  BANK_SIZES,
  SOURCE_ID,
  STANDARDS,
  asksYear,
  bankErrors,
  checkBank,
  checkQuestion,
  checkTopic,
  filterQuestions,
  isBattleReady,
  similarity,
  slotOf,
  type BankContext,
} from '../src/content/bankRules';
import { bankQuestions, bankReadIssues, bankTopics, checkBankFiles, readBankFile } from '../src/content/bank';
import { bankSources } from '../src/content/bank/sources';
import { s1395_1 } from '../src/content/episodes/s1395';
import { sources4 } from '../src/content/four';
import { skills } from '../src/content/skills';
import { storyQuestions, storyTopics } from '../src/content/situations/s1395/questions';
import { SOURCE_ID as VALIDATE_SOURCE_ID } from '../src/content/validate';
import { battleReady, bitIndex } from '../src/engine/quiz';
import type { Question, Topic } from '../src/engine/types4';

const CTX: BankContext = { sources: new Set(sources4.map((s) => s.id)), cards: new Set(skills.map((s) => s.id)), episodes: new Set(['s1395-1']) };
const rulesOf = (issues: { level: string; rule: string }[]): string[] => [...new Set(bankErrors(issues as never).map((i) => i.rule))].sort();

/** 맞는 견본 하나(고르기) */
const good = (over: Partial<Question> = {}): Question => ({
  id: 'soc5-2-1-0001',
  grade: 5,
  subject: 'social',
  topic: 'soc5-2-1',
  standard: '[6사05-01]',
  form: 'pick',
  ask: '조선이 새 도읍으로 정한 곳은 어디일까요?',
  choices: ['개경', '한양', '경주', '평양'],
  answer: 1,
  explain: '조선은 한양을 새 도읍으로 정했어요.',
  level: 1,
  facts: ['F34'],
  by: 'claude',
  ver: 1,
  ...over,
});

/** 맞는 주제 하나(문제 n개, 어려움 3:5:2) */
function topicOf(n: number, kind: 'bank' | 'story' = 'bank'): { topic: Topic; questions: Question[] } {
  const id = kind === 'bank' ? 'soc5-2-1' : 'ep-s1395-1';
  const topic: Topic = { id, grade: 5, subject: 'social', title: '시험 주제', unit: '5-2 2단원', standards: ['[6사05-01]'], count: n, bankVer: '2026-11-10', kind };
  const easy = Math.round(n * 0.3);
  const mid = Math.round(n * 0.5);
  const words = ['궁궐', '종묘', '사직단', '도성', '대문', '향교', '성균관', '서원', '서당', '한양', '삼강행실도', '관혼상제', '양반', '중인', '상민', '천민', '노비', '과거', '유교', '효도'];
  const questions = Array.from({ length: n }, (_, i): Question => {
    const no = String(i + 1).padStart(kind === 'bank' ? 4 : 3, '0');
    return good({
      id: `${id}-${no}`,
      topic: id,
      ask: `${words[i % words.length]}에 대해 묻는 ${i + 1}번째 물음 ${'가나다라마바사아자차카타파하'[i % 14]}${Math.floor(i / 14)}은 무엇일까요?`,
      choices: [`보기${i}가`, `보기${i}나`, `보기${i}다`, `보기${i}라`],
      answer: i % 4,
      level: i < easy ? 1 : i < easy + mid ? 2 : 3,
    });
  });
  return { topic, questions };
}

describe('실제 문제는 잘못이 없다', () => {
  it('①-1의 이야기 문제 20: 문제 전수 검사 잘못 0(알림도 0)', () => {
    const issues = checkBank(storyTopics, storyQuestions, CTX);
    expect(issues.map((i) => `${i.where}: ${i.message}`)).toEqual([]);
    expect(storyQuestions).toHaveLength(20);
  });

  it('이야기 문제 20의 짜임: 쉬움 6·보통 10·어려움 4, 겨루기 꼴만, 핵심 일곱은 에피소드 표와 같다, 연도를 묻는 문제는 둘 안', () => {
    expect([1, 2, 3].map((l) => storyQuestions.filter((q) => q.level === l).length)).toEqual([6, 10, 4]);
    expect(storyQuestions.every(isBattleReady)).toBe(true);
    expect(storyQuestions.filter((q) => q.tags?.includes('core')).map((q) => q.id)).toEqual(s1395_1.core);
    expect(s1395_1.core).toHaveLength(7);
    expect(storyQuestions.filter(asksYear).length).toBeLessThanOrEqual(2);
    expect(storyQuestions.every((q) => q.tags?.includes('ep:s1395-1'))).toBe(true);
  });

  it('은행 파일(㉮가 넣는 것): 읽기와 검사 잘못 0. 비어 있어도 돈다', () => {
    expect(bankReadIssues).toEqual([]);
    expect(bankErrors(checkBankFiles(CTX))).toEqual([]);
    expect(bankQuestions.length).toBe(bankTopics.reduce((sum, t) => sum + t.count, 0));
    for (const topic of bankTopics) expect(topic.kind).toBe('bank');
  });

  it('은행의 근거는 F86부터(이미 있는 번호를 다시 적지 않는다)', () => {
    for (const s of bankSources) {
      expect(SOURCE_ID.test(s.id), s.id).toBe(true);
      expect(Number(s.id.slice(1)), s.id).toBeGreaterThanOrEqual(86);
    }
    expect(new Set(sources4.map((s) => s.id)).size).toBe(sources4.length);
  });
});

describe('공용 셈이 엔진·검사기와 같다', () => {
  it('근거 번호의 꼴은 검사기와 하나다: F01~F85·F86부터(세 자리까지)·E1~E13', () => {
    expect(VALIDATE_SOURCE_ID).toBe(SOURCE_ID);
    for (const ok of ['F01', 'F85', 'F86', 'F123', 'E1', 'E9', 'E13']) expect(SOURCE_ID.test(ok), ok).toBe(true);
    for (const bad of ['F1', 'F1234', 'E', 'E123', 'T5', 'calc', 'f04']) expect(SOURCE_ID.test(bad), bad).toBe(false);
  });

  it('겨루기 꼴의 셈(isBattleReady)과 비트 자리(slotOf)가 퀴즈 엔진과 같다', () => {
    const samples: Pick<Question, 'form' | 'items' | 'pairs'>[] = [
      { form: 'pick' },
      { form: 'ox' },
      { form: 'map' },
      { form: 'order', items: ['a', 'b', 'c'] },
      { form: 'order', items: ['a', 'b', 'c', 'd'] },
      { form: 'match', pairs: [['a', 'b'], ['c', 'd']] },
      { form: 'match', pairs: [['a', 'b'], ['c', 'd'], ['e', 'f']] },
      { form: 'blank' },
      { form: 'passage' },
      { form: 'number' },
    ];
    for (const q of samples) expect(isBattleReady(q), JSON.stringify(q)).toBe(battleReady(q));
    for (const id of ['soc5-2-1-0042', 'ep-s1395-1-007', 'soc5-2-1-0001', 'x-abc']) expect(slotOf(id), id).toBe(bitIndex(id));
  });

  it('성취기준 목록: 역사 아홉과 독도', () => {
    expect(STANDARDS).toHaveLength(10);
    expect(STANDARDS).toContain('[6사05-01]');
    expect(BANK_SIZES).toEqual([40, 60, 80]);
  });
});

describe('규칙마다 틀린 견본을 잡는다 — 문제 하나', () => {
  const rule = (q: unknown) => rulesOf(checkQuestion(q, CTX));

  it('맞는 견본은 통과한다(고르기·OX·순서·짝·지도·수 넣기)', () => {
    expect(rule(good())).toEqual([]);
    expect(rule(good({ form: 'ox', choices: undefined, answer: 0 }))).toEqual([]);
    expect(rule(good({ form: 'order', choices: undefined, items: ['나라 이름이 조선', '도읍을 한양으로', '궁궐을 다 지음'], answer: [0, 1, 2] }))).toEqual([]);
    expect(rule(good({ form: 'match', choices: undefined, pairs: [['종묘', '왕과 왕비의 제사'], ['사직단', '땅과 곡식의 신']], answer: [0, 1] }))).toEqual([]);
    expect(rule(good({ form: 'map', choices: undefined, spot: { map: 'hanyang', x: 10, y: 20, r: 4 }, answer: '종묘' }))).toEqual([]);
    expect(rule(good({ subject: 'math', standard: '[6사05-01]', form: 'number', choices: undefined, answer: '3/4', facts: ['calc'] }))).toEqual([]);
  });

  it('shape: 칸이 없거나 꼴이 다르다', () => {
    expect(rule(null)).toEqual(['shape']);
    expect(rule({ ...good(), grade: 4 })).toEqual(['shape']);
    expect(rule({ ...good(), form: 'essay' })).toEqual(['shape']);
    expect(rule({ ...good(), ver: 0 })).toEqual(['shape']);
    expect(rule({ ...good(), by: 'student' })).toEqual(['shape']);
    expect(rule({ ...good(), facts: 'F34' })).toEqual(['shape']);
    expect(rule({ ...good(), explain: '' })).toEqual(['shape']);
  });

  it('budget: 물음 80 · 고를 것 30 · 풀이 60자 안', () => {
    expect(rule(good({ ask: '가'.repeat(81) }))).toEqual(['budget']);
    expect(rule(good({ ask: '가'.repeat(80) }))).toEqual([]);
    expect(rule(good({ choices: ['개경', '한양', '경주', '가'.repeat(31)] }))).toEqual(['budget']);
    expect(rule(good({ explain: `${'가'.repeat(59)}요.` }))).toEqual(['budget']);
  });

  it('answer: 답이 고를 것 안에 꼭 하나(0부터 센 차례), OX는 0·1, 순서·짝은 [0, 1, …]', () => {
    expect(rule(good({ answer: 4 }))).toEqual(['answer']);
    expect(rule(good({ answer: -1 }))).toEqual(['answer']);
    expect(rule(good({ answer: [1] }))).toEqual(['answer']);
    expect(rule(good({ answer: 1.5 }))).toEqual(['answer']);
    expect(rule(good({ choices: ['한양'], answer: 0 }))).toEqual(['answer']);
    expect(rule(good({ choices: ['가', '나', '다', '라', '마'], answer: 0 }))).toEqual(['answer']);
    expect(rule(good({ form: 'ox', choices: undefined, answer: 2 }))).toEqual(['answer']);
    expect(rule(good({ form: 'ox', choices: ['O', 'X'], answer: 0 }))).toEqual(['answer']);
    expect(rule(good({ form: 'order', choices: undefined, items: ['가', '나', '다'], answer: [0, 2, 1] }))).toEqual(['answer']);
    expect(rule(good({ form: 'order', choices: undefined, items: ['가', '나'], answer: [0, 1] }))).toEqual(['answer']);
    expect(rule(good({ form: 'match', choices: undefined, pairs: [['가', '나']], answer: [0] }))).toEqual(['answer']);
    expect(rule(good({ form: 'map', choices: undefined, answer: '종묘' }))).toEqual(['answer']);
    expect(rule(good({ subject: 'math', form: 'number', choices: undefined, answer: 'three', facts: ['calc'] }))).toEqual(['answer']);
  });

  it('choices-dup: 고를 것·낱장·짝의 한쪽끼리 겹치지 않는다', () => {
    expect(rule(good({ choices: ['한양', '개경', '한양 ', '경주'] }))).toEqual(['choices-dup']);
    expect(rule(good({ form: 'order', choices: undefined, items: ['가', '가', '다'], answer: [0, 1, 2] }))).toEqual(['choices-dup']);
    expect(rule(good({ form: 'match', choices: undefined, pairs: [['종묘', '제사'], ['종묘', '곡식']], answer: [0, 1] }))).toEqual(['choices-dup']);
  });

  it('facts: 근거 번호가 1개 이상이고 근거 목록에 있다(수학만 calc)', () => {
    expect(rule(good({ facts: [] }))).toEqual(['facts']);
    expect(rule(good({ facts: ['F99'] }))).toEqual(['facts']);
    expect(rule(good({ facts: ['F4'] }))).toEqual(['facts']);
    expect(rule(good({ facts: ['calc'] }))).toEqual(['facts']);
  });

  it('standard: 성취기준이 목록에 있다', () => {
    expect(rule(good({ standard: '[6사09-01]' }))).toEqual(['standard']);
    expect(rule(good({ standard: '' }))).toEqual(['standard']);
  });

  it('explain-yo: 풀이는 "~요"로 끝난다', () => {
    expect(rule(good({ explain: '조선은 한양을 새 도읍으로 정했다.' }))).toEqual(['explain-yo']);
    expect(rule(good({ explain: '조선은 한양을 새 도읍으로 정했어요!' }))).toEqual([]);
  });

  it('banned: 쓰지 않기로 한 낱말(낮추는 말·벌주는 묘사·믿음을 그르다 하는 말)', () => {
    expect(rule(good({ ask: '왜놈이 쳐들어온 해는 언제일까요?' }))).toContain('banned');
    expect(rule(good({ choices: ['개경', '한양', '경주', '미신을 믿어서'] }))).toEqual(['banned']);
    expect(rule(good({ explain: '노비는 곤장을 맞았어요.' }))).toEqual(['banned']);
  });

  it('tale: 옛이야기 속 존재는 역사 문제에 섞지 않는다(해치·삼족오는 된다)', () => {
    expect(rule(good({ ask: '도깨비가 좋아한 놀이는 무엇일까요?' }))).toEqual(['tale']);
    expect(rule(good({ choices: ['개경', '한양', '경주', '불가사리'] }))).toEqual(['tale']);
    expect(rule(good({ ask: '궁궐 앞에 둔 해치는 무엇을 가린다고 여겼을까요?' }))).toEqual([]);
  });

  it('side: "왼쪽·오른쪽"이 든 문제는 사람이 검증해야(checked) 통과한다', () => {
    expect(rule(good({ ask: '궁궐의 왼쪽에 있는 것은 무엇일까요?' }))).toEqual(['side']);
    expect(rule(good({ ask: '임금이 궁궐에서 남쪽을 바라볼 때 왼쪽에 있는 것은 무엇일까요?', checked: { by: '사용자', on: '2026-11-10' } }))).toEqual([]);
    expect(rule(good({ explain: '종묘는 궁궐 오른편에 있어요.' }))).toEqual(['side']);
  });

  it("lesson: 지도서 근거 'E9'와 차시는 함께, 차시는 '2단원 2~3차시' 꼴이고 쪽수를 적지 않는다", () => {
    expect(rule(good({ facts: ['F34', 'E9'] }))).toEqual(['lesson']);
    expect(rule(good({ lesson: '2단원 2~3차시' }))).toEqual(['lesson']);
    expect(rule(good({ facts: ['F34', 'E9'], lesson: '2단원 2~3차시 48쪽' }))).toEqual(['lesson']);
    expect(rule(good({ facts: ['F34', 'E9'], lesson: '2단원 8차시' }))).toEqual([]);
  });

  it('tags: 꼬리표는 id로(카드·에피소드가 있고 꼴이 맞다)', () => {
    expect(rule(good({ tags: ['card:논둑 쌓기'] }))).toEqual(['tags']);
    expect(rule(good({ tags: ['card:skill-nothing'] }))).toEqual(['tags']);
    expect(rule(good({ tags: ['ep:s1395-9'] }))).toEqual(['tags']);
    expect(rule(good({ tags: ['theme:food'] }))).toEqual(['tags']);
    expect(rule(good({ tags: ['hint:x'] }))).toEqual(['tags']);
    expect(rule(good({ tags: ['core', 'ep:s1395-1', 'card:skill-bund', 'theme:duty', 'topic:soc5-2-1'] }))).toEqual([]);
  });

  it('받은 문제를 거를 때 꼴이 틀린 것은 버린다(filterQuestions)', () => {
    const kept = filterQuestions([good(), { ...good(), answer: 9 }, 'x', null, good({ id: 'soc5-2-1-0002' })], CTX);
    expect(kept.map((q) => q.id)).toEqual(['soc5-2-1-0001', 'soc5-2-1-0002']);
  });
});

describe('규칙마다 틀린 견본을 잡는다 — 주제와 묶음', () => {
  const rule = (topic: Topic, questions: Question[]) => rulesOf(checkTopic(topic, questions, CTX));

  it('맞는 견본: 은행 80(24·40·16)과 이야기 20(6·10·4)은 통과한다', () => {
    const bank = topicOf(80);
    expect(checkTopic(bank.topic, bank.questions, CTX).map((i) => i.message)).toEqual([]);
    const story = topicOf(20, 'story');
    expect(checkTopic(story.topic, story.questions, CTX).map((i) => i.message)).toEqual([]);
  });

  it('count: 주제의 count와 실제 수, 은행은 40·60·80, 이야기는 15~20', () => {
    const t = topicOf(80);
    expect(rule({ ...t.topic, count: 79 }, t.questions)).toEqual(['count']);
    const odd = topicOf(70);
    expect(rule(odd.topic, odd.questions)).toEqual(['count']);
    const long = topicOf(21, 'story');
    expect(rule(long.topic, long.questions)).toEqual(['count']);
  });

  it('level-mix: 쉬움 3 : 보통 5 : 어려움 2(±1)', () => {
    const t = topicOf(80);
    const skew = t.questions.map((q, i) => (i < 30 ? { ...q, level: 1 as const } : q));
    expect(rule(t.topic, skew)).toEqual(['level-mix']);
    const near = t.questions.map((q, i) => (i === 30 ? { ...q, level: 1 as const } : q)); // 25·39·16 — ±1 안
    expect(rule(t.topic, near)).toEqual([]);
  });

  it('year-share: 연도를 그대로 묻는 문제는 열에 하나 안', () => {
    const t = topicOf(20, 'story');
    const years = t.questions.map((q, i) => (i < 3 ? { ...q, ask: `${i}번째로 묻는 이 일이 일어난 것은 몇 년일까요?` } : q));
    expect(rule(t.topic, years)).toEqual(['year-share']);
    expect(rule(t.topic, years.slice(1).concat(t.questions[0]))).toEqual([]);
    expect(asksYear({ form: 'pick', ask: '언제 옮겼을까요?', choices: ['1392년', '1394년', '1395년', '1398년'], answer: 1 })).toBe(true);
    expect(asksYear({ form: 'pick', ask: '1394년에 옮겨 간 곳은?', choices: ['개경', '한양', '경주', '평양'], answer: 1 })).toBe(false);
  });

  it('id: 주제 id + 번호(은행 네 자리·이야기 세 자리), 1부터, 겹침 없음', () => {
    const t = topicOf(80);
    expect(rule(t.topic, t.questions.map((q, i) => (i === 0 ? { ...q, id: 'soc5-2-1-001' } : q)))).toEqual(['id']);
    expect(rule(t.topic, t.questions.map((q, i) => (i === 0 ? { ...q, id: 'soc5-2-1-0000' } : q)))).toEqual(['id']);
    expect(rule(t.topic, t.questions.map((q, i) => (i === 1 ? { ...q, id: t.questions[0].id } : q)))).toEqual(['id']);
    const s = topicOf(20, 'story');
    expect(rule(s.topic, s.questions.map((q, i) => (i === 0 ? { ...q, id: 'ep-s1395-1-0001' } : q)))).toEqual(['id']);
  });

  it('battle-form: 이야기 문제는 겨루기 꼴만(순서 셋·짝 두 쌍까지)', () => {
    const s = topicOf(20, 'story');
    const four = s.questions.map((q, i) => (i === 0 ? { ...q, form: 'order' as const, choices: undefined, items: ['가', '나', '다', '라'], answer: [0, 1, 2, 3] } : q));
    expect(rule(s.topic, four)).toEqual(['battle-form']);
    const blank = s.questions.map((q, i) => (i === 0 ? { ...q, form: 'blank' as const } : q));
    expect(rule(s.topic, blank)).toEqual(['battle-form']);
    // 은행 주제는 서당에서만 나오는 꼴도 된다(겨루기는 퀴즈 엔진이 거른다)
    const t = topicOf(80);
    expect(rule(t.topic, t.questions.map((q, i) => (i === 0 ? { ...q, form: 'blank' as const } : q)))).toEqual([]);
  });

  it('ask-same: 같거나 아주 비슷한 물음에 답도 같으면 잘못, 답이 다르면 사람이 본다', () => {
    const t = topicOf(80);
    const same = t.questions.map((q, i) => (i === 1 ? { ...q, ask: t.questions[0].ask, choices: t.questions[0].choices, answer: t.questions[0].answer } : q));
    expect(rule(t.topic, same)).toEqual(['ask-same']);
    const near = t.questions.map((q, i) => (i === 1 ? { ...q, ask: `${t.questions[0].ask} `, choices: ['다른 가', '다른 나', '다른 다', '다른 라'] } : q));
    const issues = checkTopic(t.topic, near, CTX);
    expect(rulesOf(issues)).toEqual([]);
    expect(issues.some((i) => i.level === 'gap' && i.rule === 'ask-similar')).toBe(true);
    expect(similarity('조선이 새 도읍으로 정한 곳은?', '조선이 새 도읍으로 정한 곳은?')).toBe(1);
    expect(similarity('종묘는 무엇일까요?', '사직단은 무엇일까요?')).toBeLessThan(0.8);
  });

  it('topic: 주제의 꼴과 성취기준, 문제의 학년·과목, 없는 주제, 주제 id 겹침', () => {
    const t = topicOf(80);
    expect(rule({ ...t.topic, bankVer: '어제' }, t.questions)).toEqual(['topic']);
    expect(rule({ ...t.topic, kind: 'quiz' as never }, t.questions)).toEqual(['topic']);
    expect(rule({ ...t.topic, standards: ['[6사09-09]'] }, t.questions)).toContain('standard');
    expect(rule(t.topic, t.questions.map((q, i) => (i === 0 ? { ...q, grade: 6 as const } : q)))).toEqual(['topic']);
    expect(rulesOf(checkBank([t.topic], [...t.questions, good({ id: 'soc9-9-9-0001', topic: 'soc9-9-9' })], CTX))).toEqual(['topic']);
    expect(rulesOf(checkBank([t.topic, t.topic], t.questions, CTX))).toContain('topic');
  });

  it('은행 파일의 꼴: { topic, questions }, 파일 이름 = 주제 id, kind는 bank, 문제의 주제 = 파일의 주제', () => {
    const t = topicOf(80);
    expect(readBankFile('./soc5-2-1.json', { topic: t.topic, questions: t.questions }).issues).toEqual([]);
    expect(readBankFile('./soc5-2-1.json', [t.questions]).issues.map((i) => i.rule)).toEqual(['file']);
    expect(readBankFile('./soc5-2-2.json', { topic: t.topic, questions: t.questions }).issues.map((i) => i.rule)).toEqual(['file']);
    expect(readBankFile('./soc5-2-1.json', { topic: { ...t.topic, kind: 'story' }, questions: t.questions }).issues.map((i) => i.rule)).toEqual(['file']);
    const read = readBankFile('./soc5-2-1.json', { topic: t.topic, questions: t.questions });
    expect(bankErrors(checkBankFiles(CTX, [{ path: './soc5-2-1.json', ...read }]))).toEqual([]);
  });
});
