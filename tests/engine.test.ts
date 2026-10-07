// 규칙 엔진 시험: 수치 범위, 잠김 판정, 결과 갈림, 같은 씨앗 같은 결과, 정확히 8장면.

import { describe, expect, it } from 'vitest';
import { applyEffects, meets } from '../src/engine/conditions';
import {
  advance,
  choiceViews,
  choose,
  currentScene,
  currentText,
  isPlayable,
  newGame,
  openChoiceIds,
  playableRoles,
  roleProblems,
  sequence,
} from '../src/engine/game';
import { judgeWish, pickEnding, reviewYear, summarizeSeason } from '../src/engine/review';
import { dealRoles, mulberry32, rollDraw, subSeed } from '../src/engine/rng';
import { ROLE_IDS, SCENES_PER_YEAR, SEASONS, STATS, type Facts, type GameState, type Phase } from '../src/engine/types';
import { playRandom, playWith, seedFor, testPack } from './fixtures';

const facts = (over: Partial<Facts> = {}): Facts => ({
  role: 'farmer',
  stats: { living: 5, body: 5, trust: 5 },
  flags: [],
  draw: null,
  ...over,
});

/** 봄 세상에서 깎고, 봄 내 장면은 그대로 두고, 그 뒤로는 모두 깎는다 */
const DRAIN_ALL = ['drain', 'rest', 'drain'];

/** 장면이 나올 때까지 넘긴다 */
function toScene(state: GameState): GameState {
  let s = state;
  while (s.phase !== 'scene' && s.phase !== 'done') s = advance(testPack, s);
  return s;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

describe('수치 범위', () => {
  it('계속 깎아도 0 아래로 내려가지 않고, 0이 되어도 판은 끝까지 간다', () => {
    const end = playWith(testPack, 'farmer', 1, DRAIN_ALL);
    expect(end.phase).toBe('done');
    expect(end.history).toHaveLength(SCENES_PER_YEAR);
    expect(end.stats).toEqual({ living: 0, body: 0, trust: 0 });
    for (const turn of end.history) {
      for (const stat of STATS) {
        expect(turn.after[stat]).toBeGreaterThanOrEqual(0);
        expect(turn.after[stat]).toBeLessThanOrEqual(10);
      }
    }
    // 이미 0인 뒤에는 실제 변화가 0이고, 자료에 적힌 변화는 그대로 남는다
    const last = end.history[end.history.length - 1];
    expect(last.requested).toEqual({ living: -3, body: -3, trust: -3 });
    expect(last.delta).toEqual({ living: 0, body: 0, trust: 0 });
  });

  it('계속 늘려도 10을 넘지 않는다', () => {
    const picks = ['flag', 'rest', 'gain']; // 봄 세상, 봄 내 장면, 그 뒤로는 모두 늘리기
    const end = playWith(testPack, 'farmer', 1, picks);
    expect(end.stats).toEqual({ living: 10, body: 10, trust: 10 });
    for (const turn of end.history) {
      for (const stat of STATS) expect(turn.after[stat]).toBeLessThanOrEqual(10);
    }
  });

  it('선택 하나의 변화는 -3~+3으로 묶인다', () => {
    const start = toScene(newGame(testPack, 'farmer', 1));
    const after = choose(testPack, start, 'over'); // 자료에는 +5
    expect(after.history[0].requested.living).toBe(3);
    expect(after.stats.living).toBe(start.stats.living + 3);

    expect(applyEffects({ living: 5, body: 5, trust: 5 }, { living: -9, body: 9 })).toEqual({
      after: { living: 2, body: 8, trust: 5 },
      requested: { living: -3, body: 3, trust: 0 },
      delta: { living: -3, body: 3, trust: 0 },
    });
  });

  it('시작 수치는 상황과 집이 정한 값이다', () => {
    expect(newGame(testPack, 'farmer', 3).stats).toEqual({ living: 4, body: 6, trust: 5 });
    expect(newGame(testPack, 'son', 3).stats).toEqual({ living: 7, body: 6, trust: 6 });
  });
});

describe('잠김 판정', () => {
  it('조건: 역할·수치 아래위·표시·뽑기를 모두 채워야 참이다', () => {
    expect(meets(undefined, facts())).toBe(true);
    expect(meets({}, facts())).toBe(true);
    expect(meets({ roles: ['son'] }, facts())).toBe(false);
    expect(meets({ roles: ['son', 'farmer'] }, facts())).toBe(true);
    expect(meets({ min: { living: 5 } }, facts())).toBe(true);
    expect(meets({ min: { living: 6 } }, facts())).toBe(false);
    expect(meets({ max: { living: 4 } }, facts())).toBe(false);
    expect(meets({ max: { living: 5 } }, facts())).toBe(true);
    expect(meets({ flags: ['a'] }, facts())).toBe(false);
    expect(meets({ flags: ['a'] }, facts({ flags: ['a', 'b'] }))).toBe(true);
    expect(meets({ flags: ['a', 'c'] }, facts({ flags: ['a', 'b'] }))).toBe(false);
    expect(meets({ notFlags: ['a'] }, facts({ flags: ['a'] }))).toBe(false);
    expect(meets({ notFlags: ['a'] }, facts())).toBe(true);
    expect(meets({ draw: 'drought' }, facts())).toBe(false);
    expect(meets({ draw: 'drought' }, facts({ draw: 'drought' }))).toBe(true);
    expect(meets({ min: { living: 5 }, draw: 'drought' }, facts({ draw: 'normal' }))).toBe(false);
  });

  it('수치가 모자라면 잠기고, 잠긴 선택지도 까닭과 함께 보인다', () => {
    let s = toScene(newGame(testPack, 'farmer', 1)); // 봄 세상
    s = toScene(choose(testPack, s, 'drain')); // 살림 4 → 1, 봄 내 장면
    const views = choiceViews(testPack, s);
    expect(views.map((v) => v.id)).toEqual(['rest', 'needLiving', 'needFlag']); // 숨기지 않는다
    expect(views.find((v) => v.id === 'rest')).toMatchObject({ locked: false, reason: null });
    expect(views.find((v) => v.id === 'needLiving')).toMatchObject({ locked: true, reason: '살림이 6은 되어야 해요' });
    expect(views.find((v) => v.id === 'needFlag')).toMatchObject({ locked: true, reason: '봄에 표시를 남겨야 해요' });
    expect(openChoiceIds(testPack, s)).toEqual(['rest']);
  });

  it('잠긴 선택지는 고를 수 없다', () => {
    let s = toScene(newGame(testPack, 'farmer', 1));
    s = toScene(choose(testPack, s, 'drain'));
    expect(() => choose(testPack, s, 'needLiving')).toThrow(/잠긴/);
    expect(() => choose(testPack, s, 'nope')).toThrow(/없는 선택지/);
  });

  it('수치가 차면 열린다', () => {
    let s = toScene(newGame(testPack, 'farmer', 1));
    s = toScene(choose(testPack, s, 'over')); // 살림 4 → 7
    expect(choiceViews(testPack, s).find((v) => v.id === 'needLiving')?.locked).toBe(false);
  });

  it('앞선 선택(표시)으로 열린다', () => {
    let s = toScene(newGame(testPack, 'farmer', 1));
    s = toScene(choose(testPack, s, 'flag'));
    expect(s.flags).toEqual(['f1']);
    expect(s.cards).toEqual(['c1']);
    expect(choiceViews(testPack, s).find((v) => v.id === 'needFlag')?.locked).toBe(false);
    s = choose(testPack, s, 'needFlag');
    expect(s.flags).toEqual(['f1', 'f2']);
  });

  it('신분으로 잠긴다: 같은 세상 장면이 집에 따라 다르게 열린다', () => {
    const summerWorld = (role: 'farmer' | 'son') => {
      let s = toScene(newGame(testPack, role, 1));
      s = toScene(choose(testPack, s, 'flag'));
      s = toScene(choose(testPack, s, 'rest'));
      expect(currentScene(testPack, s)?.id).toBe('t-summer-world');
      return choiceViews(testPack, s).find((v) => v.id === 'sonOnly');
    };
    expect(summerWorld('farmer')).toMatchObject({ locked: true, reason: '양반 집 아들만 글방에 다닐 수 있었어요' });
    expect(summerWorld('son')).toMatchObject({ locked: false, reason: null });
  });
});

describe('결과 갈림', () => {
  /** 여름 내 장면까지 가서 농사를 짓는다 */
  function crop(seed: number, spring: 'flag' | 'drain') {
    let s = toScene(newGame(testPack, 'farmer', seed));
    s = toScene(choose(testPack, s, spring));
    s = toScene(choose(testPack, s, 'rest'));
    s = toScene(choose(testPack, s, 'gain')); // 여름 세상
    expect(currentScene(testPack, s)?.id).toBe('t-summer-farmer');
    const text = currentText(testPack, s);
    const after = choose(testPack, s, 'crop');
    return { text, turn: after.history[after.history.length - 1], draw: after.draw };
  }

  it('같은 선택이 뽑기에 따라 다른 결과가 된다', () => {
    const normal = crop(seedFor('normal'), 'drain');
    expect(normal.draw).toBe('normal');
    expect(normal.turn.result).toBe('normal');
    expect(normal.turn.requested.living).toBe(1);

    const bumper = crop(seedFor('bumper'), 'drain');
    expect(bumper.turn.result).toBe('bumper');
    expect(bumper.turn.requested.living).toBe(2);

    const drought = crop(seedFor('drought'), 'drain');
    expect(drought.turn.result).toBe('drought');
    expect(drought.turn.requested.living).toBe(-1);
  });

  it('봄에 고른 일(표시)과 여름 뽑기가 만나 결과가 갈린다', () => {
    const withFlag = crop(seedFor('drought'), 'flag');
    expect(withFlag.turn.result).toBe('f1+drought');
    expect(withFlag.turn.requested.living).toBe(-2);
    // 표시가 있어도 가뭄이 아니면 바탕 결과
    expect(crop(seedFor('normal'), 'flag').turn.result).toBe('normal');
  });

  it('지문도 뽑기에 따라 달라진다', () => {
    expect(crop(seedFor('drought'), 'drain').text).toBe('가문 여름');
    expect(crop(seedFor('bumper'), 'drain').text).toBe('넉넉한 여름');
    expect(crop(seedFor('normal'), 'drain').text).toBe('여느 여름');
  });

  it('갈린 결과는 바탕 결과를 통째로 갈음한다', () => {
    const drought = crop(seedFor('drought'), 'drain');
    expect(drought.turn.delta.living).toBe(-1); // 바탕의 +1과 더해지지 않는다
  });
});

describe('씨앗과 뽑기', () => {
  it('같은 씨앗이면 같은 판이 나온다', () => {
    for (const seed of [1, 2, 3, 42, 20261007, 4294967295]) {
      expect(playRandom(testPack, 'farmer', seed)).toEqual(playRandom(testPack, 'farmer', seed));
    }
    expect(newGame(testPack, 'farmer', 77)).toEqual(newGame(testPack, 'farmer', 77));
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

  it('날씨는 뽑는 계절(여름)에 들어서야 정해진다', () => {
    const seed = seedFor('drought');
    let s = newGame(testPack, 'farmer', seed);
    expect(s.draw).toBeNull(); // 봄
    s = toScene(s);
    s = toScene(choose(testPack, s, 'flag'));
    s = choose(testPack, s, 'rest');
    expect(s.draw).toBeNull(); // 봄의 마지막 결과
    s = advance(testPack, s); // 봄 닫기
    expect(s.phase).toBe('seasonClose');
    expect(s.draw).toBeNull();
    s = advance(testPack, s); // 여름 열기
    expect(s.phase).toBe('seasonOpen');
    expect(s.draw).toBe('drought');
    expect(s.draw).toBe(rollDraw('weather', seed));
  });

  it('날씨는 가뭄 3 · 보통 5 · 풍년 2 비율로 뽑힌다', () => {
    const count: Record<string, number> = { drought: 0, normal: 0, bumper: 0 };
    const total = 20000;
    for (let seed = 0; seed < total; seed++) count[rollDraw('weather', seed) ?? 'none']++;
    expect(count.drought / total).toBeCloseTo(0.3, 1);
    expect(count.normal / total).toBeCloseTo(0.5, 1);
    expect(count.bumper / total).toBeCloseTo(0.2, 1);
    expect(count.drought + count.normal + count.bumper).toBe(total);
  });

  it('뽑기 표가 없는 종류는 뽑지 않는다', () => {
    expect(rollDraw('none', 1)).toBeNull();
    expect(rollDraw('war', 1)).toBeNull(); // 3바퀴에서 더한다
  });

  it('집 뽑기: 뒤집은 패에는 언제나 할 수 있는 집이 온다', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (let picked = 0; picked < ROLE_IDS.length; picked++) {
        const dealt = dealRoles(ROLE_IDS, ['farmer'], seed, picked);
        expect(dealt[picked]).toBe('farmer');
        expect([...dealt].sort()).toEqual([...ROLE_IDS].sort()); // 네 집이 한 번씩
        expect(dealRoles(ROLE_IDS, ['farmer'], seed, picked)).toEqual(dealt);
      }
    }
    // 네 집을 다 할 수 있으면 네 집이 모두 뽑힌다
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) seen.add(dealRoles(ROLE_IDS, ROLE_IDS, seed, 0)[0]);
    expect(seen.size).toBe(ROLE_IDS.length);
    expect(() => dealRoles(ROLE_IDS, [], 1, 0)).toThrow();
  });
});

describe('한 판은 정확히 8장면', () => {
  it('계절 넷 × (세상 장면 1 + 내 장면 1), 차례는 장면 자료의 order', () => {
    const scenes = sequence(testPack, 'farmer');
    expect(scenes).toHaveLength(SCENES_PER_YEAR);
    expect(scenes.map((s) => s.id)).toEqual([
      't-spring-world',
      't-spring-farmer',
      't-summer-world',
      't-summer-farmer',
      't-autumn-world',
      't-autumn-farmer',
      't-winter-world',
      't-winter-farmer',
    ]);
  });

  it('order를 바꾸면 내 장면이 먼저 나온다', () => {
    const swapped = {
      ...testPack,
      scenes: testPack.scenes.map((s) => (s.season === 'spring' ? { ...s, order: (s.order === 1 ? 2 : 1) as 1 | 2 } : s)),
    };
    expect(sequence(swapped, 'farmer').slice(0, 2).map((s) => s.id)).toEqual(['t-spring-farmer', 't-spring-world']);
  });

  it('화면 차례: 계절 열기 → 장면 → 결과 → 장면 → 결과 → 계절 닫기를 네 번 하고 끝난다', () => {
    const phases: Phase[] = [];
    let s = newGame(testPack, 'farmer', 5);
    phases.push(s.phase);
    while (s.phase !== 'done') {
      s = s.phase === 'scene' ? choose(testPack, s, openChoiceIds(testPack, s)[0]) : advance(testPack, s);
      phases.push(s.phase);
    }
    const season: Phase[] = ['seasonOpen', 'scene', 'result', 'scene', 'result', 'seasonClose'];
    expect(phases).toEqual([...season, ...season, ...season, ...season, 'done']);
    expect(s.history).toHaveLength(8);
    expect(s.history.map((t) => t.season)).toEqual(SEASONS.flatMap((x) => [x, x]));
    expect(s.flow).toHaveLength(5); // 처음 + 계절 넷
    // 끝난 뒤에는 더 나아가지 않는다
    expect(advance(testPack, s)).toBe(s);
    expect(() => choose(testPack, s, 'rest')).toThrow();
  });

  it('고르지 않고는 넘어갈 수 없다', () => {
    const s = toScene(newGame(testPack, 'farmer', 5));
    expect(() => advance(testPack, s)).toThrow(/골라야/);
  });

  it('무작위로 500판을 해도 언제나 8장면이다', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const end = playRandom(testPack, seed % 2 ? 'farmer' : 'son', seed);
      expect(end.history).toHaveLength(SCENES_PER_YEAR);
      expect(end.phase).toBe('done');
    }
  });

  it('장면이 다 있는 집만 할 수 있다', () => {
    expect(playableRoles(testPack)).toEqual(['son', 'farmer']);
    expect(isPlayable(testPack, 'nobi')).toBe(false);
    expect(roleProblems(testPack, 'nobi')).toHaveLength(4); // 계절마다 내 장면이 없다
    expect(() => newGame(testPack, 'nobi', 1)).toThrow(/아직 할 수 없는 집/);
    expect(() => newGame(testPack, 'daughter', 1)).toThrow();
  });

  it('장면이 다 있어도 바람을 가릴 줄이 없는 집은 할 수 없다(한 해 끝에서 멈추지 않게)', () => {
    const noWish = {
      ...testPack,
      situation: {
        ...testPack.situation,
        roles: { ...testPack.situation.roles, son: { ...testPack.situation.roles.son, wishOutcomes: [] } },
      },
    };
    expect(sequence(testPack, 'son')).toHaveLength(8); // 바람 줄이 있으면 할 수 있다
    expect(playableRoles(noWish)).toEqual(['farmer']); // 아들은 "준비 중"으로 남는다
    expect(isPlayable(noWish, 'son')).toBe(false);
    expect(roleProblems(noWish, 'son')).toEqual(['올해의 바람을 가릴 줄(wishOutcomes)이 없다']);
    expect(() => newGame(noWish, 'son', 1)).toThrow(/아직 할 수 없는 집/);
  });

  it('한 해 이름이 하나도 없는 상황은 어느 집도 할 수 없다', () => {
    const noEndings = { ...testPack, situation: { ...testPack.situation, endings: [] } };
    expect(playableRoles(noEndings)).toEqual([]);
    expect(roleProblems(noEndings, 'farmer')).toEqual(['한 해 이름(endings)이 하나도 없다']);
  });

  it('할 수 있는 집이면 어떤 판이든 한 해 돌아보기를 만들 수 있다', () => {
    for (const role of playableRoles(testPack)) {
      for (let seed = 1; seed <= 200; seed++) {
        expect(() => reviewYear(testPack, playRandom(testPack, role, seed))).not.toThrow();
      }
    }
  });

  it('장면 자료만 더하면 그 집을 할 수 있다(코드를 고치지 않는다)', () => {
    const nobiScenes = testPack.scenes
      .filter((s) => s.role === 'farmer')
      .map((s) => ({ ...s, id: s.id.replace('farmer', 'nobi'), role: 'nobi' as const }));
    const bigger = { ...testPack, scenes: [...testPack.scenes, ...nobiScenes] };
    expect(playableRoles(bigger)).toEqual(['son', 'farmer', 'nobi']);
    expect(playRandom(bigger, 'nobi', 9).history).toHaveLength(8);
  });

  it('상태를 고치지 않고 새 상태를 돌려준다', () => {
    let s = deepFreeze(newGame(testPack, 'farmer', 11));
    while (s.phase !== 'done') {
      s = deepFreeze(s.phase === 'scene' ? choose(testPack, s, openChoiceIds(testPack, s)[0]) : advance(testPack, s));
    }
    expect(s.history).toHaveLength(8);
  });
});

describe('한 해 돌아보기', () => {
  it('계절마다 고른 일, 수치의 흐름, 바람, 한 해 이름, 뒷이야기를 돌려준다', () => {
    const end = playWith(testPack, 'farmer', 1, ['flag', 'rest', 'gain']);
    const review = reviewYear(testPack, end);
    expect(review.seasons.map((s) => s.season)).toEqual([...SEASONS]);
    for (const season of review.seasons) expect(season.turns).toHaveLength(2);
    expect(review.seasons[0].turns.map((t) => t.choiceId)).toEqual(['flag', 'rest']);
    expect(review.flow).toHaveLength(5);
    expect(review.flow[0]).toEqual({ living: 4, body: 6, trust: 5 });
    expect(review.flow[4]).toEqual(end.stats);
    expect(review.final).toEqual({ living: 10, body: 10, trust: 10 });
    expect(review.wish).toEqual({ text: '농민의 바람', fulfilled: true, reason: '살림이 넉넉했다' });
    expect(review.yearName.id).toBe('rich'); // 살림 10이 표시보다 먼저 맞는다
    expect(review.epilogue).toBe('뒷이야기');
    expect(review.cards).toEqual(['c1']);
    expect(review.draw).toBe(rollDraw('weather', 1));
  });

  it('한 해 이름은 수치와 선택으로 가린다', () => {
    expect(reviewYear(testPack, playWith(testPack, 'farmer', 1, DRAIN_ALL)).yearName.id).toBe('empty');
    const flagged = playWith(testPack, 'farmer', 1, ['flag', 'rest', 'drain', 'gain', 'rest']);
    expect(flagged.stats.living).toBe(4);
    expect(reviewYear(testPack, flagged).yearName.id).toBe('flagged');
    expect(pickEnding(testPack.situation, facts({ flags: ['f1'] })).id).toBe('flagged');
    expect(pickEnding(testPack.situation, facts()).id).toBe('plain');
  });

  it('바람을 이루지 못해도 까닭을 돌려준다', () => {
    const review = reviewYear(testPack, playWith(testPack, 'farmer', 1, DRAIN_ALL));
    expect(review.wish.fulfilled).toBe(false);
    expect(review.wish.reason).toBe('살림이 모자랐다');
    expect(judgeWish(testPack.situation.roles.son, facts({ stats: { living: 5, body: 0, trust: 0 } })).fulfilled).toBe(true);
  });

  it('계절 하나를 간추린다(계절 닫기 화면)', () => {
    const end = playWith(testPack, 'farmer', 1, ['drain', 'rest', 'gain']);
    const spring = summarizeSeason(end, 0);
    expect(spring.start).toEqual({ living: 4, body: 6, trust: 5 });
    expect(spring.end).toEqual({ living: 1, body: 3, trust: 2 });
    expect(spring.delta).toEqual({ living: -3, body: -3, trust: -3 });
    const summer = summarizeSeason(end, 1);
    expect(summer.start).toEqual(spring.end);
  });

  it('한 해가 끝나기 전에는 돌아볼 수 없다', () => {
    expect(() => reviewYear(testPack, newGame(testPack, 'farmer', 1))).toThrow(/끝나지 않았다/);
  });
});
