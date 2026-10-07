// 화면 차례(store) 시험: 엔진이 던져도 빈 화면에서 멈추지 않는다.
// 한 해 돌아보기를 만드는 데 실패하면 상태를 바꾸지 않고 '이어 갈 수 없어요' 화면(trouble)으로 간다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openChoiceIds } from '../src/engine/game';
import * as reviewModule from '../src/engine/review';
import {
  askingHome,
  chooseNow,
  beginYear,
  game,
  goHome,
  goPick,
  nextNow,
  pack,
  pickSituation,
  review,
  saved,
  screen,
  settleRole,
} from '../src/state/store';

vi.mock('../src/engine/review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/review')>();
  return { ...actual, reviewYear: vi.fn(actual.reviewYear) };
});

const reviewYear = vi.mocked(reviewModule.reviewYear);

/** 연달아 누르기 막기(0.3초)를 넘기려고 시계를 앞으로 돌린다 */
function later(): void {
  vi.advanceTimersByTime(400);
}

/** 제목에서 농민 집의 봄 계절 열기까지 */
function startFarmer(): void {
  later();
  goPick();
  later();
  pickSituation('s1395');
  later();
  settleRole('farmer');
  later();
  beginYear();
}

/** 겨울 계절 닫기까지(한 해 돌아보기를 누르기 바로 앞) */
function playToLastClose(): void {
  for (let step = 0; step < 60; step++) {
    const g = game.value!;
    if (g.phase === 'seasonClose' && g.seasonIndex === 3) return;
    later();
    if (g.phase === 'scene') chooseNow(openChoiceIds(pack.value!, g)[0]);
    else nextNow();
  }
  throw new Error('겨울 닫기에 이르지 못했다');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T09:00:00'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  goHome();
});

afterEach(() => {
  reviewYear.mockReset(); // 본디 reviewYear로 되돌린다
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('화면 차례', () => {
  it('제목에서 한 해 돌아보기까지 간다', () => {
    startFarmer();
    expect(screen.value).toBe('play');
    expect(game.value?.phase).toBe('seasonOpen');
    playToLastClose();
    later();
    nextNow(); // "한 해 돌아보기"
    expect(screen.value).toBe('review');
    expect(game.value?.phase).toBe('done');
    expect(review.value?.seasons).toHaveLength(4);
    expect(saved.value.firstDone).toBe(true);
    expect(saved.value.plays.at(-1)).toMatchObject({ situation: 's1395', role: 'farmer' });
  });

  it('연달아 누르면(0.3초 안) 두 번째 누름은 받지 않는다', () => {
    startFarmer();
    later();
    nextNow(); // 봄 열기 → 첫 장면
    expect(game.value?.phase).toBe('scene');
    chooseNow(openChoiceIds(pack.value!, game.value!)[0]); // 바로 이어 누름
    expect(game.value?.phase).toBe('scene');
    later();
    chooseNow(openChoiceIds(pack.value!, game.value!)[0]);
    expect(game.value?.phase).toBe('result');
  });
});

describe('엔진이 던져도 빈 화면이 되지 않는다', () => {
  it('한 해 돌아보기를 만들지 못하면 상태를 바꾸지 않고 "이어 갈 수 없어요"로 간다', () => {
    startFarmer();
    playToLastClose();
    const before = game.value;
    const plays = saved.value.plays.length;
    reviewYear.mockImplementation(() => {
      throw new Error('"양반 집 아들": 바람을 가릴 줄이 없다');
    });
    later();
    expect(() => nextNow()).not.toThrow();
    // 빈 화면이 되던 때의 상태(계절 화면에 남은 채 판만 끝남)가 아니다
    expect(screen.value).toBe('trouble');
    expect(game.value).toBe(before);
    expect(game.value?.phase).toBe('seasonClose');
    expect(saved.value.plays).toHaveLength(plays);
    expect(review.value).toBeNull();
    // 처음으로 돌아갈 수 있다
    goHome();
    expect(screen.value).toBe('title');
    expect(game.value).toBeNull();
  });

  it('돌아보기 화면을 그리다 실패해도 던지지 않고 null을 돌려준다', () => {
    startFarmer();
    playToLastClose();
    later();
    nextNow();
    expect(screen.value).toBe('review');
    expect(review.value).not.toBeNull();
    reviewYear.mockImplementation(() => {
      throw new Error('깨짐');
    });
    game.value = { ...game.value! }; // 같은 내용의 새 상태 → 돌아보기를 다시 셈하게 한다
    expect(() => review.value).not.toThrow();
    expect(review.value).toBeNull();
  });

  it('없는 선택지를 고르면 던지는 대신 "이어 갈 수 없어요"로 간다', () => {
    startFarmer();
    later();
    nextNow();
    expect(game.value?.phase).toBe('scene');
    askingHome.value = true;
    later();
    expect(() => chooseNow('이런-선택지는-없다')).not.toThrow();
    expect(screen.value).toBe('trouble');
    expect(askingHome.value).toBe(false);
  });

  it('준비 중인 집과 상황은 시작되지 않는다', () => {
    later();
    goPick();
    later();
    pickSituation('s1446'); // 준비 중
    expect(screen.value).toBe('pick');
    later();
    pickSituation('s1395');
    expect(screen.value).toBe('roleDraw');
    later();
    settleRole('son'); // 장면도 바람 줄도 없는 집
    expect(screen.value).toBe('roleDraw');
    expect(game.value).toBeNull();
  });
});
