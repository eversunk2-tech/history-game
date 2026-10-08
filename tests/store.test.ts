// 화면 차례(store) 시험: 제목 → 이야기책 → 누가 될까 → 나를 소개합니다 → 맵 → 계절 닫기 → "다음에 만들어요",
// 저절로 저장하는 때, 끄고 켰을 때 이어지는 자리, 저장이 안 되는 창, 모두 지우기, 엔진이 던졌을 때.
// 브라우저 없이 돈다: 가짜 저장소와 가짜 창을 걸어 두고, "끄고 켜기"는 가게 모듈을 새로 불러와서 흉내 낸다.
// 실제 이야기(① 1395년 농민 집 아이의 봄)로 돌린다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPack } from '../src/content';
import { canCloseSeason, doHappening, openChoiceIds, openHappenings, type DoInput } from '../src/engine/game';
import type { GameState, Look, SituationPack } from '../src/engine/types';
import { BACKUP_KEY, SAVE_KEY, SCHEMA, packBits, parseSave } from '../src/state/storage';

const env = vi.hoisted(() => {
  const data = new Map<string, string>();
  const state = { failWrites: false, noStorage: false, search: '', visibility: 'visible' };
  const listeners = new Map<string, (() => void)[]>();
  const on = (type: string, fn: () => void): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  };
  const storage = {
    getItem: (key: string): string | null => data.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      if (state.failWrites) throw new Error('꽉 참');
      data.set(key, value);
    },
    removeItem: (key: string): void => {
      data.delete(key);
    },
  };
  const win = {
    get localStorage() {
      if (state.noStorage) throw new Error('막힌 창');
      return storage;
    },
    location: {
      get search() {
        return state.search;
      },
    },
    addEventListener: on,
  };
  const doc = {
    get visibilityState() {
      return state.visibility;
    },
    addEventListener: on,
  };
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = doc;
  return {
    data,
    state,
    listeners,
    fire(type: string): void {
      for (const fn of listeners.get(type) ?? []) fn();
    },
  };
});

type Store = typeof import('../src/state/store');

/** 게임을 (다시) 켠다: 가게 모듈을 새로 불러온다. 저장소의 글자는 그대로 남아 있다. */
async function boot(): Promise<Store> {
  vi.resetModules();
  env.listeners.clear();
  env.state.visibility = 'visible';
  return import('../src/state/store');
}

/** 연달아 누르기 막기(0.3초)를 넘기려고 시계를 앞으로 돌린다 */
function later(): void {
  vi.advanceTimersByTime(400);
}

function saved(): { schema: number; build: string; cards: string[]; current?: GameState; walked?: string; papers?: string[]; cleared: object } | null {
  const raw = env.data.get(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

const PACK = getPack('s1395') as SituationPack;

/** 제목에서 봄의 맵까지 */
function startSpring(s: Store, look: Look = 'girl'): void {
  later();
  s.goBook();
  later();
  s.openStory('s1395');
  later();
  s.settleRole('farmer', look);
  later();
  s.beginYear();
}

/** 그 일을 처음 열린 선택지와 놀이의 첫 모습으로 넘길 값 */
function inputFor(game: GameState, id: string, pick = 0): DoInput {
  const h = PACK.happenings.find((x) => x.id === id)!;
  const open = openChoiceIds(PACK, game, id);
  return { id, choiceId: open.length > 0 ? open[Math.min(pick, open.length - 1)] : undefined, play: h.play ? Object.keys(h.play.flags)[0] : undefined };
}

/** 맵에서 일 하나를 한다: 자리에 닿아 대화 장면이 열리고, 고르고, 닫고, "미션이 풀림" 종이를 넘긴다 */
function doOne(s: Store, id: string, pick = 0): void {
  later();
  s.openTalk(id);
  expect(s.talk.value).toBe(id);
  const deed = s.commitTalk(inputFor(s.game.value!, id, pick));
  expect(deed?.happeningId).toBe(id);
  s.closeTalk();
  while (s.missionQueue.value.length > 0) {
    later();
    s.closeMissionDone();
  }
}

/** 꼭 할 일을 다 한다(덤은 하지 않는다). 한 일의 수를 돌려준다. */
function doMusts(s: Store, limit = 99): number {
  let n = 0;
  for (; n < limit; n++) {
    const g = s.game.value!;
    if (canCloseSeason(PACK, g)) break;
    const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun);
    if (!next) throw new Error('꼭 할 일이 남았는데 할 수 있는 일이 없다');
    doOne(s, next.happening.id);
  }
  return n;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T09:00:00'));
  env.data.clear();
  env.state.failWrites = false;
  env.state.noStorage = false;
  env.state.search = '';
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('화면 차례', () => {
  it('제목 → 이야기책 → 누가 될까 → 나를 소개합니다 → 맵', async () => {
    const s = await boot();
    expect(s.screen.value).toBe('title');
    expect(s.loadStatus.value).toBe('empty');
    expect(s.canContinue.value).toBe(false);
    later();
    s.goBook();
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('s1395');
    expect(s.screen.value).toBe('rolePick');
    expect(s.pack.value?.situation.id).toBe('s1395');
    later();
    s.settleRole('farmer', 'girl');
    expect(s.screen.value).toBe('intro');
    expect(s.game.value?.look).toBe('girl');
    // 맵에 들어서기 전에는 아무것도 적지 않는다
    expect(saved()).toBeNull();
    later();
    s.beginYear();
    expect(s.screen.value).toBe('map');
    expect(saved()?.current?.role).toBe('farmer');
    expect(saved()?.schema).toBe(SCHEMA);
  });

  it('준비 중인 이야기와 집은 열리지 않는다', async () => {
    const s = await boot();
    later();
    s.goBook();
    later();
    s.openStory('s1592');
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('없는 이야기');
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('s1395');
    for (const role of ['son', 'daughter', 'nobi', '없는 집']) {
      later();
      s.settleRole(role, 'boy');
      expect(s.screen.value, role).toBe('rolePick');
      expect(s.game.value, role).toBeNull();
    }
  });

  it('연달아 두 번 누르면 한 번만 먹는다', async () => {
    const s = await boot();
    later();
    s.goBook();
    s.openStory('s1395'); // 0.3초가 지나지 않았다
    expect(s.screen.value).toBe('book');
    later();
    s.openStory('s1395');
    expect(s.screen.value).toBe('rolePick');
  });

  it('남자아이·여자아이 모습 모두: 꼭 할 일을 다 해야 봄을 보낼 수 있고, 보내면 계절 닫기 → "다음에 만들어요"', async () => {
    for (const look of ['boy', 'girl'] as const) {
      env.data.clear();
      const s = await boot();
      startSpring(s, look);
      // 꼭 할 일이 남았으면 넘어가지 않는다
      later();
      s.closeSeasonNow();
      expect(s.screen.value).toBe('map');
      expect(s.game.value?.phase).toBe('season');
      const did = doMusts(s);
      expect(did).toBeGreaterThanOrEqual(2);
      expect(canCloseSeason(PACK, s.game.value!)).toBe(true);
      later();
      s.closeSeasonNow();
      expect(s.screen.value).toBe('seasonClose');
      expect(s.game.value?.phase).toBe('seasonClose');
      expect(saved()?.current?.phase).toBe('seasonClose');
      expect(s.nextSeasonReady()).toBe(false); // 여름은 아직 만들지 않았다
      later();
      s.goNextSeason();
      expect(s.screen.value).toBe('next');
      expect(s.game.value?.seasonIndex).toBe(1);
      expect(saved()?.current?.seasonIndex).toBe(1);
      later();
      s.backToTitle();
      expect(s.screen.value).toBe('title');
      expect(s.game.value).toBeNull();
    }
  });
});

describe('대화 장면과 미션이 풀림', () => {
  it('자리에 닿으면 대화 장면이 얹히고, 그동안 맵은 멈춘다', async () => {
    const s = await boot();
    startSpring(s);
    expect(s.mapBusy.value).toBe(false);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    s.openTalk(first);
    expect(s.talk.value).toBe(first);
    expect(s.mapBusy.value).toBe(true);
    // 대화가 떠 있는 동안에는 다른 일이 열리지 않는다
    s.openTalk('다른 일');
    expect(s.talk.value).toBe(first);
  });

  it('"나중에 할게요": 고르기 전에 닫으면 아무 일도 일어나지 않은 것이다', async () => {
    const s = await boot();
    startSpring(s);
    const before = s.game.value;
    const first = openHappenings(PACK, before!).find((v) => v.must)!.happening.id;
    s.openTalk(first);
    s.closeTalk();
    expect(s.talk.value).toBeNull();
    expect(s.game.value).toEqual(before);
    expect(s.missionQueue.value).toEqual([]);
    expect(s.mapBusy.value).toBe(false);
  });

  it('일을 마치면 바로 저장되고, 미션이 풀리면 대화가 닫힌 뒤에 종이가 뜬다', async () => {
    const s = await boot();
    startSpring(s);
    let solvedSeen = false;
    for (let step = 0; step < 12 && !canCloseSeason(PACK, s.game.value!); step++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      later();
      s.openTalk(next);
      const deed = s.commitTalk(inputFor(g, next));
      expect(deed).not.toBeNull();
      // 대화 장면이 결과를 보여 주는 동안 이미 적혀 있다(여기서 꺼도 한 일은 남는다)
      expect(saved()?.current?.done).toContain(next);
      expect(s.talk.value).toBe(next);
      expect(s.missionQueue.value).toEqual([]);
      s.closeTalk();
      expect(s.talk.value).toBeNull();
      expect(s.missionQueue.value).toEqual(deed!.solved);
      if (deed!.solved.length > 0) {
        solvedSeen = true;
        expect(s.mapBusy.value).toBe(true);
        expect(saved()?.current?.solved).toEqual(expect.arrayContaining(deed!.solved));
      }
      while (s.missionQueue.value.length > 0) {
        later();
        s.closeMissionDone();
      }
      expect(s.mapBusy.value).toBe(false);
    }
    expect(solvedSeen).toBe(true);
  });

  it('봇짐과 지난 이야기는 맵 위에 뜨고, 대화 중에는 열리지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    s.openPanel('bag');
    expect(s.panel.value).toBe('bag');
    expect(s.mapBusy.value).toBe(true);
    s.openPanel('past');
    expect(s.panel.value).toBe('past');
    s.openPanel('past');
    expect(s.panel.value).toBeNull();
    s.openPanel('bag');
    const first = openHappenings(PACK, s.game.value!)[0].happening.id;
    s.openTalk(first);
    expect(s.panel.value).toBeNull();
    s.openPanel('bag');
    expect(s.panel.value).toBeNull();
  });

  it('해 ☀가 다 지면 덤으로 하는 일은 더 할 수 없다(가게가 엔진의 약속을 지킨다)', async () => {
    const s = await boot();
    startSpring(s);
    let extras = 0;
    for (let step = 0; step < 10; step++) {
      const next = openHappenings(PACK, s.game.value!).find((v) => !v.must && !v.noSun);
      if (!next) break;
      doOne(s, next.happening.id);
      extras++;
    }
    expect(extras).toBe(PACK.situation.roles.find((r) => r.id === 'farmer')!.suns);
    expect(s.game.value!.sunsLeft).toBe(0);
    // 남은 덤은 맵에 보이지만 할 수 없다
    const left = openHappenings(PACK, s.game.value!).filter((v) => !v.must);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((v) => v.noSun)).toBe(true);
    // 꼭 할 일은 해가 없어도 할 수 있다
    doMusts(s);
    expect(canCloseSeason(PACK, s.game.value!)).toBe(true);
  });
});

describe('끄고 켜도 이어진다', () => {
  it('봄의 어느 때에 꺼도 그 판 그대로, 그 계절의 맵에서 이어진다', async () => {
    // 꼭 할 일을 0개, 1개, 2개 … 한 뒤에 끄고 켠다
    for (let cut = 0; cut < 8; cut++) {
      env.data.clear();
      let s = await boot();
      startSpring(s, cut % 2 === 0 ? 'girl' : 'boy');
      const did = doMusts(s, cut);
      const before = s.game.value!;
      s = await boot();
      expect(s.loadStatus.value, `${cut}`).toBe('ok');
      expect(s.screen.value).toBe('title');
      expect(s.canContinue.value).toBe(true);
      later();
      s.continueGame();
      expect(s.screen.value, `${cut}`).toBe('map');
      expect(s.game.value, `${cut}`).toEqual(before);
      expect(s.talk.value).toBeNull();
      // 이어서 끝까지 갈 수 있다
      doMusts(s);
      later();
      s.closeSeasonNow();
      expect(s.screen.value, `${cut}`).toBe('seasonClose');
      if (did < cut) break; // 꼭 할 일을 다 했다
    }
  });

  it('대화나 놀이 도중에 끄면 그 일의 처음부터다(고르기 전의 것은 적히지 않는다)', async () => {
    let s = await boot();
    startSpring(s);
    const before = s.game.value!;
    const first = openHappenings(PACK, before).find((v) => v.must)!.happening.id;
    s.openTalk(first);
    // 여는 대화를 읽는 중에 화면이 가려지고 꺼졌다
    env.state.visibility = 'hidden';
    env.fire('visibilitychange');
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.talk.value).toBeNull();
    expect(s.game.value).toEqual(before);
    expect(openHappenings(PACK, s.game.value!).some((v) => v.happening.id === first)).toBe(true);
  });

  it('마지막에 서 있던 자리와 가 본 곳이 남는다: 화면이 가려질 때 적는다', async () => {
    let s = await boot();
    startSpring(s);
    const walked = packBits(Uint8Array.from({ length: 96 * 72 }, (_, i) => (i % 3 === 0 ? 1 : 0)));
    s.markPlace('46,34', ['village', 'fields'], walked);
    // markPlace는 적지 않는다(걸을 때마다 저장소를 건드리지 않는다)
    expect(saved()?.current?.at).toBeUndefined();
    env.state.visibility = 'hidden';
    env.fire('visibilitychange');
    expect(saved()?.current?.at).toBe('46,34');
    expect(saved()?.current?.seen).toEqual(['village', 'fields']);
    expect(saved()?.walked).toBe(walked);
    s = await boot();
    later();
    s.continueGame();
    expect(s.game.value?.at).toBe('46,34');
    expect(s.game.value?.seen).toEqual(['village', 'fields']);
    expect(s.walkedText()).toBe(walked);
  });

  it('창을 닫을 때(pagehide)도, 일을 마칠 때도, 처음으로 갈 때도 서 있던 자리가 적힌다', async () => {
    const s = await boot();
    startSpring(s);
    s.markPlace('30,36', ['village']);
    env.fire('pagehide');
    expect(saved()?.current?.at).toBe('30,36');
    s.markPlace('29,36', ['village']);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    expect(saved()?.current?.at).toBe('29,36');
    s.markPlace('44,54', ['village', 'fields']);
    s.askHome();
    expect(s.askingHome.value).toBe(true);
    expect(s.mapBusy.value).toBe(true);
    s.goHome();
    expect(s.askingHome.value).toBe(false);
    expect(s.screen.value).toBe('title');
    expect(saved()?.current?.at).toBe('44,54');
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value?.at).toBe('44,54');
  });

  it('계절 닫기 화면에서 끄면 계절 닫기에서, 봄을 넘긴 뒤에 끄면 "다음에 만들어요"에서 이어진다', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    later();
    s.closeSeasonNow();
    const closed = s.game.value;
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('seasonClose');
    expect(s.game.value).toEqual(closed);
    later();
    s.goNextSeason();
    expect(s.screen.value).toBe('next');
    s = await boot();
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('next');
    expect(s.game.value?.seasonIndex).toBe(1);
  });

  it('새 계절로 넘어가면 가 본 칸은 비운다(계절마다 새로 걷는다)', async () => {
    const s = await boot();
    startSpring(s);
    s.markPlace('30,36', ['village'], 'ff00');
    doMusts(s);
    expect(saved()?.walked).toBe('ff00');
    later();
    s.closeSeasonNow();
    later();
    s.goNextSeason();
    expect(s.walkedText()).toBe('');
    expect(saved()?.walked).toBe('');
  });

  it('새 판을 시작하면 앞 판의 가 본 칸이 딸려 오지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    s.markPlace('30,36', ['village'], 'ff00');
    s.goHome();
    expect(saved()?.walked).toBe('ff00');
    later();
    s.dropCurrent();
    startSpring(s, 'boy');
    expect(s.walkedText()).toBe('');
    expect(saved()?.walked).toBe('');
    expect(saved()?.current?.at).toBeUndefined();
  });

  it('모은 카드는 판 밖에도 적힌다(수첩)', async () => {
    const s = await boot();
    startSpring(s);
    doMusts(s);
    const cards = s.game.value!.cards;
    expect(saved()?.cards).toEqual(expect.arrayContaining(cards));
    // 진행 중인 해를 지워도 카드는 남는다
    s.goHome();
    s.dropCurrent();
    expect(saved()?.current).toBeUndefined();
    expect(saved()?.cards).toEqual(expect.arrayContaining(cards));
    expect(s.canContinue.value).toBe(false);
  });
});

describe('"미션이 풀림" 종이를 보기 전에 꺼도 다음에 뜬다(review 4번)', () => {
  /** 미션을 푸는 일 바로 앞까지 간 뒤, 그 일의 id를 돌려준다 */
  function untilSolving(s: Store): string {
    for (let step = 0; step < 12; step++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      // 이 일을 하면 미션이 풀리는가(엔진으로 미리 해 본다)
      const tried = doHappening(PACK, g, inputFor(g, next));
      if (tried.solved.length > g.solved.length) return next;
      doOne(s, next);
    }
    throw new Error('미션을 푸는 일에 이르지 못했다');
  }

  it('결과 대화를 보다가 끄면: 이어 할 때 맵에 들어서자마자 종이가 뜨고, 닫으면 다시 뜨지 않는다', async () => {
    let s = await boot();
    startSpring(s);
    const id = untilSolving(s);
    later();
    s.openTalk(id);
    const deed = s.commitTalk(inputFor(s.game.value!, id))!;
    expect(deed.solved.length).toBe(1);
    // 대화 장면이 결과를 보여 주는 중이다. 종이는 아직 뜨지 않았지만 저장에는 빚으로 적혀 있다.
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toEqual(deed.solved);
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.talk.value).toBeNull();
    expect(s.missionQueue.value).toEqual(deed.solved);
    expect(s.mapBusy.value).toBe(true);
    later();
    s.closeMissionDone();
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toBeUndefined();
    s = await boot();
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual([]);
  });

  it('종이가 떠 있을 때 끄거나 처음으로 가도 다음에 다시 뜬다', async () => {
    let s = await boot();
    startSpring(s);
    const id = untilSolving(s);
    later();
    s.openTalk(id);
    const deed = s.commitTalk(inputFor(s.game.value!, id))!;
    s.closeTalk();
    expect(s.missionQueue.value).toEqual(deed.solved);
    s.goHome();
    expect(s.missionQueue.value).toEqual([]);
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual(deed.solved);
    s = await boot();
    later();
    s.continueGame();
    expect(s.missionQueue.value).toEqual(deed.solved);
  });

  it('새 판을 시작하면 앞 판의 종이가 딸려 오지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    const id = untilSolving(s);
    later();
    s.openTalk(id);
    s.commitTalk(inputFor(s.game.value!, id));
    s.closeTalk();
    s.goHome();
    later();
    s.dropCurrent();
    startSpring(s, 'boy');
    expect(s.missionQueue.value).toEqual([]);
    expect(saved()?.papers).toBeUndefined();
  });

  it('계절을 넘기면 남은 종이는 지워진다', async () => {
    const s = await boot();
    startSpring(s);
    doMusts(s);
    later();
    s.closeSeasonNow();
    expect(saved()?.papers).toBeUndefined();
    expect(s.missionQueue.value).toEqual([]);
  });
});

describe('새 판', () => {
  it('새 판을 만들 때마다 판의 번호가 는다(맵이 앞 판의 자리를 버린다 — review 14번)', async () => {
    env.state.search = '?seed=7';
    const s = await boot();
    const before = s.gameNo.value;
    startSpring(s);
    const first = s.gameNo.value;
    expect(first).toBe(before + 1);
    expect(s.game.value!.seed).toBe(7);
    s.markPlace('46,34', ['village'], 'ff');
    s.goHome();
    // 이어 하기는 같은 판이다
    later();
    s.continueGame();
    expect(s.gameNo.value).toBe(first);
    s.goHome();
    // 처음부터: 같은 씨앗, 같은 모습이어도 다른 판이다
    later();
    s.dropCurrent();
    startSpring(s);
    expect(s.game.value!.seed).toBe(7);
    expect(s.gameNo.value).toBeGreaterThan(first);
    expect(s.game.value!.at).toBeUndefined();
  });
});

describe('저장이 안 되거나 읽을 수 없을 때', () => {
  it('저장이 안 되는 창: 알리고, 게임은 끝까지 된다', async () => {
    env.state.noStorage = true;
    const s = await boot();
    expect(s.loadStatus.value).toBe('noStorage');
    startSpring(s);
    expect(s.screen.value).toBe('map');
    expect(s.saveFailed.value).toBe(true);
    doMusts(s);
    later();
    s.closeSeasonNow();
    expect(s.screen.value).toBe('seasonClose');
    later();
    s.goNextSeason();
    expect(s.screen.value).toBe('next');
    expect(env.data.size).toBe(0);
  });

  it('쓰다가 실패하면(공간 없음) 알리고 게임은 이어진다. 다시 써지면 알림이 꺼진다', async () => {
    const s = await boot();
    startSpring(s);
    expect(s.saveFailed.value).toBe(false);
    env.state.failWrites = true;
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    expect(s.saveFailed.value).toBe(true);
    expect(s.game.value!.done).toContain(first);
    expect(saved()?.current?.done).toEqual([]);
    env.state.failWrites = false;
    s.saveNow();
    expect(s.saveFailed.value).toBe(false);
    expect(saved()?.current?.done).toContain(first);
  });

  it('글자가 깨진 저장: 처음부터 하되 깨진 글자를 한 벌 남긴다', async () => {
    env.data.set(SAVE_KEY, '{"schema":2,"cards":[');
    const s = await boot();
    expect(s.loadStatus.value).toBe('unreadable');
    expect(s.canContinue.value).toBe(false);
    expect(env.data.get(BACKUP_KEY)).toBe('{"schema":2,"cards":[');
    startSpring(s);
    expect(s.screen.value).toBe('map');
    expect(saved()?.current?.role).toBe('farmer');
  });

  it('진행 중인 해만 망가진 저장: 깬 기록과 카드는 남고 그 해만 봄부터 다시 한다', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    const raw = saved()!;
    const cards = raw.cards;
    expect(cards.length).toBeGreaterThan(0);
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, cleared: { s1395: [{ role: 'farmer', look: 'girl', ending: 'e', legacy: 'l' }] }, current: { ...raw.current, stats: 'x' } }));
    s = await boot();
    expect(s.loadStatus.value).toBe('yearLost');
    expect(s.canContinue.value).toBe(false);
    expect(s.save.value.cards).toEqual(cards);
    expect(s.save.value.cleared.s1395).toHaveLength(1);
    // 새로 시작해도 깬 기록과 카드가 저장에 그대로 있다
    startSpring(s);
    expect(saved()?.cards).toEqual(cards);
    expect((saved()?.cleared as Record<string, unknown[]>).s1395).toHaveLength(1);
  });

  it('저장에 없어진 일·카드가 섞여 있으면 그 항목만 버리고 이어 한다', async () => {
    let s = await boot();
    startSpring(s);
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    const raw = saved()!;
    const cur = raw.current!;
    env.data.set(
      SAVE_KEY,
      JSON.stringify({
        ...raw,
        current: {
          ...cur,
          done: [...cur.done, 's1395-없어진-일'],
          solved: ['s1395-없어진-미션'],
          cards: [...cur.cards, '없어진 카드'],
          items: ['없어진 물건'],
          history: [...cur.history, { ...cur.history[0], happeningId: 's1395-없어진-일' }],
        },
      }),
    );
    s = await boot();
    expect(s.loadStatus.value).toBe('ok');
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value!.done).toEqual(cur.done);
    expect(s.game.value!.solved).toEqual([]);
    expect(s.game.value!.cards).toEqual(cur.cards);
    expect(s.game.value!.items).toEqual([]);
    expect(s.game.value!.history).toHaveLength(cur.history.length);
    expect(s.game.value!.stats).toEqual(cur.stats);
    // 그 판으로 끝까지 간다
    doMusts(s);
    later();
    s.closeSeasonNow();
    expect(s.screen.value).toBe('seasonClose');
  });

  it('남겨 둔 한 벌(backup)은 계절을 하나 넘기면 지운다', async () => {
    env.data.set(SAVE_KEY, '{"깨진');
    const s = await boot();
    expect(env.data.has(BACKUP_KEY)).toBe(true);
    startSpring(s);
    doMusts(s);
    expect(env.data.has(BACKUP_KEY)).toBe(true);
    later();
    s.closeSeasonNow();
    expect(env.data.has(BACKUP_KEY)).toBe(false);
    expect(saved()?.current?.phase).toBe('seasonClose');
  });

  it('없는 역할이나 될 수 없는 모습의 저장: "이어 하기"를 누르면 그 해만 내려놓고 제목에서 알린다(되풀이되지 않는다)', async () => {
    for (const hurt of [{ role: '없는 집' }, { role: 'son', look: 'girl' }]) {
      env.data.clear();
      let s = await boot();
      startSpring(s);
      doMusts(s);
      const raw = saved()!;
      const text = JSON.stringify({ ...raw, current: { ...raw.current, ...hurt } });
      env.data.set(SAVE_KEY, text);
      s = await boot();
      expect(s.canContinue.value).toBe(true);
      later();
      s.continueGame();
      expect(s.screen.value).toBe('title');
      expect(s.loadStatus.value).toBe('yearLost');
      expect(s.canContinue.value).toBe(false);
      expect(s.game.value).toBeNull();
      // 카드는 남고, 내려놓기 전의 글자가 한 벌 남는다
      expect(saved()?.current).toBeUndefined();
      expect(saved()?.cards).toEqual(raw.cards);
      expect(env.data.get(BACKUP_KEY)).toBe(text);
      // 새로 시작할 수 있다
      startSpring(s);
      expect(s.screen.value).toBe('map');
    }
  });

  it('한 일의 기록이 망가진 저장: 읽을 때 그 해만 버린다("이어 하기"가 먹통이 되지 않는다)', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    const raw = saved()!;
    for (const history of [[...raw.current!.history, 'x'], [{ happeningId: 3 }], [null]]) {
      env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, history } }));
      s = await boot();
      expect(s.loadStatus.value).toBe('yearLost');
      expect(s.canContinue.value).toBe(false);
      expect(s.save.value.cards).toEqual(raw.cards);
    }
  });

  it('남은 해 ☀가 터무니없는 저장: 그 역할의 해로 묶어 이어 한다', async () => {
    let s = await boot();
    startSpring(s);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, sunsLeft: 999 } }));
    s = await boot();
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    expect(s.game.value!.sunsLeft).toBe(PACK.situation.roles.find((r) => r.id === 'farmer')!.suns);
  });

  it('같은 저장으로 거듭 멈추면 그 해를 내려놓는다(이어 하기 → 멈춤 → 처음으로가 되풀이되지 않게)', async () => {
    const s = await boot();
    startSpring(s);
    // 첫 번째 멈춤: 처음으로 가도 하던 해는 남아 있다
    s.openTalk('없는 일');
    s.commitTalk({ id: '없는 일' });
    expect(s.screen.value).toBe('trouble');
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('map');
    // 일을 하나도 마치지 못하고 또 멈춘다(화면을 그리다 멈춘 것도 같은 셈이다)
    s.noteTrouble();
    s.goHome();
    expect(s.screen.value).toBe('title');
    expect(s.loadStatus.value).toBe('yearLost');
    expect(s.canContinue.value).toBe(false);
    expect(env.data.has(BACKUP_KEY)).toBe(true);
  });

  it('멈춘 뒤에라도 일을 하나 마치면 다시 처음부터 센다', async () => {
    const s = await boot();
    startSpring(s);
    s.openTalk('없는 일');
    s.commitTalk({ id: '없는 일' });
    s.goHome();
    later();
    s.continueGame();
    const first = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, first);
    s.noteTrouble();
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    expect(s.loadStatus.value).not.toBe('yearLost');
  });

  it('이야기가 없어진 저장(다른 판의 것)은 이어 하기를 내놓지 않는다', async () => {
    let s = await boot();
    startSpring(s);
    const raw = saved()!;
    env.data.set(SAVE_KEY, JSON.stringify({ ...raw, current: { ...raw.current, situationId: 's0000' } }));
    s = await boot();
    expect(s.canContinue.value).toBe(false);
    later();
    s.continueGame();
    expect(s.screen.value).toBe('title');
  });

  it('코드보다 새 꼴의 저장은 건드리지 않는다', async () => {
    const raw = JSON.stringify({ schema: SCHEMA + 1, cards: ['미래'] });
    env.data.set(SAVE_KEY, raw);
    const s = await boot();
    expect(s.loadStatus.value).toBe('newer');
    expect(s.canContinue.value).toBe(false);
    expect(env.data.get(SAVE_KEY)).toBe(raw);
  });

  it('"모두 지우고 처음부터": 저장이 사라지고 이어 하기도 사라진다', async () => {
    let s = await boot();
    startSpring(s);
    doMusts(s);
    s.goHome();
    expect(s.canContinue.value).toBe(true);
    s.wipeAll();
    expect(env.data.size).toBe(0);
    expect(s.canContinue.value).toBe(false);
    expect(s.save.value.cards).toEqual([]);
    expect(s.screen.value).toBe('title');
    s = await boot();
    expect(s.loadStatus.value).toBe('empty');
    expect(s.canContinue.value).toBe(false);
  });
});

describe('엔진이 던져도 빈 화면에서 멈추지 않는다', () => {
  it('할 수 없는 일을 마치려 하면 "이어 갈 수 없어요"로 가고, 거기서 처음으로 갈 수 있다', async () => {
    const s = await boot();
    startSpring(s);
    const before = s.game.value;
    s.openTalk('없는 일');
    expect(s.commitTalk({ id: '없는 일' })).toBeNull();
    expect(s.screen.value).toBe('trouble');
    expect(s.talk.value).toBeNull();
    expect(s.game.value).toEqual(before);
    s.goHome();
    expect(s.screen.value).toBe('title');
    // 하던 해는 그대로 적혀 있어 이어 할 수 있다
    expect(s.canContinue.value).toBe(true);
  });

  it('잠긴 선택지를 넘겨도 판은 바뀌지 않는다', async () => {
    const s = await boot();
    startSpring(s);
    const view = openHappenings(PACK, s.game.value!).find((v) => v.must)!;
    const before = s.game.value;
    s.openTalk(view.happening.id);
    expect(s.commitTalk({ id: view.happening.id, choiceId: '없는 선택지' })).toBeNull();
    expect(s.screen.value).toBe('trouble');
    expect(s.game.value).toEqual(before);
    expect(saved()?.current?.done).toEqual([]);
  });
});

describe('주인공 그림의 이름', () => {
  it('농민·노비 집 아이는 모습이 붙고, 양반 집 아들·딸은 역할이 곧 모습이다', async () => {
    const s = await boot();
    expect(s.heroName('farmer', 'boy')).toBe('farmer-boy');
    expect(s.heroName('farmer', 'girl')).toBe('farmer-girl');
    expect(s.heroName('nobi', 'girl')).toBe('nobi-girl');
    expect(s.heroName('son', 'girl')).toBe('son');
    expect(s.heroName('daughter', 'boy')).toBe('daughter');
  });
});

// ── 저장 견본 만들기 ─────────────────────────────────────────────
// VITE_MAKE_SAVES=1 npx vitest run tests/store.test.ts 로 돌리면 이 판이 만든 저장을 tests/fixtures/saves/에 적는다.
// 저장의 꼴(schema)을 올릴 때는 옛 견본을 지우지 말고 새 번호의 견본을 더한다(옛 견본이 계속 읽히는지 tests/storage.test.ts가 본다).

describe.runIf(import.meta.env.VITE_MAKE_SAVES === '1')('저장 견본 만들기', () => {
  it(`꼴 ${SCHEMA}의 견본을 적는다`, async () => {
    // 파일을 쓰는 것은 이 시험뿐이다. 이름을 이어 붙여 불러온다(이 프로젝트에는 Node의 형 정의를 두지 않는다).
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
      mkdirSync(path: string, options: { recursive: boolean }): void;
      writeFileSync(path: string, text: string): void;
    };
    const dir = decodeURIComponent(new URL('./fixtures/saves/', import.meta.url).pathname);
    fs.mkdirSync(dir, { recursive: true });
    const walked = (n: number): string => packBits(Uint8Array.from({ length: 96 * 72 }, (_, i) => (i % 96 > 24 && i % 96 < 24 + n && Math.floor(i / 96) > 28 && Math.floor(i / 96) < 60 ? 1 : 0)));
    const write = (name: string): void => {
      const raw = env.data.get(SAVE_KEY)!;
      expect(parseSave(raw).status).toBe('ok');
      fs.writeFileSync(`${dir}${name}`, `${JSON.stringify(JSON.parse(raw), null, 1)}\n`);
    };
    const s = await boot();
    env.state.search = '?seed=1395';
    startSpring(s, 'girl');
    // 봄의 한가운데: 꼭 할 일 하나와 덤 하나를 하고, 우물가에 서 있다
    const must = openHappenings(PACK, s.game.value!).find((v) => v.must)!.happening.id;
    doOne(s, must);
    const extra = openHappenings(PACK, s.game.value!).find((v) => !v.must && !v.noSun)!.happening.id;
    doOne(s, extra);
    s.markPlace('46,34', ['village'], walked(20));
    s.saveNow();
    write(`schema${SCHEMA}-spring-mid.json`);
    // 미션을 푸는 일의 결과를 보는 중(종이가 아직 뜨지 않았다)
    for (let step = 0; step < 12; step++) {
      const g = s.game.value!;
      const next = openHappenings(PACK, g).find((v) => v.must && !v.noSun)!.happening.id;
      later();
      s.openTalk(next);
      const deed = s.commitTalk(inputFor(g, next))!;
      if (deed.solved.length > 0) {
        s.markPlace('44,57', ['village', 'fields'], walked(26));
        s.saveNow();
        write(`schema${SCHEMA}-spring-paper.json`);
        s.closeTalk();
        while (s.missionQueue.value.length > 0) {
          later();
          s.closeMissionDone();
        }
        break;
      }
      s.closeTalk();
    }
    // 봄을 보낸 바로 뒤(계절 닫기 화면)
    doMusts(s);
    s.markPlace('44,54', ['village', 'fields'], walked(30));
    later();
    s.closeSeasonNow();
    write(`schema${SCHEMA}-spring-closed.json`);
    // 여름으로 넘어간 뒤(여름이 아직 없어 "다음에 만들어요")
    later();
    s.goNextSeason();
    s.markPlace('44,54', ['village', 'fields'], walked(30));
    s.saveNow();
    write(`schema${SCHEMA}-spring-over.json`);
  });
});
