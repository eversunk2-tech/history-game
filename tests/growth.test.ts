// 성장 엔진 시험(spec 5.5·5.6, 11.1 사의 ㉡ 칸 "경험치와 돈의 균형"): 경험치 곡선과 5.5의 표, 레벨 상한(4-1은 5)과 쌓아 둔 경험치,
// 능력치 점, 기운·귀띔·기세 칸, 에피소드의 경험치(처음 깸 160, 이야기 배수, 다시 하기와 하루 세 판), 서당의 경험치(문제마다·끝까지·
// 같은 주제 반·0·하루 300), 꾸미기·가게·걷기의 경험치 0, 일곱 이야기 흉내 판의 끝 레벨(29~30 ±2).

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import {
  IDLE_ACTIONS,
  LEVEL_CAP_41,
  addXp,
  battleHp,
  capFor,
  episodeXp,
  hintsFor,
  momentumFull,
  newHero,
  placePoint,
  raiseCap,
  rollDay,
  seodangXp,
  xpEver,
  xpOfAction,
  xpToNext,
  xpTotalAt,
  type Today,
} from '../src/engine/growth';
import { emptyLog, pickSeodang, recordAnswer } from '../src/engine/quiz';
import { mulberry32 } from '../src/engine/rng';
import type { Hero, Question, QuizLog } from '../src/engine/types4';
import { bankTopic } from './fixtures4';

describe('레벨과 경험치', () => {
  it('L에서 L+1로 100 + 15 × L(1→2는 115, 29→30은 535)', () => {
    expect(xpToNext(1)).toBe(115);
    expect(xpToNext(29)).toBe(535);
  });

  it('모인 경험치가 5.5의 표와 같다', () => {
    const table: Record<number, number> = { 5: 550, 8: 1120, 10: 1575, 13: 2370, 15: 2975, 17: 3640, 20: 4750, 24: 6440, 26: 7375, 30: 9425 };
    for (const [level, total] of Object.entries(table)) expect(xpTotalAt(Number(level))).toBe(total);
    expect(xpTotalAt(1)).toBe(0);
  });

  it('새 주인공은 레벨 1, 능력치 3·3·3·3, 점 0', () => {
    const hero = newHero('girl');
    expect(hero).toMatchObject({ level: 1, xp: 0, banked: 0, points: 0, stats: { power: 3, wisdom: 3, craft: 3, heart: 3 }, deck: [] });
  });

  it('경험치가 차면 레벨이 오르고 오를 때마다 능력치 점 하나', () => {
    const { hero, levels } = addXp(newHero('boy'), 115 + 130 + 10, 30);
    expect(hero.level).toBe(3);
    expect(hero.xp).toBe(10);
    expect(levels).toBe(2);
    expect(hero.points).toBe(2);
    expect(() => addXp(hero, -1, 30)).toThrow();
  });

  it('4-1의 상한은 5: 넘는 것은 쌓아 두고(잃지 않는다), 상한이 오르면 들어간다', () => {
    expect(LEVEL_CAP_41).toBe(5);
    const big = addXp(newHero('boy'), 1000, LEVEL_CAP_41);
    expect(big.hero.level).toBe(5);
    expect(big.hero.xp).toBe(0);
    expect(big.hero.banked).toBe(1000 - 550);
    expect(big.banked).toBe(450);
    expect(xpEver(big.hero)).toBe(1000);
    const more = addXp(big.hero, 40, LEVEL_CAP_41);
    expect(more.hero.banked).toBe(490);
    expect(more.levels).toBe(0);
    const opened = raiseCap(more.hero, capFor(['s1395']));
    expect(capFor(['s1395'])).toBe(9);
    expect(opened.hero.level).toBe(7);
    expect(opened.hero.banked).toBe(0);
    expect(opened.hero.points).toBe(6);
    expect(xpEver(opened.hero)).toBe(1040);
  });

  it('상한: 열린 이야기 가운데 가장 뒤의 권장 레벨 끝 + 2, 30까지', () => {
    expect(capFor(['s1395', 's1446'])).toBe(14);
    expect(capFor(['s1899'])).toBe(30);
    expect(capFor([])).toBe(1);
  });

  it('능력치 점: 하나에 15까지, 점이 없으면 둘 수 없다', () => {
    let hero: Hero = { ...newHero('boy'), points: 20 };
    for (let i = 0; i < 12; i++) hero = placePoint(hero, 'power');
    expect(hero.stats.power).toBe(15);
    expect(() => placePoint(hero, 'power')).toThrow();
    expect(() => placePoint({ ...hero, points: 0 }, 'heart')).toThrow();
    expect(placePoint(hero, 'heart').points).toBe(7);
  });
});

describe('겨루기의 몸', () => {
  it('기운 = 20 + 힘 × 3 + 레벨 × 2 − (5 − 기력)⁺ × 3(레벨 1·힘 3 → 31), 아무리 지쳐도 10', () => {
    expect(battleHp(1, 3, 6)).toBe(31);
    expect(battleHp(1, 3, 5)).toBe(31);
    expect(battleHp(1, 3, 4)).toBe(28);
    expect(battleHp(1, 3, 0)).toBe(16);
    expect(battleHp(30, 15, 10)).toBe(20 + 45 + 60);
    expect(battleHp(1, 0, 0)).toBe(BALANCE.hpFloor);
  });

  it('귀띔은 큰 고비마다 1 + 지혜 5마다 1, 기세는 세 칸(어울림 8 이상이면 두 칸)', () => {
    expect(hintsFor(3, true)).toBe(1);
    expect(hintsFor(4, true)).toBe(1);
    expect(hintsFor(5, true)).toBe(2);
    expect(hintsFor(15, true)).toBe(4);
    expect(hintsFor(9, false)).toBe(1);
    expect(momentumFull(7)).toBe(3);
    expect(momentumFull(8)).toBe(2);
  });
});

describe('에피소드의 경험치', () => {
  const stars3 = [true, true, true];

  it('①-1 처음 깸·별 셋 = 큰 고비 80 + 작은 고비 둘 30 + 도감 20 + 별 30 = 160', () => {
    expect(episodeXp({ story: 's1395', first: true, stars: stars3, minors: 2, book: 10 }).xp).toBe(160);
    expect(episodeXp({ story: 's1395', first: true, stars: stars3, minors: 2, book: 40 }).xp).toBe(160);
    expect(episodeXp({ story: 's1395', first: true, stars: [true, false, false], minors: 2, book: 3 }).xp).toBe(80 + 30 + 6 + 10);
  });

  it('이야기 배수: ② ×1.2 … ⑦ ×1.55', () => {
    expect(episodeXp({ story: 's1446', first: true, stars: stars3, minors: 2, book: 10 }).xp).toBe(192);
    expect(episodeXp({ story: 's1899', first: true, stars: stars3, minors: 2, book: 10 }).xp).toBe(248);
  });

  it('다시 하기 = 새로 받은 별 × 10 + 처음 깸의 10분의 1, 같은 에피소드는 하루 세 판까지(넷째 판부터 0)', () => {
    const replay = (had: boolean[], stars: boolean[], replaysToday: number) =>
      episodeXp({ story: 's1395', first: false, stars, had, minors: 2, book: 5, replaysToday }).xp;
    expect(replay([true, false, false], stars3, 0)).toBe(20 + 11);
    expect(replay(stars3, stars3, 0)).toBe(11);
    expect(replay(stars3, [true, false, false], 2)).toBe(11);
    expect(replay([true, false, false], stars3, 3)).toBe(0);
  });

  it('다시 하기 열 판을 하루에 해도 셋째 판까지만 받는다(5.6의 2번)', () => {
    let today: Today = rollDay(undefined, '2026-11-07');
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const n = today.replays['s1395-1'] ?? 0;
      total += episodeXp({ story: 's1395', first: false, stars: stars3, had: stars3, minors: 2, book: 0, replaysToday: n }).xp;
      today = { ...today, replays: { ...today.replays, 's1395-1': n + 1 } };
    }
    expect(total).toBe(3 * 11);
    // 날이 바뀌면 다시 센다
    expect(rollDay(today, '2026-11-08').replays).toEqual({});
    expect(rollDay(today, '2026-11-07')).toBe(today);
  });
});

describe('서당의 경험치', () => {
  const topic = bankTopic('soc5-2-1');
  const date = '2026-11-07';

  function round(log: QuizLog | undefined, seed: number, rate: number): { qs: Question[]; answers: { q: string; right: boolean }[] } {
    const qs = pickSeodang(topic, log, seed);
    const rng = mulberry32(seed);
    return { qs, answers: qs.map((q) => ({ q: q.id, right: rng() < rate })) };
  }

  it('처음 맞힘 4(어려움 6), 틀렸지만 풀이를 읽음 1, 끝까지 풀면 10', () => {
    const qs = [topic.find((q) => q.level === 1), topic.find((q) => q.level === 3), topic.find((q) => q.level === 2)] as Question[];
    const out = seodangXp({
      topic: 'soc5-2-1',
      questions: qs,
      answers: [
        { q: qs[0].id, right: true },
        { q: qs[1].id, right: true },
        { q: qs[2].id, right: false },
      ],
      finished: true,
      today: undefined,
      date,
    });
    expect(out.raw).toBe(4 + 6 + 1 + 10);
    expect(out.xp).toBe(21);
    const unread = seodangXp({ topic: 't', questions: qs, answers: [{ q: qs[2].id, right: false, read: false }], finished: false, today: undefined, date });
    expect(unread.raw).toBe(0);
  });

  it('이미 맞힌 문제를 다시 맞히면 0, 다시 볼 문제를 처음 맞히면 3', () => {
    let log = recordAnswer(undefined, topic[0].id, true);
    log = recordAnswer(log, topic[1].id, false);
    const out = seodangXp({
      topic: 'soc5-2-1',
      log,
      questions: topic,
      answers: [
        { q: topic[0].id, right: true },
        { q: topic[1].id, right: true },
      ],
      finished: false,
      today: undefined,
      date,
    });
    expect(out.raw).toBe(0 + 3);
  });

  it('한 판 70 안팎(처음 푸는 주제, 7할 맞힘)', () => {
    const { qs, answers } = round(undefined, 1, 0.7);
    const out = seodangXp({ topic: 'soc5-2-1', questions: qs, answers, finished: true, today: undefined, date });
    expect(out.xp).toBeGreaterThan(55);
    expect(out.xp).toBeLessThan(90);
  });

  it('같은 날 같은 주제: 둘째 판은 반, 셋째 판부터 0. 다른 주제는 따로 센다', () => {
    let today: Today | undefined;
    const got: number[] = [];
    let log: QuizLog | undefined;
    for (let i = 0; i < 4; i++) {
      const { qs, answers } = round(log, i + 1, 0.7);
      const out = seodangXp({ topic: 'soc5-2-1', log, questions: qs, answers, finished: true, today, date });
      got.push(out.xp);
      expect(out.share).toBe([1, 0.5, 0, 0][i]);
      today = out.today;
      for (const a of answers) log = recordAnswer(log, a.q, a.right, topic.map((q) => q.id));
    }
    expect(got[1]).toBeGreaterThan(0);
    expect(got[2]).toBe(0);
    expect(got[3]).toBe(0);
    const other = seodangXp({ topic: 'soc5-2-2', questions: topic, answers: [{ q: topic[0].id, right: true }], finished: true, today, date });
    expect(other.round).toBe(1);
    expect(other.xp).toBeGreaterThan(0);
    // 날이 바뀌면 같은 주제도 다시 첫 판
    const tomorrow = seodangXp({ topic: 'soc5-2-1', questions: topic, answers: [], finished: true, today, date: '2026-11-08' });
    expect(tomorrow.round).toBe(1);
    expect(tomorrow.xp).toBe(10);
  });

  it('서당 스무 판을 하루에 해도 300을 넘지 않는다(주제를 바꿔 가며도)', () => {
    let today: Today | undefined;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const name = `t${i}`;
      const qs = bankTopic(name).slice(0, 20);
      const out = seodangXp({
        topic: name,
        questions: qs,
        answers: qs.map((q) => ({ q: q.id, right: true })),
        finished: true,
        today,
        date,
      });
      total += out.xp;
      today = out.today;
    }
    expect(total).toBe(BALANCE.quizDayCap);
    expect(today?.xp).toBe(300);
  });
});

describe('배우는 행동에서만', () => {
  it('꾸미기·가게(사고팔기)·걷기·사진관·우리 집 꾸미기의 경험치는 0', () => {
    expect(IDLE_ACTIONS.length).toBeGreaterThanOrEqual(5);
    for (const action of IDLE_ACTIONS) expect(xpOfAction(action)).toBe(0);
  });
});

describe('일곱 이야기 흉내 판(5.5의 표)', () => {
  /** 이야기마다 에피소드 수(5.5 — 6·5·4·5·5·4·5 = 34)와 서당 판 수(약 30 — 이야기마다 네댓) */
  const EPISODES = [6, 5, 4, 5, 5, 4, 5];
  const SEODANG = [5, 4, 4, 4, 5, 4, 4];

  function simulate(rate = 0.7): { hero: Hero; episodeXp: number; seodangXp: number; caps: number[]; bankedAtEnd: number[] } {
    let hero = newHero('boy');
    let fromEpisodes = 0;
    let fromSeodang = 0;
    const caps: number[] = [];
    const bankedAtEnd: number[] = [];
    let day = 0;
    BALANCE.stories.forEach((story, i) => {
      // 이야기가 열리면 상한이 오르고 쌓아 둔 것이 들어간다
      const cap = capFor(BALANCE.stories.slice(0, i + 1));
      caps.push(cap);
      hero = raiseCap(hero, cap).hero;
      for (let e = 0; e < EPISODES[i]; e++) {
        const xp = episodeXp({ story, first: true, stars: [true, true, true], minors: 2, book: 10 }).xp;
        fromEpisodes += xp;
        hero = addXp(hero, xp, cap).hero;
      }
      for (let s = 0; s < SEODANG[i]; s++) {
        // 판마다 다른 날·처음 푸는 주제(같은 날 같은 주제의 막기에 걸리지 않게)
        const topic = bankTopic(`${story}-${s}`);
        const qs = pickSeodang(topic, emptyLog(), day);
        const rng = mulberry32(day + 1);
        const out = seodangXp({
          topic: `${story}-${s}`,
          questions: qs,
          answers: qs.map((q) => ({ q: q.id, right: rng() < rate })),
          finished: true,
          today: undefined,
          date: `day-${day++}`,
        });
        fromSeodang += out.xp;
        hero = addXp(hero, out.xp, cap).hero;
      }
      bankedAtEnd.push(hero.banked);
    });
    return { hero, episodeXp: fromEpisodes, seodangXp: fromSeodang, caps, bankedAtEnd };
  }

  it('끝 레벨이 29~30 ±2, 에피소드 약 7,200 · 서당 약 2,100(4분의 1쯤)', () => {
    for (const rate of [0.6, 0.7, 0.8]) {
      const sim = simulate(rate);
      expect(sim.hero.level).toBeGreaterThanOrEqual(27);
      expect(sim.hero.level).toBeLessThanOrEqual(30);
      expect(sim.episodeXp).toBeGreaterThan(7000);
      expect(sim.episodeXp).toBeLessThan(7400);
      expect(sim.seodangXp).toBeGreaterThan(1700);
      expect(sim.seodangXp).toBeLessThan(2600);
      const share = sim.seodangXp / (sim.seodangXp + sim.episodeXp);
      expect(share).toBeGreaterThan(0.15);
      expect(share).toBeLessThan(0.3);
      expect(sim.caps).toEqual([9, 14, 18, 22, 25, 27, 30]);
      // 잃는 것이 없다: 모인 경험치(레벨 + 막대 + 쌓아 둔 것) = 받은 경험치
      expect(xpEver(sim.hero)).toBe(sim.episodeXp + sim.seodangXp);
      // 쌓아 둔 것은 다음 이야기가 열리면 들어간다(마지막 이야기 앞까지는 다음 이야기에서 풀린다)
      if (sim.hero.banked > 0) expect(sim.hero.level).toBe(30);
    }
    expect(simulate(0.5).hero.level).toBe(29);
  });

  it('4-1(①-1만 — 상한 5): 처음 깸 한 번과 서당을 많이 해도 레벨 5에서 멈추고 나머지는 쌓아 둔다', () => {
    let hero = newHero('girl');
    hero = addXp(hero, episodeXp({ story: 's1395', first: true, stars: [true, true, true], minors: 2, book: 10 }).xp, LEVEL_CAP_41).hero;
    expect(hero.level).toBe(2);
    for (let i = 0; i < 20; i++) hero = addXp(hero, 70, LEVEL_CAP_41).hero;
    expect(hero.level).toBe(5);
    expect(hero.banked).toBe(160 + 1400 - 550);
    expect(hero.points).toBe(4);
  });
});
