// 규칙 엔진 시험(견본 이야기로): 수치와 변화 한도, 조건, 잠김과 숨김, 결과 갈림과 놀이 표시, 해 ☀ 한도,
// 꼭 푸는 미션을 다 풀어야 계절이 넘어감, 도움의 일, 나중에 나타나는 결과, 뽑기, 약속이 깨지면 던짐, 순수 함수, 같은 씨앗 같은 결과.

import { describe, expect, it } from 'vitest';
import { applyEffects, clampStats, meets } from '../src/engine/conditions';
import {
  canCloseSeason,
  choiceViews,
  closeSeason,
  currentSeason,
  deedsOfSeason,
  doHappening,
  lastClosing,
  lastDeed,
  missingMusts,
  missionOfHappening,
  missionViews,
  missionsOf,
  newGame,
  nextSeason,
  openChoiceIds,
  openHappenings,
  openingLines,
  playableRoles,
  seasonLine,
  seasonReady,
  sunsFor,
} from '../src/engine/game';
import { judgeWish, pickEnding, reviewYear, summarizeSeason } from '../src/engine/review';
import { dealRoles, drawValues, mulberry32, rollDraw, subSeed } from '../src/engine/rng';
import { SEASONS, STATS, type Facts, type GameState, type Happening, type SituationPack } from '../src/engine/types';
import { deepFreeze, doAll, movesOf, playSeasonRandom, playYearRandom, seedFor, testPack, withStats } from './fixtures';

const facts = (over: Partial<Facts> = {}): Facts => ({
  role: 'farmer',
  look: 'boy',
  stats: { living: 5, body: 5, trust: 5 },
  flags: [],
  draw: null,
  items: [],
  ...over,
});

const farmer = (seed = 1, look: 'boy' | 'girl' = 'boy') => newGame(testPack, 'farmer', look, seed);
const nobi = (seed = 1) => newGame(testPack, 'nobi', 'boy', seed);
const openIds = (pack: SituationPack, state: GameState) => openHappenings(pack, state).map((v) => v.happening.id);

/** 봄의 꼭 푸는 미션 둘을 푸는 가장 짧은 길(농민 집) */
const SPRING_MUSTS = ['t-news/help', 't-help', 't-sow/low/even'];

/** 견본을 베껴 일 하나를 고친다 */
function patched(id: string, change: (h: Happening) => void): SituationPack {
  const copy = structuredClone(testPack);
  const found = copy.happenings.find((h) => h.id === id);
  if (!found) throw new Error(`견본에 없는 일: ${id}`);
  change(found);
  return copy;
}

/** 여름의 맵까지 간다(봄의 미션을 풀고 계절을 넘긴다) */
function toSummer(seed: number, springSteps: string[] = SPRING_MUSTS): GameState {
  return nextSeason(testPack, closeSeason(testPack, doAll(testPack, farmer(seed), springSteps)));
}

describe('수치', () => {
  it('시작 수치는 이야기와 역할이 정한 값이다', () => {
    expect(farmer().stats).toEqual({ living: 4, body: 6, trust: 5 });
    expect(nobi().stats).toEqual({ living: 2, body: 6, trust: 4 });
    expect(farmer().flow).toEqual([{ living: 4, body: 6, trust: 5 }]);
  });

  it('수치는 0~10으로 묶인다', () => {
    expect(applyEffects({ living: 1, body: 9, trust: 5 }, { living: -3, body: 3 })).toEqual({
      after: { living: 0, body: 10, trust: 5 },
      requested: { living: -3, body: 3, trust: 0 },
      delta: { living: -1, body: 1, trust: 0 },
    });
    expect(clampStats({ living: -4, body: 11.6, trust: 4.4 })).toEqual({ living: 0, body: 10, trust: 4 });
    // 바닥에서 더 깎이는 일을 해도 0 아래로 내려가지 않고, 판은 이어진다
    const low = withStats(farmer(), { living: 0, body: 2, trust: 0 });
    const after = doAll(testPack, low, ['t-news/own', 't-own', 't-sow/split']);
    expect(after.stats).toEqual({ living: 1, body: 0, trust: 0 });
    expect(after.history[1].requested.trust).toBe(-1);
    expect(after.history[1].delta.trust).toBe(0); // 자료에 적힌 변화는 남고, 실제로 바뀐 만큼은 0
    expect(canCloseSeason(testPack, after)).toBe(true);
  });

  it('미션의 일 하나의 변화는 -3~+3으로 묶인다', () => {
    const pack = patched('t-help', (h) => void (h.after!.effects = { living: 5, body: -9, trust: 3 }));
    const after = doAll(pack, farmer(), ['t-news/help', 't-help']);
    expect(lastDeed(after)?.requested).toEqual({ living: 3, body: -3, trust: 3 });
    expect(after.stats).toEqual({ living: 7, body: 3, trust: 8 });
    expect(applyEffects({ living: 5, body: 5, trust: 5 }, { living: -9, body: 9 }).requested).toEqual({ living: -3, body: 3, trust: 0 });
  });

  it('덤으로 하는 일의 변화는 -1~+1로 묶인다', () => {
    const pack = patched('t-woods', (h) => void (h.after!.effects = { living: 3, body: -3 }));
    const after = doAll(pack, farmer(), ['t-woods']);
    expect(lastDeed(after)?.requested).toEqual({ living: 1, body: -1, trust: 0 });
    expect(after.stats).toEqual({ living: 5, body: 5, trust: 5 });
    expect(applyEffects({ living: 5, body: 5, trust: 5 }, { living: 3, trust: -2 }, 1).requested).toEqual({ living: 1, body: 0, trust: -1 });
  });

  it('아무렇게나 500해를 해도 수치는 언제나 0~10이다', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const end = seed % 3 === 0 ? playYearRandom(testPack, 'nobi', 'boy', seed) : playYearRandom(testPack, 'farmer', seed % 2 ? 'boy' : 'girl', seed);
      expect(end.phase).toBe('done');
      for (const deed of end.history) {
        for (const stat of STATS) {
          expect(deed.after[stat]).toBeGreaterThanOrEqual(0);
          expect(deed.after[stat]).toBeLessThanOrEqual(10);
          expect(Math.abs(deed.requested[stat])).toBeLessThanOrEqual(deed.sun === 1 ? 1 : 3);
        }
      }
      for (const stats of end.flow) for (const stat of STATS) expect(stats[stat] >= 0 && stats[stat] <= 10).toBe(true);
    }
  });
});

describe('조건', () => {
  it('적힌 칸을 모두 채워야 참이고, 아무것도 적지 않으면 언제나 참이다', () => {
    expect(meets(undefined, facts())).toBe(true);
    expect(meets({}, facts())).toBe(true);
    expect(meets({ min: { living: 5 }, draw: 'drought' }, facts({ draw: 'normal' }))).toBe(false);
    expect(meets({ min: { living: 5 }, flags: ['a'], look: 'boy' }, facts({ flags: ['a'] }))).toBe(true);
  });

  it('roles · min · max', () => {
    expect(meets({ roles: ['son'] }, facts())).toBe(false);
    expect(meets({ roles: ['son', 'farmer'] }, facts())).toBe(true);
    expect(meets({ min: { living: 5 } }, facts())).toBe(true);
    expect(meets({ min: { living: 6 } }, facts())).toBe(false);
    expect(meets({ max: { living: 4 } }, facts())).toBe(false);
    expect(meets({ max: { living: 5 } }, facts())).toBe(true);
    expect(meets({ min: { body: 5, trust: 6 } }, facts())).toBe(false);
  });

  it('flags · notFlags · draw', () => {
    expect(meets({ flags: ['a'] }, facts())).toBe(false);
    expect(meets({ flags: ['a'] }, facts({ flags: ['a', 'b'] }))).toBe(true);
    expect(meets({ flags: ['a', 'c'] }, facts({ flags: ['a', 'b'] }))).toBe(false);
    expect(meets({ notFlags: ['a'] }, facts({ flags: ['a'] }))).toBe(false);
    expect(meets({ notFlags: ['a'] }, facts())).toBe(true);
    expect(meets({ draw: 'drought' }, facts())).toBe(false);
    expect(meets({ draw: 'drought' }, facts({ draw: 'drought' }))).toBe(true);
  });

  it('notFlags가 둘 이상이면 그 가운데 하나라도 남아 있으면 거짓이다(모두 없어야 참)', () => {
    const neither = { notFlags: ['a', 'b'] };
    expect(meets(neither, facts())).toBe(true);
    expect(meets(neither, facts({ flags: ['c'] }))).toBe(true);
    expect(meets(neither, facts({ flags: ['a'] }))).toBe(false); // 첫째만 있어도
    expect(meets(neither, facts({ flags: ['b'] }))).toBe(false); // 둘째만 있어도
    expect(meets(neither, facts({ flags: ['a', 'b'] }))).toBe(false);
    expect(meets({ notFlags: ['a', 'b', 'c'] }, facts({ flags: ['c', 'd'] }))).toBe(false); // 마지막 것만 있어도
    expect(meets({ notFlags: [] }, facts({ flags: ['a'] }))).toBe(true); // 빈 목록은 조건이 없는 것과 같다
    // flags와 함께: 있어야 할 것은 모두 있고, 없어야 할 것은 하나도 없어야 한다
    const both = { flags: ['x', 'y'], notFlags: ['a', 'b'] };
    expect(meets(both, facts({ flags: ['x', 'y'] }))).toBe(true);
    expect(meets(both, facts({ flags: ['x', 'y', 'b'] }))).toBe(false);
    expect(meets(both, facts({ flags: ['x'] }))).toBe(false);
    // "또는" 안에서도 같다
    const either = { anyOf: [{ notFlags: ['a', 'b'] }, { flags: ['z'] }] };
    expect(meets(either, facts({ flags: ['b'] }))).toBe(false);
    expect(meets(either, facts({ flags: ['b', 'z'] }))).toBe(true);
    expect(meets(either, facts({ flags: ['c'] }))).toBe(true);
  });

  it('notFlags 둘로 나타나는 일과 잠기는 선택지: 앞선 선택 가운데 어느 하나만 했어도 사라지고 잠긴다', () => {
    // 땔나무가 있어야 나타나던 일을 "이웃을 거들러 가지도, 우리 집 일을 하러 가지도 않았을 때"만 나타나게 바꾼다
    const shown = patched('t-fire', (h) => void (h.shows = { notFlags: ['news.go.help', 'news.go.own'] }));
    expect(openIds(shown, newGame(shown, 'farmer', 'boy', 1))).toContain('t-fire');
    expect(openIds(shown, doAll(shown, newGame(shown, 'farmer', 'boy', 1), ['t-news/help']))).not.toContain('t-fire');
    expect(openIds(shown, doAll(shown, newGame(shown, 'farmer', 'boy', 1), ['t-news/own']))).not.toContain('t-fire'); // 둘째 표시만 남아도
    expect(openIds(shown, doAll(shown, newGame(shown, 'farmer', 'boy', 1), ['t-news/give']))).toContain('t-fire'); // 다른 표시는 상관없다
    // 잠김에도 같다
    const locked = patched('t-well', (h) => {
      h.choices![0].lock = { unless: { notFlags: ['news.go.help', 'news.go.own'] }, reason: '일하러 가는 길이라 들를 수 없어요' };
    });
    const listen = (steps: string[]) => choiceViews(locked, doAll(locked, newGame(locked, 'farmer', 'boy', 1), steps), 't-well')[0];
    expect(listen([]).locked).toBe(false);
    expect(listen(['t-news/help']).locked).toBe(true);
    expect(listen(['t-news/own']).locked).toBe(true);
    expect(listen(['t-news/own']).reason).toBe('일하러 가는 길이라 들를 수 없어요');
    expect(listen(['t-news/give']).locked).toBe(false);
  });

  it('look · items', () => {
    expect(meets({ look: 'girl' }, facts())).toBe(false);
    expect(meets({ look: 'girl' }, facts({ look: 'girl' }))).toBe(true);
    expect(meets({ items: ['rice'] }, facts())).toBe(false);
    expect(meets({ items: ['rice', 'cloth'] }, facts({ items: ['rice'] }))).toBe(false);
    expect(meets({ items: ['rice', 'cloth'] }, facts({ items: ['cloth', 'rice', 'salt'] }))).toBe(true);
  });

  it('anyOf: 그 가운데 하나라도 참이면 되고, 다른 칸과는 "그리고"로 묶인다', () => {
    const either = { anyOf: [{ min: { trust: 8 } }, { flags: ['a'] }] };
    expect(meets(either, facts())).toBe(false);
    expect(meets(either, facts({ flags: ['a'] }))).toBe(true);
    expect(meets(either, facts({ stats: { living: 0, body: 0, trust: 8 } }))).toBe(true);
    expect(meets({ look: 'girl', ...either }, facts({ flags: ['a'] }))).toBe(false);
    expect(meets({ anyOf: [{ anyOf: [{ draw: 'bumper' }] }, { items: ['x'] }] }, facts({ draw: 'bumper' }))).toBe(true);
    expect(meets({ anyOf: [] }, facts())).toBe(true); // 빈 "또는"은 조건이 없는 것과 같다
  });
});

describe('잠김과 숨김', () => {
  it('그 사람의 삶에 없는 선택지는 숨기고(only), 잠긴 선택지는 까닭과 함께 보인다', () => {
    expect(choiceViews(testPack, farmer(), 't-news').map((v) => v.id)).toEqual(['help', 'own', 'give']);
    const views = choiceViews(testPack, nobi(), 't-news'); // 노비 집은 살림 2
    expect(views.map((v) => v.id)).toEqual(['help', 'give', 'errand']);
    expect(views.find((v) => v.id === 'give')).toEqual({ id: 'give', label: '스님께 길양식을 보탠다', locked: true, reason: '보탤 곡식이 남아 있지 않아요' });
    expect(views.find((v) => v.id === 'help')).toMatchObject({ locked: false, reason: undefined });
    expect(openChoiceIds(testPack, nobi(), 't-news')).toEqual(['help', 'errand']);
  });

  it('수치가 차면 열린다', () => {
    expect(openChoiceIds(testPack, withStats(nobi(), { living: 3 }), 't-news')).toEqual(['help', 'give', 'errand']);
    expect(openChoiceIds(testPack, withStats(farmer(), { living: 2 }), 't-news')).toEqual(['help', 'own']);
  });

  it('"또는" 잠김: 인심이 높거나 앞에서 이웃을 거들었으면 열린다', () => {
    const story = (state: GameState) => choiceViews(testPack, state, 't-granny').find((v) => v.id === 'story');
    expect(story(farmer())).toMatchObject({ locked: true, reason: '할머니는 아직 나를 잘 모르세요' });
    expect(story(withStats(farmer(), { trust: 6 }))?.locked).toBe(false);
    const helped = doAll(testPack, withStats(farmer(), { trust: 3 }), ['t-news/help', 't-help']);
    expect(helped.stats.trust).toBe(4);
    expect(story(helped)?.locked).toBe(false);
  });

  it('조건(shows)이 맞아야 맵에 나타난다: 앞선 선택, 물건', () => {
    const start = farmer();
    expect(openIds(testPack, start)).toEqual(['t-news', 't-sow', 't-well', 't-temple', 't-granny', 't-woods']);
    const chose = doAll(testPack, start, ['t-news/give']);
    expect(chose.items).toEqual(['bundle']);
    expect(openIds(testPack, chose)).toContain('t-give');
    expect(openIds(testPack, chose)).not.toContain('t-help');
    // 표시는 있는데 물건이 없으면 나타나지 않는다
    expect(openIds(testPack, { ...chose, items: [] })).not.toContain('t-give');
    // 땔나무를 해 오면 아궁이 일이 생긴다
    expect(openIds(testPack, doAll(testPack, start, ['t-woods']))).toContain('t-fire');
  });

  it('역할에 따라 생기는 일이 다르다', () => {
    expect(openIds(testPack, nobi())).toEqual(['t-news', 't-errand', 't-well', 't-temple', 't-granny', 't-woods']);
    expect(openHappenings(testPack, nobi()).filter((v) => v.must).map((v) => v.happening.id)).toEqual(['t-news', 't-errand']);
  });

  it('여는 대화는 모습과 뽑기에 따라 갈린다', () => {
    expect(openingLines(testPack, farmer(1, 'boy'), 't-news')[0].text).toBe('마을 어귀에 사람들이 모여 있다.');
    expect(openingLines(testPack, farmer(1, 'girl'), 't-news')[0].text).toBe('물동이를 이고 마을 어귀를 지난다.');
    expect(openingLines(testPack, toSummer(seedFor('drought')), 't-weed')[0].text).toBe('큰비 뒤, 논에 풀이 가득하다.');
    expect(openingLines(testPack, toSummer(seedFor('normal')), 't-weed')[0].text).toBe('여느 여름, 논에 풀이 가득하다.');
  });
});

describe('약속이 깨지면 던진다', () => {
  it('잠긴 선택지, 숨긴 선택지, 없는 선택지', () => {
    expect(() => doHappening(testPack, nobi(), { id: 't-news', choiceId: 'give' })).toThrow(/잠긴 선택지/);
    expect(() => doHappening(testPack, nobi(), { id: 't-news', choiceId: 'own' })).toThrow(/보이지 않는 선택지/);
    expect(() => doHappening(testPack, farmer(), { id: 't-news', choiceId: 'nope' })).toThrow(/없는 선택지/);
    expect(() => doHappening(testPack, farmer(), { id: 't-news' })).toThrow(/없는 선택지/); // 고르지 않고는 할 수 없다
  });

  it('없는 일, 아직 나타나지 않은 일, 남의 일, 이미 한 일, 다른 계절의 일', () => {
    expect(() => doHappening(testPack, farmer(), { id: 'nope' })).toThrow(/할 수 없는 일/);
    expect(() => doHappening(testPack, farmer(), { id: 't-help' })).toThrow(/할 수 없는 일/);
    expect(() => doHappening(testPack, farmer(), { id: 't-errand', choiceId: 'quick' })).toThrow(/할 수 없는 일/);
    expect(() => doHappening(testPack, farmer(), { id: 't-weed', choiceId: 'rest' })).toThrow(/할 수 없는 일/);
    const once = doAll(testPack, farmer(), ['t-temple']);
    expect(() => doHappening(testPack, once, { id: 't-temple' })).toThrow(/할 수 없는 일/);
  });

  it('없는 역할, 아직 할 수 없는 역할, 될 수 없는 모습', () => {
    expect(() => newGame(testPack, 'king', 'boy', 1)).toThrow(/없는 역할/);
    expect(() => newGame(testPack, 'son', 'boy', 1)).toThrow(/아직 할 수 없다/);
    expect(() => newGame(testPack, 'nobi', 'girl', 1)).toThrow(/모습/);
  });

  it('계절을 닫는 중에는 일을 할 수 없고, 닫기 전에는 다음 계절로 갈 수 없다', () => {
    const done = doAll(testPack, farmer(), SPRING_MUSTS);
    const closed = closeSeason(testPack, done);
    expect(() => doHappening(testPack, closed, { id: 't-temple' })).toThrow(/일을 할 수 없다/);
    expect(() => closeSeason(testPack, closed)).toThrow(/계절을 보낼 수 없다/);
    expect(() => nextSeason(testPack, done)).toThrow(/계절을 먼저 보내야/);
    expect(openHappenings(testPack, closed)).toEqual([]);
  });
});

describe('결과 갈림과 일 놀이', () => {
  it('놀이가 끝난 모습이 표시로 남고, 결과는 그 표시에 따라 갈린다', () => {
    const even = doAll(testPack, farmer(), ['t-sow/low/even']);
    expect(lastDeed(even)).toMatchObject({ choiceId: 'low', label: '낮은 논에 몰아 뿌린다', play: 'even', newFlags: ['sow.even', 'sow.low'] });
    expect(lastDeed(even)?.lines[0].text).toBe('낮은 논에 볍씨를 고루 뿌렸다.');
    expect(lastDeed(even)?.requested).toEqual({ living: 0, body: -1, trust: 0 });

    const heaped = doAll(testPack, farmer(), ['t-sow/low/heaped']);
    expect(heaped.flags).toEqual(['sow.heaped', 'sow.low']);
    expect(lastDeed(heaped)?.lines[0].text).toBe('볍씨가 한쪽에 몰렸다.');
    expect(lastDeed(heaped)?.requested).toEqual({ living: -1, body: -1, trust: 0 });
  });

  it('갈린 결과는 바탕 결과를 통째로 갈음한다(수치도, 쪽지도)', () => {
    const left = doAll(testPack, farmer(), ['t-sow/low/left']);
    expect(lastDeed(left)?.requested).toEqual({ living: 0, body: 0, trust: 0 }); // 바탕의 기력 -1과 더해지지 않는다
    expect(lastDeed(left)?.note).toBe('힘든 일은 어른이 맡기도 했어요.');
    expect(lastDeed(doAll(testPack, farmer(), ['t-sow/low/even']))?.note).toBe('시험에 쓰는 배움 쪽지예요.');
  });

  it('놀이가 어떻게 끝났는지 넘기지 않으면(건너뛰면) 첫 번째 모습으로 친다', () => {
    const skipped = doAll(testPack, farmer(), ['t-sow/split']);
    expect(lastDeed(skipped)?.play).toBe('even');
    expect(skipped.flags).toEqual(['sow.even', 'sow.split']);
    const unknown = doHappening(testPack, farmer(), { id: 't-sow', choiceId: 'split', play: 'nope' });
    expect(lastDeed(unknown)?.play).toBe('even');
    // 자료에 없는 이름은 받지 않는다(객체가 물려받은 이름이어도)
    for (const play of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const odd = doHappening(testPack, farmer(), { id: 't-sow', choiceId: 'split', play });
      expect(lastDeed(odd)?.play).toBe('even');
      expect(odd.flags).toEqual(['sow.even', 'sow.split']);
    }
  });

  it('같은 선택이 모습에 따라 다른 이야기가 된다', () => {
    expect(lastDeed(doAll(testPack, farmer(1, 'boy'), ['t-well/listen']))?.lines[0].text).toBe('공사 이야기를 들었다.');
    expect(lastDeed(doAll(testPack, farmer(1, 'girl'), ['t-well/listen']))?.lines[0].text).toBe('물을 길으며 공사 이야기를 들었다.');
  });

  it('선택지가 없는 일의 결과(after)도 수치에 따라 갈린다', () => {
    const plain = doAll(testPack, farmer(), ['t-news/give', 't-give']);
    expect(lastDeed(plain)?.lines[0].text).toBe('잘 먹겠다.');
    expect(plain.cards).toEqual(['c1']);
    const trusted = doAll(testPack, withStats(farmer(), { trust: 8 }), ['t-news/give', 't-give']);
    expect(lastDeed(trusted)?.lines[0].text).toBe('마을 사람들이 너를 칭찬하더구나.');
  });

  it('같은 선택이 뽑기와 앞선 선택에 따라 다른 결과가 된다', () => {
    const weed = (weather: string, spring: string[]) => {
      const summer = toSummer(seedFor(weather), spring);
      expect(summer.draw).toBe(weather);
      return lastDeed(doAll(testPack, summer, ['t-weed/all']));
    };
    expect(weed('normal', SPRING_MUSTS)?.lines[0].text).toBe('여느 해처럼 김을 맸다.');
    expect(weed('normal', SPRING_MUSTS)?.requested).toEqual({ living: 1, body: -2, trust: 0 });
    expect(weed('bumper', SPRING_MUSTS)?.requested).toEqual({ living: 2, body: -2, trust: 0 });
    // 위에서부터 처음 맞는 갈림 하나: 낮은 논 + 큰비가 먼저 맞는다
    expect(weed('drought', SPRING_MUSTS)?.lines[0].text).toBe('잠긴 낮은 논에서 김을 맸다.');
    expect(weed('drought', ['t-news/help', 't-help', 't-sow/split/even'])?.lines[0].text).toBe('큰비 속에 김을 맸다.');
  });

  it('얻은 카드·물건·표시는 한 번만 적힌다', () => {
    const state = doAll(testPack, farmer(), ['t-temple', 't-woods']);
    expect(state.cards).toEqual(['c2']);
    expect(state.items).toEqual(['firewood']);
    expect(state.history.map((d) => [d.newCards, d.newItems, d.newFlags])).toEqual([
      [['c2'], [], ['story.temple']],
      [[], ['firewood'], []],
    ]);
  });
});

describe('해 ☀', () => {
  it('계절의 해는 역할이 정하고, 기력이 2 이하이면 하나 준다(하나는 남는다)', () => {
    expect(farmer().sunsLeft).toBe(3);
    expect(nobi().sunsLeft).toBe(2);
    expect(sunsFor(testPack, 'farmer', { living: 5, body: 3, trust: 5 })).toBe(3);
    expect(sunsFor(testPack, 'farmer', { living: 5, body: 2, trust: 5 })).toBe(2);
    expect(sunsFor(testPack, 'nobi', { living: 5, body: 0, trust: 5 })).toBe(1);
    const lowSuns = { ...testPack, situation: { ...testPack.situation, roles: testPack.situation.roles.map((r) => ({ ...r, suns: 1 })) } };
    expect(sunsFor(lowSuns, 'farmer', { living: 5, body: 0, trust: 5 })).toBe(1);
  });

  it('덤으로 하는 일 하나에 해 하나가 지고, 꼭 푸는 미션은 해를 쓰지 않는다', () => {
    let state = doAll(testPack, farmer(), SPRING_MUSTS);
    expect(state.sunsLeft).toBe(3);
    expect(state.history.map((d) => d.sun)).toEqual([0, 0, 0]);
    state = doAll(testPack, state, ['t-well/listen']);
    expect(state.sunsLeft).toBe(2);
    expect(lastDeed(state)?.sun).toBe(1);
  });

  it('해가 없으면 덤을 못 한다(미션의 일은 여전히 할 수 있다)', () => {
    const spent = doAll(testPack, farmer(), ['t-well/listen', 't-temple', 't-woods']);
    expect(spent.sunsLeft).toBe(0);
    const views = openHappenings(testPack, spent);
    expect(views.filter((v) => v.noSun).map((v) => v.happening.id)).toEqual(['t-granny', 't-fire']);
    expect(views.filter((v) => !v.noSun).map((v) => v.happening.id)).toEqual(['t-news', 't-sow']);
    expect(() => doHappening(testPack, spent, { id: 't-granny', choiceId: 'greet' })).toThrow(/해가 남아 있지 않다/);
    expect(movesOf(testPack, spent).every((move) => move.id === 't-news' || move.id === 't-sow')).toBe(true);
    expect(canCloseSeason(testPack, doAll(testPack, spent, SPRING_MUSTS))).toBe(true);
  });

  it('덤 다섯 가운데 해 ☀만큼만 할 수 있다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const end = playSeasonRandom(testPack, farmer(seed), mulberry32(seed));
      expect(end.history.filter((d) => d.sun === 1).length).toBeLessThanOrEqual(3);
      expect(end.sunsLeft).toBe(3 - end.history.filter((d) => d.sun === 1).length);
    }
  });

  it('계절이 바뀌면 해가 다시 차고, 그때 기력이 2 이하이면 하나 준다', () => {
    const spring = doAll(testPack, farmer(), [...SPRING_MUSTS, 't-temple', 't-well/listen']);
    expect(spring.sunsLeft).toBe(1);
    expect(nextSeason(testPack, closeSeason(testPack, spring)).sunsLeft).toBe(3);
    const tired = closeSeason(testPack, withStats(spring, { body: 2 }));
    expect(nextSeason(testPack, tired).sunsLeft).toBe(2);
  });
});

describe('미션과 계절', () => {
  it('꼭 푸는 미션을 다 풀어야 계절을 보낼 수 있다', () => {
    let state = farmer();
    expect(canCloseSeason(testPack, state)).toBe(false);
    expect(missingMusts(testPack, state).map((m) => m.id)).toEqual(['m-news', 'm-sow']);
    expect(() => closeSeason(testPack, state)).toThrow(/꼭 푸는 미션이 남았다: 돌아온 사람들, 볍씨 뿌리기/);
    state = doAll(testPack, state, ['t-sow/split/even']);
    expect(state.solved).toEqual(['m-sow']);
    expect(canCloseSeason(testPack, state)).toBe(false);
    expect(() => closeSeason(testPack, state)).toThrow(/돌아온 사람들/);
    // 덤을 아무리 해도 꼭 푸는 미션이 남으면 넘어가지 않는다
    state = doAll(testPack, state, ['t-well/listen', 't-temple', 't-woods']);
    expect(canCloseSeason(testPack, state)).toBe(false);
    state = doAll(testPack, state, ['t-news/own', 't-own']);
    expect(canCloseSeason(testPack, state)).toBe(true);
    expect(missingMusts(testPack, state)).toEqual([]);
  });

  it('미션은 고르는 것만으로는 풀리지 않고, 고른 일을 그 자리에 가서 마쳐야 풀린다(goTo)', () => {
    const chose = doAll(testPack, farmer(), ['t-news/help']);
    expect(chose.solved).toEqual([]);
    expect(lastDeed(chose)).toMatchObject({ missionId: 'm-news', goTo: 'neighbor', solved: [] });
    expect(chose.goTo).toBe('neighbor');
    expect(missionViews(testPack, chose).find((v) => v.mission.id === 'm-news')).toMatchObject({ solved: false, spot: 'neighbor' });
    const did = doAll(testPack, chose, ['t-help']);
    expect(lastDeed(did)).toMatchObject({ missionId: 'm-news', solved: ['m-news'] });
    expect(did.solved).toEqual(['m-news']);
    expect(did.goTo).toBeUndefined();
    expect(missionViews(testPack, did).find((v) => v.mission.id === 'm-news')).toMatchObject({ solved: true, spot: undefined });
  });

  it('할 일 쪽지: 꼭 푸는 미션이 먼저 오고, 다음 일이 있는 자리를 가리킨다', () => {
    const views = missionViews(testPack, farmer());
    expect(views.map((v) => [v.mission.id, v.solved, v.spot])).toEqual([
      ['m-news', false, 'tree'],
      ['m-sow', false, 'paddy'],
      ['m-stories', false, 'temple'],
    ]);
    expect(missionsOf(testPack, 'nobi', 'spring').map((m) => m.id)).toEqual(['m-news', 'm-errand', 'm-stories']);
    expect(missionOfHappening(testPack, 'farmer', 't-sow-rescue')?.id).toBe('m-sow');
    expect(missionOfHappening(testPack, 'farmer', 't-well')).toBeUndefined();
  });

  it('덤 미션은 풀리면 적히지만 계절을 넘기는 데는 필요 없다', () => {
    const state = doAll(testPack, withStats(farmer(), { trust: 6 }), ['t-temple', 't-granny/story']);
    expect(lastDeed(state)?.solved).toEqual(['m-stories']);
    expect(lastDeed(state)?.missionId).toBe('m-stories');
    expect(state.solved).toEqual(['m-stories']);
    expect(canCloseSeason(testPack, state)).toBe(false);
    expect(canCloseSeason(testPack, doAll(testPack, farmer(), SPRING_MUSTS))).toBe(true);
  });

  it('계절을 보내면 그 계절의 수치 변화가 적히고 다음 계절로 간다', () => {
    const done = doAll(testPack, farmer(), ['t-news/own', 't-own', 't-sow/split/even', 't-woods']);
    const closed = closeSeason(testPack, done);
    expect(closed.phase).toBe('seasonClose');
    expect(lastClosing(closed)).toEqual({
      season: 'spring',
      before: { living: 4, body: 6, trust: 5 },
      after: { living: 6, body: 3, trust: 4 },
      delta: { living: 2, body: -3, trust: -1 },
      lines: [],
      newCards: [],
    });
    expect(closed.flow).toEqual([
      { living: 4, body: 6, trust: 5 },
      { living: 6, body: 3, trust: 4 },
    ]);
    const summer = nextSeason(testPack, closed);
    expect(summer).toMatchObject({ phase: 'season', seasonIndex: 1, sunsLeft: 3 });
    expect(currentSeason(summer)).toBe('summer');
    expect(openIds(testPack, summer)).toEqual(['t-weed', 't-summer-1', 't-summer-2', 't-summer-3', 't-summer-4']);
    expect(deedsOfSeason(summer, 'spring')).toHaveLength(4);
    expect(summarizeSeason(summer, 0)).toMatchObject({ season: 'spring', closing: { season: 'spring' } });
  });

  it('겨울을 보내면 한 해가 끝난다', () => {
    const end = playYearRandom(testPack, 'farmer', 'girl', 3);
    expect(end.phase).toBe('done');
    expect(end.seasonIndex).toBe(3);
    expect(end.closings.map((c) => c.season)).toEqual([...SEASONS]);
    expect(end.flow).toHaveLength(5); // 처음 + 계절 넷
    expect(end.solved).toEqual(expect.arrayContaining(['m-news', 'm-sow', 'm-weed']));
    expect(() => doHappening(testPack, end, { id: 't-temple' })).toThrow();
  });

  it('미션이 만들어진 역할만 할 수 있다', () => {
    expect(playableRoles(testPack)).toEqual(['farmer', 'nobi']);
    expect(seasonReady(testPack, 'farmer', 'summer')).toBe(true);
    expect(seasonReady(testPack, 'farmer', 'autumn')).toBe(false);
    expect(seasonReady(testPack, 'son', 'spring')).toBe(false);
    // 미션 자료만 더하면 그 역할을 할 수 있다(코드를 고치지 않는다)
    const more = structuredClone(testPack);
    more.missions.find((m) => m.id === 'm-news')!.roles!.push('son');
    expect(playableRoles(more)).toEqual(['farmer', 'nobi', 'son']);
  });
});

describe('도움의 일(막다른 길이 없게)', () => {
  it('미션의 선택지가 모두 잠기면 도움의 일이 나타나고, 그것으로 미션이 풀린다', () => {
    const worn = withStats(farmer(), { body: 1 });
    expect(openChoiceIds(testPack, worn, 't-sow')).toEqual([]);
    expect(openIds(testPack, worn)).toContain('t-sow-rescue');
    const rescue = openHappenings(testPack, worn).find((v) => v.happening.id === 't-sow-rescue');
    expect(rescue).toMatchObject({ must: true, noSun: false, mission: { id: 'm-sow' } });
    const after = doAll(testPack, worn, ['t-sow-rescue']);
    expect(lastDeed(after)).toMatchObject({ missionId: 'm-sow', solved: ['m-sow'], sun: 0 });
    expect(lastDeed(after)?.requested.trust).toBe(-1); // 대신 다른 것이 걸린다
    expect(after.flags).toEqual(['sow.split', 'sow.helped']);
    // 한 번 쓴 도움의 일은 다시 나타나지 않는다
    expect(openIds(testPack, after)).not.toContain('t-sow-rescue');
  });

  it('길이 열려 있으면 도움의 일은 나타나지 않는다', () => {
    expect(openIds(testPack, farmer())).not.toContain('t-sow-rescue');
    expect(openIds(testPack, withStats(farmer(), { body: 2 }))).not.toContain('t-sow-rescue');
    expect(() => doHappening(testPack, farmer(), { id: 't-sow-rescue' })).toThrow(/할 수 없는 일/);
    // 미션을 푼 뒤에는 기력이 바닥나도 나타나지 않는다
    const solved = withStats(doAll(testPack, farmer(), ['t-sow/low/even']), { body: 0 });
    expect(openIds(testPack, solved)).not.toContain('t-sow-rescue');
  });

  it('수치를 바닥(0·0·0)에 놓아도 봄의 미션이 모두 풀린다', () => {
    const floor = withStats(farmer(), { living: 0, body: 0, trust: 0 });
    const after = doAll(testPack, floor, ['t-news/help', 't-help', 't-sow-rescue']);
    expect(canCloseSeason(testPack, after)).toBe(true);
    expect(after.stats).toEqual({ living: 0, body: 0, trust: 0 });
  });
});

describe('나중에 나타나는 결과', () => {
  it('계절을 닫을 때 앞선 선택에 따라 변화가 붙는다', () => {
    const closed = closeSeason(testPack, doAll(testPack, farmer(), SPRING_MUSTS));
    expect(lastClosing(closed)?.lines).toEqual(['거들어 준 이웃이 고마워했다.']);
    expect(closed.stats.trust).toBe(7); // 5 + 거들기 1 + 나중 결과 1
    expect(lastClosing(closed)?.delta).toEqual({ living: 0, body: -2, trust: 2 });
    const other = closeSeason(testPack, doAll(testPack, farmer(), ['t-news/own', 't-own', 't-sow/low/even']));
    expect(lastClosing(other)?.lines).toEqual([]);
  });

  it('봄의 볍씨 선택이 여름의 뽑기와 만난다', () => {
    const closeSummer = (weather: string, sow: string) => {
      const summer = toSummer(seedFor(weather), ['t-news/own', 't-own', sow]);
      const before = doAll(testPack, summer, ['t-weed/rest']);
      const closed = closeSeason(testPack, before);
      return { change: closed.stats.living - before.stats.living, closing: lastClosing(closed)!, cards: closed.cards };
    };
    const flooded = closeSummer('drought', 't-sow/low/even');
    expect(flooded.change).toBe(-3);
    expect(flooded.closing.lines).toEqual(['낮은 논이 큰비에 잠겼다.']);
    expect(flooded.closing.newCards).toEqual(['c2']);
    expect(flooded.cards).toContain('c2');
    expect(closeSummer('normal', 't-sow/low/even').change).toBe(1);
    expect(closeSummer('bumper', 't-sow/low/even').closing.lines).toEqual(['낮은 논의 벼가 잘 자랐다.']);
    expect(closeSummer('drought', 't-sow/split/even').change).toBe(-1);
    expect(closeSummer('normal', 't-sow/split/even')).toMatchObject({ change: 0, closing: { lines: [] } });
  });

  it('나중 결과도 수치를 0~10 밖으로 밀지 못한다', () => {
    const summer = withStats(toSummer(seedFor('drought'), ['t-news/own', 't-own', 't-sow/low/even']), { living: 1 });
    const closed = closeSeason(testPack, doAll(testPack, summer, ['t-weed/rest']));
    expect(closed.stats.living).toBe(0);
    expect(closed.flow[2].living).toBe(0);
  });
});

describe('뽑기와 씨앗', () => {
  it('날씨는 뽑는 계절(여름)에 들어서야 정해진다', () => {
    const seed = seedFor('drought');
    const spring = doAll(testPack, farmer(seed), SPRING_MUSTS);
    expect(spring.draw).toBeNull();
    const closed = closeSeason(testPack, spring);
    expect(closed.draw).toBeNull();
    const summer = nextSeason(testPack, closed);
    expect(summer.draw).toBe('drought');
    expect(summer.draw).toBe(rollDraw('weather', seed));
    expect(seasonLine(testPack, summer)).toBe('큰비가 그치지 않는다.');
    expect(seasonLine(testPack, toSummer(seedFor('normal')))).toBe('볕이 뜨겁다.');
    expect(seasonLine(testPack, spring)).toBe('얼었던 땅이 풀린다.');
  });

  it('봄에 뽑는 이야기는 시작할 때 뽑는다', () => {
    const early = { ...testPack, situation: { ...testPack.situation, draw: { kind: 'weather' as const, season: 'spring' as const } } };
    expect(newGame(early, 'farmer', 'boy', seedFor('bumper')).draw).toBe('bumper');
  });

  it('같은 씨앗이면 같은 뽑기, 같은 판이 나온다', () => {
    for (const seed of [1, 2, 3, 42, 20261009, 4294967295]) {
      expect(rollDraw('weather', seed)).toBe(rollDraw('weather', seed));
      expect(playYearRandom(testPack, 'farmer', 'boy', seed)).toEqual(playYearRandom(testPack, 'farmer', 'boy', seed));
    }
    expect(farmer(77)).toEqual(farmer(77));
    // 씨앗은 뽑기만 정한다: 같은 일을 같은 차례로 하면 날씨가 드러나기 전까지는 씨앗이 달라도 같은 판이다
    const a = doAll(testPack, farmer(1), SPRING_MUSTS);
    const b = doAll(testPack, farmer(2), SPRING_MUSTS);
    expect({ ...a, seed: 0 }).toEqual({ ...b, seed: 0 });
  });

  it('난수는 씨앗만으로 정해지고 0 이상 1 미만이다', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(subSeed(1, 'draw:weather')).toBe(subSeed(1, 'draw:weather'));
    expect(subSeed(1, 'draw:weather')).not.toBe(subSeed(1, 'role'));
  });

  it('날씨는 궂은 해 3 · 평소 같은 해 5 · 비가 알맞게 온 해 2 비율로 뽑힌다', () => {
    const count: Record<string, number> = { drought: 0, normal: 0, bumper: 0 };
    const total = 20000;
    for (let seed = 0; seed < total; seed++) count[rollDraw('weather', seed) ?? 'none']++;
    expect(count.drought / total).toBeCloseTo(0.3, 1);
    expect(count.normal / total).toBeCloseTo(0.5, 1);
    expect(count.bumper / total).toBeCloseTo(0.2, 1);
    expect(count.drought + count.normal + count.bumper).toBe(total);
    expect(drawValues('weather')).toEqual(['drought', 'normal', 'bumper']);
  });

  it('뽑기 표가 없는 종류는 뽑지 않는다', () => {
    expect(rollDraw('none', 1)).toBeNull();
    expect(rollDraw('war', 1)).toBeNull(); // 3바퀴에서 더한다
    expect(drawValues('none')).toEqual([]);
  });

  it('태어날 집 뽑기: 뒤집은 패에는 언제나 할 수 있는 집이 온다(역할 목록은 이야기가 정한다)', () => {
    const all = testPack.situation.roles.map((r) => r.id);
    const playable = playableRoles(testPack);
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      for (let picked = 0; picked < all.length; picked++) {
        const dealt = dealRoles(all, playable, seed, picked);
        expect(playable).toContain(dealt[picked]);
        expect([...dealt].sort()).toEqual([...all].sort()); // 집마다 한 번씩
        expect(dealRoles(all, playable, seed, picked)).toEqual(dealt);
        seen.add(dealt[picked]);
      }
    }
    expect([...seen].sort()).toEqual([...playable].sort());
    expect(() => dealRoles(all, [], 1, 0)).toThrow();
    expect(() => dealRoles(all, playable, 1, all.length)).toThrow();
  });
});

describe('순수 함수', () => {
  it('상태를 고치지 않고 새 상태를 돌려준다', () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      const rng = mulberry32(seed);
      let state = deepFreeze(newGame(structuredClone(testPack), 'farmer', seed % 2 ? 'boy' : 'girl', seed));
      const pack = deepFreeze(structuredClone(testPack));
      while (state.phase !== 'done') {
        const moves = movesOf(pack, state);
        if (canCloseSeason(pack, state) && (moves.length === 0 || rng() < 0.3)) {
          state = deepFreeze(nextSeason(pack, deepFreeze(closeSeason(pack, state))));
        } else {
          state = deepFreeze(doHappening(pack, state, moves[Math.floor(rng() * moves.length)]));
        }
      }
      expect(state.closings).toHaveLength(4);
    }
  });

  it('일을 해도 앞의 상태는 그대로다', () => {
    const before = farmer();
    const copy = structuredClone(before);
    const after = doAll(testPack, before, ['t-news/give', 't-give', 't-woods']);
    expect(before).toEqual(copy);
    expect(after).not.toBe(before);
    expect(after.history).toHaveLength(3);
    expect(before.history).toHaveLength(0);
  });
});

describe('한 해 돌아보기', () => {
  it('푼 미션, 수치의 흐름, 바람, 한 해 이름, 뒷이야기를 돌려준다', () => {
    const end = playYearRandom(testPack, 'farmer', 'boy', 5);
    const review = reviewYear(testPack, end);
    expect(review.seasons.map((s) => s.season)).toEqual([...SEASONS]);
    expect(review.flow).toHaveLength(5);
    expect(review.flow[0]).toEqual({ living: 4, body: 6, trust: 5 });
    expect(review.final).toEqual(end.stats);
    expect(review.solved).toEqual(end.solved);
    expect(review.wish.text).toBe('식구 모두 겨울 나기');
    expect(review.wish.reason.length).toBeGreaterThan(0);
    expect(testPack.situation.endings.map((e) => e.id)).toContain(review.yearName.id);
    expect(review.epilogue).toBe('뒷이야기');
    expect(review.draw).toBe(rollDraw('weather', 5));
  });

  it('한 해 이름과 바람은 수치와 앞선 선택으로 가린다(위에서부터 처음 맞는 것)', () => {
    expect(pickEnding(testPack.situation, facts({ stats: { living: 0, body: 5, trust: 5 }, flags: ['news.help'] })).id).toBe('empty');
    expect(pickEnding(testPack.situation, facts({ stats: { living: 10, body: 5, trust: 5 } })).id).toBe('rich');
    expect(pickEnding(testPack.situation, facts({ flags: ['news.help'] })).id).toBe('helped');
    expect(pickEnding(testPack.situation, facts()).id).toBe('plain');
    const farmerDef = testPack.situation.roles[0];
    expect(judgeWish(farmerDef, facts())).toEqual({ text: '식구 모두 겨울 나기', fulfilled: true, reason: '살림이 넉넉했어요.' });
    expect(judgeWish(farmerDef, facts({ stats: { living: 4, body: 9, trust: 9 } }))).toMatchObject({ fulfilled: false, reason: '살림이 모자랐어요.' });
  });

  it('한 해가 끝나기 전에는 돌아볼 수 없다', () => {
    expect(() => reviewYear(testPack, farmer())).toThrow(/끝나지 않았다/);
  });
});
